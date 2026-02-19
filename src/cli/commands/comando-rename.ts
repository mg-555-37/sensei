// SPDX-License-Identifier: MIT

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import { Command } from 'commander';
import chalk from '@core/config/chalk-safe.js';
import { log } from '@core/messages/index.js';
import { config } from '@core/config/config.js';
import { ExitCode, sair } from '@cli/helpers/exit-codes.js';

// @ts-ignore
const traverse = traverseModule.default || traverseModule;
// @ts-ignore
const generate = generateModule.default || generateModule;
export function comandoRename(aplicarFlagsGlobais: (opts: Record<string, unknown>) => void): Command {
  return new Command('rename').description('Aplica as renomeações de variáveis baseadas no arquivo de mapeamento.').action(async function (this: Command) {
    try {
      await aplicarFlagsGlobais(this.parent && typeof this.parent.opts === 'function' ? this.parent.opts() : {});
    } catch (err) {
      log.erro(`Falha ao aplicar flags: ${err instanceof Error ? err.message : String(err)}`);
      sair(ExitCode.Failure);
      return;
    }
    const RAIZ_DIR = process.cwd();
    const SRC_DIR = path.resolve(RAIZ_DIR, 'src');
    const MAPPING_ARQUIVO = path.resolve(RAIZ_DIR, 'names', 'name.txt');
    if (!fs.existsSync(MAPPING_ARQUIVO)) {
      log.erro(`Arquivo de mapeamento não encontrado: ${chalk.bold('names/name.txt')}`);
      log.info('Execute o comando `names` primeiro para gerar a lista.');
      sair(ExitCode.Failure);
      return;
    }
    const lines = fs.readFileSync(MAPPING_ARQUIVO, 'utf-8').split('\n');
    const mappings = new Map<string, string>();
    for (const line of lines) {
      const parts = line.split('=');
      if (parts.length < 2) continue;
      const oldName = parts[0].trim();
      const newNome = parts[1].trim();

      // Apenas adiciona se tiver um novo nome e for DIFERENTE do antigo
      if (oldName && newNome && oldName !== newNome) {
        mappings.set(oldName, newNome);
      }
    }
    if (mappings.size === 0) {
      log.aviso('Nenhum mapeamento de tradução encontrado em name.txt.');
      return;
    }
    function getFiles(dir: string): string[] {
      const files: string[] = [];
      if (!fs.existsSync(dir)) return files;
      const items = fs.readdirSync(dir, {
        withFileTypes: true
      });
      for (const item of items) {
        if (item.isDirectory()) {
          if (['node_modules', 'dist', 'names', '.git', '.doutor'].includes(item.name)) continue;
          files.push(...getFiles(path.join(dir, item.name)));
        } else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) {
          files.push(path.join(dir, item.name));
        }
      }
      return files;
    }
    const files = getFiles(SRC_DIR);
    let totalArquivosUpdated = 0;
    log.info(chalk.cyan(`Iniciando renomeação de variáveis (Processando ${mappings.size} mapeamentos)...`));
    for (const file of files) {
      try {
        const code = fs.readFileSync(file, 'utf-8');
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'decorators-legacy']
        });
        let changed = false;
        traverse(ast, {
          Identifier(path) {
            const newNome = mappings.get(path.node.name);
            if (newNome && newNome !== path.node.name) {
              // Evita renomear se for uma Keyword em algum contexto? Babel já cuida disso no nome.
              path.node.name = newNome;
              changed = true;
            }
          }
        });
        if (changed) {
          const output = generate(ast, {
            retainLines: false,
            // retainLines estava causando quebras em casts de tipos
            comments: true,
            compact: false
          }, code);
          fs.writeFileSync(file, output.code);
          if (config.VERBOSE) log.info(`Atualizado: ${path.relative(RAIZ_DIR, file)}`);
          totalArquivosUpdated++;
        }
      } catch (e) {
        // console.warn(`[Aviso] Erro ao processar ${path.relative(ROOT_DIR, file)}`);
      }
    }
    log.sucesso(`Renomeação concluída! ${totalArquivosUpdated} arquivos atualizados.`);
  });
}