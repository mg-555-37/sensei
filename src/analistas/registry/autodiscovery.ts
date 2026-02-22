// SPDX-License-Identifier: MIT
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Analista, EntradaRegistry, ModuloAnalista, Tecnica } from '@';

type Entry = Analista | Tecnica;

function isEntry(x: unknown): x is Entry {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.nome === 'string' && typeof o.aplicar === 'function';
}

function extrairEntradasDeModulo(mod: unknown): Entry[] {
  const m = mod as ModuloAnalista & Record<string, unknown>;
  const out: Entry[] = [];

  const candidates: unknown[] = [];
  candidates.push(m.default);
  if (Array.isArray(m.analistas)) candidates.push(...m.analistas);

  // Coleta exportações nomeadas que pareçam analista/técnica
  for (const v of Object.values(m)) candidates.push(v);

  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) if (isEntry(item)) out.push(item);
      continue;
    }
    if (isEntry(c)) out.push(c);
  }

  // Dedup interno por nome
  const byName = new Map<string, Entry>();
  for (const e of out) {
    if (e.nome) byName.set(e.nome, e);
  }
  return Array.from(byName.values());
}

/**
 * Autodiscovery de analistas/plugins.
 *
 * Convenção: qualquer arquivo em `src/analistas/plugins/` com prefixo
 * `analista-` ou `detector-` será importado e suas entradas serão extraídas.
 *
 * - Em runtime buildado: arquivos `.js`
 * - Em Vitest/dev: arquivos `.ts` podem existir (resolver do Vitest mapeia `.js` -> `.ts`)
 */
export async function discoverAnalistasPlugins(): Promise<EntradaRegistry[]> {
  try {
    const dirUrl = new URL('../plugins/', import.meta.url);
    const dirFsPath = fileURLToPath(dirUrl);
    const entries = await fs.readdir(dirFsPath, { withFileTypes: true });

    const arquivos = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => n !== 'index.ts' && n !== 'index.js')
      .filter((n) => /^(analista|detector)-.+\.(ts|js)$/i.test(n));

    const results: EntradaRegistry[] = [];
    for (const fname of arquivos) {
      const base = fname.replace(/\.(ts|js)$/i, '');
      // Preferimos importar via alias com sufixo .js (forma padrão do código);
      // em testes, o Vitest resolve este .js para o .ts correspondente.
      const spec = `@analistas/plugins/${base}.js`;
      try {
        const mod = (await import(spec)) as unknown;
        const extracted = extrairEntradasDeModulo(mod);
        results.push(...extracted);
      } catch {
        // Fallback: tentar importar via caminho file:// direto para o arquivo encontrado
        try {
          const fileUrl = new URL(fname, dirUrl);
          const mod2 = (await import(fileUrl.toString())) as unknown;
          const extracted2 = extrairEntradasDeModulo(mod2);
          results.push(...extracted2);
        } catch {
          // plugin opcional: ignorar
        }
      }
    }

    // Dedup final por nome
    const byName = new Map<string, EntradaRegistry>();
    for (const r of results) {
      const entry = r as Entry;
      if (entry?.nome) byName.set(entry.nome, r);
    }
    return Array.from(byName.values());
  } catch {
    return [];
  }
}

