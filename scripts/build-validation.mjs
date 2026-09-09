import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const HASH_CHUNK_BYTES = 1024 * 1024;
const MACH_O_64_LE = 0xfeedfacf;
const MACH_CPU_ARM64 = 0x0100000c;
const DOS_HEADER_BYTES = 64;
const PE_OFFSET_FIELD = 0x3c;
const PE_SIGNATURE = 0x00004550;
const PE_MACHINE_X64 = 0x8664;

// Hash installers and embedded-font samples without loading the whole file into memory.
export function fileSha256(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const hash = createHash('sha256');
    const chunk = Buffer.allocUnsafe(HASH_CHUNK_BYTES);
    let bytes;
    while ((bytes = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, bytes));
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}

export function assertRuntimeVersion(versions, expected) {
  if (versions?.electron !== expected || !/^\d+\.\d+\.\d+\.\d+$/.test(versions?.chrome || '')) {
    throw new Error('Packaged Electron/Chromium runtime version mismatch');
  }
}

// VS_FIXEDFILEINFO stores four numeric product-version components in the PE resource.
export function verifyWindowsRuntime(buffer, expected) {
  verifyArchitecture(buffer, 'x64');
  const range = (offset, size) => {
    if (!Number.isInteger(offset) || offset < 0 || offset + size > buffer.length) throw new Error('Truncated Windows version resource');
    return offset;
  };
  const pe = buffer.readUInt32LE(PE_OFFSET_FIELD), optional = pe + 24;
  range(optional, 136);
  if (buffer.readUInt16LE(optional) !== 0x20b) throw new Error('Expected PE32+ optional header');
  const sectionCount = buffer.readUInt16LE(pe + 6);
  const sections = optional + buffer.readUInt16LE(pe + 20);
  const rvaToOffset = (rva, size) => {
    for (let i = 0; i < sectionCount; i++) {
      const section = range(sections + i * 40, 40);
      const start = buffer.readUInt32LE(section + 12), rawSize = buffer.readUInt32LE(section + 16);
      if (rva >= start && rva + size <= start + rawSize) return range(buffer.readUInt32LE(section + 20) + rva - start, size);
    }
    throw new Error('Windows version resource RVA is not mapped');
  };
  // PE32+ data-directory index 2 is the resource directory; RT_VERSION is type 16.
  const resourceSize = buffer.readUInt32LE(optional + 132);
  const base = rvaToOffset(buffer.readUInt32LE(optional + 128), resourceSize);
  const resourceOffset = (relative, size) => {
    if (relative + size > resourceSize) throw new Error('Windows version resource exceeds directory');
    return range(base + relative, size);
  };
  const entries = relative => {
    const dir = resourceOffset(relative, 16);
    const count = buffer.readUInt16LE(dir + 12) + buffer.readUInt16LE(dir + 14);
    return Array.from({ length: count }, (_, i) => {
      const entry = resourceOffset(relative + 16 + i * 8, 8);
      return { name: buffer.readUInt32LE(entry), target: buffer.readUInt32LE(entry + 4) };
    });
  };
  const matches = [];
  const visit = (target, depth) => {
    if (target & 0x80000000) {
      if (depth > 2) throw new Error('Invalid Windows version resource depth');
      for (const entry of entries(target & 0x7fffffff)) visit(entry.target, depth + 1);
      return;
    }
    const data = resourceOffset(target, 16), size = buffer.readUInt32LE(data + 4);
    const value = buffer.subarray(rvaToOffset(buffer.readUInt32LE(data), size), rvaToOffset(buffer.readUInt32LE(data), size) + size);
    const key = Buffer.from('VS_VERSION_INFO\0', 'utf16le');
    const fixed = Math.ceil((6 + key.length) / 4) * 4;
    if (value.length < fixed + 52 || !value.subarray(6, 6 + key.length).equals(key) || value.readUInt32LE(fixed) !== 0xfeef04bd) throw new Error('Invalid VS_VERSION_INFO');
    const majorMinor = value.readUInt32LE(fixed + 16), patchBuild = value.readUInt32LE(fixed + 20);
    matches.push([majorMinor >>> 16, majorMinor & 0xffff, patchBuild >>> 16, patchBuild & 0xffff].join('.'));
  };
  for (const entry of entries(0).filter(entry => entry.name === 16)) visit(entry.target, 0);
  if (!matches.length || matches.some(version => version !== `${expected}.0`)) throw new Error(`Windows Electron runtime version mismatch: ${matches.join(', ') || 'missing'}`);
  return matches[0];
}

export function assertVersions(pkg, lock) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) throw new Error('Invalid application version');
  if (pkg.version !== lock.version || pkg.version !== lock.packages?.['']?.version) throw new Error('package.json and package-lock.json versions differ');
}

export function verifyArchitecture(buffer, architecture) {
  if (architecture === 'arm64') {
    if (buffer.length >= 8 && buffer.readUInt32LE(0) === MACH_O_64_LE && buffer.readUInt32LE(4) === MACH_CPU_ARM64) return;
  } else if (architecture === 'x64' && buffer.length >= DOS_HEADER_BYTES && buffer.toString('ascii', 0, 2) === 'MZ') {
    const offset = buffer.readUInt32LE(PE_OFFSET_FIELD);
    if (offset + 6 <= buffer.length && buffer.readUInt32LE(offset) === PE_SIGNATURE && buffer.readUInt16LE(offset + 4) === PE_MACHINE_X64) return;
  }
  throw new Error(`Application binary is not ${architecture}`);
}


export function verifyPackagedResources(asar, archive, version, expected) {
  if (JSON.parse(asar.extractFile(archive, 'package.json')).version !== version) throw new Error('Packaged version mismatch');
  for (const [name, digest] of expected) {
    // ASAR traverses directories using the host separator, while manifest names use '/'.
    const bytes = asar.extractFile(archive, path.normalize(name));
    if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error(`Packaged resource mismatch: ${name}`);
  }
}
