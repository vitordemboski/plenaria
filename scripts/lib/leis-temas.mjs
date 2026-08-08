/**
 * "O que o Congresso APROVA, por tema" — o perfil temático das normas.
 *
 * Não é a mesma conta das Prioridades, e confundir as duas produz números
 * errados em silêncio. Duas diferenças que mandam:
 *
 * 1. **O universo é a NORMA DISTINTA, não a autoria.** Autoria coletiva é
 *    frequente (uma matéria chega a 59 autores principais), então somar as leis
 *    de cada parlamentar contaria a mesma lei dezenas de vezes: medido, 445
 *    contagens para 191 normas. Toda entrada aqui passa por deduplicação.
 * 2. **A classificação é OFICIAL**, exatamente a das Prioridades (temas.mjs):
 *    a Câmara publica os temas em bulk, o Senado as classificações do processo.
 *    A IA não agrupa nada — ela lê a tabela pronta e escreve o parágrafo. Trocar
 *    isso por classificação de ementa por modelo jogaria fora dado oficial com
 *    100% de cobertura (139/139 na Câmara, 52/52 no Senado, medido) e tornaria o
 *    agrupamento não-auditável.
 *
 * Herda as regras de contagem das Prioridades: **contagem CHEIA** (uma lei com 3
 * temas conta inteira nos 3, então os percentuais NÃO somam 100%) e nenhuma cor
 * de bom/ruim — aprovar sobre Defesa não é melhor nem pior que aprovar sobre
 * Saúde. A taxa abaixo descreve, não julga.
 */
import { contarTemas, HOMENAGENS } from './temas.mjs';

/**
 * Agrupa leis por tema oficial, deduplicando por proposição.
 *
 * @param {{url: string, temas?: string[]}[]} leis pode conter a mesma lei várias
 *   vezes (uma por autor) — a dedupe é responsabilidade DAQUI, não de quem chama
 * @returns {{temas: {tema: string, n: number}[], nComTema: number, nSemTema: number, nLeis: number}}
 */
export function agruparLeis(leis) {
  const porUrl = new Map();
  for (const l of leis ?? []) {
    if (l?.url && !porUrl.has(l.url)) porUrl.set(l.url, l.temas ?? []);
  }
  const { temas, nComTema, nSemTema } = contarTemas([...porUrl.values()]);
  return { temas, nComTema, nSemTema, nLeis: porUrl.size };
}

/**
 * Apresentado × aprovado, por tema — onde mora a resposta a "o que o Congresso
 * aprova DE FATO".
 *
 * A `taxa` (leis ÷ proposições apresentadas no mesmo tema) é uma razão de duas
 * contagens sobre proposições DISTINTAS nos dois lados; comparar um lado deduplicado
 * com outro multiplicado por coautoria daria uma taxa inventada.
 *
 * O `piso` existe pela mesma razão do piso da faixa do card e do quartil dos
 * títulos vermelhos: com 2 leis num tema, "50% de aproveitamento" é ruído
 * apresentado como fato. Abaixo dele a linha existe, mas SEM taxa — a contagem
 * é factual, a razão não seria.
 *
 * @param {{temas: {tema: string, n: number}[], nComTema: number}} aprovadas
 * @param {{temas: {tema: string, n: number}[], nComTema: number}} apresentadas
 * @param {number} piso nº mínimo de LEIS no tema para a taxa ser publicada
 */
export function apresentadoVersusAprovado(aprovadas, apresentadas, piso = 4) {
  const apresPorTema = new Map((apresentadas?.temas ?? []).map((t) => [t.tema, t.n]));
  const nAprov = aprovadas?.nComTema ?? 0;
  const nApres = apresentadas?.nComTema ?? 0;
  return (aprovadas?.temas ?? []).map((t) => {
    const nApresentadas = apresPorTema.get(t.tema) ?? 0;
    return {
      tema: t.tema,
      n: t.n,
      nApresentadas,
      pctAprovadas: nAprov ? (t.n / nAprov) * 100 : 0,
      pctApresentadas: nApres ? (nApresentadas / nApres) * 100 : 0,
      // null, não 0: "não dá para afirmar" e "0% de aproveitamento" são
      // afirmações diferentes, e a segunda seria falsa
      taxa: t.n >= piso && nApresentadas > 0 ? (t.n / nApresentadas) * 100 : null,
    };
  });
}

/**
 * Quantas normas são SIMBÓLICAS — título honorífico, data comemorativa,
 * inscrição no Livro dos Heróis, reconhecimento de manifestação cultural.
 *
 * É o único recorte do site em que o leitor consegue avaliar o CONTEÚDO do que
 * foi aprovado, e não só o volume. Por isso ele existe — e por isso o rótulo é
 * descritivo: a plataforma conta ("60 das 191"), quem julga se isso é pouco ou
 * demais é quem lê. Chamar de "lei inútil" seria opinião nossa, e o projeto já
 * derrubou um título por imputar juízo ("Safra Eleitoral" → "Produção
 * Concentrada"). O número sustenta o argumento melhor que o adjetivo.
 *
 * Duas contagens, porque medem coisas diferentes e a diferença é grande:
 * - `n`: a norma TEM o tema (pode ter outros junto — "Dia Nacional do Policial
 *   Penal" é homenagem e segurança);
 * - `exclusivas`: é o ÚNICO tema da norma — o corte mais estrito possível.
 *
 * @param {{url: string, temas?: string[]}[]} leis
 */
export function simbolicas(leis) {
  const porUrl = new Map();
  for (const l of leis ?? []) {
    if (l?.url && !porUrl.has(l.url)) porUrl.set(l.url, [...new Set(l.temas ?? [])]);
  }
  let n = 0, exclusivas = 0;
  for (const temas of porUrl.values()) {
    if (!temas.includes(HOMENAGENS)) continue;
    n++;
    if (temas.length === 1) exclusivas++;
  }
  return { n, exclusivas, total: porUrl.size, pct: porUrl.size ? (n / porUrl.size) * 100 : 0 };
}
