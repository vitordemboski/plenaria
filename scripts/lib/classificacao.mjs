/**
 * Classificação dos tipos de proposição da Câmara.
 *
 * GUARDRAIL: allowlist explícita, nunca regex em texto livre. Cada regra aqui
 * precisa ser dizível numa frase no tooltip do card.
 */

/** Ataque — propor lei nova. */
export const TIPOS_PRINCIPAIS = new Set(['PL', 'PLP', 'PEC', 'PDL']);

/** Técnica — trabalho sobre o texto alheio (junto com as relatorias).
 *  EMC = emenda na comissão · EMP = emenda de plenário · EMR = emenda de relator. */
export const TIPOS_EMENDA = new Set(['EMC', 'EMP', 'EMR']);

/** Fiscalização — controle do Executivo (CF art. 49, X e art. 50).
 *  O tipo REQ sozinho não basta: ele mistura fiscalização com voto de regozijo,
 *  moção e sessão solene. Só entram estes subtipos, pelo rótulo oficial. */
const REQ_FISCALIZACAO = [
  'Requerimento de Convocação de Ministro de Estado no Plenário',
  'Requerimento de Convocação de Ministro de Estado na Comissão',
  'Requerimento para envio de Requerimento de Informação pela Comissão',
];

/**
 * @param {string} siglaTipo        coluna `siglaTipo` de proposicoes-{ano}.csv
 * @param {string} descricaoTipo    coluna `descricaoTipo` do mesmo arquivo
 */
export function ehFiscalizacao(siglaTipo, descricaoTipo) {
  if (siglaTipo === 'RIC' || siglaTipo === 'PFC') return true;
  if (siglaTipo !== 'REQ') return false;
  const d = (descricaoTipo ?? '').trim();
  // startsWith: o rótulo da convocação em comissão traz o artigo da CF no fim
  // ("... na Comissão (art. 50, caput, da CF)") e o texto varia entre anos.
  return REQ_FISCALIZACAO.some((alvo) => d.startsWith(alvo));
}

/** Só Sim/Não são posição comparável. Abstenção, obstrução, "Artigo 17" e
 *  ausência não dizem se o parlamentar concordou ou não. */
const POSICAO = new Set(['Sim', 'Não']);

/**
 * Alinhamento com uma bancada (na prática, a do Governo).
 * @param {Map<string,string>} votosDep       idVotacao → voto do deputado
 * @param {Map<string,string>} orientacaoBanc idVotacao → orientação da bancada
 * @returns {{iguais:number, comparaveis:number, taxa:number|null}} taxa null = sem base
 */
export function alinhamento(votosDep, orientacaoBanc) {
  let iguais = 0, comparaveis = 0;
  for (const [idVotacao, orientacao] of orientacaoBanc) {
    if (!POSICAO.has(orientacao)) continue;
    const voto = votosDep.get(idVotacao);
    if (!POSICAO.has(voto)) continue;
    comparaveis++;
    if (voto === orientacao) iguais++;
  }
  return { iguais, comparaveis, taxa: comparaveis ? iguais / comparaveis : null };
}

// ---------- Eficiência do SENADO: situação da matéria ----------
// A Câmara publica a situação como texto no CSV bulk e a ingestão a lê por regex.
// O Senado publica `situacaoAtual` no /processo, e ali o vocabulário é FECHADO
// (35 valores em toda a legislatura) — então aqui vale a regra da casa: allowlist
// explícita, nunca regex. Se o Senado inventar um status novo, ele cai no default
// "não avançou" e aparece no aviso de cobertura da ingestão, em vez de casar por
// acidente com um regex frouxo.

/**
 * Matéria que AVANÇOU: saiu do limbo inicial (aguardando despacho, aguardando
 * relator, com a relatoria) e chegou a ser pautada, aprovada, remetida ou virou
 * norma. É o espelho do AVANCOU_RE da Câmara ("pronta para pauta", "apreciação
 * pelo Senado", "autógrafos", "transformada em norma").
 *
 * REMETIDA À CÂMARA DOS DEPUTADOS é o análogo exato de "apreciação pelo Senado":
 * a matéria foi aprovada na casa de origem e seguiu para a casa revisora.
 *
 * VETADA entra: a matéria percorreu o Congresso inteiro e foi aprovada pelas duas
 * casas — o veto é ato do Executivo, não fracasso do parlamentar. Não conta como
 * norma (não virou lei), mas contar como "não avançou" seria factualmente falso.
 */
export const SITUACOES_AVANCOU = new Set([
  'TRANSFORMADA EM NORMA JURÍDICA',
  'TRANSFORMADA EM NORMA JURÍDICA COM VETO PARCIAL',
  'REMETIDA À CÂMARA DOS DEPUTADOS',
  'REMETIDA À SANÇÃO',
  'VETADA',
  'APROVADA',
  'APROVADO PARECER NA COMISSÃO',
  'PRONTA PARA A PAUTA NA COMISSÃO',
  'PRONTO PARA DELIBERAÇÃO DO PLENÁRIO',
  'INCLUÍDA EM ORDEM DO DIA',
  'INCLUÍDA NA PAUTA DA REUNIÃO',
]);

/** Matéria que virou LEI. Espelha o APROVADA_RE da Câmara. */
export const SITUACOES_NORMA = new Set([
  'TRANSFORMADA EM NORMA JURÍDICA',
  'TRANSFORMADA EM NORMA JURÍDICA COM VETO PARCIAL',
]);

/** normaliza o `situacaoAtual` do /processo (vem em caixa variável, pode vir vazio) */
const norm = (situacao) => (situacao ?? '').trim().toUpperCase();

/** @param {string|null|undefined} situacao `situacaoAtual` do /processo */
export function senadoAvancou(situacao) {
  return SITUACOES_AVANCOU.has(norm(situacao));
}

/** @param {string|null|undefined} situacao `situacaoAtual` do /processo */
export function senadoVirouNorma(situacao) {
  return SITUACOES_NORMA.has(norm(situacao));
}
