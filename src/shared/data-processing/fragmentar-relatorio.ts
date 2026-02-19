// SPDX-License-Identifier: MIT
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { config } from '@core/config/config.js';
import { salvarBinario, salvarEstado } from '@shared/persistence/persistencia.js';
import type { FileEntryFragmentacao, FragmentOptions, Manifest, ManifestPartFragmentacao, Ocorrencia, RelatorioCompletoFragmentacao } from '@';

// Aliases para compatibilidade
type FileEntry = FileEntryFragmentacao;
type ManifestPart = ManifestPartFragmentacao;
type RelatorioCompleto = RelatorioCompletoFragmentacao;

// Re-exporta os tipos para compatibilidade
export type { FileEntry, FragmentOptions, Manifest, ManifestPart, RelatorioCompleto };
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
export async function fragmentarRelatorio(relatorioFull: RelatorioCompleto, dir: string, ts: string, options?: FragmentOptions): Promise<{
  manifestFile: string;
  manifest: Manifest;
}> {
  const maxOcorrencias = options?.maxOcorrenciasPerShard ?? config.REPORT_FRAGMENT_OCCURRENCES ?? 2000;
  const maxArquivoEntries = options?.maxFileEntriesPerShard ?? config.REPORT_FRAGMENT_FILEENTRIES ?? 500;
  const topN = config.REPORT_FRAGMENT_SUMMARY_TOPN ?? 5;

  // Normaliza a estrutura esperada
  const rel = relatorioFull as Record<string, unknown>;
  const resultado = rel && 'resultado' in rel ? rel.resultado as Record<string, unknown> : rel as Record<string, unknown>;
  const ocorrencias: Ocorrencia[] = resultado && Array.isArray((resultado as Record<string, unknown>).ocorrencias) ? (resultado as Record<string, unknown>).ocorrencias as Ocorrencia[] : [];
  const fileEntries: FileEntry[] = resultado && Array.isArray((resultado as Record<string, unknown>).fileEntries) ? (resultado as Record<string, unknown>).fileEntries as FileEntry[] : [];
  const salvar = salvarEstado;

  // Manifest que descreve as partes geradas
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    baseNome: `doutor-relatorio-full-${ts}`,
    parts: []
  };

  // Salva meta (tudo exceto ocorrencias/fileEntries)
  const meta = {
    ...rel
  } as Record<string, unknown>;
  if (meta.resultado && typeof meta.resultado === 'object') {
    const r = meta.resultado as Record<string, unknown>;
    delete r.ocorrencias;
    delete r.fileEntries;
  }
  const metaFilename = `doutor-relatorio-full-${ts}-meta.json.gz`;
  const metaBuf = Buffer.from(JSON.stringify(meta, null, 2), 'utf-8');
  const metaGz = gzipSync(metaBuf);
  await salvarBinario(path.join(dir, metaFilename), metaGz);
  manifest.parts.push({
    kind: 'meta',
    file: metaFilename,
    bytes: metaGz.length
  });

  // Fragmenta ocorrencias se necessário
  if (ocorrencias.length > 0) {
    const occPedacos = chunkArray(ocorrencias, maxOcorrencias);
    for (let i = 0; i < occPedacos.length; i++) {
      const fname = `doutor-relatorio-full-${ts}-ocorrencias-part-${i + 1}.json.gz`;
      const payload = {
        shard: {
          kind: 'ocorrencias',
          index: i + 1,
          total: occPedacos.length
        },
        count: occPedacos[i].length,
        ocorrencias: occPedacos[i]
      };
      const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
      const gz = gzipSync(buf);
      await salvarBinario(path.join(dir, fname), gz);

      // Gerar resumo por shard: top tipos e top arquivos (relPath)
      const tiposContagem: Record<string, number> = {};
      const arquivosContagem: Record<string, number> = {};
      for (const o of occPedacos[i] as Ocorrencia[]) {
        // Suporta formatos legados com 'type' e 'path' para compatibilidade
        const oLegacy = o as Ocorrencia & {
          type?: string;
          path?: string;
        };
        const t = o && (o.tipo || oLegacy.type) ? String(o.tipo ?? oLegacy.type) : 'desconhecido';
        tiposContagem[t] = (tiposContagem[t] || 0) + 1;
        const relp = o && (o.relPath || oLegacy.path) ? String(o.relPath ?? oLegacy.path) : 'desconhecido';
        arquivosContagem[relp] = (arquivosContagem[relp] || 0) + 1;
      }
      const topTipos = Object.entries(tiposContagem).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([k, v]) => ({
        tipo: k,
        count: v
      }));
      const topArquivos = Object.entries(arquivosContagem).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([k, v]) => ({
        arquivo: k,
        count: v
      }));
      manifest.parts.push({
        kind: 'ocorrencias',
        file: fname,
        index: i + 1,
        total: occPedacos.length,
        count: occPedacos[i].length,
        bytes: gz.length,
        summary: {
          topTipos,
          topArquivos
        }
      });
    }
  }

  // Fragmenta fileEntries (ASTs) se necessário
  if (fileEntries.length > 0) {
    const fePedacos = chunkArray(fileEntries, maxArquivoEntries);
    for (let i = 0; i < fePedacos.length; i++) {
      const fname = `doutor-relatorio-full-${ts}-fileentries-part-${i + 1}.json.gz`;
      const payload = {
        shard: {
          kind: 'fileEntries',
          index: i + 1,
          total: fePedacos.length
        },
        count: fePedacos[i].length,
        fileEntries: fePedacos[i]
      };
      const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
      const gz = gzipSync(buf);
      await salvarBinario(path.join(dir, fname), gz);

      // Resumo por shard de fileEntries: top arquivos por tamanho (linhas) quando possível
      const arquivosResumo: Array<{
        arquivo: string;
        linhas?: number;
      }> = [];
      for (const fe of fePedacos[i] as FileEntry[]) {
        // Suporta formato legado com 'path' para compatibilidade
        const feLegacy = fe as FileEntry & {
          path?: string;
        };
        const rel = fe && (fe.relPath || fe.fullCaminho || feLegacy.path) ? String(fe.relPath ?? fe.fullCaminho ?? feLegacy.path) : 'desconhecido';
        let linhas: number | undefined = undefined;
        try {
          if (fe && typeof fe.content === 'string') linhas = fe.content.split(/\r?\n/).length;
        } catch {}
        arquivosResumo.push({
          arquivo: rel,
          linhas
        });
      }
      const topArquivosByLinhas = arquivosResumo.filter(a => typeof a.linhas === 'number').sort((a, b) => (b.linhas ?? 0) - (a.linhas ?? 0)).slice(0, topN);
      manifest.parts.push({
        kind: 'fileEntries',
        file: fname,
        index: i + 1,
        total: fePedacos.length,
        count: fePedacos[i].length,
        bytes: gz.length,
        summary: {
          topArquivosByLinhas
        }
      });
    }
  }

  // Salva o manifest final
  const manifestFilename = `doutor-relatorio-full-${ts}-manifest.json`;
  await salvar(path.join(dir, manifestFilename), manifest);
  return {
    manifestFile: manifestFilename,
    manifest
  };
}
export default fragmentarRelatorio;