/**
 * Ritmo no exercício: Ataque, Técnica e o VOLUME da Eficiência comparam o que o
 * parlamentar produziu por mês em exercício, não o total da legislatura.
 *
 * Por que: a Stamina (taxa sobre as votações do exercício) e a Economia (gasto ÷ meses
 * em exercício) já não penalizavam quem assumiu tarde ou passou meses licenciado no
 * Executivo — e a /como-calculamos promete isso ao leitor. As três contagens não
 * seguiam: um suplente com 20 meses ou um ex-ministro com 15 eram comparados ao total
 * de quem esteve sentado 44. A contagem é escalada para o equivalente da legislatura
 * (total × meses da legislatura ÷ meses em exercício) e só ENTÃO entra na escala da
 * casa, que continua a mesma (percentil no Ataque, log na Técnica).
 *
 * O PISO de 24 meses no divisor é o que impede extrapolar amostra curta: sem ele, 13
 * meses de exercício — tipicamente o ex-ministro que volta em ano eleitoral — seriam
 * multiplicados por 3,4. Com ele, no máximo 1,8x. O piso NÃO é corte de elegibilidade:
 * quem pontua continua sendo quem tem ≥ 12 meses (MESES_MIN_RANK no gerador).
 *
 * Medido na ingestão de 2026-10-02 (piso 24): 44 mudanças de Tier na Câmara e 2 no
 * Senado; Poder médio de quem cumpriu o mandato inteiro −0,81 (Câmara) × −0,65
 * (Senado); fração da Técnica abaixo de 40 de 23,4% para 22,7%; Tier S inalterado.
 * Sem piso eram 61 mudanças e −1,27 × −1,08.
 */

export const PISO_MESES_RITMO = 24;

/**
 * Divisor de meses usado no ritmo: os meses em exercício, mas nunca abaixo do piso e
 * nunca acima da própria legislatura (arredondamento de dias não pode virar fator < 1).
 * No início de uma legislatura nova (menos meses decorridos que o piso) o divisor é a
 * legislatura inteira — ninguém é extrapolado.
 */
export function mesesDivisor(meses, mesesLegislatura, piso = PISO_MESES_RITMO) {
  return Math.min(mesesLegislatura, Math.max(meses ?? 0, piso));
}

/** quanto a contagem do parlamentar é escalada para o equivalente da legislatura (≥ 1) */
export function fatorExercicio(meses, mesesLegislatura, piso = PISO_MESES_RITMO) {
  if (!(mesesLegislatura > 0)) return 1;
  return mesesLegislatura / mesesDivisor(meses, mesesLegislatura, piso);
}

/**
 * Esteve fora parte da legislatura? Decide só o TEXTO (a conta usa o fator sempre).
 * Arredondado ao mês: quem tem 43,9 de 44 não ganha frase sobre ausência que não houve.
 */
export function exercicioParcial(meses, mesesLegislatura) {
  return meses != null && mesesLegislatura > 0 && Math.round(meses) < Math.round(mesesLegislatura);
}

const nf = new Intl.NumberFormat('pt-BR');

/**
 * Cauda das frases de rawNumbers do Ataque/Técnica/Eficiência — vazia para quem esteve
 * em exercício a legislatura toda. O número exibido continua o TOTAL (é o fato); a
 * frase diz que a nota comparou o ritmo, senão "8 proposições" ao lado de um Ataque
 * maior que o de quem tem 10 parece conta errada.
 */
export function fraseRitmo(meses, mesesLegislatura, { volume = false, piso = PISO_MESES_RITMO } = {}) {
  if (!exercicioParcial(meses, mesesLegislatura)) return '';
  const m = nf.format(Math.round(meses));
  // Na Eficiência só o VOLUME vira ritmo — a taxa (andou ÷ tocou) já independe do tempo.
  const oQue = volume ? 'o volume que avançou é comparado por mês, não pelo total' : 'a nota compara o ritmo por mês, não o total';
  const base = ` — em ${m} dos ${nf.format(Math.round(mesesLegislatura))} meses da legislatura em exercício; ${oQue}`;
  return meses < piso ? `${base} (contado sobre no mínimo ${piso} meses)` : base;
}

/** sufixo da linha curta da imagem de compartilhamento ("8 proposições apresentadas em 30 meses") */
export function sufixoMeses(meses, mesesLegislatura) {
  return exercicioParcial(meses, mesesLegislatura) ? ` em ${nf.format(Math.round(meses))} meses` : '';
}
