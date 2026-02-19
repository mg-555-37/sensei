// SPDX-License-Identifier: MIT
/**
 * @fileoverview Registry centralizado para operações de leitura/escrita de arquivos JSON
 *
 * Este módulo fornece uma camada de abstração sobre a persistência,
 * gerenciando migrações automáticas de arquivos legados e garantindo
 * que todos os arquivos sejam salvos nos locais corretos.
 *
 * Features:
 * - Migração automática de arquivos legados
 * - Validação de integridade de JSONs
 * - Logging de operações de I/O
 * - Fallback para configurações seguras
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ExcecoesMensagens } from '@core/messages/core/excecoes-messages.js';
import type { MigrationResult } from '@';
import { log } from '../messages/log/log.js';
import { DOUTOR_DIRS, DOUTOR_ARQUIVOS, type DoutorFilePath, MIGRACAO_MAPA } from './paths.js';

/**
 * Opções para operações de leitura
 */
interface ReadOptions<T> {
  /** Valor padrão se arquivo não existir */
  default?: T;
  /** Tentar migrar de arquivo legado automaticamente */
  migrate?: boolean;
  /** Validar estrutura do JSON */
  validate?: (data: unknown) => data is T;
}

/**
 * Opções para operações de escrita
 */
interface WriteOptions {
  /** Criar diretórios pai se não existirem */
  createDirs?: boolean;
  /** Fazer backup antes de sobrescrever */
  backup?: boolean;
  /** Pretty print JSON */
  pretty?: boolean;
}

/**
 * Verifica se arquivo existe
 */
async function fileExists(fileCaminho: string): Promise<boolean> {
  try {
    await fs.access(fileCaminho);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cria diretórios pai se não existirem
 */
async function ensureDir(fileCaminho: string): Promise<void> {
  const dir = path.dirname(fileCaminho);
  await fs.mkdir(dir, {
    recursive: true
  });
}

/**
 * Tenta migrar arquivo legado para novo local
 */
async function tryMigrate(targetPath: string): Promise<MigrationResult> {
  const legacyCaminho = Object.entries(MIGRACAO_MAPA).find(([_, target]) => target === targetPath)?.[0];
  if (!legacyCaminho) {
    return {
      migrated: false
    };
  }
  const legacyExists = await fileExists(legacyCaminho);
  if (!legacyExists) {
    return {
      migrated: false
    };
  }
  try {
    // Ler arquivo legado
    const content = await fs.readFile(legacyCaminho, 'utf-8');

    // Garantir diretório de destino
    await ensureDir(targetPath);

    // Escrever no novo local
    await fs.writeFile(targetPath, content, 'utf-8');

    // Renomear arquivo legado (não deletar para segurança)
    const backupCaminho = `${legacyCaminho}.migrated`;
    await fs.rename(legacyCaminho, backupCaminho);
    log.info(`Migração automática: ${path.basename(legacyCaminho)} → ${path.basename(targetPath)}`);
    return {
      migrated: true,
      from: legacyCaminho,
      to: targetPath
    };
  } catch (erro) {
    log.aviso(`Falha na migração de ${legacyCaminho}: ${(erro as Error).message}`);
    return {
      migrated: false
    };
  }
}

/**
 * Lê arquivo JSON do registry
 *
 * @param filePath Caminho do arquivo (use DOUTOR_FILES.*)
 * @param options Opções de leitura
 * @returns Conteúdo parseado do JSON
 *
 * @example
 * ```ts
 * const config = await readJSON(DOUTOR_FILES.CONFIG, {
 *   default: {}
 * });
 * ```
 */
export async function readJSON<T = unknown>(fileCaminho: DoutorFilePath | string, options: ReadOptions<T> = {}): Promise<T> {
  const {
    default: defaultValue,
    migrate = true,
    validate
  } = options;
  try {
    // Tentar migração se habilitado
    if (migrate) {
      const migration = await tryMigrate(fileCaminho);
      if (migration.migrated && migration.to) {
        // Usar arquivo migrado
        fileCaminho = migration.to;
      }
    }

    // Verificar existência
    const exists = await fileExists(fileCaminho);
    if (!exists) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(ExcecoesMensagens.arquivoNaoEncontrado(String(fileCaminho)));
    }

    // Ler e parsear
    const content = await fs.readFile(fileCaminho, 'utf-8');
    const parsed = JSON.parse(content) as T;

    // Validar se fornecido
    if (validate && !validate(parsed)) {
      throw new Error(ExcecoesMensagens.validacaoFalhouPara(String(fileCaminho)));
    }
    return parsed;
  } catch (erro) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(ExcecoesMensagens.erroAoLer(String(fileCaminho), (erro as Error).message));
  }
}

/**
 * Escreve arquivo JSON no registry
 *
 * @param filePath Caminho do arquivo (use DOUTOR_FILES.*)
 * @param data Dados a serem salvos
 * @param options Opções de escrita
 *
 * @example
 * ```ts
 * await writeJSON(DOUTOR_FILES.GUARDIAN_BASELINE, snapshot, {
 *   createDirs: true,
 *   backup: true
 * });
 * ```
 */
export async function writeJSON<T = unknown>(fileCaminho: DoutorFilePath | string, data: T, options: WriteOptions = {}): Promise<void> {
  const {
    createDirs = true,
    backup = false,
    pretty = true
  } = options;
  try {
    // Criar diretórios se necessário
    if (createDirs) {
      await ensureDir(fileCaminho);
    }

    // Fazer backup se solicitado
    if (backup && (await fileExists(fileCaminho))) {
      const backupCaminho = `${fileCaminho}.backup`;
      await fs.copyFile(fileCaminho, backupCaminho);
    }

    // Serializar JSON
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

    // Escrever arquivo
    await fs.writeFile(fileCaminho, content, 'utf-8');
  } catch (erro) {
    throw new Error(ExcecoesMensagens.erroAoEscrever(String(fileCaminho), (erro as Error).message));
  }
}

/**
 * Deleta arquivo do registry
 *
 * @param filePath Caminho do arquivo (use DOUTOR_FILES.*)
 * @param options Opções de deleção
 */
export async function deleteJSON(fileCaminho: DoutorFilePath | string, options: {
  backup?: boolean;
} = {}): Promise<void> {
  const {
    backup = true
  } = options;
  try {
    const exists = await fileExists(fileCaminho);
    if (!exists) {
      return; // Já deletado
    }
    if (backup) {
      const backupCaminho = `${fileCaminho}.deleted`;
      await fs.rename(fileCaminho, backupCaminho);
    } else {
      await fs.unlink(fileCaminho);
    }
  } catch (erro) {
    throw new Error(ExcecoesMensagens.erroAoDeletar(String(fileCaminho), (erro as Error).message));
  }
}

/**
 * Lista todos os arquivos JSON em um diretório do registry
 *
 * @param dirPath Caminho do diretório (use DOUTOR_DIRS.*)
 * @returns Lista de caminhos completos
 */
export async function listJSONFiles(dirPath: string): Promise<string[]> {
  try {
    const exists = await fileExists(dirPath);
    if (!exists) {
      return [];
    }
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true
    });
    const jsonArquivos = entries.filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => path.join(dirPath, entry.name));
    return jsonArquivos;
  } catch (erro) {
    log.aviso(`Erro ao listar arquivos em ${dirPath}: ${(erro as Error).message}`);
    return [];
  }
}

/**
 * Exporta funções auxiliares para compatibilidade com código existente
 */
export const ArquivoRegistro = {
  read: readJSON,
  write: writeJSON,
  delete: deleteJSON,
  list: listJSONFiles,
  paths: DOUTOR_ARQUIVOS,
  dirs: DOUTOR_DIRS
} as const;