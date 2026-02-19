// SPDX-License-Identifier: MIT

import { otimizarSvgLikeSvgo, shouldSugerirOtimizacaoSvg } from '@shared/impar/svgs.js';
import type { AutoFixConfig, PatternBasedQuickFix } from '@';
import { hasMinimumConfidence, isCategoryAllowed, shouldExcludeFile } from './auto-fix-config.js';

// Re-exporta os tipos para compatibilidade
export type { PatternBasedQuickFix };

// Small textual helpers used by some heuristics
function _isInComment(match: RegExpMatchArray, fullCode: string): boolean {
  const lines = fullCode.split('\n');
  const matchInicio = typeof match.index === 'number' ? match.index : fullCode.indexOf(match[0]);
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineInicio = pos;
    const lineFim = pos + line.length;
    if (matchInicio >= lineInicio && matchInicio <= lineFim) {
      const before = line.substring(0, Math.max(0, matchInicio - lineInicio));
      if (/\/\//.test(before)) return true;
      const blockInicio = fullCode.lastIndexOf('/*', matchInicio);
      const blockFim = fullCode.indexOf('*/', matchInicio);
      if (blockInicio !== -1 && (blockFim === -1 || blockFim > matchInicio)) return true;
    }
    pos = lineFim + 1;
  }
  return false;
}
function _isInTodoComment(match: RegExpMatchArray, fullCode: string): boolean {
  const lines = fullCode.split('\n');
  const matchInicio = typeof match.index === 'number' ? match.index : fullCode.indexOf(match[0]);
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineInicio = pos;
    const lineFim = pos + line.length;
    if (matchInicio >= lineInicio && matchInicio <= lineFim) {
      if (/TODO|FIXME|XXX|HACK/i.test(line)) return true;
    }
    pos = lineFim + 1;
  }
  return false;
}
function _isCriticalSystemFile(fullCode: string): boolean {
  const criticalIndicators = ['SPDX-License-Identifier', '@core/configuracao', 'operario-estrutura', 'corretor-estrutura', 'config.js', 'executor.js', 'quick-fix-registry', 'mapa-reversao', 'persistence/persistencia'];
  return criticalIndicators.some(i => fullCode.includes(i));
}

// 🚨 REGISTRY SEGURO - APENAS QUICK FIXES QUE NÃO QUEBRAM CÓDIGO
export const quickCorrecaoRegistro: PatternBasedQuickFix[] = [
// ✅ Quick fixes reintroduzidos de forma conservadora:
// Começamos por SVGs, pois a transformação é determinística e segura.
{
  id: 'svg-optimize-svgo-like',
  title: 'Otimizar SVG (Doutor)',
  description: 'Remove prolog/doctype/comentários/metadata e colapsa whitespace entre tags para reduzir tamanho do SVG.',
  // Match único do arquivo inteiro
  pattern: /^[\s\S]+$/,
  category: 'performance',
  confidence: 95,
  shouldApply: (_match: RegExpMatchArray, fullCode: string, _lineContext: string, fileCaminho?: string): boolean => {
    // Aceita apenas SVGs (por path ou, como fallback, por conteúdo)
    const pareceSvg = /<svg\b/i.test(fullCode);
    const isSvgCaminho = typeof fileCaminho === 'string' ? /\.svg$/i.test(fileCaminho) : false;
    if (!isSvgCaminho && !pareceSvg) return false;
    const opt = otimizarSvgLikeSvgo({
      svg: fullCode
    });
    if (!opt.changed) return false;
    if (!shouldSugerirOtimizacaoSvg(opt.originalBytes, opt.optimizedBytes)) return false;
    return true;
  },
  fix: (_match: RegExpMatchArray, fullCode: string): string => {
    const opt = otimizarSvgLikeSvgo({
      svg: fullCode
    });
    return opt.data;
  }
}, {
  id: 'svg-add-viewbox-safe',
  title: 'Adicionar viewBox (quando seguro)',
  description: 'Quando o SVG tem width/height numéricos e não tem viewBox, adiciona viewBox="0 0 width height".',
  pattern: /^[\s\S]+$/,
  category: 'performance',
  confidence: 92,
  shouldApply: (_match: RegExpMatchArray, fullCode: string, _lineContext: string, fileCaminho?: string): boolean => {
    const pareceSvg = /<svg\b/i.test(fullCode);
    const isSvgCaminho = typeof fileCaminho === 'string' ? /\.svg$/i.test(fileCaminho) : false;
    if (!isSvgCaminho && !pareceSvg) return false;
    if (/\bviewBox\s*=\s*['"][^'"]+['"]/i.test(fullCode)) return false;
    // Só aplica quando width/height são numéricos (ou px), evitando %/em/etc.
    const width = fullCode.match(/\bwidth\s*=\s*['"]([^'"]+)['"]/i)?.[1] ?? '';
    const height = fullCode.match(/\bheight\s*=\s*['"]([^'"]+)['"]/i)?.[1] ?? '';
    const parse = (v: string): number | null => {
      const m = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/i.exec(v);
      return m ? Number(m[1]) : null;
    };
    const w = parse(width);
    const h = parse(height);
    return w !== null && h !== null && w > 0 && h > 0;
  },
  fix: (_match: RegExpMatchArray, fullCode: string): string => {
    // Insere viewBox no start tag do SVG
    const tagMatch = /<svg\b[^>]*>/i.exec(fullCode);
    if (!tagMatch) return fullCode;
    const tag = tagMatch[0];
    if (/\bviewBox\s*=\s*['"][^'"]+['"]/i.test(tag)) return fullCode;
    const width = fullCode.match(/\bwidth\s*=\s*['"]([^'"]+)['"]/i)?.[1] ?? '';
    const height = fullCode.match(/\bheight\s*=\s*['"]([^'"]+)['"]/i)?.[1] ?? '';
    const parse = (v: string): string | null => {
      const m = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/i.exec(v);
      return m ? m[1] : null;
    };
    const w = parse(width);
    const h = parse(height);
    if (!w || !h) return fullCode;
    const viewBoxAttr = ` viewBox="0 0 ${w} ${h}"`;
    const updatedTag = tag.replace(/<svg\b/i, `<svg${viewBoxAttr}`);
    return fullCode.replace(tag, updatedTag);
  }
}];
export function findQuickFixes(code: string, problemTipo?: string, config?: AutoFixConfig, fileCaminho?: string): Array<PatternBasedQuickFix & {
  matches: RegExpMatchArray[];
}> {
  const results: Array<PatternBasedQuickFix & {
    matches: RegExpMatchArray[];
  }> = [];
  if (config && fileCaminho && shouldExcludeFile(fileCaminho, config)) return results;
  for (const fix of quickCorrecaoRegistro) {
    if (config && !isCategoryAllowed(fix.category, config)) continue;
    if (config && !hasMinimumConfidence(fix.confidence, config)) continue;
    if (problemTipo && !fix.id.includes(problemTipo)) continue;
    const matches: RegExpMatchArray[] = [];
    fix.pattern.lastIndex = 0;
    let match: RegExpMatchArray | null;
    while ((match = fix.pattern.exec(code)) !== null) {
      if (fix.shouldApply) {
        const lines = code.split('\n');
        const matchPos = match.index ?? 0;
        const linesBefore = code.substring(0, matchPos).split('\n');
        const lineContext = lines[linesBefore.length - 1] || '';
        const ok = fix.shouldApply(match, code, lineContext, fileCaminho);
        if (!ok) {
          if (!fix.pattern.global) break;
          continue;
        }
      }
      matches.push(match);
      if (config && typeof config.maxFixesPerArquivo === 'number' && matches.length >= config.maxFixesPerArquivo) break;
      if (!fix.pattern.global) break;
    }
    if (matches.length > 0) results.push({
      ...fix,
      matches
    });
  }
  return results;
}
export function applyQuickFix(code: string, fix: PatternBasedQuickFix, match: RegExpMatchArray): string {
  return fix.fix(match, code);
}