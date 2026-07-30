/**
 * Resumo CURTO do número bruto por atributo — uma linha de ~40 caracteres que cabe
 * sob a barra do atributo na imagem de compartilhamento.
 *
 * Por que não reusar `rawNumbers`: aquelas frases são a explicação COMPLETA da ficha
 * ("849 votos registrados em 1.587 votações nominais ocorridas durante o seu
 * exercício (53%)") e passam de 100 caracteres — na imagem elas
 * seriam truncadas com reticência, que é o pior dos mundos: ocupa espaço e não
 * informa. Aqui o número vem inteiro, só sem a oração explicativa.
 *
 * Cuidado ao mexer: o valor citado tem que ser o MESMO que o `rawNumbers` cita, senão
 * a imagem e a ficha contam histórias diferentes sobre o mesmo parlamentar.
 */

const nf = new Intl.NumberFormat('pt-BR');
const pct = (x) => `${Math.round(x * 100)}%`;

/** 2.739.689 → "2,7 mi" · 43.955 → "44 mil" (a imagem não tem largura para o número cheio) */
export function seguidoresCurto(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`;
  return nf.format(n);
}

/**
 * @param n números brutos do parlamentar; cada chave é opcional — o que não vier
 *   simplesmente não gera linha (nunca inventar, mesma regra da evidência).
 * @returns { [statKey]: frase curta }
 */
export function resumoCurtoStats(n) {
  const r = {};

  if (n.props != null) r.ataque = `${nf.format(n.props)} ${n.props === 1 ? 'proposição apresentada' : 'proposições apresentadas'}`;

  if (n.votos != null && n.votacoes) {
    r.stamina = `${nf.format(n.votos)} de ${nf.format(n.votacoes)} votações · ${pct(n.votos / n.votacoes)}`;
  }

  if (n.eficTocou != null && n.eficAndou != null) {
    r.eficiencia = n.eficTocou
      ? `${nf.format(n.eficAndou)} de ${nf.format(n.eficTocou)} matérias avançaram · ${pct(n.eficAndou / n.eficTocou)}`
      : 'nenhuma matéria de autoria ou relatoria';
  }

  if (n.relatorias != null) {
    // A Técnica do Senado é só relatoria; a da Câmara soma emendas.
    r.tecnica = n.emendas != null
      ? `${nf.format(n.relatorias)} ${n.relatorias === 1 ? 'relatoria' : 'relatorias'} + ${nf.format(n.emendas)} ${n.emendas === 1 ? 'emenda' : 'emendas'}`
      : `${nf.format(n.relatorias)} ${n.relatorias === 1 ? 'relatoria' : 'relatorias'}`;
  }

  if (n.gastoMes != null) r.economia = `R$ ${nf.format(Math.round(n.gastoMes / 1000))} mil/mês de cota`;

  if (n.seguidores != null) r.influencia = `${seguidoresCurto(n.seguidores)} seguidores`;

  if (n.fiscal != null) r.fiscalizacao = `${nf.format(n.fiscal)} ${n.fiscal === 1 ? 'ato de cobrança' : 'atos de cobrança'} ao Executivo`;

  if (n.alinhamentoPct != null) r.alinhamento = `${n.alinhamentoPct}% com a orientação do Governo`;

  if (n.comissoes != null) r.comando = `${nf.format(n.comissoes)} ${n.comissoes === 1 ? 'comissão ativa' : 'comissões ativas'}`;

  return r;
}
