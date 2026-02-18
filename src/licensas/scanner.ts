// SPDX-License-Identifier: MIT
import path from 'node:path';

import { exists, findLicenseFile,readPackageJsonSync } from './fs-utils.js';
import type { ScanOptions,ScanResult } from './licensas.js';
import { normalizeLicense } from './normalizer.js';

export async function scan({ root = process.cwd(), includeDev = false } = {} as ScanOptions): Promise<ScanResult> {
  const nmDir = path.join(root, 'node_modules');
  const result: ScanResult = {
    generatedAt: new Date().toISOString(),
    totalPackages: 0,
    totalFiltered: 0,
    licenseCounts: {},
    packages: [],
    problematic: [],
  };

  if (!exists(nmDir)) {
    return result;
  }

  const entries: string[] = [];
  try {
    const dirEntries = await fsReaddir(nmDir);
    for (const e of dirEntries) entries.push(e);
  } catch (err) {
    try {
      const syncNames = require('node:fs').readdirSync(nmDir, { withFileTypes: true });
      for (const d of syncNames) entries.push(d.name);
    } catch {
      return result;
    }
  }

  for (const entryName of entries) {
    if (entryName === '.bin') continue;
    const full = path.join(nmDir, entryName);
    if (entryName.startsWith('@')) {
      try {
        const scoped = await fsReaddir(full);
        for (const s of scoped) {
          const p = path.join(full, s);
          if (await fsStatIsDir(p)) await processPackage(p, result);
        }
      } catch {
        // ignore
      }
    } else {
      if (await fsStatIsDir(full)) await processPackage(full, result);
    }
  }

  // Removido `: unknown` — result.packages já é tipado, inferência funciona corretamente
  const filtered = result.packages.filter((p) => !p.name.startsWith('@types/'));
  result.totalPackages = result.packages.length;
  result.totalFiltered = filtered.length;

  for (const p of filtered) result.licenseCounts[p.license] = (result.licenseCounts[p.license] || 0) + 1;

  return result;

  async function processPackage(pkgDir: string, resObj: ScanResult) {
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!exists(pkgJsonPath)) return;
    const data = readPackageJsonSync(pkgJsonPath);
    if (!data) return;
    const name = data.name || path.basename(pkgDir);
    const version = data.version || '0.0.0';
    const rawLicense = data.license || data.licenses || null;
    const licenseValue = await normalizeLicense(rawLicense || 'UNKNOWN');
    const licenseFile = findLicenseFile(pkgDir);
    resObj.packages.push({
      name,
      version,
      license: licenseValue,
      repository:
        (data.repository && (typeof data.repository === 'string' ? data.repository : data.repository.url)) || null,
      private: !!data.private,
      licenseFile: licenseFile ? licenseFile.file : null,
      licenseText: licenseFile ? licenseFile.text : null,
      path: pkgDir,
    });
  }
}

export async function fsReaddir(p: string): Promise<string[]> {
  const fs = await import('node:fs');
  return fs.promises.readdir(p, { withFileTypes: false }).catch(() => []);
}

async function fsStatIsDir(p: string): Promise<boolean> {
  const fs = await import('node:fs');
  try {
    const stat = await fs.promises.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function scanCommand(opts: ScanOptions = {}): Promise<ScanResult> {
  const res = await scan(opts);
  // Removido `: unknown` e `as unknown` — res.packages já é tipado corretamente
  const problematic = res.packages.filter((p) => p.license === 'UNKNOWN');
  res.problematic = problematic;
  return res;
}