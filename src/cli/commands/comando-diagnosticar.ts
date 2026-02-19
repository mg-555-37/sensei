// SPDX-License-Identifier: MIT
// @doutor-disable tipo-literal-inline-complexo
// Justificativa: tipos inline para opções de comando CLI são locais e não precisam de extração
import { optionsDiagnosticar } from '@cli/options-diagnosticar.js';
import { processarDiagnostico } from '@cli/processamento-diagnostico.js';
import { CliComandoDiagnosticarMensagens } from '@core/messages/cli/cli-comando-diagnosticar-messages.js';
import { CABECALHOS, log } from '@core/messages/index.js';
import { ativarModoJson } from '@shared/helpers/json-mode.js';
import { Command } from 'commander';
import ora from 'ora';
import type { ParentWithOpts } from '@';
export function comandoDiagnosticar(aplicarFlagsGlobais: (opts: Record<string, unknown>) => void): Command {
  const cmd = new Command('diagnosticar').alias('diag').description('Executa uma análise completa do repositório');

  // Em modo padrão, ignoramos opções desconhecidas para evitar saídas forçadas do Commander
  // (comportamento desejado também pelos testes de opções inválidas)
  cmd.allowUnknownOption(true);
  // Também aceitamos argumentos excedentes silenciosamente, pois diversos testes
  // passam o nome do comando na linha simulada (ex.: ['node','cli','diagnosticar', ...])
  // e o Commander trataria como "excess arguments" por padrão.
  cmd.allowExcessArguments(true);

  // Adiciona opções centralizadas
  for (const opt of optionsDiagnosticar) {
    if ('parser' in opt && opt.parser) {
      cmd.option(opt.flags, opt.desc, opt.parser, opt.defaultValue);
    } else if ('defaultValue' in opt) {
      cmd.option(opt.flags, opt.desc, opt.defaultValue);
    } else {
      cmd.option(opt.flags, opt.desc);
    }
  }
  cmd.action(async (opts: {
    guardianCheck?: boolean;
    json?: boolean;
    include?: string[];
    exclude?: string[];
    listarAnalistas?: boolean;
    detalhado?: boolean;
    criarArquetipo?: boolean;
    salvarArquetipo?: boolean;
    full?: boolean;
    fast?: boolean;
    logNivel?: string;
    executive?: boolean;
    autoFix?: boolean;
    autoCorrecaoMode?: string;
    autoFixConservative?: boolean;
  }, command: Command) => {
    // Aplicar flags globais (merge entre flags passadas antes do subcomando e flags locais)
    // Isso garante que opções como --export funcionem tanto quando fornecidas antes quanto depois do subcomando
    try {
      const parentObj = command.parent as unknown as {
        opts?: () => Record<string, unknown>;
      } | undefined;
      const parentFlags = parentObj && typeof parentObj.opts === 'function' ? parentObj.opts() : {};
      const localFlags = typeof command.opts === 'function' ? command.opts() : {};
      const merged = {
        ...(parentFlags || {}),
        ...(localFlags || {}),
        ...(opts || {})
      };
      await aplicarFlagsGlobais(merged);
    } catch {
      // Em caso de erro ao aplicar flags, ainda tentamos aplicar as flags locais de forma conservadora
      try {
        await aplicarFlagsGlobais(opts as unknown as Record<string, unknown>);
      } catch {
        /* swallow - falha de flags não deve interromper execução aqui */
      }
    }

    // Fast mode de teste: retorna estrutura mínima simulada sem executar análise completa
    if (process.env.DOUTOR_TEST_FAST === '1') {
      if (opts.json) {
        // Estrutura mínima para satisfazer consumidores dos testes
        console.log(JSON.stringify({
          meta: {
            fast: true,
            tipo: CliComandoDiagnosticarMensagens.fastModeTipo
          },
          totalArquivos: 0,
          ocorrencias: []
        }, null, 2));
        return;
      }
      return;
    }
    // Ativar modo JSON se necessário (suprime logs visuais)
    if (opts.json) {
      ativarModoJson();
    }

    // Antes de delegar, imprimir um bloco de sugestões/flags úteis para o usuário
    // (APENAS em modo verbose/debug - não polui saída normal)
    const logNivel = opts.logNivel as string || 'info';
    const isVerbose = opts.full || logNivel === 'debug' || opts.detalhado;
    if (!opts.json && isVerbose) {
      try {
        const {
          default: chalk
        } = await import('@core/config/chalk-safe.js');
        const {
          config
        } = await import('@core/config/config.js');
        const activeFlags: string[] = [];
        const details: string[] = [];
        const parent = command.parent as unknown as ParentWithOpts | undefined;
        const parentOpts: Record<string, unknown> = parent && typeof parent.opts === 'function' ? parent.opts() : {};

        // Mapear flags relevantes e adicionar detalhes úteis
        if (opts.json) {
          activeFlags.push('--json');
          details.push(CliComandoDiagnosticarMensagens.detalheSaidaEstruturada);
        }
        if (opts.guardianCheck) {
          activeFlags.push('--guardian-check');
          details.push(CliComandoDiagnosticarMensagens.detalheGuardian);
        }
        if (opts.executive) {
          activeFlags.push('--executive');
          details.push(CliComandoDiagnosticarMensagens.detalheExecutive);
        }
        if (opts.full) {
          activeFlags.push('--full');
          details.push(CliComandoDiagnosticarMensagens.detalheFull);
        }
        if (opts.fast) {
          activeFlags.push('--fast');
          details.push(CliComandoDiagnosticarMensagens.detalheFast);
        }
        // Compact
        const localCompact = Boolean((opts as unknown as Record<string, unknown>)['compact']);
        const effectiveCompact = localCompact || !opts.full && !localCompact;
        if (effectiveCompact && !opts.full) {
          activeFlags.push('--compact');
          details.push(CliComandoDiagnosticarMensagens.detalheCompact);
        }
        if (opts.listarAnalistas) {
          activeFlags.push('--listar-analistas');
        }
        if (opts.autoFix) {
          activeFlags.push('--auto-fix');
          details.push(CliComandoDiagnosticarMensagens.detalheAutoFix);
        }
        if (opts.autoFixConservative) {
          activeFlags.push('--auto-fix-conservative');
          details.push(CliComandoDiagnosticarMensagens.detalheAutoFixConservative);
        }
        // include/exclude counts
        const includes = opts.include as string[] || [];
        const excludes = opts.exclude as string[] || [];
        if (includes.length) details.push(CliComandoDiagnosticarMensagens.detalheIncludePatterns(includes.length, includes.join(', ')));
        if (excludes.length) details.push(CliComandoDiagnosticarMensagens.detalheExcludePatterns(excludes.length, excludes.join(', ')));

        // Export flags can be passed as parent/global flags
        const parentExport = Boolean(parentOpts && Object.prototype.hasOwnProperty.call(parentOpts, 'export') && Boolean(parentOpts['export']));
        const parentExportFull = Boolean(parentOpts && Object.prototype.hasOwnProperty.call(parentOpts, 'exportFull') && Boolean(parentOpts['exportFull']));
        const localExport = Boolean((opts as unknown as Record<string, unknown>)['export']);
        const localExportFull = Boolean((opts as unknown as Record<string, unknown>)['exportFull']);
        if (parentExport || localExport) {
          activeFlags.push('--export');
          const relDir = config && (config as Record<string, unknown>)['RELATORIOS_DIR'] || 'relatorios';
          details.push(CliComandoDiagnosticarMensagens.detalheExport(String(relDir)));
        }
        if (parentExportFull || localExportFull) {
          activeFlags.push('--export-full');
          // manifest nome será gerado só durante execução; mencionar que shards serão criados
          details.push(CliComandoDiagnosticarMensagens.detalheExportFull);
        }

        // Log-level / debug mapping
        const resolvedParentLogNivel = parentOpts && Object.prototype.hasOwnProperty.call(parentOpts, 'logLevel') ? String(parentOpts['logLevel']) : undefined;
        const logNivel = opts.logNivel as string || resolvedParentLogNivel || 'info';
        details.push(CliComandoDiagnosticarMensagens.detalheLogLevel(String(logNivel)));

        // Recomendações para flags redundantes ou legadas
        details.push(CliComandoDiagnosticarMensagens.dicaPrefiraLogLevelDebug);
        details.push(CliComandoDiagnosticarMensagens.dicaAutoFixConservative);

        // Mostrar bloco apenas se houver conteúdo relevante
        if (activeFlags.length || details.length) {
          const header = chalk.cyan(CliComandoDiagnosticarMensagens.sugestoesHeader);
          const footer = chalk.cyan(CliComandoDiagnosticarMensagens.sugestoesFooter);
          log.info(header);
          if (activeFlags.length) log.info(chalk.yellow(`${CABECALHOS.diagnostico.flagsAtivas} `) + activeFlags.join(' '));else log.info(chalk.gray(CliComandoDiagnosticarMensagens.nenhumaFlagRelevante));
          log.info(CliComandoDiagnosticarMensagens.linhaEmBranco);
          log.info(chalk.green(CABECALHOS.diagnostico.informacoesUteis));
          for (const d of details) log.info(CliComandoDiagnosticarMensagens.detalheLinha(String(d)));
          log.info(footer);
        }
      } catch {
        // não crítico — prosseguir silenciosamente
      }
    }

    // Spinner visual durante processamento (APENAS se não estiver em modo JSON)
    const spinner = opts.json ? {
      text: '',
      start: () => spinner,
      succeed: () => {},
      fail: () => {}
    } : ora({
      text: CliComandoDiagnosticarMensagens.spinnerExecutando,
      spinner: 'dots'
    }).start();
    // Bridge de fases: atualizar texto do spinner conforme fases do processamento
    try {
      const logWithFase = log as {
        fase?: (t: string) => void;
      };
      logWithFase.fase = (t: string) => {
        if (typeof t === 'string' && t.trim()) {
          spinner.text = CliComandoDiagnosticarMensagens.spinnerFase(t);
        }
      };
    } catch {
      /* não crítico */
    }
    try {
      // Delegar todo o processamento para a função modularizada
      await processarDiagnostico(opts as unknown as import('@').OpcoesProcessamentoDiagnostico);
      spinner.succeed(CliComandoDiagnosticarMensagens.spinnerConcluido);
    } catch (err) {
      spinner.fail(CliComandoDiagnosticarMensagens.spinnerFalhou);
      throw err;
    }
  });
  return cmd;
}