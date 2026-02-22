// SPDX-License-Identifier: MIT

import * as fs from 'fs';
import * as path from 'path';

const DIRS_IGNORADOS = new Set(['node_modules', 'dist', 'names', '.git', '.sensei']);

/**
 * Lista arquivos .ts e .js recursivamente sob `dir`, ignorando pastas comuns.
 */
export function getSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      if (DIRS_IGNORADOS.has(item.name)) continue;
      files.push(...getSourceFiles(path.join(dir, item.name)));
    } else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) {
      files.push(path.join(dir, item.name));
    }
  }
  return files;
}

/**
 * Lista todos os arquivos com extensão `ext` (ex: ".txt") recursivamente sob `dir`.
 */
export function getFilesWithExtension(dir: string, ext: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      files.push(...getFilesWithExtension(path.join(dir, item.name), ext));
    } else if (item.name.endsWith(ext)) {
      files.push(path.join(dir, item.name));
    }
  }
  return files;
}
