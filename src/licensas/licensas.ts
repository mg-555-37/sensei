// SPDX-License-Identifier: MIT

export interface ScanOptions {
  root?: string;
  includeDev?: boolean;
}

export interface PackageInfo {
  name: string;
  version: string;
  license: string;
  repository: string | null;
  private: boolean;
  licenseFile: string | null;
  licenseText: string | null;
  path: string;
}

export interface ScanResult {
  generatedAt: string;
  totalPackages: number;
  totalFiltered: number;
  licenseCounts: Record<string, number>;
  packages: PackageInfo[];
  problematic: PackageInfo[];
}
export function scanCommand(arg0: { root: string; }) {
  throw new Error('Function not implemented.');
}

export function generateNotices(arg0: { root: string; ptBr: boolean; output: string | undefined; }) {
  throw new Error('Function not implemented.');
}

export function addDisclaimer(arg0: { root: string; disclaimerPath: string | undefined; dryRun: boolean; }) {
  throw new Error('Function not implemented.');
}

export function verifyDisclaimer(arg0: { root: string; disclaimerPath: string | undefined; }) {
  throw new Error('Function not implemented.');
}

