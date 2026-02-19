// SPDX-License-Identifier: MIT
import type { NodePath } from '@babel/traverse';
import type { Node } from '@babel/types';
import { findQuickFixes, type PatternBasedQuickFix } from '@core/config/auto/fix-config.js';
import type { Analista, Ocorrencia } from '@';
import { criarOcorrencia } from '@';
export const analistaQuickFixes: Analista = {
  nome: 'quick-fixes',
  categoria: 'melhorias',
  descricao: 'Detecta problemas comuns e oferece correções automáticas',
  test: (relPath: string): boolean => {
    return /\.(js|jsx|ts|tsx|mjs|cjs|svg)$/.test(relPath);
  },
  aplicar: (src: string, relPath: string, _ast: NodePath<Node> | null): Ocorrencia[] => {
    if (!src) return [];
    const ocorrencias: Ocorrencia[] = [];

    // Buscar quick fixes gerais
    const quickFixes = findQuickFixes(src, undefined, undefined, relPath);

    // Buscar quick fixes específicos por tipo de problema detectado
    const problemaTipos = ['unhandled-async', 'console-log', 'memory-leak', 'dangerous-html', 'eval-usage', 'complex-regex'];
    for (const problemTipo of problemaTipos) {
      const specificFixes = findQuickFixes(src, problemTipo, undefined, relPath);
      quickFixes.push(...specificFixes);
    }

    // Remover duplicatas por ID
    const uniqueFixes = quickFixes.filter((fix, index, arr) => arr.findIndex(f => f.id === fix.id) === index);
    for (const fixResultado of uniqueFixes) {
      for (const match of fixResultado.matches) {
        // Calcular linha aproximada do match
        const beforeMatch = src.substring(0, match.index || 0);
        const linha = beforeMatch.split('\n').length;

        // Gerar preview da correção
        const previewCorrecao = fixResultado.fix(match, src);
        const originalLine = src.split('\n')[linha - 1] || '';
        const fixedLine = previewCorrecao.split('\n')[linha - 1] || '';

        // Criar sugestão com preview mais detalhado
        const sugestao = [fixResultado.description, '', `🔧 Correção sugerida:`, `❌ Antes: ${originalLine.trim()}`, `✅ Depois: ${fixedLine.trim()}`, '', `Confiança: ${fixResultado.confidence}%`, `Categoria: ${fixResultado.category}`, `ID do Fix: ${fixResultado.id}`].join('\n');

        // Mapear categoria para nível
        const nivel = mapearCategoriaNivel(fixResultado.category);

        // Criar ocorrência base
        const ocorrencia = criarOcorrencia({
          tipo: 'auto-fix-disponivel',
          nivel,
          mensagem: `${fixResultado.title}`,
          relPath,
          linha
        });

        // Adicionar campos extras como propriedades do objeto genérico
        const ocorrenciaGenerica = ocorrencia as Ocorrencia & {
          sugestao?: string;
          quickFixId?: string;
          confidence?: number;
          category?: string;
          matchIndex?: number;
          matchLength?: number;
        }; // OcorrenciaGenerica allows extra properties
        ocorrenciaGenerica.sugestao = sugestao;
        ocorrenciaGenerica.quickFixId = fixResultado.id;
        ocorrenciaGenerica.confidence = fixResultado.confidence;
        ocorrenciaGenerica.category = fixResultado.category;
        ocorrenciaGenerica.matchIndex = match.index;
        ocorrenciaGenerica.matchLength = match[0].length;
        ocorrencias.push(ocorrencia);
      }
    }
    return ocorrencias;
  }
};
function mapearCategoriaNivel(category: PatternBasedQuickFix['category']): 'info' | 'aviso' | 'erro' {
  switch (category) {
    case 'security':
      return 'erro';
    case 'performance':
      return 'aviso';
    case 'style':
    case 'documentation':
      return 'info';
    default:
      return 'info';
  }
}