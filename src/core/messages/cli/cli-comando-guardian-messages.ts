// SPDX-License-Identifier: MIT

export const CliComandoGuardianMensagens = {
  baselineNaoPermitidoFullScan: 'Não é permitido aceitar baseline em modo --full-scan. Remova a flag e repita.',
  diffMudancasDetectadas: (drift: number) => `Detectadas ${drift} mudança(s) desde o baseline.`,
  diffComoAceitarMudancas: 'Execute `doutor guardian --accept-baseline` para aceitar essas mudanças.',
  baselineCriadoComoAceitar: 'Execute `doutor guardian --accept-baseline` para aceitá-lo ou `doutor diagnosticar` novamente.'
} as const;