/**
 * Contrato da camada de ANÁLISE GERADA POR IA.
 *
 * O que a IA faz aqui: LER. Os números das prioridades saem inteiros da
 * classificação temática oficial das duas casas (ver temas.mjs) — a IA só
 * escreve um parágrafo de leitura em cima deles. Ela não classifica, não conta e
 * não produz nenhuma quantidade. É a mesma divisão que o resto do projeto faz
 * entre fato e interpretação.
 *
 * A REGRA QUE SUSTENTA TUDO: toda análise carrega o `fonteHash` dos números que
 * ela descreve, e a UI só a renderiza se esse hash bater com o hash calculado no
 * build. Sem isso, a única falha grave possível nesta feature aconteceria em
 * silêncio: um texto escrito sobre a foto de julho seguiria publicado ao lado das
 * barras de setembro, parecendo análise do dado atual. Análise obsoleta some.
 *
 * `data/analises.json` é versionado no git e pode simplesmente não existir
 * conteúdo para um alvo — nesse caso a página mostra só as barras factuais.
 */

/**
 * Hash determinístico dos números que uma análise descreve.
 *
 * FNV-1a de 32 bits, não SHA: só precisamos responder "os números mudaram?", e
 * uma função pura de ~10 linhas roda igual no gerador, no site e em qualquer
 * ferramenta que produza a análise — sem depender de `node:crypto` nem de
 * WebCrypto (que é assíncrono e contaminaria o render).
 *
 * A string canônica ordena os temas alfabeticamente: a ordem de exibição é por
 * contagem e muda com um único empate desfeito, o que invalidaria análises sem
 * que nenhum número tivesse mudado.
 *
 * @param {{temas: {tema: string, n: number}[], nComTema: number}} agregado
 * @returns {string} 8 dígitos hexadecimais
 */
export function fonteHash(agregado) {
  const temas = [...(agregado?.temas ?? [])]
    .map((t) => `${t.tema}:${t.n}`)
    .sort();
  const canonica = `v1|${agregado?.nComTema ?? 0}|${temas.join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < canonica.length; i++) {
    h ^= canonica.charCodeAt(i);
    // FNV prime (16777619) por deslocamentos: o produto direto estoura o inteiro
    // de 32 bits em ponto flutuante e o hash deixa de ser reprodutível
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** chave de um alvo de análise — o mesmo formato no JSON e em quem o produz */
export const alvoNacional = () => 'nacional';
export const alvoGuilda = (sigla) => `guilda:${sigla}`;
export const alvoParlamentar = (slug) => `parlamentar:${slug}`;

/**
 * A análise deste alvo, SE ela ainda descreve os números atuais.
 *
 * Devolver null (em vez de exibir com um aviso de "pode estar desatualizada") é
 * deliberado: o leitor não tem como saber quanto o número mudou, e um parágrafo
 * sobre política ao lado de barras que o contradizem é pior que parágrafo nenhum.
 *
 * @param {{alvo: string, fonteHash: string}[]} analises conteúdo de data/analises.json
 * @param {string} alvo
 * @param {{temas: {tema: string, n: number}[], nComTema: number}} agregado números atuais
 */
export function analiseDe(analises, alvo, agregado) {
  const a = (analises ?? []).find((x) => x?.alvo === alvo);
  if (!a?.texto) return null;
  return a.fonteHash === fonteHash(agregado) ? a : null;
}

/**
 * Quantas análises do arquivo ficaram obsoletas — para o gerador LOGAR.
 * Sumir em silêncio na UI é correto para o leitor e péssimo para quem mantém:
 * sem este número, ninguém descobre que a página perdeu o texto.
 */
export function contarObsoletas(analises, hashAtualPorAlvo) {
  let obsoletas = 0, orfas = 0;
  for (const a of analises ?? []) {
    if (!a?.alvo) continue;
    if (!hashAtualPorAlvo.has(a.alvo)) { orfas++; continue; }
    if (a.fonteHash !== hashAtualPorAlvo.get(a.alvo)) obsoletas++;
  }
  return { obsoletas, orfas };
}
