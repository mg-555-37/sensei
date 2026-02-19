// SPDX-License-Identifier: MIT
/**
 * Quick Fix: Replace unknown with specific types
 * Mais conservador que fix-any - requer confiança >= 90%
 */

import type { Node } from '@babel/types';
import { buildTypesRelPathPosix, getTypesDirectoryDisplay } from '@core/config/conventions.js';
import { MENSAGENS_CORRECAO_TIPOS } from '@core/messages/index.js';
import type { QuickFix, QuickFixResult, TypeSafetyWarning } from '@';
import { isInStringOrComment, isLegacyOrVendorFile, isUnknownInGenericContext } from '../type-safety/context-analyzer.js';
import { analyzeUnknownUsage } from '../type-safety/type-analyzer.js';
import { createTypeDefinition } from '../type-safety/type-creator.js';
import { validateTypeReplacement } from '../type-safety/type-validator.js';
export const fixUnknownToSpecificTipo: QuickFix = {
  id: 'fix-unknown-to-specific-type',
  title: MENSAGENS_CORRECAO_TIPOS.fixUnknown.title,
  description: MENSAGENS_CORRECAO_TIPOS.fixUnknown.description,
  pattern: /:\s*unknown\b/g,
  category: 'style',
  confidence: 75,
  // Mais conservador que any

  shouldApply: (match: RegExpMatchArray, fullCode: string, lineContext: string, fileCaminho?: string) => {
    // 1. Verificar contexto básico
    if (isInStringOrComment(fullCode, match.index || 0)) {
      return false;
    }

    // 2. Não modificar arquivos de definição
    if (fileCaminho?.includes('.d.ts') || fileCaminho?.includes('/@types/')) {
      return false;
    }

    // 3. Não modificar legado/vendor
    if (isLegacyOrVendorFile(fileCaminho)) {
      return false;
    }

    // 4. Verificar se unknown está em contexto genérico apropriado
    if (isUnknownInGenericContext(fullCode, match.index || 0)) {
      return false; // unknown é apropriado aqui (entrada genérica, deserialização, etc)
    }
    return true;
  },
  fix: (match: RegExpMatchArray, fullCode: string) => {
    // Retornar código sem modificação por padrão
    return fullCode;
  }
};

/**
 * Versão assíncrona com análise completa (conservador)
 */
export async function fixUnknownToSpecificTypeAsync(match: RegExpMatchArray, fullCode: string, fileCaminho: string, ast: Node | null): Promise<QuickFixResult> {
  try {
    // 1. Analisar uso (mais conservador que any)
    const typeAnalise = await analyzeUnknownUsage(match, fullCode, fileCaminho, ast);

    // 2. Estratégia mais conservadora (requer >= 90% confiança)
    if (typeAnalise.confidence >= 90) {
      // ALTA CONFIANÇA: Criar interface dedicada

      const typeCaminho = await createTypeDefinition(typeAnalise, fileCaminho);
      const importStatement = `import type { ${typeAnalise.typeName} } from '${typeCaminho}';\n`;

      // Adicionar import e substituir unknown
      const lines = fullCode.split('\n');
      const importIndex = findImportInsertionPoint(lines);
      lines.splice(importIndex, 0, importStatement);
      let fixedCodigo = lines.join('\n');
      fixedCodigo = fixedCodigo.replace(match[0], `: ${typeAnalise.typeName}`);

      // Validar
      const validation = await validateTypeReplacement(fullCode, fixedCodigo, typeAnalise);
      if (!validation.isCompatible) {
        return {
          code: fullCode,
          applied: false,
          reason: `Validação falhou: ${validation.errors.join(', ')}`
        };
      }
      return {
        code: fixedCodigo,
        applied: true,
        additionalChanges: [{
          type: 'add-import',
          content: importStatement
        }, {
          type: 'create-type-file',
          content: typeAnalise.typeDefinition,
          path: buildTypesRelPathPosix(typeAnalise.suggestedPath)
        }]
      };
    } else if (typeAnalise.confidence >= 70) {
      // MÉDIA CONFIANÇA: Sugerir tipo
      const warning: TypeSafetyWarning = {
        type: 'type-suggestion',
        message: `unknown pode ser substituído por tipo específico: ${typeAnalise.inferredTipo}`,
        suggestion: `Crie interface em ${buildTypesRelPathPosix(typeAnalise.suggestedPath)}`,
        confidence: typeAnalise.confidence
      };
      return {
        code: fullCode,
        applied: false,
        reason: `Confiança média (${typeAnalise.confidence}%) - sugestão apenas`,
        warnings: [warning]
      };
    } else {
      // BAIXA CONFIANÇA: Manter unknown
      const warning: TypeSafetyWarning = {
        type: 'keep-unknown',
        message: 'unknown apropriado aqui (entrada genérica ou baixa confiança)',
        suggestion: `Se possível, adicione type guards ou crie tipo dedicado em ${getTypesDirectoryDisplay()}`
      };
      return {
        code: fullCode,
        applied: false,
        reason: `Confiança baixa (${typeAnalise.confidence}%) - manter unknown`,
        warnings: [warning]
      };
    }
  } catch (error) {
    return {
      code: fullCode,
      applied: false,
      reason: `Erro na análise: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Encontra ponto de inserção para import
 */
function findImportInsertionPoint(lines: string[]): number {
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }
    if (line.startsWith('import ')) {
      lastImportIndex = i;
    }
    if (line && !line.startsWith('import ') && lastImportIndex !== -1) {
      break;
    }
  }
  return lastImportIndex + 1;
}