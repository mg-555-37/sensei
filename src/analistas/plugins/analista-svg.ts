// SPDX-License-Identifier: MIT
import { AnalystOrigens, AnalystTipos, SeverityNiveis, SvgMensagens } from '@core/messages/core/plugin-messages.js';
import { otimizarSvgLikeSvgo, shouldSugerirOtimizacaoSvg } from '@shared/impar/svgs.js';
import type { Ocorrencia } from '@';
import { criarAnalista, criarOcorrencia } from '@';
const disableEnv = process.env.DOUTOR_DISABLE_PLUGIN_SVG === '1';
type Msg = ReturnType<typeof criarOcorrencia>;
function findLine(src: string, index = 0): number {
  const safeIndex = Math.max(0, index);
  let line = 1;
  for (let i = 0; i < safeIndex && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}
function findFirstMatchLine(src: string, re: RegExp, fallbackLine = 1): number {
  const idx = src.search(re);
  if (idx < 0) return fallbackLine;
  return findLine(src, idx);
}
function msg(message: string, relPath: string, nivel: (typeof SeverityNiveis)[keyof typeof SeverityNiveis] = SeverityNiveis.warning, line = 1): Msg {
  return criarOcorrencia({
    relPath,
    mensagem: message,
    linha: line,
    nivel,
    origem: AnalystOrigens.svg,
    tipo: AnalystTipos.svg
  });
}
export const analistaSvg = criarAnalista({
  nome: 'analista-svg',
  categoria: 'assets',
  descricao: 'Heurísticas para SVG + sugestão de otimização (modo Doutor).',
  global: false,
  test: (relPath: string): boolean => /\.svg$/i.test(relPath),
  aplicar: async (src, relPath): Promise<Ocorrencia[] | null> => {
    if (disableEnv) return null;
    const ocorrencias: Ocorrencia[] = [];
    if (!/<svg\b/i.test(src)) {
      ocorrencias.push(msg(SvgMensagens.naoPareceSvg, relPath, SeverityNiveis.warning, 1));
      return ocorrencias;
    }
    const idxSvg = src.search(/<svg\b/i);
    const linhaSvg = idxSvg >= 0 ? findLine(src, idxSvg) : 1;
    const opt = otimizarSvgLikeSvgo({
      svg: src
    });

    // Segurança
    for (const w of opt.warnings) {
      if (w === 'script-inline') {
        const line = findFirstMatchLine(src, /<script\b/i, linhaSvg);
        ocorrencias.push(msg(SvgMensagens.scriptInline, relPath, SeverityNiveis.error, line));
      } else if (w === 'evento-inline') {
        const line = findFirstMatchLine(src, /\son\w+\s*=\s*['"]/i, linhaSvg);
        ocorrencias.push(msg(SvgMensagens.eventoInline, relPath, SeverityNiveis.warning, line));
      } else if (w === 'javascript-url') {
        const line = findFirstMatchLine(src, /javascript:\s*/i, linhaSvg);
        ocorrencias.push(msg(SvgMensagens.javascriptUrl, relPath, SeverityNiveis.error, line));
      }
    }

    // Boas práticas
    if (!/\bviewBox\s*=\s*['"][^'"]+['"]/i.test(src)) {
      ocorrencias.push(msg(SvgMensagens.semViewBox, relPath, SeverityNiveis.info, linhaSvg));
    }

    // Otimização (diferença de bytes)
    if (opt.changed && opt.originalBytes > opt.optimizedBytes && shouldSugerirOtimizacaoSvg(opt.originalBytes, opt.optimizedBytes)) {
      ocorrencias.push(msg(SvgMensagens.podeOtimizar(opt.originalBytes, opt.optimizedBytes, opt.mudancas), relPath, SeverityNiveis.info, linhaSvg));
    }
    return ocorrencias.length ? ocorrencias : null;
  }
});
export default analistaSvg;