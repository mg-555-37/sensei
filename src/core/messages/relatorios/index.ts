// SPDX-License-Identifier: MIT
/**
 * Mensagens de Relatórios MD/JSON
 */

export { getDescricaoCampo, JsonMensagens, wrapComMetadados } from './json-messages.js';
export { formatMessage, pluralize, RelatorioMensagens, separator } from './relatorio-messages.js';
export { escreverRelatorioMarkdown, gerarFooterRelatorio, gerarHeaderRelatorio, gerarSecaoEstatisticas, gerarSecaoGuardian, gerarSecaoProblemasAgrupados, gerarTabelaDuasColunas, gerarTabelaOcorrencias, gerarTabelaResumoTipos, type MetadadosRelatorioEstendido } from './relatorio-templates.js';