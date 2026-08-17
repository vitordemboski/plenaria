/**
 * O recorte temporal do que ESTA legislatura moveu.
 *
 * O universo da Eficiência não é "o que foi apresentado nesta legislatura": é o que ela
 * FEZ ANDAR. Um projeto de 2021 que virou lei em 2024 é entrega desta legislatura, e
 * ficava invisível — o autor do marco legal dos jogos eletrônicos (PL 2796/2021 → Lei
 * 14.852/2024) aparecia sem a lei mais conhecida dele. Medido na virada: 371 normas
 * sancionadas nesta legislatura vinham de proposição da anterior, contra 396 que já
 * contávamos — o número de leis quase dobrou.
 *
 * ⚠️ A DATA CONFIÁVEL É A DA SITUAÇÃO, NÃO A DA TRAMITAÇÃO.
 *
 * O caminho intuitivo — varrer as tramitações e achar quando a matéria avançou — usa o
 * `codSituacao` de cada tramitação, e ele é FURADO: a própria PL 2796/2021 carrega
 * "Transformado em Norma Jurídica" numa tramitação de 2021-09-15, três anos antes de
 * virar lei (o campo é carimbado retroativamente em parte das linhas). Datar avanço por
 * ele devolve um número plausível e errado, que é o modo de falha nº 1 deste projeto.
 *
 * O que serve é `ultimoStatus_dataHora` (Câmara) / `dataSituacaoAtual` (Senado): a data
 * em que a situação ATUAL foi alcançada. Não é a data da última tramitação — a PL
 * 3820/2019 tem situação de 2019-12-12 e última tramitação em 2022-12-28 —, e foi
 * conferida em 25 de 25 amostras: no dia da data há evento de avanço de verdade
 * (parecer do relator, encerramento de prazo, remessa ao Senado).
 *
 * Consequência boa e não-óbvia: a matéria antiga PARADA fica fora do denominador, porque
 * esta legislatura não a moveu. O cemitério de proposições arquivadas em 2019 não
 * penaliza quem está no segundo mandato — só entra o que teve desfecho agora, para o bem
 * (avançou) ou para o mal (esta legislatura a arquivou).
 *
 * Sem data, a resposta é NÃO. A matéria antiga só entra quando dá para AFIRMAR que esta
 * legislatura a moveu; "não sei" não vira "sim" (nem vira "não" para a matéria desta
 * legislatura, que entra pelo ano de apresentação e não passa por aqui).
 */

/** início da legislatura 2023–2027 */
export const INICIO_LEGISLATURA = '2023-02-01';

/**
 * A situação atual da matéria foi alcançada DENTRO desta legislatura?
 * @param {string|null|undefined} dataSituacao data ISO (`2024-05-03` ou `2024-05-03T00:00:00`)
 * @param {string} inicio início da legislatura
 */
export function moveuNestaLegislatura(dataSituacao, inicio = INICIO_LEGISLATURA) {
  const d = (dataSituacao ?? '').slice(0, 10);
  // 10 caracteres exatos: `2024` sozinho compara como string e diria "sim" para
  // qualquer coisa de 2024 em diante, mas também "não" para `2023` — silenciosamente
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d >= inicio;
}
