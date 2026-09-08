import test from 'node:test';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertVersions, verifyArchitecture, verifyPackagedResources } from '../scripts/build-validation.mjs';
import { validateDelivery } from '../scripts/release-validation.mjs';

test('packaging rejects inconsistent package and lock versions', () => {
  const pkg = { version: '1.6.0' };
  assert.doesNotThrow(() => assertVersions(pkg, { version: '1.6.0', packages: { '': pkg } }));
  assert.throws(() => assertVersions(pkg, { version: '1.5.8', packages: { '': pkg } }));
  assert.throws(() => assertVersions(pkg, { version: '1.6.0', packages: { '': { version: '1.5.8' } } }));
});

test('architecture checks reject truncated binaries and the wrong platform', () => {
  const mac = Buffer.alloc(8); mac.writeUInt32LE(0xfeedfacf); mac.writeUInt32LE(0x0100000c, 4);
  assert.doesNotThrow(() => verifyArchitecture(mac, 'arm64'));
  assert.throws(() => verifyArchitecture(mac, 'x64'));
  const win = Buffer.alloc(128); win.write('MZ'); win.writeUInt32LE(64, 0x3c); win.writeUInt32LE(0x4550, 64); win.writeUInt16LE(0x8664, 68);
  assert.doesNotThrow(() => verifyArchitecture(win, 'x64'));
  win.writeUInt16LE(0x14c, 68);
  assert.throws(() => verifyArchitecture(win, 'x64'));
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(4), Buffer.from('MZ')]) assert.throws(() => verifyArchitecture(bytes, 'x64'));
});

test('release validation fails closed on wrong commit, dirty source, missing checks and tampering', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcard-delivery-test-'));
  try {
    const expected = { version: '1.6.0', commit: 'abc123', target: 'win-x64', productName: 'Tape Cover Generator' };
    const name = 'Tape Cover Generator Setup 1.6.0-x64.exe';
    const data = Buffer.from('test installer');
    const sha256 = createHash('sha256').update(data).digest('hex');
    fs.writeFileSync(path.join(dir, name), data);
    fs.writeFileSync(path.join(dir, `${name}.sha256`), `${sha256}  ${name}\n`);
    const record = { schemaVersion: 1, version: expected.version, commit: expected.commit, target: expected.target, dirty: false, completedAt: new Date().toISOString(), sourceSha256: sha256, checks: ['automated-tests', 'font-assets', 'production-build', 'source-unchanged', 'packaged-resources'], artifacts: [{ name, platform: 'win32', architecture: 'x64', sha256, bytes: data.length, checks: ['nsis-integrity', 'extracted-resources', 'version', 'x64'] }] };
    assert.equal(validateDelivery(record, expected, dir).name, name);
    for (const change of [{ dirty: true }, { commit: 'other' }, { checks: [] }, { target: 'mac-arm64' }]) assert.throws(() => validateDelivery({ ...record, ...change }, expected, dir));
    const missing = structuredClone(record); missing.artifacts[0].checks = [];
    assert.throws(() => validateDelivery(missing, expected, dir));
    fs.writeFileSync(path.join(dir, name), 'tampered');
    assert.throws(() => validateDelivery(record, expected, dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('release validation verifies Mac checks and rejects a changed checksum sidecar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcard-mac-delivery-test-'));
  try {
    const expected = { version: '1.6.0', commit: 'abc123', target: 'mac-arm64', productName: 'Tape Cover Generator' };
    const name = 'Tape Cover Generator-1.6.0-arm64-mac.dmg';
    const data = Buffer.from('test dmg');
    const sha256 = createHash('sha256').update(data).digest('hex');
    fs.writeFileSync(path.join(dir, name), data);
    fs.writeFileSync(path.join(dir, `${name}.sha256`), `${sha256}  ${name}\n`);
    const record = { schemaVersion: 1, version: expected.version, commit: expected.commit, target: expected.target, dirty: false, completedAt: new Date().toISOString(), sourceSha256: sha256, checks: ['automated-tests', 'font-assets', 'production-build', 'source-unchanged', 'packaged-resources'], artifacts: [{ name, platform: 'darwin', architecture: 'arm64', sha256, bytes: data.length, checks: ['dmg-integrity', 'mounted-resources', 'version', 'arm64', 'ad-hoc-signature'] }] };
    assert.equal(validateDelivery(record, expected, dir).name, name);
    fs.writeFileSync(path.join(dir, `${name}.sha256`), `${sha256}  wrong.dmg\n`);
    assert.throws(() => validateDelivery(record, expected, dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('publish command refuses to run without explicit confirmation before accessing GitHub', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, ['scripts/publish-desktop.mjs'], { encoding: 'utf8', env: { ...process.env, PUBLISH_CONFIRMATION: '', GH_TOKEN: '' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Publishing requires an explicit PUBLISH confirmation/);
});


test('packaged resources use native ASAR paths and reject missing or changed nested files', async () => {
  const asar = createRequire(import.meta.url)('@electron/asar');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcard-asar-test-'));
  const source = path.join(dir, 'source'), archive = path.join(dir, 'app.asar');
  try {
    fs.mkdirSync(path.join(source, 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ version: '1.6.1' }));
    const name = 'dist/assets/font.ttf', bytes = Buffer.from('fixture font bytes');
    fs.writeFileSync(path.join(source, name), bytes);
    await asar.createPackage(source, archive);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const expected = new Map([[name, digest]]);
    assert.doesNotThrow(() => verifyPackagedResources(asar, archive, '1.6.1', expected));
    assert.throws(() => verifyPackagedResources(asar, archive, '1.6.0', expected), /version mismatch/);
    assert.throws(() => verifyPackagedResources(asar, archive, '1.6.1', new Map([[name, 'wrong']])) , /resource mismatch/);
    assert.throws(() => verifyPackagedResources(asar, archive, '1.6.1', new Map([['dist/assets/missing.ttf', digest]])), /not found/);
  } finally { asar.uncache(archive); fs.rmSync(dir, { recursive: true, force: true }); }
});
