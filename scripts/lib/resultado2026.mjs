/**
 * Resultado de 2026 — quem estará na 58ª legislatura (posse em 01/02/2027) e quem não.
 * Fonte: o MESMO `consulta_cand_2026_BRASIL.csv` da candidatura; depois do pleito o TSE
 * preenche `CD_SIT_TOT_TURNO` (eleito / não eleito / suplente / 2º turno).
 *
 * Cinco decisões que um agente reverteria sem saber:
 *
 * 1. **"Fica" e "muda" saem da LISTA DE ELEITOS, não da candidatura casada.** A lista
 *    das duas cadeiras é FECHADA (513 deputados, 54 senadores em 2026) — por isso o
 *    portão exige a lista inteira antes de afirmar qualquer coisa. Com ela completa,
 *    "não está entre os eleitos" é fato sobre um conjunto conhecido, não ausência de
 *    match. Sem ela, a lista curta faria eleito parecer derrotado.
 * 2. **Todo mandato de deputado acaba em 31/01/2027.** Quem não está entre os 513 sai
 *    da Câmara, tenha disputado o que for — inclusive quem ainda disputa 2º turno para
 *    governo: não concorreu à Câmara. Senador da turma de 2022 tem mandato até 2031 e
 *    só sai se eleito para OUTRO cargo (governo, Câmara…).
 * 3. **`#NULO` na própria cadeira não afirma nada.** É candidatura sem resultado
 *    publicado (sub judice, indeferida em recurso): o voto pode ser validado depois.
 * 4. **Senado casa por nome — e, sem candidatura casada, o "sai" exige que nenhum eleito
 *    da UF pareça a mesma pessoa.** Um nome civil grafado diferente no TSE faria um
 *    reeleito "sair". Com a candidatura casada a guarda não vale: o parecido é parente.
 * 5. **Suplente em exercício numa cadeira que vai até 2031 fica sem afirmação**: a
 *    cadeira segue, mas quem senta nela depende do titular.
 *
 * Informativo, como a candidatura: não pontua, não vira título, não tem cor de status.
 */

/** Dia da posse da 58ª legislatura. Depois dele "estará no próximo mandato" deixa de
 *  ser previsão — o campo para de ser emitido (ver `aindaVale`). */
export const POSSE_2027 = '2027-02-01';
/** Fim do mandato de todo deputado e da turma de 2018 do Senado. */
export const FIM_MANDATO_2027 = '2027-01-31';
/** Cadeiras em disputa em 2026: Câmara inteira; 2/3 do Senado. */
export const CADEIRAS_2026 = { 6: 513, 5: 54 };

/** `CD_SIT_TOT_TURNO` → situação. Vocabulário FECHADO: código fora daqui é logado.
 *  `-1` (#NULO) é ausência de resultado, não derrota — ver decisão 3. */
const SITUACOES = new Map([
  [1, 'eleito'], [2, 'eleito'], [3, 'eleito'],
  [4, 'nao-eleito'], [5, 'suplente'], [6, 'segundo-turno'],
]);

/** @returns {'eleito'|'nao-eleito'|'suplente'|'segundo-turno'|null} */
export const situacaoTse = (r) => SITUACOES.get(Number(r?.CD_SIT_TOT_TURNO)) ?? null;
export const situacaoDesconhecida = (r) => {
  const n = Number(r?.CD_SIT_TOT_TURNO);
  return n !== -1 && !SITUACOES.has(n);
};

/** Depois da posse a previsão vira passado — e a legislatura do site, outra. */
export const aindaVale = (hoje, posse = POSSE_2027) => String(hoje) < posse;

const CONECTIVOS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);
const nomeNorm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => nomeNorm(s).split(' ').filter((t) => t.length > 1 && !CONECTIVOS.has(t));
const cpfNorm = (s) => {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.length && d.length <= 11 ? d.padStart(11, '0') : '';
};

/**
 * Os eleitos ao Congresso, por CPF e por nome civil — e a contagem por cargo que o
 * portão confere.
 */
export function indiceEleitos(linhas) {
  const porCpf = new Map();
  const porNome = new Map();
  const lista = [];
  const contagem = { 5: 0, 6: 0 };
  for (const r of linhas ?? []) {
    const cargo = Number(r.CD_CARGO);
    if ((cargo !== 5 && cargo !== 6) || situacaoTse(r) !== 'eleito') continue;
    contagem[cargo]++;
    const e = { cargo, uf: String(r.SG_UF ?? '').toUpperCase(), nome: r.NM_CANDIDATO, urna: r.NM_URNA_CANDIDATO };
    lista.push(e);
    const cpf = cpfNorm(r.NR_CPF_CANDIDATO);
    if (cpf) porCpf.set(cpf, e);
    const n = nomeNorm(r.NM_CANDIDATO);
    porNome.set(n, [...(porNome.get(n) ?? []), e]);
  }
  return { porCpf, porNome, lista, contagem };
}

/**
 * Sucesso vazio: arquivo íntegro com a lista de eleitos incompleta (totalização em
 * curso, resultado não carregado) transformaria eleito em "não volta". Sem as duas
 * listas inteiras, nenhum resultado é emitido.
 * @returns {string|null}
 */
export function motivoParaAbortar(contagem) {
  for (const [cargo, n] of Object.entries(CADEIRAS_2026)) {
    const achados = contagem?.[cargo] ?? 0;
    if (achados < n) {
      return `${achados} de ${n} eleitos para ${cargo === '6' ? 'a Câmara' : 'o Senado'} — lista incompleta`;
    }
  }
  return null;
}

/**
 * A qual cadeira do Congresso a pessoa foi eleita: 5, 6, null (a nenhuma) ou
 * 'duvida' (não dá para afirmar). Câmara pela chave forte (CPF); Senado pelo nome civil,
 * com a guarda da decisão 4.
 */
function eleitoAoCongresso(p, idx, temLinha) {
  if (p.casa === 'camara') {
    const cpf = cpfNorm(p.cpf);
    if (!cpf) return 'duvida';
    return idx.porCpf.get(cpf)?.cargo ?? null;
  }
  let achados = idx.porNome.get(nomeNorm(p.nomeCivil)) ?? [];
  if (achados.length > 1) achados = achados.filter((e) => e.uf === p.uf);
  if (achados.length === 1) return achados[0].cargo;
  if (achados.length > 1) return 'duvida';
  // A candidatura da pessoa já casou pelo nome exato: o eleito parecido é OUTRA pessoa
  // (medido: Jader Barbalho × Jader Barbalho Filho, Daniella × Aguinaldo Ribeiro) —
  // ninguém disputa duas cadeiras.
  if (temLinha) return null;
  // Ninguém com o nome exato: só é "não eleito" se nenhum eleito da UF se parece.
  const civil = tokens(p.nomeCivil);
  const parl = nomeNorm(p.nomeParlamentar);
  const parecido = idx.lista.some((e) => e.uf === p.uf && (
    (parl && nomeNorm(e.urna) === parl)
    || tokens(e.nome).filter((t) => civil.includes(t)).length >= 2));
  return parecido ? 'duvida' : null;
}

/**
 * Onde a pessoa estará na 58ª legislatura.
 *
 * @param {{casa:'camara'|'senado', uf:string, cpf?:string, nomeCivil?:string,
 *          nomeParlamentar?:string, fimMandato?:string, titular?:boolean}} p
 * @param {object|undefined} linha  a candidatura casada (`casaCandidaturas`), se houver
 * @param {ReturnType<typeof indiceEleitos>} idx
 * @returns {null | {destino:'fica'|'muda'|'sai'|'segue'|'pendente',
 *                   motivo?:'nao-reeleito'|'outro-cargo'|'fim-de-mandato'}}
 *          null = não dá para afirmar (sem campo, sem chip)
 */
export function destinoNaLegislatura(p, linha, idx) {
  const propria = p.casa === 'camara' ? 6 : 5;
  const eleito = eleitoAoCongresso(p, idx, Boolean(linha));
  if (eleito === 'duvida') return null;
  if (eleito === propria) return { destino: 'fica' };
  if (eleito) return { destino: 'muda' };

  const cargo = linha ? Number(linha.CD_CARGO) : null;
  const sit = linha ? situacaoTse(linha) : null;
  // disputou cadeira do Congresso e não há resultado: pode ser validado depois. E a
  // linha casada dizer "eleito" com a pessoa fora da lista é chave inconsistente.
  if (linha && (cargo === 5 || cargo === 6) && (sit === null || sit === 'eleito')) return null;

  const mandatoSegue = p.casa === 'senado' && String(p.fimMandato ?? '') > POSSE_2027;
  if (mandatoSegue) {
    if (!p.titular) return null;
    if (!linha) return { destino: 'segue' };
    if (sit === 'segundo-turno') return { destino: 'pendente', motivo: 'outro-cargo' };
    if (sit === null) return null;
    // eleito suplente de senador não assume nada em fevereiro; perder outra disputa
    // não tira a cadeira
    if (sit === 'eleito' && cargo !== 9 && cargo !== 10) return { destino: 'sai', motivo: 'outro-cargo' };
    return { destino: 'segue' };
  }

  // Senador sem fim de mandato conhecido não tem a premissa da decisão 2.
  if (p.casa === 'senado' && !p.fimMandato) return null;
  if (!linha) return { destino: 'sai', motivo: 'fim-de-mandato' };
  return { destino: 'sai', motivo: cargo === propria ? 'nao-reeleito' : 'outro-cargo' };
}

/** Tiers na ordem de exibição; quem está fora do ranking tem balde próprio. */
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F', 'fora'];

/**
 * Agregados da aba "Eleições" dos Insights. Quem ficou sem afirmação (`eleicao2026`
 * ausente) entra no balde `indefinido` — some do numerador E fica à vista, nunca é
 * contado como quem fica.
 *
 * @param {{slug:string,nome:string,casa:string,uf:string,partido:string,tier:string,
 *          ops:number,fora:boolean,eleicao2026?:{destino:string,motivo?:string,
 *          situacao?:string,cargo?:string}}[]} ps
 */
export function agregaEleicao(ps) {
  const vazio = () => ({ total: 0, fica: 0, muda: 0, sai: 0, segue: 0, pendente: 0, indefinido: 0 });
  const conta = (acc, p) => { acc.total++; acc[p.eleicao2026?.destino ?? 'indefinido']++; return acc; };

  const casas = { camara: vazio(), senado: vazio() };
  for (const p of ps) conta(casas[p.casa], p);

  const porTier = TIERS.map((tier) => ({ tier, ...ps.filter((p) => (p.fora ? 'fora' : p.tier) === tier).reduce(conta, vazio()) }))
    .filter((t) => t.total > 0);

  // Reeleição: SÓ quem disputou a própria cadeira — o denominador honesto. Quem foi
  // para o governo não "perdeu a reeleição", e contá-lo derrubaria a taxa por fora.
  const disputouPropria = (p) => p.eleicao2026 && (p.eleicao2026.destino === 'fica'
    || p.eleicao2026.motivo === 'nao-reeleito');
  const reeleicaoPorTier = TIERS.map((tier) => {
    const g = ps.filter((p) => (p.fora ? 'fora' : p.tier) === tier && disputouPropria(p));
    return { tier, disputaram: g.length, reeleitos: g.filter((p) => p.eleicao2026.destino === 'fica').length };
  }).filter((t) => t.disputaram > 0);

  const saem = ps.filter((p) => p.eleicao2026?.destino === 'sai');
  const motivos = {
    naoReeleito: saem.filter((p) => p.eleicao2026.motivo === 'nao-reeleito').length,
    outroCargoEleito: saem.filter((p) => p.eleicao2026.motivo === 'outro-cargo' && p.eleicao2026.situacao === 'eleito').length,
    outroCargoSegundoTurno: saem.filter((p) => p.eleicao2026.motivo === 'outro-cargo' && p.eleicao2026.situacao === 'segundo-turno').length,
    outroCargoNaoEleito: saem.filter((p) => p.eleicao2026.motivo === 'outro-cargo'
      && !['eleito', 'segundo-turno'].includes(p.eleicao2026.situacao)).length,
    fimDeMandato: saem.filter((p) => p.eleicao2026.motivo === 'fim-de-mandato').length,
  };

  const porGuildaMap = new Map();
  for (const p of ps) porGuildaMap.set(p.partido, conta(porGuildaMap.get(p.partido) ?? vazio(), p));
  const porGuilda = [...porGuildaMap].map(([sigla, c]) => ({ sigla, ...c }))
    .sort((a, b) => b.total - a.total || a.sigla.localeCompare(b.sigla));

  const slim = (p) => ({ slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido,
    tier: p.fora ? null : p.tier, ops: p.ops, sexo: p.sexo ?? null, eleicao2026: p.eleicao2026 });
  const porPoder = (a, b) => b.ops - a.ops;
  // Os que saem do topo: a pergunta que o leitor traz ("quem bom vai embora?").
  const saemDoTopo = saem.filter((p) => !p.fora && (p.tier === 'S' || p.tier === 'A')).sort(porPoder).map(slim);
  const mudam = ps.filter((p) => p.eleicao2026?.destino === 'muda').sort(porPoder).map(slim);
  const paraOutroCargo = saem.filter((p) => p.eleicao2026.motivo === 'outro-cargo'
    && ['eleito', 'segundo-turno'].includes(p.eleicao2026.situacao)).sort(porPoder).map(slim);
  const pendentes = ps.filter((p) => p.eleicao2026?.destino === 'pendente').sort(porPoder).map(slim);

  return { casas, porTier, reeleicaoPorTier, motivos, porGuilda, saemDoTopo, mudam, paraOutroCargo, pendentes };
}
