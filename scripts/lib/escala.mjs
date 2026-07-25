/**
 * Escalas de atributo ancoradas na MEDIANA DA CASA.
 *
 * A normalização padrão do Poder é percentil dentro da casa. Serve para contagens
 * de trabalho (Ataque, Técnica), mas quebra em dois casos:
 *
 *  - quando a MAGNITUDE é o que importa (Economia): percentil mede colocação na
 *    fila e a descarta — gastar 2,2x a cota de um colega frugal custava 9 pontos,
 *    enquanto R$3 mil/mês a mais na mediana custava 24;
 *  - quando a distribuição é COMPRIMIDA (Stamina no Senado, mediana 92% de
 *    comparecimento): a inclinação passa a depender da densidade local de colegas,
 *    e o mesmo 1 ponto percentual de presença vale de 0 a 7,5 pontos de atributo.
 *
 * A escala daqui é linear no valor bruto, com inclinação constante em cada metade.
 * Ancorar na mediana (= 50) não é estética: (1) o limiar de vermelho (< 40) é
 * convenção compartilhada com os atributos percentílicos, que têm ~40% da casa
 * abaixo dele por construção — uma reta entre extremos jogava 72% da Câmara no
 * vermelho e fazia o rótulo acusar quem gasta a MEDIANA; (2) os cortes de Tier são
 * ABSOLUTOS e valem para as duas casas, então preservar a mediana em 50 é o que
 * impede a troca de embutir "senador vale mais que deputado" no Poder.
 */

export function quantil(ordenado, p) {
  if (!ordenado.length) return 0;
  const i = (ordenado.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (i - lo);
}

/**
 * Devolve a função valor-bruto → 0–100 calibrada na casa recebida.
 * Sempre POR CASA — Câmara e Senado nunca compartilham calibração.
 *
 * `maiorEhMelhor: false` inverte (Economia: gastar mais é pior). Nesse caso o topo
 * é o ZERO natural da métrica — não gastou nada = 100 —, e não um percentil baixo:
 * ancorar no p5 empatava 26 deputados em 100 e tornava frugalidade um ingresso
 * barato para o Tier S. Do lado ruim usa-se o p95, para que um único outlier não
 * achate a casa inteira.
 */
export function escalaAncorada(valores, { maiorEhMelhor = true } = {}) {
  const s = [...valores].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const mediana = quantil(s, 0.5);
  const bom = maiorEhMelhor ? quantil(s, 0.95) : 0;
  const ruim = maiorEhMelhor ? quantil(s, 0.05) : quantil(s, 0.95);

  return (v) => {
    if (!Number.isFinite(v) || bom === ruim) return 50;
    const dBom = Math.abs(bom - mediana), dRuim = Math.abs(mediana - ruim);
    if (dBom <= 0 || dRuim <= 0) return 50;
    const melhorQueMediana = maiorEhMelhor ? v > mediana : v < mediana;
    const bruto = melhorQueMediana
      ? 50 + (50 * Math.abs(v - mediana)) / dBom
      : 50 - (50 * Math.abs(mediana - v)) / dRuim;
    return Math.round(Math.max(0, Math.min(100, bruto)));
  };
}

/** Economia: menos gasto é melhor, e não gastar nada é o topo da escala. */
export const escalaFrugalidade = (gastos) => escalaAncorada(gastos, { maiorEhMelhor: false });

/** Stamina: comparecer mais é melhor. */
export const escalaComparecimento = (taxas) => escalaAncorada(taxas, { maiorEhMelhor: true });

/**
 * Escala LOGARÍTMICA para contagens de trabalho (Ataque, Técnica) — distribuições
 * com cauda longa à direita, onde o percentil satura: do p95 ao topo cabem 3,5x a
 * 5x de trabalho em 5 pontos de atributo, e quem faz o dobro do trabalho de um
 * colega no topo leva 1 ponto a mais. Escala LINEAR não resolve: ela achataria o
 * miolo, onde vive quase toda a casa.
 *
 * Aqui cada DOBRO de trabalho vale um incremento constante, em qualquer altura da
 * escala. É a leitura certa para contagem que varre ordens de grandeza (de 0 a 758
 * proposições) — mas é uma decisão de produto, não um conserto: assume que ir de
 * 20 para 40 matérias é a mesma conquista que ir de 300 para 600.
 *
 * Ancorada na mediana (= 50) pelos mesmos motivos das outras escalas daqui. O topo
 * é o MÁXIMO da casa, não um p99: como a cauda é longa, o p99 cai colado no máximo
 * e todo o topo satura junto — medido na Câmara, p99 punha Kim, Nikolas e Laura os
 * três em 100, que é exatamente o defeito que a escala existe para corrigir. Com o
 * máximo, "o que mais trabalhou na casa" = 100, que é legível. A sensibilidade a um
 * outlier fica contida pelo próprio log: um valor 156x maior estica a escala 1,8x,
 * não 156x.
 */
export function escalaLog(valores, { pisoTopo = 1 } = {}) {
  const s = [...valores].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const mediana = quantil(s, 0.5);
  const topo = quantil(s, pisoTopo);
  // +1 em tudo: contagem tem zero legítimo, e log(0) não existe
  const lg = (v) => Math.log2(v + 1);
  const amp = lg(topo) - lg(mediana);
  return (v) => {
    if (!Number.isFinite(v) || amp <= 0) return 50;
    return Math.round(Math.max(0, Math.min(100, 50 + (50 * (lg(v) - lg(mediana))) / amp)));
  };
}
