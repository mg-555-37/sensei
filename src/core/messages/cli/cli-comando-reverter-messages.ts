// SPDX-License-Identifier: MIT

export const CliComandoReverterMensagens = {
  mapaLimpoComSucesso: (iconeSucesso: string) => `${iconeSucesso} Mapa de reversão limpo com sucesso`,
  ultimoMove: (dataPtBr: string) => `Último move: ${dataPtBr}`
} as const;