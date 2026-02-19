// SPDX-License-Identifier: MIT
/**
 * Sistema de configuração granular de regras
 * Suporta:
 * - Regras por arquivo/diretório (glob patterns)
 * - Overrides específicos
 * - Severidade customizada
 * - Exclusões por padrão de arquivo
 */

import { config } from '@core/config/config.js';
import { minimatch } from 'minimatch';
import type { RuleConfig, RuleOverride } from '@';
export type { RuleConfig, RuleOverride };

/**
 * Verifica se uma regra deve ser aplicada para um arquivo específico
 */
export function isRuleSuppressed(ruleName: string, fileCaminho: string): boolean {
  // Normaliza o caminho do arquivo (remove ./ e normaliza barras)
  const normalizedCaminho = fileCaminho.replace(/^\.\//, '').replace(/\\/g, '/');

  // 1. Verifica suppressRules globais (config antigo - compatibilidade)
  const configData = config as unknown as {
    suppressRules?: string[];
    rules?: Record<string, RuleConfig>;
    testPadroes?: {
      files?: string[];
      allowAnyType?: boolean;
    };
  };
  const suppressRules = configData.suppressRules;
  if (suppressRules?.includes(ruleName)) {
    return true;
  }

  // 2. Verifica config.rules (novo sistema)
  const ruleConfiguracao = configData.rules?.[ruleName];
  if (ruleConfiguracao) {
    // Verifica se severity é 'off'
    if (ruleConfiguracao.severity === 'off') {
      return true;
    }

    // Verifica se arquivo está em exclude patterns
    if (ruleConfiguracao.exclude) {
      for (const pattern of ruleConfiguracao.exclude) {
        if (minimatch(normalizedCaminho, pattern, {
          dot: true
        })) {
          return true;
        }
      }
    }

    // Verifica allowTestFiles para arquivos de teste
    if (ruleConfiguracao.allowTestFiles && isTestArquivo(normalizedCaminho, configData)) {
      return true;
    }
  }

  // 3. Verifica padrões de teste globais (para tipo-inseguro em testes)
  if (ruleName === 'tipo-inseguro' || ruleName === 'tipo-inseguro-any') {
    const testPadroes = configData.testPadroes;
    if (testPadroes?.allowAnyType && isTestArquivo(normalizedCaminho, configData)) {
      return true;
    }
  }
  return false;
} /**
  * Verifica se um arquivo é de teste baseado nos padrões configurados
  */
function isTestArquivo(fileCaminho: string, configData: {
  testPadroes?: {
    files?: string[];
  };
}): boolean {
  const testPadroes = configData.testPadroes?.files || ['**/*.test.*', '**/*.spec.*', 'test/**/*', 'tests/**/*', '**/__tests__/**'];
  return testPadroes.some(pattern => minimatch(fileCaminho, pattern, {
    dot: true
  }));
}

/**
 * Obtém a severidade configurada para uma regra
 */
export function getRuleSeverity(ruleName: string, fileCaminho: string): 'error' | 'warning' | 'info' | undefined {
  const configData = config as unknown as {
    rules?: Record<string, RuleConfig>;
  };
  const ruleConfiguracao = configData.rules?.[ruleName];
  if (!ruleConfiguracao) {
    return undefined;
  }

  // Se regra está suprimida, retorna undefined
  if (isRuleSuppressed(ruleName, fileCaminho)) {
    return undefined;
  }

  // Mapeia severidades
  if (ruleConfiguracao.severity === 'error') return 'error';
  if (ruleConfiguracao.severity === 'warning') return 'warning';
  if (ruleConfiguracao.severity === 'info') return 'info';
  return undefined;
}

/**
 * Verifica se uma ocorrência deve ser suprimida baseado na configuração
 */
export function shouldSuppressOccurrence(tipo: string, fileCaminho: string, _severity?: string): boolean {
  // Extrai o nome base da regra
  // tipo-inseguro-any -> tipo-inseguro
  // tipo-inseguro-any-assertion -> tipo-inseguro
  // tipo-inseguro-any-cast -> tipo-inseguro
  // tipo-inseguro-unknown -> tipo-inseguro
  const baseRuleNome = tipo.replace(/-(any|unknown|assertion|cast).*$/, '');

  // Verifica supressão para regra base e variantes
  const rulesToCheck = [tipo, baseRuleNome];
  return rulesToCheck.some(rule => isRuleSuppressed(rule, fileCaminho));
}