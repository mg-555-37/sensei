// SPDX-License-Identifier: MIT

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { Command } from 'commander';
import chalk from '@core/config/chalk-safe.js';
import { log } from '@core/messages/index.js';
import { ExitCode, sair } from '@cli/helpers/exit-codes.js';

// @ts-ignore
const traverse = traverseModule.default || traverseModule;

export function comandoNames(
aplicarFlagsGlobais: (opts: Record<string, unknown>) => void)
: Command {
  return new Command('names').
  description('Varre o repositório em busca de nomes de variáveis e gera um arquivo de mapeamento.').
  action(async function (this: Command) {
    try {
      await aplicarFlagsGlobais(
        this.parent && typeof this.parent.opts === 'function' ? this.parent.opts() : {}
      );
    } catch (err) {
      log.erro(`Falha ao aplicar flags: ${err instanceof Error ? err.message : String(err)}`);
      sair(ExitCode.Failure);
      return;
    }

    const RAIZ_DIR = process.cwd();
    const SRC_DIR = path.resolve(RAIZ_DIR, 'src');
    const SAIDA_DIR = path.resolve(RAIZ_DIR, 'names');
    const SAIDA_ARQUIVO = path.resolve(SAIDA_DIR, 'name.txt');

    if (!fs.existsSync(SAIDA_DIR)) {
      fs.mkdirSync(SAIDA_DIR, { recursive: true });
    }

    function getFiles(dir: string): string[] {
      const files: string[] = [];
      if (!fs.existsSync(dir)) return files;
      const items = fs.readdirSync(dir, { withFileTypes: true });
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

    log.info(chalk.cyan('Iniciando varredura de nomes de variáveis...'));

    const files = getFiles(SRC_DIR);
    const variableNomes = new Set<string>();

    for (const file of files) {
      try {
        const code = fs.readFileSync(file, 'utf-8');
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'decorators-legacy']
        });

        traverse(ast, {
          VariableDeclarator(path) {
            if (path.node.id.type === 'Identifier') {
              variableNomes.add(path.node.id.name);
            }
          }
        });
      } catch (e) {
        // Apenas loga erro de parsing mas continua
        console.warn(`[Aviso] Erro ao processar ${path.relative(RAIZ_DIR, file)}`);
      }
    }

    const sortedNomes = Array.from(variableNomes).sort();
    const content = sortedNomes.map((name) => `${name} = `).join('\n');

    fs.writeFileSync(SAIDA_ARQUIVO, content);
    log.sucesso(`Varredura concluída! Encontradas ${sortedNomes.length} variáveis.`);
    log.info(`Mapeamento salvo em: ${chalk.bold(path.relative(RAIZ_DIR, SAIDA_ARQUIVO))}`);
  });
}