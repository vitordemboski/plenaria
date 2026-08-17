import type { Candidatura, Casa } from './types';

/**
 * Textos do chip de candidatura, num lugar só: ele aparece em quatro superfícies
 * (ficha, card, filtro, imagem compartilhável) e não pode dizer coisas diferentes
 * em cada uma. Estado factual, como partido e UF — não julga, não pontua.
 */

/** UF da candidatura ≠ UF do mandato acontece (mudança de domicílio eleitoral). */
const comUf = (c: Candidatura, ufMandato: string) =>
  c.uf && c.uf !== 'BR' && c.uf !== ufMandato ? ` (${c.uf})` : '';

/** Ficha: "Concorre em 2026: Câmara dos Deputados (reeleição)". */
export function rotuloCandidatura(c: Candidatura, ufMandato: string) {
  return `${c.cargo}${comUf(c, ufMandato)}${c.reeleicao ? ' (reeleição)' : ''}`;
}

/** Card da lista, ~390px: "2026: Gov. MG". */
export function rotuloCurtoCandidatura(c: Candidatura) {
  return `2026: ${c.curto}`;
}

/** Tooltip do chip. "Registrou pedido", nunca "deferida" — o TSE não publica
 *  deferimento nesta fase —, e sempre com a data: pode ser indeferida depois. */
export function explicaCandidatura(c: Candidatura, casa: Casa, ufMandato: string) {
  const alvo = c.reeleicao
    ? `à reeleição para ${casa === 'camara' ? 'a Câmara dos Deputados' : 'o Senado'}`
    : `a ${c.cargo}${comUf(c, ufMandato)}`;
  return `Registrou pedido de candidatura ${alvo} nas eleições de 2026. `
    + `Fonte: registro de candidaturas do TSE, arquivo de ${dataBR(c.registroEm)}. `
    + 'O TSE ainda não publica o deferimento neste arquivo, então o que se afirma é o pedido. '
    + 'Informativo: não pontua no Poder nem gera título.';
}

/** Linha da imagem compartilhável, que circula sem o site nem revalidação. */
export const linhaCandidaturaShare = (c: Candidatura) =>
  `Concorre em 2026: ${c.cargo} · registro no TSE, ${dataBR(c.registroEm)}`;

function dataBR(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
