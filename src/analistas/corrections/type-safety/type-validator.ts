// SPDX-License-Identifier: MIT
/**
 * Validação de tipos criados/modificados
 * Verifica compatibilidade e compilação TypeScript
 */

import type { TypeAnalysis, TypeReplacementValidation } from '@';
import { findExistingType, isSameType } from './type-creator.js';

/**
 * Valida substituição de tipo (any/unknown → specific)
 */
export async function validateTypeReplacement(originalCode: string, fixedCodigo: string, typeAnalise: TypeAnalysis): Promise<TypeReplacementValidation> {
  const result: TypeReplacementValidation = {
    isCompatible: true,
    expectedType: typeAnalise.inferredTipo,
    errors: [],
    warnings: []
  };

  // 1. Verificar se tipo criado já existe com definição diferente
  if (typeAnalise.createdNewType) {
    const existingTipo = await findExistingType(typeAnalise.typeName);
    if (existingTipo && !isSameType(existingTipo, typeAnalise.typeDefinition)) {
      result.warnings.push(`Tipo ${typeAnalise.typeName} já existe com definição diferente. ` + `Verifique conflito em ${existingTipo.path}`);
    }
  }

  // 2. Verificar se tipo inferido é compatível com uso
  const usageValidation = validateTypeUsageCompatibility(fixedCodigo, typeAnalise);
  if (!usageValidation.isCompatible) {
    result.errors.push(`Tipo inferido ${typeAnalise.inferredTipo} incompatível com uso detectado. ` + `Esperado: ${usageValidation.expectedType}`);
    result.isCompatible = false;
  }

  // 3. Verificar se import foi adicionado corretamente
  if (typeAnalise.requiresImport) {
    const hasCorrectImport = fixedCodigo.includes(`import type { ${typeAnalise.typeName} }`) || fixedCodigo.includes(`import { type ${typeAnalise.typeName} }`);
    if (!hasCorrectImport) {
      result.errors.push(`Import de tipo ${typeAnalise.typeName} não encontrado`);
      result.isCompatible = false;
    }
  }

  // 4. Verificar confiança mínima
  if (typeAnalise.confidence < 60) {
    result.warnings.push(`Confiança muito baixa (${typeAnalise.confidence}%). Considere revisão manual.`);
  }

  // 5. Validar sintaxe básica do código modificado
  const syntaxValidation = validateBasicSyntax(fixedCodigo);
  if (!syntaxValidation.isValid) {
    result.errors.push(...syntaxValidation.errors);
    result.isCompatible = false;
  }
  return result;
}

/**
 * Valida compatibilidade do tipo inferido com uso real
 */
function validateTypeUsageCompatibility(code: string, typeAnalise: TypeAnalysis): {
  isCompatible: boolean;
  expectedType: string;
} {
  // Simplificado - em produção, usar TypeScript compiler API
  // para verificação completa

  // Por enquanto, considerar compatível se confiança >= 70%
  const isCompatible = typeAnalise.confidence >= 70;
  return {
    isCompatible,
    expectedType: typeAnalise.inferredTipo
  };
}

/**
 * Valida sintaxe básica do código
 */
function validateBasicSyntax(code: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Verificar balanceamento de chaves
  const braceContagem = (code.match(/{/g) || []).length - (code.match(/}/g) || []).length;
  if (braceContagem !== 0) {
    errors.push(`Chaves desbalanceadas: diferença de ${Math.abs(braceContagem)}`);
  }

  // Verificar balanceamento de parênteses
  const parenContagem = (code.match(/\(/g) || []).length - (code.match(/\)/g) || []).length;
  if (parenContagem !== 0) {
    errors.push(`Parênteses desbalanceados: diferença de ${Math.abs(parenContagem)}`);
  }

  // Verificar balanceamento de colchetes
  const bracketContagem = (code.match(/\[/g) || []).length - (code.match(/\]/g) || []).length;
  if (bracketContagem !== 0) {
    errors.push(`Colchetes desbalanceados: diferença de ${Math.abs(bracketContagem)}`);
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Simula compilação TypeScript (simplificado)
 * Em produção, usar TypeScript compiler API
 */
export function runTypeScriptCompiler(code: string): {
  hasErrors: boolean;
  errors: string[];
} {
  // Simplificado - validações básicas
  const errors: string[] = [];

  // Verificar imports malformados
  const importLines = code.split('\n').filter(line => line.trim().startsWith('import'));
  for (const line of importLines) {
    if (!line.includes('from') && !line.includes('=')) {
      errors.push(`Import malformado: ${line.trim()}`);
    }
  }

  // Verificar sintaxe de interface
  const interfaceRegex = /interface\s+\w+\s*{[^}]*}/g;
  const interfaces = code.match(interfaceRegex) || [];
  for (const iface of interfaces) {
    // Verificar propriedades
    const properties = iface.match(/\w+\s*\??\s*:\s*[\w\[\]<>|&\s]+;/g);
    if (!properties) {
      errors.push(`Interface malformada: ${iface.substring(0, 50)}...`);
    }
  }
  return {
    hasErrors: errors.length > 0,
    errors
  };
}