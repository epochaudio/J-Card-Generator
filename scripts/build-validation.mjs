import path from 'node:path';
import { createHash } from 'node:crypto';
const MACH_O_64_LE = 0xfeedfacf;
const MACH_CPU_ARM64 = 0x0100000c;
const DOS_HEADER_BYTES = 64;
const PE_OFFSET_FIELD = 0x3c;
const PE_SIGNATURE = 0x00004550;
const PE_MACHINE_X64 = 0x8664;

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
