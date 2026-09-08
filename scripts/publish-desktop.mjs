import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateDelivery, githubAssetName } from './release-validation.mjs';

const { RELEASE_TAG: tag, BUILD_RUN_ID: runId, PUBLISH_CONFIRMATION: confirmation, GITHUB_REPOSITORY: repo } = process.env;
if (confirmation !== 'PUBLISH' || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag || '') || !/^\d+$/.test(runId || '') || !repo) {
  throw new Error('Publishing requires an explicit PUBLISH confirmation, version tag, build run ID and repository.');
}
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const gh = (...args) => run('gh', args);
const json = (...args) => JSON.parse(gh(...args));
const pkg = JSON.parse(fs.readFileSync('package.json'));
const commit = run('git', ['rev-parse', 'HEAD']).trim();
const sourceFiles = run('git', ['ls-files', '-z']).split('\0').filter(Boolean).sort();
const sourceSha256 = createHash('sha256').update(JSON.stringify(Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])))).digest('hex');
if (tag !== `v${pkg.version}` || run('git', ['rev-parse', `${tag}^{commit}`]).trim() !== commit || run('git', ['status', '--porcelain']).trim()) throw new Error('Publishing requires a clean checkout of the exact version tag.');
const workflow = json('api', `repos/${repo}/actions/runs/${runId}`);
if (workflow.conclusion !== 'success' || workflow.event !== 'workflow_dispatch' || workflow.path !== '.github/workflows/release-desktop.yml' || workflow.repository?.full_name !== repo) throw new Error('Run must be a successful desktop build in this repository.');
const notesFile = path.resolve('docs/releases', `${pkg.version}.md`);
if (!fs.existsSync(notesFile)) throw new Error('Version-specific release notes are missing.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jcard-publish-'));
try {
  const deliveries = [];
  for (const target of ['mac-arm64', 'win-x64']) {
    const directory = path.join(temp, target);
    gh('run', 'download', runId, '--repo', repo, '--name', `desktop-${target}`, '--dir', directory);
    // upload-artifact may preserve the build directory; find exactly one manifest.
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const manifests = walk(directory).filter(file => path.basename(file) === 'build-record.json');
    if (manifests.length !== 1) throw new Error(`Expected one manifest for ${target}`);
    const record = JSON.parse(fs.readFileSync(manifests[0]));
    if (record.sourceSha256 !== sourceSha256 || record.ci?.runId !== runId || record.ci?.repository !== repo) throw new Error('Artifact source or workflow provenance mismatch');
    const artifact = validateDelivery(record, { version: pkg.version, commit, target, productName: pkg.build.productName }, path.dirname(manifests[0]));
    deliveries.push({ record, artifact, directory: path.dirname(manifests[0]), manifest: manifests[0] });
  }
  if (deliveries[0].record.sourceSha256 !== deliveries[1].record.sourceSha256) throw new Error('Platform builds used different source content.');
  // A moved tag must not associate old artifacts with a different commit.
  const remoteCommit = run('git', ['ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`]).trim().split('\n').filter(Boolean).at(-1)?.split(/\s+/)[0];
  if (remoteCommit !== commit) throw new Error('Remote tag no longer matches the verified source.');
  const releases = json('api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`).flat();
  const existing = releases.find(release => release.tag_name === tag);
  if (existing && (!existing.draft || existing.assets.length)) throw new Error('Refusing to alter a public release or overwrite existing draft assets. Use a new release or review the existing draft first.');
  if (!existing) gh('release', 'create', tag, '--repo', repo, '--verify-tag', '--draft', '--title', `${pkg.build.productName} ${pkg.version}`, '--notes-file', notesFile);
  else gh('release', 'edit', tag, '--repo', repo, '--title', `${pkg.build.productName} ${pkg.version}`, '--notes-file', notesFile);
  for (const delivery of deliveries) {
    const file = path.join(delivery.directory, delivery.artifact.name);
    const manifest = path.join(temp, `build-record-${delivery.record.target}.json`);
    fs.copyFileSync(delivery.manifest, manifest);
    gh('release', 'upload', tag, '--repo', repo, file, `${file}.sha256`, manifest);
  }
  const remote = path.join(temp, 'remote');
  gh('release', 'download', tag, '--repo', repo, '--dir', remote);
  for (const delivery of deliveries) {
    const downloadedRecord = JSON.parse(fs.readFileSync(path.join(remote, `build-record-${delivery.record.target}.json`)));
    validateDelivery(downloadedRecord, { version: pkg.version, commit, target: delivery.record.target, productName: pkg.build.productName, github: true }, remote);
    for (const name of [delivery.artifact.name, `${delivery.artifact.name}.sha256`]) {
      const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (digest(path.join(remote, githubAssetName(name))) !== digest(path.join(delivery.directory, name))) throw new Error(`Uploaded content mismatch: ${name}`);
    }
    if (JSON.stringify(downloadedRecord) !== JSON.stringify(delivery.record)) throw new Error('Uploaded manifest mismatch');
  }
  const state = json('release', 'view', tag, '--repo', repo, '--json', 'isDraft');
  if (!state.isDraft) throw new Error('Release state changed before publication');
  gh('release', 'edit', tag, '--repo', repo, '--draft=false');
  console.log(gh('release', 'view', tag, '--repo', repo, '--json', 'url,isDraft,tagName'));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
