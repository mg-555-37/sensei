// SPDX-License-Identifier: MIT
import { RelatorioMensagens } from '@core/messages/index.js';
import { salvarEstado } from '@shared/persistence/persistencia.js';
import type { MovimentoEstrutural, OpcoesRelatorioReestruturar } from '@';
export async function gerarRelatorioReestruturarMarkdown(caminho: string, movimentos: MovimentoEstrutural[], opcoes?: OpcoesRelatorioReestruturar): Promise<void> {
  const dataISO = new Date().toISOString();
  const total = movimentos.length;
  const simulado = opcoes?.simulado;
  const origem = opcoes?.origem ?? 'desconhecido';
  const preset = opcoes?.preset ?? 'doutor';
  const conflitos = opcoes?.conflitos ?? 0;
  const linhas: string[] = [];
  linhas.push(`# ${RelatorioMensagens.reestruturar.titulo}`);
  linhas.push('');
  linhas.push(`**${RelatorioMensagens.reestruturar.secoes.metadados.data}:** ${dataISO}  `);
  linhas.push(`**${RelatorioMensagens.reestruturar.secoes.metadados.execucao}:** ${simulado ? RelatorioMensagens.reestruturar.secoes.metadados.simulacao : RelatorioMensagens.reestruturar.secoes.metadados.real}  `);
  linhas.push(`**${RelatorioMensagens.reestruturar.secoes.metadados.origemPlano}:** ${origem}  `);
  linhas.push(`**${RelatorioMensagens.reestruturar.secoes.metadados.preset}:** ${preset}  `);
  linhas.push(`**${RelatorioMensagens.reestruturar.secoes.movimentos.total}:** ${total}  `);
  linhas.push(`**${RelatorioMensagens.reestruturar.secoes.conflitos.total}:** ${conflitos}  `);
  linhas.push('');
  linhas.push('---');
  linhas.push('');
  linhas.push(`## ${RelatorioMensagens.reestruturar.secoes.movimentos.titulo}`);
  if (!total) {
    linhas.push(RelatorioMensagens.reestruturar.secoes.movimentos.vazio);
  } else {
    const cols = RelatorioMensagens.reestruturar.secoes.movimentos.colunas;
    linhas.push(`| ${cols.origem} | ${cols.destino} |`);
    linhas.push('|----|------|');
    for (const m of movimentos) {
      linhas.push(`| ${m.de} | ${m.para} |`);
    }
  }
  await salvarEstado(caminho, linhas.join('\n'));
}
export async function gerarRelatorioReestruturarJson(caminho: string, movimentos: MovimentoEstrutural[], opcoes?: OpcoesRelatorioReestruturar): Promise<void> {
  const json = {
    simulado: Boolean(opcoes?.simulado),
    origem: opcoes?.origem ?? 'desconhecido',
    preset: opcoes?.preset ?? 'doutor',
    conflitos: opcoes?.conflitos ?? 0,
    totalMovimentos: movimentos.length,
    movimentos,
    timestamp: Date.now()
  };
  await salvarEstado(caminho, json);
}