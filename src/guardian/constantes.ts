// SPDX-License-Identifier: MIT
import { DOUTOR_ARQUIVOS } from '@core/registry/paths.js';

/**
 * 📌 Caminho absoluto para o arquivo de baseline principal (usado pelo Sentinela).
 *
 * Usa o sistema de paths centralizado: .doutor/guardian.baseline.json
 * Com fallback automático para baseline.json legado se necessário.
 */
export const LINHA_BASE_CAMINHO = DOUTOR_ARQUIVOS.GUARDIAN_BASELINE;

/**
 * 📌 Caminho padrão para os registros da Vigia Oculta.
 *
 * Integridade de execução armazenada em .doutor/integridade.json
 */
export const REGISTRO_VIGIA_CAMINHO_PADRAO = DOUTOR_ARQUIVOS.REGISTRO_VIGIA;
/**
 * 🧮 Algoritmo padrão utilizado para hashing de integridade.
 * (BLAKE3 é o padrão universal do Guardian.)
 */
export const ALGORITMO_HASH = 'blake3';