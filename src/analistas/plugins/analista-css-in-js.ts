// SPDX-License-Identifier: MIT
import { AnalystOrigens, AnalystTipos, CssInJsMensagens, SeverityNiveis } from '@core/messages/core/plugin-messages.js';
import type { Ocorrencia } from '@';
import { criarAnalista, criarOcorrencia } from '@';
const disableEnv = process.env.DOUTOR_DISABLE_PLUGIN_CSS_IN_JS === '1';
type Msg = ReturnType<typeof criarOcorrencia>;
function findLine(src: string, index = 0): number {
  return src.slice(0, index).split(/\n/).length;
}
function emitir(message: string, relPath: string, nivel: (typeof SeverityNiveis)[keyof typeof SeverityNiveis], line = 1): Msg {
  return criarOcorrencia({
    relPath,
    mensagem: message,
    linha: line,
    nivel,
    origem: AnalystOrigens.cssInJs,
    tipo: AnalystTipos.cssInJs
  });
}
function detectarStyledComponents(src: string): {
  detected: boolean;
  global: boolean;
  indices: number[];
} {
  const indices: number[] = [];
  for (const m of src.matchAll(/from\s+['"]styled-components['"]/g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  for (const m of src.matchAll(/require\(\s*['"]styled-components['"]\s*\)/g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  for (const m of src.matchAll(/\bstyled\s*\./g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  for (const m of src.matchAll(/\bstyled\s*\(/g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  for (const m of src.matchAll(/\bcreateGlobalStyle\b/g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  for (const m of src.matchAll(/\bcss\s*`/g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  const detected = indices.length > 0;
  const global = /\bcreateGlobalStyle\b/.test(src);
  return {
    detected,
    global,
    indices
  };
}
function detectarStyledJsx(src: string): {
  detected: boolean;
  global: boolean;
  indices: number[];
} {
  const indices: number[] = [];
  for (const m of src.matchAll(/<style\b[^>]*\bjsx\b[^>]*>/gi)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  for (const m of src.matchAll(/from\s+['"]styled-jsx\/css['"]/g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  for (const m of src.matchAll(/from\s+['"]styled-jsx['"]/g)) {
    if (typeof m.index === 'number') indices.push(m.index);
  }
  const detected = indices.length > 0;
  const global = /<style\b[^>]*\bjsx\b[^>]*\bglobal\b[^>]*>/i.test(src);
  return {
    detected,
    global,
    indices
  };
}
export const analistaCssInJs = criarAnalista({
  nome: 'analista-css-in-js',
  categoria: 'estilo',
  descricao: 'Detecta padrões de CSS-in-JS (styled-components, styled-jsx).',
  global: false,
  test: (relPath: string): boolean => /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(relPath),
  aplicar: async (src, relPath): Promise<Ocorrencia[] | null> => {
    if (disableEnv) return null;

    // Prefiltro barato para evitar múltiplos matchAll em arquivos que não têm sinais.
    if (!/styled-components|styled-jsx|<style\b[^>]*\bjsx\b|\bcreateGlobalStyle\b|\bstyled\b/i.test(src)) {
      return null;
    }
    const ocorrencias: Ocorrencia[] = [];
    const sc = detectarStyledComponents(src);
    const sj = detectarStyledJsx(src);
    if (!sc.detected && !sj.detected) return null;
    if (sc.detected) {
      const first = sc.indices[0] ?? 0;
      ocorrencias.push(emitir(CssInJsMensagens.detectedStyledComponents, relPath, SeverityNiveis.info, findLine(src, first)));
      if (sc.global) {
        ocorrencias.push(emitir(CssInJsMensagens.globalStyles('styled-components'), relPath, SeverityNiveis.warning, findLine(src, first)));
      }
    }
    if (sj.detected) {
      const first = sj.indices[0] ?? 0;
      ocorrencias.push(emitir(CssInJsMensagens.detectedStyledJsx, relPath, SeverityNiveis.info, findLine(src, first)));
      if (sj.global) {
        ocorrencias.push(emitir(CssInJsMensagens.globalStyles('styled-jsx'), relPath, SeverityNiveis.warning, findLine(src, first)));
      }
    }

    // Sinais comuns dentro de CSS em template strings / style tags
    if (/!important/.test(src)) {
      ocorrencias.push(emitir(CssInJsMensagens.importantUsage, relPath, SeverityNiveis.warning, 1));
    }
    if (/url\(\s*['"]?http:\/\//i.test(src)) {
      ocorrencias.push(emitir(CssInJsMensagens.httpUrl, relPath, SeverityNiveis.warning, 1));
    }
    return ocorrencias.length ? ocorrencias : null;
  }
});
export default analistaCssInJs;