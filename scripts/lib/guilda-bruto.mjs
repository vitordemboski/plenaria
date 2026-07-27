/**
 * Números BRUTOS da bancada de uma guilda — uma frase curta por atributo, no
 * mesmo espírito do `resumo-stat.mjs` (que faz isso para UM parlamentar).
 *
 * Por que isto existe: o atributo da guilda é a MÉDIA DOS PERCENTIS dos membros,
 * e percentil médio não tem bruto único — foi por isso que o card de guilda nasceu
 * sem número ao lado da barra. Só que "Ataque 60" sozinho não diz nada ao leitor:
 * a saída daqui é um agregado INDEPENDENTE, calculado sobre os brutos da bancada,
 * e por isso toda frase declara o que ela é (média por parlamentar ou soma da
 * bancada). Nunca apresente estes números como "o bruto do percentil médio" — são
 * duas contas diferentes sobre a mesma bancada.
 *
 * Duas formas, escolhidas pelo que a conta significa:
 *   · CONTAGEM (proposições, relatorias, cota) → média POR PARLAMENTAR;
 *   · TAXA (comparecimento, eficiência)        → soma da bancada ÷ soma da bancada,
 *     porque média de porcentagens de universos diferentes (o deputado vota em
 *     ~1.589 votações, o senador em ~418) não é a taxa da bancada.
 *
 * Só entram membros RANQUEÁVEIS — quem chama já filtra por `foraDoRanking`, a mesma
 * base do Poder médio e dos atributos. Misturar as duas casas é intencional (a
 * guilda é uma só), e cada frase carrega o denominador para que isso fique visível.
 */

const nf = new Intl.NumberFormat('pt-BR');
const pct = (n, d) => `${Math.round((n / d) * 100)}%`;
/** média com 1 casa só quando o número é pequeno (2,4 proposições diz mais que 2) */
const med = (soma, n) => {
  const v = soma / n;
  return v >= 10 || v === 0 ? nf.format(Math.round(v)) : nf.format(Math.round(v * 10) / 10);
};
/** concorda com o número JÁ FORMATADO ("1" é singular; "1,5" não é) */
const plural = (txt, um, muitos) => (txt === '1' ? um : muitos);

const soma = (ms, f) => ms.reduce((a, p) => a + (f(p) || 0), 0);

/**
 * @param membros parlamentares ranqueáveis da guilda, como estão em
 *   `data/politicians.json` (usa `bruto`, `relatoriasN`, `statRaw`, `casa`).
 * @returns { [statKey]: frase } — atributo sem base na bancada simplesmente não
 *   gera frase (mesma regra da evidência: nunca inventar).
 */
export function brutoDaGuilda(membros) {
  const r = {};
  const ms = (membros ?? []).filter((p) => p && p.bruto);
  if (!ms.length) return r;
  const n = ms.length;

  const props = med(soma(ms, (p) => p.bruto.proposicoes), n);
  r.ataque = `${props} ${plural(props, 'proposição', 'proposições')} por parlamentar`;

  const votos = soma(ms, (p) => p.bruto.votos);
  const votacoes = soma(ms, (p) => p.bruto.votacoes);
  if (votacoes) r.stamina = `${nf.format(votos)} de ${nf.format(votacoes)} votações da bancada · ${pct(votos, votacoes)}`;

  const tocou = soma(ms, (p) => p.bruto.eficTocou);
  const andou = soma(ms, (p) => p.bruto.eficAndou);
  if (tocou) r.eficiencia = `${nf.format(andou)} de ${nf.format(tocou)} matérias avançaram · ${pct(andou, tocou)}`;

  // Relatoria vale nas duas casas; emenda só na Câmara (a Técnica do senador é só
  // relatoria). Numa guilda mista, somar emendas e dividir pela bancada inteira
  // daria uma "média por parlamentar" que nenhum senador podia ter — então a
  // emenda só entra quando TODA a bancada é da Câmara, e aí a frase é exatamente
  // a mesma do card individual. Na mista, a linha fala só de relatoria: menos
  // informação, mas nenhum denominador inventado.
  const rel = med(soma(ms, (p) => p.relatoriasN), n);
  const soCamara = ms.every((p) => p.casa === 'camara');
  const emeSoma = soma(ms, (p) => (p.statRaw?.tecnica ?? 0) - (p.relatoriasN ?? 0));
  const eme = med(emeSoma, n);
  const relTxt = `${rel} ${plural(rel, 'relatoria', 'relatorias')}`;
  r.tecnica = soCamara && emeSoma > 0
    ? `${relTxt} + ${eme} ${plural(eme, 'emenda', 'emendas')} por parlamentar`
    : `${relTxt} por parlamentar`;

  const gasto = soma(ms, (p) => p.bruto.gastoMes);
  r.economia = `R$ ${nf.format(Math.round(gasto / n / 1000))} mil/mês de cota por parlamentar`;

  return r;
}
