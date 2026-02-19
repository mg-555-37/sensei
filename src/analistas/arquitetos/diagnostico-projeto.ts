// SPDX-License-Identifier: MIT
import type { DiagnosticoProjeto, SinaisProjeto } from '@';

// Níveis de confiança para detecção de tipos de projeto
const CONFIANCA = {
  PADRAO: 0.3,
  FULLSTACK: 0.95,
  MONOREPO: 0.99,
  LANDING: 0.92,
  API: 0.88,
  CLI: 0.85,
  LIB: 0.8,
} as const;

export function diagnosticarProjeto(sinais: SinaisProjeto): DiagnosticoProjeto {
  const positivos = Object.entries(sinais)
    .filter(([, valor]) => valor === true)
    .map(([chave]) => chave as keyof SinaisProjeto);

  let tipo: DiagnosticoProjeto['tipo'] = 'desconhecido';
  let confianca: number = CONFIANCA.PADRAO;

  if ('ehFullstack' in sinais && sinais.ehFullstack) {
    tipo = 'fullstack';
    confianca = CONFIANCA.FULLSTACK;
  } else if ('ehMonorepo' in sinais && sinais.ehMonorepo) {
    tipo = 'monorepo';
    confianca = CONFIANCA.MONOREPO;
  } else if (ehLanding(sinais)) {
    tipo = 'landing';
    confianca = CONFIANCA.LANDING;
  } else if (ehApi(sinais)) {
    tipo = 'api';
    confianca = CONFIANCA.API;
  } else if (ehCli(sinais)) {
    tipo = 'cli';
    confianca = CONFIANCA.CLI;
  } else if (ehLib(sinais)) {
    tipo = 'lib';
    confianca = CONFIANCA.LIB;
  }

  // Mantém valor de confiança original (0..1) sem arredondar para evitar perda de precisão
  return { tipo, sinais: positivos, confiabilidade: confianca };
}

function ehLanding(s: SinaisProjeto): boolean {
  // Considera landing se temPages for true, mesmo sem components/controllers
  return !!(s.temPages === true);
}

function ehApi(s: SinaisProjeto): boolean {
  return !!(s.temApi ?? s.temControllers ?? s.temExpress);
}

function ehLib(s: SinaisProjeto): boolean {
  return !!(s.temSrc && !s.temComponents && !(s.temApi ?? false));
}

function ehCli(s: SinaisProjeto): boolean {
  return !!s.temCli;
}
