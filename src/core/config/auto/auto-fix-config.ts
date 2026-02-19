// SPDX-License-Identifier: MIT

// SPDX-License-Identifier: MIT
// Merged auto-fix configuration: keep compatibility with both older
// AUTO_FIX_CONFIG_DEFAULTS and the newer DEFAULT_AUTO_FIX_CONFIG surface.

import type { AutoFixConfig } from '@';

// Re-exporta o tipo para compatibilidade
export type { AutoFixConfig };
export const PADRAO_AUTO_CORRECAO_CONFIGURACAO: AutoFixConfig = {
  mode: 'balanced',
  minConfidence: 75,
  allowedCategories: ['security', 'performance', 'style', 'documentation'],
  excludePadroes: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/*.min.js', '**/src/nucleo/configuracao/**', '**/src/shared/persistence/**', '**/operario-estrutura.ts', '**/corretor-estrutura.ts', '**/mapa-reversao.ts', '**/quick-fix-registry.ts', '**/config.ts', '**/executor.ts'],
  excludeFunctionPatterns: ['planejar', 'aplicar', 'corrigir', 'executar', 'processar', 'salvar.*Estado', 'ler.*Estado', 'gerarPlano.*', 'detectar.*', 'analisar.*', 'validar.*'],
  maxFixesPerArquivo: 5,
  createBackup: true,
  validateAfterFix: true,
  // backwards compat defaults
  allowMutateFs: false,
  backupSuffix: '.local.bak',
  conservative: true
};
export const CONSERVADORA_AUTO_CORRECAO_CONFIGURACAO: AutoFixConfig = {
  ...PADRAO_AUTO_CORRECAO_CONFIGURACAO,
  mode: 'conservative',
  minConfidence: 90,
  allowedCategories: ['security', 'performance'],
  maxFixesPerArquivo: 2,
  excludePadroes: [...(PADRAO_AUTO_CORRECAO_CONFIGURACAO.excludePadroes as string[] || []), '**/src/analistas/**', '**/src/arquitetos/**', '**/src/zeladores/**', '**/src/guardian/**', '**/src/cli/**']
};
export const AGRESSIVA_AUTO_CORRECAO_CONFIGURACAO: AutoFixConfig = {
  ...PADRAO_AUTO_CORRECAO_CONFIGURACAO,
  mode: 'aggressive',
  minConfidence: 60,
  maxFixesPerArquivo: 10,
  excludePadroes: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/*.min.js']
};

// Backwards compat constant name used elsewhere in the codebase
export const AUTO_CORRECAO_CONFIGURACAO_PADROES = PADRAO_AUTO_CORRECAO_CONFIGURACAO;
export default AUTO_CORRECAO_CONFIGURACAO_PADROES;
export function shouldExcludeFile(fileCaminho: string, config: AutoFixConfig): boolean {
  if (!config || !config.excludePadroes) return false;
  return config.excludePadroes.some(pattern => {
    const regexPadrao = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
    return new RegExp(regexPadrao).test(fileCaminho);
  });
}
export function shouldExcludeFunction(functionName: string, config: AutoFixConfig): boolean {
  if (!config || !config.excludeFunctionPatterns) return false;
  return config.excludeFunctionPatterns.some(pattern => new RegExp(pattern, 'i').test(functionName));
}
export function isCategoryAllowed(category: string, config: AutoFixConfig): boolean {
  if (!config || !config.allowedCategories) return true;
  // allowedCategories is an array of known category strings - coerce to string[] for safe includes check
  return (config.allowedCategories as string[]).includes(category);
}
export function hasMinimumConfidence(confidence: number, config: AutoFixConfig): boolean {
  if (typeof config?.minConfidence !== 'number') return true;
  return confidence >= (config.minConfidence as number);
}
export function getAutoFixConfig(mode?: string): AutoFixConfig {
  switch (mode) {
    case 'conservative':
      return CONSERVADORA_AUTO_CORRECAO_CONFIGURACAO;
    case 'aggressive':
      return AGRESSIVA_AUTO_CORRECAO_CONFIGURACAO;
    case 'balanced':
    default:
      return PADRAO_AUTO_CORRECAO_CONFIGURACAO;
  }
}