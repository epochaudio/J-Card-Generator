import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { assertVersions, verifyArchitecture } from './build-validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const require = createRequire(import.meta.url);
const target = process.argv[2];
if (!['all', 'mac-arm64', 'win-x64'].includes(target) || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/build-desktop.mjs all|mac-arm64|win-x64');
}
if (target !== 'win-x64' && process.platform !== 'darwin') throw new Error('macOS packaging requires macOS.');
const pkg = JSON.parse(fs.readFileSync('package.json'));
const lockfile = JSON.parse(fs.readFileSync('package-lock.json'));
assertVersions(pkg, lockfile);
for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
  const installed = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', dependency, 'package.json'))).version;
  if (installed !== lockfile.packages?.[`node_modules/${dependency}`]?.version) throw new Error(`Installed ${dependency} differs from lockfile; run npm ci.`);
}
const asar = require('@electron/asar');
const sevenZip = require('7zip-bin').path7za;
const builder = require.resolve('electron-builder/cli.js');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script through the documented npm commands.');
const run = (command, args, capture = false) => execFileSync(command, args, {
  cwd: root, stdio: capture ? 'pipe' : 'inherit', encoding: capture ? 'utf8' : undefined,
  maxBuffer: 32 * 1024 * 1024,
});
const npm = (...args) => run(process.execPath, [npmCli, ...args]);
const hash = data => createHash('sha256').update(data).digest('hex');
const fileHash = file => hash(fs.readFileSync(file));
const git = (...args) => run('git', args, true).trim();
const sourceFiles = () => [...new Set(run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], true).split('\0').filter(Boolean))].sort();
const snapshot = () => Object.fromEntries(sourceFiles().map(file => [file, fs.existsSync(file) ? fileHash(file) : null]));
const commit = git('rev-parse', 'HEAD');
const status = git('status', '--porcelain');
if (process.env.CI && status) throw new Error('CI requires a clean source checkout.');
if (process.env.RELEASE_TAG) {
  if (process.env.RELEASE_TAG !== `v${pkg.version}` || git('rev-parse', `${process.env.RELEASE_TAG}^{commit}`) !== commit) {
    throw new Error('Release tag, package version and checked-out commit must agree.');
  }
}
const outputRoot = path.join(root, 'dist_electron_builds');
fs.mkdirSync(outputRoot, { recursive: true });
const buildLock = path.join(outputRoot, '.build-lock');
try { fs.mkdirSync(buildLock); } catch { throw new Error(`Another build may be running. Check before removing ${buildLock}`); }
let temp;
let mounted = false;
try {
  temp = fs.mkdtempSync(path.join(outputRoot, '.pending-'));
  const deliver = path.join(temp, 'deliver');
  fs.mkdirSync(deliver);
  const source = snapshot();
  const sourceSha256 = hash(JSON.stringify(source));
  const record = {
    schemaVersion: 1, version: pkg.version, commit, dirty: Boolean(status), sourceSha256,
    sourceFiles: source, ci: { runId: process.env.GITHUB_RUN_ID || null, repository: process.env.GITHUB_REPOSITORY || null }, startedAt: new Date().toISOString(), target,
    tools: { node: process.version, npm: run(process.execPath, [npmCli, '--version'], true).trim(),
      electron: require('electron/package.json').version, builder: require('electron-builder/package.json').version },
    host: { platform: process.platform, arch: process.arch, release: os.release() },
    checks: [], artifacts: [], limitations: ['No Windows installation smoke test or physical print test.', 'macOS ad-hoc signature without notarization; Windows unsigned.'],
  };
  npm('test');
  record.checks.push('automated-tests');
  npm('run', 'build');
  record.checks.push('font-assets', 'production-build');
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(name) : [name];
  });
  const expected = new Map();
  for (const entry of pkg.build.files) {
    if (entry.endsWith('/**/*')) {
      for (const file of walk(entry.slice(0, -5))) expected.set(file.split(path.sep).join('/'), fileHash(file));
    } else if (!entry.includes('*')) expected.set(entry, fileHash(entry));
    else throw new Error(`Unsupported package file pattern: ${entry}`);
  }
  function verifyAsar(archive) {
    if (JSON.parse(asar.extractFile(archive, 'package.json')).version !== pkg.version) throw new Error('Packaged version mismatch');
    for (const [name, digest] of expected) {
      if (hash(asar.extractFile(archive, name)) !== digest) throw new Error(`Packaged resource mismatch: ${name}`);
    }
  }
  function artifact(file, platform, architecture, checks) {
    const name = path.basename(file);
    const sha256 = fileHash(file);
    fs.writeFileSync(`${file}.sha256`, `${sha256}  ${name}\n`);
    record.artifacts.push({ name, platform, architecture, bytes: fs.statSync(file).size, sha256, checks });
  }
  if (target !== 'win-x64') {
    const raw = path.join(temp, 'mac');
    run(process.execPath, [builder, '--mac', 'dir', '--arm64', '--publish', 'never', `-c.directories.output=${raw}`]);
    const app = path.join(raw, 'mac-arm64', `${pkg.build.productName}.app`);
    run('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app]);
    run('codesign', ['--verify', '--deep', '--strict', app]);
    const staging = path.join(temp, 'staging');
    fs.mkdirSync(staging);
    run('ditto', [app, path.join(staging, path.basename(app))]);
    fs.symlinkSync('/Applications', path.join(staging, 'Applications'));
    const dmg = path.join(deliver, `${pkg.build.productName}-${pkg.version}-arm64-mac.dmg`);
    run('hdiutil', ['create', '-volname', pkg.build.productName, '-srcfolder', staging, '-format', 'UDZO', dmg]);
    run('hdiutil', ['verify', dmg]);
    const mount = path.join(temp, 'mount');
    fs.mkdirSync(mount);
    run('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg]);
    mounted = true;
    try {
      const installed = path.join(mount, `${pkg.build.productName}.app`);
      run('codesign', ['--verify', '--deep', '--strict', installed]);
      const plist = path.join(installed, 'Contents/Info.plist');
      const version = run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', plist], true).trim();
      if (version !== pkg.version) throw new Error('DMG application version mismatch');
      const executable = run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', plist], true).trim();
      verifyArchitecture(fs.readFileSync(path.join(installed, 'Contents/MacOS', executable)), 'arm64');
      verifyAsar(path.join(installed, 'Contents/Resources/app.asar'));
    } finally { run('hdiutil', ['detach', mount]); mounted = false; }
    artifact(dmg, 'darwin', 'arm64', ['dmg-integrity', 'mounted-resources', 'version', 'arm64', 'ad-hoc-signature']);
  }
  if (target !== 'mac-arm64') {
    const raw = path.join(temp, 'win');
    run(process.execPath, [builder, '--win', 'nsis', '--x64', '--publish', 'never', '--config.win.signAndEditExecutable=false', `-c.directories.output=${raw}`]);
    const name = `${pkg.build.productName} Setup ${pkg.version}-x64.exe`;
    const installer = path.join(raw, name);
    run(sevenZip, ['t', installer]);
    const extracted = path.join(temp, 'extracted');
    run(sevenZip, ['x', '-y', `-o${extracted}`, installer]);
    const archives = walk(extracted).filter(file => path.basename(file) === 'app.asar');
    if (archives.length !== 1) throw new Error('Installer must contain exactly one app.asar');
    verifyAsar(archives[0]);
    const executable = path.join(path.dirname(path.dirname(archives[0])), `${pkg.build.productName}.exe`);
    verifyArchitecture(fs.readFileSync(executable), 'x64');
    const dest = path.join(deliver, name);
    fs.copyFileSync(installer, dest);
    artifact(dest, 'win32', 'x64', ['nsis-integrity', 'extracted-resources', 'version', 'x64']);
  }
  if (hash(JSON.stringify(snapshot())) !== sourceSha256 || git('rev-parse', 'HEAD') !== commit) throw new Error('Source changed during build; outputs will not be delivered.');
  record.completedAt = new Date().toISOString();
  record.checks.push('source-unchanged', 'packaged-resources');
  fs.writeFileSync(path.join(deliver, 'build-record.json'), `${JSON.stringify(record, null, 2)}\n`);
  const id = `${pkg.version}-${target}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const finalDir = path.join(outputRoot, id);
  fs.renameSync(deliver, finalDir);
  console.log(`Verified build: ${finalDir}`);
} finally {
  if (temp && !mounted) fs.rmSync(temp, { recursive: true, force: true });
  if (mounted) console.error(`Image could not be detached; temporary files retained for manual recovery: ${temp}`);
  fs.rmdirSync(buildLock);
}
