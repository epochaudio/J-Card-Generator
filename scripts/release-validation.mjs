import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function validateDelivery(record, expected, directory) {
  const { version, commit, target, productName } = expected;
  if (record.schemaVersion !== 1 || record.version !== version || record.commit !== commit || record.target !== target || record.dirty !== false || !record.completedAt || !/^[a-f0-9]{64}$/.test(record.sourceSha256)) throw new Error('Build provenance mismatch');
  for (const check of ['automated-tests', 'font-assets', 'production-build', 'source-unchanged', 'packaged-resources']) {
    if (!record.checks?.includes(check)) throw new Error(`Missing build check: ${check}`);
  }
  const isMac = target === 'mac-arm64';
  if (!isMac && target !== 'win-x64') throw new Error('Unsupported delivery target');
  const name = isMac ? `${productName}-${version}-arm64-mac.dmg` : `${productName} Setup ${version}-x64.exe`;
  const artifact = record.artifacts?.[0];
  if (record.artifacts?.length !== 1 || artifact.name !== name || artifact.platform !== (isMac ? 'darwin' : 'win32') || artifact.architecture !== (isMac ? 'arm64' : 'x64')) throw new Error('Artifact identity mismatch');
  const required = isMac ? ['dmg-integrity', 'mounted-resources', 'version', 'arm64', 'ad-hoc-signature'] : ['nsis-integrity', 'extracted-resources', 'version', 'x64'];
  for (const check of required) if (!artifact.checks?.includes(check)) throw new Error(`Missing installer check: ${check}`);
  const file = path.join(directory, name);
  const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (digest !== artifact.sha256 || fs.statSync(file).size !== artifact.bytes || fs.readFileSync(`${file}.sha256`, 'utf8') !== `${digest}  ${name}\n`) throw new Error('Artifact size or checksum mismatch');
  return artifact;
}
