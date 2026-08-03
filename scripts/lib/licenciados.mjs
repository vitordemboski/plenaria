/**
 * Quem está LICENCIADO do mandato — o titular afastado que sai da lista oficial e
 * por isso não tem ficha no site (a cadeira passa ao suplente empossado).
 *
 * As duas casas publicam só quem está em exercício, então a ausência é invisível:
 * este módulo é o que permite NOMEAR o ausente sem inventar o motivo dele.
 *
 * Regra que vale para as duas: classifique por CÓDIGO, nunca pela prosa (mesmo
 * princípio do voto-senado.mjs). No Senado a consulta ingênua — "titular da
 * legislatura que não está na lista atual" — devolve, junto dos licenciados, dois
 * senadores FALECIDOS, uma cassada e quatro renúncias. Chamar isso de "licença"
 * publicaria que um morto está temporariamente afastado. Daí a allowlist: causa
 * fora dela é NÃO-licença (omitir alguém é o status quo; afirmar errado, não).
 *
 * Nenhuma das duas APIs diz o MOTIVO da licença — a Câmara devolve `descricaoStatus`
 * vazio até para quem assumiu ministério. Só se pode publicar "licenciado desde X".
 */

/** Afastamento TEMPORÁRIO da cadeira (Senado, `SiglaCausaAfastamento`). */
export const CAUSAS_LICENCA = new Set(['LCS', 'AFO', 'LP', 'LS']);

/** Fim DEFINITIVO do exercício — a cadeira não volta para essa pessoa (ou nunca saiu). */
const CAUSAS_DEFINITIVAS = new Set(['FAL', 'CAS', 'REN', 'TER', 'RET']);

const sig = (s) => (s ?? '').trim();

/** Causa fora do vocabulário conhecido — a ingestão loga em vez de adivinhar. */
export const causaDesconhecida = (sigla) => {
  const s = sig(sigla);
  return s !== '' && !CAUSAS_LICENCA.has(s) && !CAUSAS_DEFINITIVAS.has(s);
};

/**
 * Câmara: `ultimoStatus` de `/deputados/{id}`. A situação já é vocabulário
 * controlado — "Licença" é o afastamento temporário; "Vacância" é a cadeira vaga
 * (morte, cassação, renúncia) e não entra.
 * @returns {{desde: string}|null}
 */
export function licencaCamara(ultimoStatus) {
  if (sig(ultimoStatus?.situacao) !== 'Licença') return null;
  const desde = sig(ultimoStatus?.data);
  return desde ? { desde } : null; // sem a data não há o que afirmar
}

/**
 * Senado: mandatos de `/senador/{cod}/mandatos`. Vale o ÚLTIMO exercício do mandato
 * da legislatura corrente — quem se afastou e voltou está em exercício.
 * @returns {{desde: string}|null}
 */
export function licencaSenado(mandatos, legislatura) {
  const alvo = String(legislatura);
  for (const m of mandatos ?? []) {
    const legs = [m?.PrimeiraLegislaturaDoMandato, m?.SegundaLegislaturaDoMandato]
      .map((l) => l?.NumeroLegislatura);
    if (!legs.includes(alvo)) continue;

    const ex = m?.Exercicios?.Exercicio;
    const lista = (Array.isArray(ex) ? ex : ex ? [ex] : [])
      .slice()
      .sort((a, b) => (a.DataInicio ?? '').localeCompare(b.DataInicio ?? ''));
    const ultimo = lista.at(-1);
    if (!ultimo?.DataFim) continue; // exercício aberto = sentado

    if (CAUSAS_LICENCA.has(sig(ultimo.SiglaCausaAfastamento))) return { desde: ultimo.DataFim };
  }
  return null;
}
