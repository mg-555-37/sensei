// SPDX-License-Identifier: MIT
/**
 * Quick Fix: Replace any with proper types
 * Analisa uso de `any` e infere/cria tipos corretos
 */

import type { Node } from '@babel/types';
import { buildTypesRelPathPosix } from '@core/config/conventions.js';
import { MENSAGENS_CORRECAO_TIPOS } from '@core/messages/index.js';
import type { QuickFix, QuickFixResult, TypeSafetyWarning } from '@';
import { isAnyInGenericFunction, isInStringOrComment, isLegacyOrVendorFile, isTypeScriptContext } from '../type-safety/context-analyzer.js';
import { analyzeTypeUsage } from '../type-safety/type-analyzer.js';
import { createTypeDefinition } from '../type-safety/type-creator.js';
import { validateTypeReplacement } from '../type-safety/type-validator.js';
const CONFIANCA_NIVEIS = {
  HIGH: 85,
  MEDIUM: 60,
  DEFAULT: 70
} as const;
export const fixAnyToProperTipo: QuickFix = {
  id: 'fix-any-to-proper-type',
  title: MENSAGENS_CORRECAO_TIPOS.fixAny.title,
  description: MENSAGENS_CORRECAO_TIPOS.fixAny.description,
  pattern: /:\s*any\b/g,
  category: 'style',
  // Type safety é considerado 'style' pois não afeta execução
  confidence: CONFIANCA_NIVEIS.DEFAULT,
  // Média - requer análise contextual

  shouldApply: (match: RegExpMatchArray, fullCode: string, lineContext: string, fileCaminho?: string) => {
    // 1. Verificar contexto básico
    if (isInStringOrComment(fullCode, match.index || 0)) {
      return false;
    }

    // 2. Verificar contexto TypeScript (type assertion, etc)
    if (isTypeScriptContext(fullCode, match.index || 0)) {
      return false;
    }

    // 3. Não modificar arquivos de definição de tipos
    if (fileCaminho?.includes('.d.ts') || fileCaminho?.includes('/@types/')) {
      return false;
    }

    // 4. Não modificar vendor/node_modules
    if (isLegacyOrVendorFile(fileCaminho)) {
      return false;
    }

    // 5. Verificar se any está em função genérica apropriada
    if (isAnyInGenericFunction(fullCode, match.index || 0)) {
      return false; // any pode ser apropriado aqui
    }
    return true;
  },
  fix: (match: RegExpMatchArray, fullCode: string) => {
    // Retornar código sem modificação por padrão
    // A aplicação real deve ser feita via fixAsync
    return fullCode;
  }
};

/**
 * Versão assíncrona do fix que faz análise completa
 */
export async function fixAnyToProperTypeAsync(match: RegExpMatchArray, fullCode: string, fileCaminho: string, ast: Node | null): Promise<QuickFixResult> {
  try {
    // 1. Analisar uso do tipo
    const typeAnalise = await analyzeTypeUsage(match, fullCode, fileCaminho, ast);

    // 2. Estratégia baseada em confiança
    if (typeAnalise.confidence >= CONFIANCA_NIVEIS.HIGH) {
      // ALTA CONFIANÇA: Aplicar tipo automaticamente

      if (typeAnalise.isSimpleType) {
        // Tipo primitivo: substituir diretamente
        const fixedCodigo = fullCode.replace(match[0], `: ${typeAnalise.inferredTipo}`);

        // Validar resultado
        const validation = await validateTypeReplacement(fullCode, fixedCodigo, typeAnalise);
        if (!validation.isCompatible) {
          return {
            code: fullCode,
            applied: false,
            reason: `Validação falhou: ${validation.errors.join(', ')}`,
            warnings: validation.warnings.map(w => ({
              type: 'unsafe-type',
              message: w,
              suggestion: 'Revise manualmente'
            }))
          };
        }
        return {
          code: fixedCodigo,
          applied: true,
          warnings: validation.warnings.map(w => ({
            type: 'type-suggestion',
            message: w,
            suggestion: MENSAGENS_CORRECAO_TIPOS.validacao.revisar
          }))
        };
      } else {
        // Tipo complexo: criar interface
        const typeCaminho = await createTypeDefinition(typeAnalise, fileCaminho);
        const importStatement = `import type { ${typeAnalise.typeName} } from '${typeCaminho}';\n`;

        // Adicionar import no topo e substituir any
        const lines = fullCode.split('\n');
        const importIndex = findImportInsertionPoint(lines);
        lines.splice(importIndex, 0, importStatement);
        let fixedCodigo = lines.join('\n');
        fixedCodigo = fixedCodigo.replace(match[0], `: ${typeAnalise.typeName}`);

        // Validar resultado
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
      }
    } else if (typeAnalise.confidence >= CONFIANCA_NIVEIS.MEDIUM) {
      // MÉDIA CONFIANÇA: Sugerir mas não aplicar
      const warning: TypeSafetyWarning = {
        type: 'type-suggestion',
        message: MENSAGENS_CORRECAO_TIPOS.warnings.confiancaMedia(typeAnalise.confidence, typeAnalise.inferredTipo),
        suggestion: MENSAGENS_CORRECAO_TIPOS.warnings.criarTipoDedicado(typeAnalise.suggestedPath),
        confidence: typeAnalise.confidence
      };
      return {
        code: fullCode,
        applied: false,
        reason: `Confiança média (${typeAnalise.confidence}%) - sugestão apenas`,
        warnings: [warning]
      };
    } else {
      // BAIXA CONFIANÇA: Apenas avisar
      const warning: TypeSafetyWarning = {
        type: 'unsafe-type',
        message: MENSAGENS_CORRECAO_TIPOS.warnings.confiancaBaixa(typeAnalise.confidence),
        suggestion: MENSAGENS_CORRECAO_TIPOS.warnings.useTiposCentralizados(),
        needsManualReview: true
      };
      return {
        code: fullCode,
        applied: false,
        reason: `Confiança baixa (${typeAnalise.confidence}%)`,
        warnings: [warning]
      };
    }
  } catch (error) {
    return {
      code: fullCode,
      applied: false,
      reason: MENSAGENS_CORRECAO_TIPOS.erros.analise(error instanceof Error ? error.message : String(error))
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

    // Pular comentários no topo
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }

    // Encontrar último import
    if (line.startsWith('import ')) {
      lastImportIndex = i;
    }

    // Se encontrou código não-import, parar
    if (line && !line.startsWith('import ') && lastImportIndex !== -1) {
      break;
    }
  }

  // Inserir após último import ou no topo
  return lastImportIndex + 1;
}