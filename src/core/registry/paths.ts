// SPDX-License-Identifier: MIT
/**
 * @fileoverview Gerenciamento centralizado de caminhos para arquivos JSON do Doutor
 *
 * Este módulo define todos os caminhos de arquivos JSON usados pelo sistema,
 * evitando hardcoding espalhado e permitindo evolução consistente.
 *
 * Convenção de nomes:
 * - guardian.baseline.json: Snapshot de integridade do Guardian
 * - estrutura.baseline.json: Baseline da estrutura de diretórios
 * - estrutura.arquetipo.json: Arquétipo personalizado do repositório
 * - doutor.config.json: Configuração do usuário (raiz do projeto)
 */

import path from 'node:path';

// Diretório base do projeto (raiz) - usa CWD quando executado pelo CLI
export const PROJETO_RAIZ = process.cwd();

/**
 * Diretórios principais do Doutor
 */
export const DOUTOR_DIRS = {
  /** Diretório de estado interno (.doutor/) */
  STATE: path.join(PROJETO_RAIZ, '.doutor'),
  /** Diretório de histórico de métricas (.doutor/historico-metricas/) */
  METRICS_HISTORY: path.join(PROJETO_RAIZ, '.doutor', 'historico-metricas'),
  /** Diretório de relatórios (relatorios/) */
  REPORTS: path.join(PROJETO_RAIZ, 'relatorios'),
  /** Diretório de performance baselines (docs/perf/) */
  PERF: path.join(PROJETO_RAIZ, 'docs', 'perf')
} as const;

/**
 * Arquivos JSON do sistema
 *
 * Categoria 1: Configuração (leitura usuário)
 * Categoria 2: Estado interno (leitura/escrita sistema)
 * Categoria 3: Relatórios (escrita sistema)
 */
export const DOUTOR_ARQUIVOS = {
  /* -------------------------- CONFIGURAÇÃO (raiz do projeto) -------------------------- */
  /** Configuração principal do usuário (doutor.config.json) */
  CONFIG: path.join(PROJETO_RAIZ, 'doutor.config.json'),
  /** Configuração segura/alternativa (doutor.config.safe.json) */
  CONFIG_SAFE: path.join(PROJETO_RAIZ, 'doutor.config.safe.json'),
  /* -------------------------- ESTADO INTERNO (.doutor/) -------------------------- */
  /** Baseline de integridade do Guardian (.doutor/guardian.baseline.json) */
  GUARDIAN_BASELINE: path.join(DOUTOR_DIRS.STATE, 'guardian.baseline.json'),
  /** Baseline de estrutura de diretórios (.doutor/estrutura.baseline.json) */
  ESTRUTURA_BASELINE: path.join(DOUTOR_DIRS.STATE, 'estrutura.baseline.json'),
  /** Arquétipo personalizado do repo (.doutor/estrutura.arquetipo.json) */
  ESTRUTURA_ARQUETIPO: path.join(DOUTOR_DIRS.STATE, 'estrutura.arquetipo.json'),
  /** Mapa de reversão de estrutura (.doutor/mapa-reversao.json) */
  MAPA_REVERSAO: path.join(DOUTOR_DIRS.STATE, 'mapa-reversao.json'),
  /** Registros da Vigia Oculta (.doutor/integridade.json) */
  REGISTRO_VIGIA: path.join(DOUTOR_DIRS.STATE, 'integridade.json'),
  /** Histórico de métricas (.doutor/historico-metricas/metricas-historico.json) */
  METRICAS_HISTORICO: path.join(DOUTOR_DIRS.METRICS_HISTORY, 'metricas-historico.json'),
  /* -------------------------- ARQUIVOS LEGADOS (compatibilidade) -------------------------- */
  /** @deprecated Use GUARDIAN_BASELINE - baseline.json antigo */
  GUARDIAN_BASELINE_LEGACY: path.join(DOUTOR_DIRS.STATE, 'baseline.json'),
  /** @deprecated Use ESTRUTURA_BASELINE - baseline-estrutura.json antigo */
  ESTRUTURA_BASELINE_LEGACY: path.join(DOUTOR_DIRS.STATE, 'baseline-estrutura.json'),
  /** @deprecated Movido para .doutor/ - doutor.repo.arquetipo.json na raiz */
  ESTRUTURA_ARQUETIPO_LEGACY_ROOT: path.join(PROJETO_RAIZ, 'doutor.repo.arquetipo.json')
} as const;

/**
 * Padrões de nomenclatura para relatórios dinâmicos
 */
export const REPORT_PADROES = {
  /** Relatório de diagnóstico (doutor-diagnostico-{timestamp}.md) */
  DIAGNOSTICO: (timestamp: string) => path.join(DOUTOR_DIRS.REPORTS, `doutor-diagnostico-${timestamp}.md`),
  /** Relatório JSON resumo (doutor-relatorio-summary-{timestamp}.json) */
  SUMMARY_JSON: (timestamp: string) => path.join(DOUTOR_DIRS.REPORTS, `doutor-relatorio-summary-${timestamp}.json`),
  /** Relatório de análise async (async-analysis-report.json) */
  ASYNC_ANALYSIS: path.join(DOUTOR_DIRS.REPORTS, 'async-analysis-report.json'),
  /** Baseline de performance (docs/perf/baseline-{timestamp}.json) */
  PERF_BASELINE: (timestamp: string) => path.join(DOUTOR_DIRS.PERF, `baseline-${timestamp}.json`),
  /** Diff de performance (docs/perf/ultimo-diff.json) */
  PERF_DIFF: path.join(DOUTOR_DIRS.PERF, 'ultimo-diff.json')
} as const;

/**
 * Mapeia nomes legados para novos caminhos (migração automática)
 */
export const MIGRACAO_MAPA = {
  // Guardian: baseline.json → guardian.baseline.json
  [DOUTOR_ARQUIVOS.GUARDIAN_BASELINE_LEGACY]: DOUTOR_ARQUIVOS.GUARDIAN_BASELINE,
  // Estrutura: baseline-estrutura.json → estrutura.baseline.json
  [DOUTOR_ARQUIVOS.ESTRUTURA_BASELINE_LEGACY]: DOUTOR_ARQUIVOS.ESTRUTURA_BASELINE,
  // Arquétipo: doutor.repo.arquetipo.json (raiz) → .doutor/estrutura.arquetipo.json
  [DOUTOR_ARQUIVOS.ESTRUTURA_ARQUETIPO_LEGACY_ROOT]: DOUTOR_ARQUIVOS.ESTRUTURA_ARQUETIPO
} as const;

/**
 * Retorna o caminho legado (se existir) ou o novo
 * @param newPath Caminho novo desejado
 * @returns Caminho do arquivo (prioriza legado se existir)
 */
export function resolveFilePath(newPath: string): string {
  // Verifica se há entrada no mapa de migração reverso
  const legacyCaminho = Object.entries(MIGRACAO_MAPA).find(([_, target]) => target === newPath)?.[0];
  return legacyCaminho || newPath;
}

/**
 * Tipo para caminhos de arquivos do Doutor
 */
export type DoutorFilePath = (typeof DOUTOR_ARQUIVOS)[keyof typeof DOUTOR_ARQUIVOS];
export type DoutorDirPath = (typeof DOUTOR_DIRS)[keyof typeof DOUTOR_DIRS];