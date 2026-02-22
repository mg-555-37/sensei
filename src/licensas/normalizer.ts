// SPDX-License-Identifier: MIT
/**
 * License normalizer ported from original JS implementation.
 */

type SpdxParseFn = (s: string) => unknown;
type SpdxCorrectFn = (s: string) => string | null;
type SpdxLicenseEntry = { name?: string } | string;

let spdxParse: SpdxParseFn | null = null;
let spdxCorrect: SpdxCorrectFn | null = null;
let spdxLicencaList: Record<string, SpdxLicenseEntry> | null = null;
let spdxLoaded = false;
async function tryLoadSpdx(): Promise<void> {
  if (spdxLoaded) return;
  spdxLoaded = true;
  try {
    spdxParse = (await import('spdx-expression-parse')).default || (await import('spdx-expression-parse'));
  } catch {}
  try {
    spdxCorrect = (await import('spdx-correct')).default || (await import('spdx-correct'));
  } catch {}
  try {
    spdxLicencaList = (await import('spdx-license-list')).default || (await import('spdx-license-list'));
  } catch {}
}
function fallbackNormalize(raw: unknown): string {
  if (raw == null) return 'UNKNOWN';
  if (Array.isArray(raw)) return raw.map(r => fallbackNormalize(r)).join(' OR ');
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return obj.type != null ? fallbackNormalize(obj.type) : 'UNKNOWN';
  }
  let s = String(raw).trim();
  s = s.replace(/\s+/g, ' ');
  const map: Record<string, string> = {
    mit: 'MIT',
    isc: 'ISC',
    'apache-2.0': 'Apache-2.0',
    apache: 'Apache-2.0',
    gpl: 'GPL',
    agpl: 'AGPL',
    lgpl: 'LGPL'
  };
  const parts = s.split(/\s+(OR|AND)\s+/i);
  return parts.map(p => {
    if (/^(OR|AND)$/i.test(p)) return p.toUpperCase();
    const key = p.toLowerCase();
    if (map[key]) return map[key];
    let token = p.trim();
    try {
      if (spdxCorrect) token = spdxCorrect(token) ?? token;
    } catch {}
    try {
      if (spdxLicencaList) {
        const id = String(token).trim();
        if (spdxLicencaList[id]) return id;
        const matchId = Object.keys(spdxLicencaList).find(k => k.toLowerCase() === String(token).toLowerCase());
        if (matchId) return matchId;
        const matchByNome = Object.entries(spdxLicencaList).find(([, v]) => v && typeof v === 'object' && v.name && String(v.name).toLowerCase() === String(token).toLowerCase());
        if (matchByNome) return matchByNome[0];
      }
    } catch {}
    return token;
  }).join(' ');
}

/**
 * Normalize a license value into a canonical string (preferably SPDX-like).
 * Supports strings, arrays and simple objects ({ type }).
 * Falls back to a heuristic normalizer when full SPDX libraries are not available.
 */
export async function normalizeLicense(raw: unknown): Promise<string> {
  await tryLoadSpdx();
  if (spdxParse && typeof raw === 'string' && /\b(OR|AND)\b/i.test(raw)) {
    return fallbackNormalize(raw);
  }
  if (spdxParse) {
    try {
      if (Array.isArray(raw)) return raw.map(r => awaitOrFallback(r)).join(' OR ');
      if (typeof raw === 'object') raw = (raw as Record<string, unknown>).type ?? raw;
      return awaitOrFallback(raw);
    } catch {
      // fallthrough
    }
  }
  return fallbackNormalize(raw);
  function awaitOrFallback(value: unknown): string {
    try {
      const s = String(value).trim();
      const corrected = spdxCorrect ? spdxCorrect(s) ?? s : s;
      if (spdxParse) {
        try {
          const parsed = spdxParse(corrected);
          return astToExpression(parsed);
        } catch {
          return corrected;
        }
      }
      return corrected;
    } catch {
      return fallbackNormalize(value);
    }
  }
  function astToExpression(ast: unknown): string {
    if (!ast) return 'UNKNOWN';
    if (typeof ast === 'string') return ast;
    const node = ast as Record<string, unknown>;
    if (node.license) return String(node.license);
    if (node.left != null && node.right != null && node.conjunction) {
      return `${astToExpression(node.left)} ${String(node.conjunction).toUpperCase()} ${astToExpression(node.right)}`;
    }
    return JSON.stringify(ast);
  }
}
export default normalizeLicense;