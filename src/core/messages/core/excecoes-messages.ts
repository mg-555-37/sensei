// SPDX-License-Identifier: MIT

export const ExcecoesMensagens = {
  // CLI
  exit1: 'exit:1',
  requireMutateFsAutoFix: 'Auto-fix indisponível',
  autoFixTimeout: (timeoutMs: number) => `Auto-fix timeout após ${timeoutMs}ms`,
  // Plugins / import seguro
  pluginsDesabilitadosSafeMode: 'Carregamento de plugins desabilitado em SAFE_MODE. Defina DOUTOR_ALLOW_PLUGINS=1 para permitir.',
  pluginBloqueado: (erro: string) => `Plugin bloqueado: ${erro}`,
  caminhoPluginNaoResolvido: 'Caminho de plugin não resolvido',
  // Registry de plugins
  pluginRegistradoNaoPodeSerObtido: (name: string) => `Plugin ${name} está registrado mas não pode ser obtido`,
  pluginCarregandoPromiseNaoPodeSerObtida: (name: string) => `Plugin ${name} está sendo carregado mas promise não pode ser obtida`,
  naoFoiPossivelCarregarPlugin: (name: string, errMsg: string) => `Não foi possível carregar o plugin '${name}': ${errMsg}`,
  pluginDeveTerNomeValido: 'Plugin deve ter um nome válido',
  pluginDeveTerVersaoValida: 'Plugin deve ter uma versão válida',
  pluginDeveDefinirPeloMenosUmaExtensao: 'Plugin deve definir pelo menos uma extensão',
  pluginDeveImplementarMetodoParse: 'Plugin deve implementar método parse()',
  // Tipos/Analistas
  definicaoAnalistaInvalida: 'Definição de analista inválida',
  analistaSemFuncaoAplicar: (nome: string) => `Analista ${nome} sem função aplicar`,
  // Validação / Segurança
  caminhoForaDaCwdNaoPermitido: (p: string) => `Caminho fora da CWD não permitido: ${p}`,
  persistenciaNegadaForaRaizProjeto: (caminho: string) => `Persistência negada: caminho fora da raiz do projeto: ${caminho}`,
  // Persistência (ambiente)
  fsWriteFileBinaryIndisponivel: 'fs.writeFile (binary) indisponível no ambiente atual',
  fsReadFileIndisponivel: 'fs.readFile indisponível no ambiente atual',
  fsWriteFileIndisponivel: 'fs.writeFile indisponível no ambiente atual',
  fsRenameIndisponivel: 'fs.rename indisponível no ambiente atual',
  fsMkdirIndisponivel: 'fs.mkdir indisponível no ambiente atual',
  // Schema
  versaoSchemaDesconhecida: (versao: string) => `Versão de schema desconhecida: ${versao}`,
  relatorioSchemaInvalido: (erros: string) => `Relatório com schema inválido: ${erros}`,
  // File registry
  arquivoNaoEncontrado: (fileCaminho: string) => `Arquivo não encontrado: ${fileCaminho}`,
  validacaoFalhouPara: (fileCaminho: string) => `Validação falhou para ${fileCaminho}`,
  erroAoLer: (fileCaminho: string, errMsg: string) => `Erro ao ler ${fileCaminho}: ${errMsg}`,
  erroAoEscrever: (fileCaminho: string, errMsg: string) => `Erro ao escrever ${fileCaminho}: ${errMsg}`,
  erroAoDeletar: (fileCaminho: string, errMsg: string) => `Erro ao deletar ${fileCaminho}: ${errMsg}`,
  // Scanner
  statIndefinidoPara: (fullCaminho: string) => `Stat indefinido para ${fullCaminho}`,
  // Reversão
  mapaReversaoCorrompido: 'Mapa de reversão corrompido',
  // Relatórios
  semPkg: 'sem pkg'
} as const;