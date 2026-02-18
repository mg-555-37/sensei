// SPDX-License-Identifier: MIT
import { execFile as _execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface DisclaimerOptions {
  root?: string;
  disclaimerPath?: string;
  dryRun?: boolean;
}

function execFileAsync(cmd: string, args: string[], opts: Record<string, unknown> = {}): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    _execFile(cmd, args, { shell: false, ...opts }, (err: Error | null, stdout: unknown, stderr: unknown) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

const defaultDisclaimerPath = 'docs/partials/AVISO-PROVENIENCIA.md';
const marker = /Proveni[eê]ncia e Autoria/i;

async function listMarkdown(root: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '*.md'], { cwd: root });
    return stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    const out: string[] = [];
    async function walk(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (/^(node_modules|dist|\.git|pre-public|preview-oraculo|coverage|relatorios|\.oraculo)$/i.test(e.name)) continue;
          out.push(...(await walk(p)));
        } else if (/\.md$/i.test(e.name)) {
          out.push(path.relative(root, p));
        }
      }
      return out;
    }
    return walk(root);
  }
}

export async function addDisclaimer({ root = process.cwd(), disclaimerPath = defaultDisclaimerPath, dryRun = false }:
  DisclaimerOptions = {}): Promise<{updatedFiles: string[]}> {
  const absDisclaimer = path.join(root, disclaimerPath);
  await fs.access(absDisclaimer).catch(() => { throw new Error(`Disclaimer not found: ${disclaimerPath}`); });
  const disclaimerText = await fs.readFile(absDisclaimer, 'utf8');

  const files = (await listMarkdown(root))
    .filter((f) => f !== disclaimerPath && !f.startsWith('pre-public/'))
    .filter((f) => !f.startsWith('.abandonados/') && !f.startsWith('.deprecados/') && !f.startsWith('coverage/') && !f.startsWith('relatorios/'));

  const updatedFiles: string[] = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    try {
      await fs.access(abs);
    } catch {
      continue;
    }
    const content = await fs.readFile(abs, 'utf8');
    const head = content.split('\n').slice(0, 30).join('\n');
    if (marker.test(head)) continue;

    const updated = `${disclaimerText}\n\n${content.trimStart()}\n`;
    if (!dryRun) await fs.writeFile(abs, updated, 'utf8');
    updatedFiles.push(rel);
  }

  return { updatedFiles };
}

export async function verifyDisclaimer({ root = process.cwd(), disclaimerPath = defaultDisclaimerPath }:
  Pick<DisclaimerOptions, 'root' | 'disclaimerPath'> = {}): Promise<{missing: string[]}> {
  const files = (await listMarkdown(root))
    .filter((f) => f !== disclaimerPath && !f.startsWith('pre-public/') && !f.startsWith('preview-oraculo/'))
    .filter((f) => !f.startsWith('.abandonados/') && !f.startsWith('.deprecados/') && !f.startsWith('coverage/') && !f.startsWith('relatorios/'));

  const missing: string[] = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    try {
      await fs.access(abs);
    } catch {
      continue;
    }
    const content = await fs.readFile(abs, 'utf8');
    const head = content.split('\n').slice(0, 30).join('\n');
    if (!marker.test(head)) missing.push(rel);
  }

  return { missing };
}

export default { addDisclaimer, verifyDisclaimer };
