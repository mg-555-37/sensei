// SPDX-License-Identifier: MIT
// CLI wrapper around the license-auditor functionality migrated from `implantar/licensas`.
// The original package exported a simple node script; here we integrate into the main Commander
// program and convert to TypeScript.

import path from 'node:path';
import { ExitCode, sair } from '@cli/helpers/exit-codes.js';
import { log } from '@core/messages/index.js';
import * as licensas from '@licensas/licensas.js';
import { Command } from 'commander';
export function comandoLicencas(): Command {
  const cmd = new Command('licencas').description('Ferramentas relacionadas a licença');
  cmd.allowUnknownOption(true);
  cmd.allowExcessArguments(true);

  // subcommand: scan
  cmd.command('scan').description('Escaneia dependências em busca de licenças desconhecidas').option('--root <path>', 'diretório raiz (padrão: cwd)').action(async (opts: {
    root?: string;
  }) => {
    try {
      const root = opts.root ? path.resolve(opts.root) : process.cwd();
      const result = await licensas.scanCommand({
        root
      });
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.problematic && result.problematic.length > 0 ? 2 : 0;
    } catch (err) {
      log.erro(`Falha ao escanear licenças: ${err instanceof Error ? err.message : String(err)}`);
      sair(ExitCode.Failure);
    }
  });

  // subcommand: notices generate
  const notices = cmd.command('notices').description('Gerenciar avisos/terceiros');
  notices.command('generate').description('Gerar arquivo THIRD-PARTY/AVISOS').option('--pt-br', 'usar cabeçalho em português').option('--output <file>', 'arquivo de saída').option('--root <path>', 'pasta do projeto').action(async (opts: {
    ptBr?: boolean;
    output?: string;
    root?: string;
  }) => {
    try {
      const root = opts.root ? path.resolve(opts.root) : process.cwd();
      const res = await licensas.generateNotices({
        root,
        ptBr: Boolean(opts.ptBr),
        output: opts.output
      });
      console.log('Generated notices:', res);
      sair(ExitCode.Ok);
    } catch (err) {
      log.erro(`Falha ao gerar notices: ${err instanceof Error ? err.message : String(err)}`);
      sair(ExitCode.Failure);
    }
  });

  // subcommand: disclaimer
  const disclaimer = cmd.command('disclaimer').description('Adicionar/verificar disclaimer em markdown');
  disclaimer.command('add').description('Inserir aviso de proveniência nos arquivos markdown').option('--disclaimer-path <path>', 'caminho do arquivo de disclaimer').option('--root <path>', 'pasta do projeto').option('--dry-run', 'não grava alterações, apenas lista').action(async (opts: {
    disclaimerPath?: string;
    root?: string;
    dryRun?: boolean;
  }) => {
    try {
      const root = opts.root ? path.resolve(opts.root) : process.cwd();
      const res = await licensas.addDisclaimer({
        root,
        disclaimerPath: opts.disclaimerPath,
        dryRun: Boolean(opts.dryRun)
      });
      console.log('Disclaimer inserted into files:', res.updatedArquivos.length);
      sair(ExitCode.Ok);
    } catch (err) {
      log.erro(`Falha ao adicionar disclaimer: ${err instanceof Error ? err.message : String(err)}`);
      sair(ExitCode.Failure);
    }
  });
  disclaimer.command('verify').description('Verificar se todos os markdown possuem o disclaimer').option('--disclaimer-path <path>').option('--root <path>').action(async (opts: {
    disclaimerPath?: string;
    root?: string;
  }) => {
    try {
      const root = opts.root ? path.resolve(opts.root) : process.cwd();
      const res = await licensas.verifyDisclaimer({
        root,
        disclaimerPath: opts.disclaimerPath
      });
      if (res.missing.length) {
        console.error('Missing disclaimer in files:');
        for (const f of res.missing) console.error('-', f);
        sair(ExitCode.Failure);
        return;
      }
      console.log('All markdown files include the disclaimer.');
      sair(ExitCode.Ok);
    } catch (err) {
      log.erro(`Falha ao verificar disclaimer: ${err instanceof Error ? err.message : String(err)}`);
      sair(ExitCode.Failure);
    }
  });
  return cmd;
}