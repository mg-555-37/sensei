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
  licenseArquivo: string | null;
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
export interface DisclaimerAddResult {
  updatedArquivos: string[];
}
export interface DisclaimerVerifyResult {
  missing: string[];
}

// Re-export real implementations from sibling modules
export { addDisclaimer, verifyDisclaimer } from './disclaimer.js';
export { generateNotices } from './generate-notices.js';
export { scanCommand } from './scanner.js';