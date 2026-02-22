// SPDX-License-Identifier: MIT

import generateModule from '@babel/generator';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { ExitCode, sair } from '@cli/helpers/exit-codes.js';
import { getFilesWithExtension, getSourceFiles } from '@cli/helpers/get-files-src.js';
import chalk from '@core/config/chalk-safe.js';
import { config } from '@core/config/config.js';
import { log } from '@core/messages/index.js';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- CJS default interop
// @ts-ignore
const traverse = traverseModule.default || traverseModule;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- CJS default interop
// @ts-ignore
const generate = generateModule.default || generateModule;

function parseMappingLine(line: string): { oldName: string; newName: string } | null {
  const parts = line.split('=');
  if (parts.length < 2) return null;
  const oldName = parts[0].trim();
  const newNome = parts[1].trim();
  if (!oldName || !newNome || oldName === newNome) return null;
  return { oldName, newName: newNome };
}

function loadMappingsFromFile(
  filePath: string,
  mappings: Map<string, string>,
  raizDir: string,
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    const parsed = parseMappingLine(line);
    if (parsed) {
      const existing = mappings.get(parsed.oldName);
      if (existing !== undefined && existing !== parsed.newName && config.VERBOSE) {
        log.info(
          `Conflito de mapeamento para "${parsed.oldName}": ${path.relative(raizDir, filePath)} usa "${parsed.newName}", anterior era "${existing}" (last wins).`,
        );
      }
      mappings.set(parsed.oldName, parsed.newName);
    }
  }
}

export function comandoRename(
  aplicarFlagsGlobais: (opts: Record<string, unknown>) => void,
): Command {
  return new Command('rename')
    .description(
      'Aplica as renomeações de variáveis baseadas no arquivo(s) de mapeamento em names/.',
    )
    .action(async function (this: Command) {
      try {
        await aplicarFlagsGlobais(
          this.parent && typeof this.parent.opts === 'function'
            ? this.parent.opts()
            : {},
        );
      } catch (err) {
        log.erro(
          `Falha ao aplicar flags: ${err instanceof Error ? err.message : String(err)}`,
        );
        sair(ExitCode.Failure);
        return;
      }

      const RAIZ_DIR = process.cwd();
      const SRC_DIR = path.resolve(RAIZ_DIR, 'src');
      const NAMES_DIR = path.resolve(RAIZ_DIR, 'names');
      const MAPPING_ARQUIVO = path.resolve(NAMES_DIR, 'name.txt');

      const mappings = new Map<string, string>();

      if (fs.existsSync(MAPPING_ARQUIVO)) {
        loadMappingsFromFile(MAPPING_ARQUIVO, mappings, RAIZ_DIR);
      } else if (fs.existsSync(NAMES_DIR)) {
        const txtFiles = getFilesWithExtension(NAMES_DIR, '.txt');
        if (txtFiles.length === 0) {
          log.erro(
            `Nenhum arquivo de mapeamento em ${chalk.bold('names/')}. Execute o comando ${chalk.bold('names')} primeiro.`,
          );
          sair(ExitCode.Failure);
          return;
        }
        for (const f of txtFiles) {
          loadMappingsFromFile(f, mappings, RAIZ_DIR);
        }
      } else {
        log.erro(
          `Pasta de mapeamento não encontrada: ${chalk.bold('names/')}. Execute o comando ${chalk.bold('names')} primeiro.`,
        );
        sair(ExitCode.Failure);
        return;
      }

      if (mappings.size === 0) {
        log.aviso(
          'Nenhum mapeamento de tradução encontrado (formato: nomeAntigo = nomeNovo por linha).',
        );
        return;
      }

      const files = getSourceFiles(SRC_DIR);
      let totalArquivosUpdated = 0;
      log.info(
        chalk.cyan(
          `Iniciando renomeação de variáveis (${mappings.size} mapeamentos)...`,
        ),
      );
      for (const file of files) {
        try {
          const code = fs.readFileSync(file, 'utf-8');
          const ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'decorators-legacy'],
          });
          let changed = false;
          traverse(ast, {
            Identifier(path) {
              const newNome = mappings.get(path.node.name);
              if (newNome && newNome !== path.node.name) {
                path.node.name = newNome;
                changed = true;
              }
            },
          });
          if (changed) {
            const output = generate(
              ast,
              {
                retainLines: false,
                comments: true,
                compact: false,
              },
              code,
            );
            fs.writeFileSync(file, output.code);
            if (config.VERBOSE)
              log.info(`Atualizado: ${path.relative(RAIZ_DIR, file)}`);
            totalArquivosUpdated++;
          }
        } catch {
          // ignora erros de parse por arquivo
        }
      }
      log.sucesso(
        `Renomeação concluída! ${totalArquivosUpdated} arquivos atualizados.`,
      );
    });
}
