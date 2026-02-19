import { promises as fs } from 'node:fs';
import path from 'node:path';
export async function aplicarFixAliasImports(fileCaminho: string, content: string): Promise<{
  changed: boolean;
  content: string;
}> {
  if (!fileCaminho.endsWith('.ts')) return {
    changed: false,
    content
  };
  const out = content.replace(/@types\/types\.js\b/g, 'types');
  return {
    changed: out !== content,
    content: out
  };
}
export async function scanAndApplyFix(root: string): Promise<number> {
  let changed = 0;
  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, {
        withFileTypes: true
      });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fileCaminho = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fileCaminho);
      } else if (entry.isFile() && fileCaminho.endsWith('.ts')) {
        const src = await fs.readFile(fileCaminho, 'utf8');
        const {
          changed: wasChanged,
          content
        } = await aplicarFixAliasImports(fileCaminho, src);
        if (wasChanged) {
          await fs.writeFile(fileCaminho, content, 'utf8');
          changed++;
        }
      }
    }
  }
  await walk(path.join(root, 'src'));
  await walk(path.join(root, 'tests'));
  return changed;
}