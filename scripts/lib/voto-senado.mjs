/**
 * Comparecimento às votações nominais do Senado.
 *
 * A API põe o MOTIVO DA AUSÊNCIA no mesmo campo do voto, e `SiglaDescricaoVoto` é
 * vocabulário controlado — classifique por código, nunca por regex na descrição em
 * prosa: um regex descontava "Atividade parlamentar" e deixava "Missão da Casa"
 * passar como presença, sendo as duas a mesma coisa. Para conferir um código novo,
 * `plenario/lista/votacao/{AAAAMMDD}` devolve a votação inteira.
 */

const AUSENTE = new Set(['AP', 'MIS', 'LS', 'LP', 'LAP', 'NCom']);
const PRESENTE = new Set([
  'Sim', 'Não', 'Abstenção', 'Votou', 'P-NRV', 'Presidente (art. 51 RISF)', 'NA',
]);

/** Código fora das duas listas — a ingestão loga em vez de assumir presença. */
export const codigoDesconhecido = (sigla) => {
  const s = (sigla ?? '').trim();
  return s !== '' && !AUSENTE.has(s) && !PRESENTE.has(s);
};

/** Presença. `P-NRV` conta: o rótulo ("Presente – Não registrou voto") a afirma. */
export function compareceu(v) {
  const sigla = (v?.SiglaDescricaoVoto ?? '').trim();
  if (AUSENTE.has(sigla)) return false;
  if (PRESENTE.has(sigla)) return true;
  return !/não compareceu|ausen|licen|não votou|atividade parlamentar|miss[ãa]o/i.test(v?.DescricaoVoto ?? '');
}

/**
 * Votou de fato — exclui também o `P-NRV`. A Câmara não tem equivalente (o bulk só
 * registra voto efetivo), então sem as duas taxas os 90% do senador parecem
 * comparáveis aos 59% do deputado. Informativa: a Stamina segue no comparecimento.
 */
export function registrouVoto(v) {
  return (v?.SiglaDescricaoVoto ?? '').trim() !== 'P-NRV' && compareceu(v);
}
