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

export interface DisclaimerAddResult {
  updatedFiles: string[];
}

export interface DisclaimerVerifyResult {
  missing: string[];
}

export function scanCommand(arg0: { root: string }): Promise<ScanResult> {
  throw new Error('Function not implemented.');
}

export function generateNotices(arg0: { root: string; ptBr: boolean; output: string | undefined }): Promise<unknown> {
  throw new Error('Function not implemented.');
}

export function addDisclaimer(arg0: { root: string; disclaimerPath: string | undefined; dryRun: boolean }): Promise<DisclaimerAddResult> {
  throw new Error('Function not implemented.');
}

export function verifyDisclaimer(arg0: { root: string; disclaimerPath: string | undefined }): Promise<DisclaimerVerifyResult> {
  throw new Error('Function not implemented.');
}