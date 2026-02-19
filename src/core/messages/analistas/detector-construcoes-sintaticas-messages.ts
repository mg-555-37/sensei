// SPDX-License-Identifier: MIT

type ErroUnknown = unknown;
function erroToMessage(erro: ErroUnknown): string {
  return erro instanceof Error ? erro.message : 'Erro desconhecido';
}
export const DetectorConstrucoesSintaticasMensagens = {
  identificadas: (mensagemFinal: string) => `Construções sintáticas identificadas: ${mensagemFinal}`,
  erroAnalisar: (erro: ErroUnknown) => `Erro ao analisar construções sintáticas: ${erroToMessage(erro)}`
} as const;