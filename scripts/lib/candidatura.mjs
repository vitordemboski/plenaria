/**
 * Candidatura 2026 — a qual cargo cada parlamentar em exercício pediu registro. Passado o
 * pleito, é a CHAVE do resultado (`resultado2026.mjs`): a linha casada traz o cargo
 * disputado e a situação.
 * Fonte: `consulta_cand_2026_BRASIL.csv` (bulk do TSE, latin1, regerado diariamente).
 *
 * Quatro decisões que um agente reverteria sem saber:
 *
 * 1. **Chave: CPF na Câmara, nome civil no Senado.** Medido em 2026-08-16: CPF casou
 *    499 dos 513 deputados; nome civil + UF, 484; nome parlamentar + UF, 445. Casar
 *    por nome perde ~15 candidatos REAIS, e some mais quem usa nome de urna longe do
 *    civil ("Doutor Luizinho"). O Senado não expõe CPF — lá o nome civil completo é
 *    único em 51 de 81, sem colisão. O CPF entra em memória e sai: nunca é gravado.
 * 2. **Nascimento confirma, nunca reprova** (ver `casaCandidaturas`).
 * 3. **Ausência não afirma nada**: sem match, o campo não é emitido — o site nunca
 *    diz "não é candidato", que seria falso quando o match é que falhou.
 * 4. **O verbo é "registrou", nunca "deferida"**: `DS_SITUACAO_CANDIDATURA` vinha
 *    `#NE` em 100% das 20.456 linhas.
 */

/** Dia do pleito (1º turno — o único que decide cadeira no Congresso). */
export const PLEITO_2026 = '2026-10-04';

/** `CD_CARGO` → rótulo. Vocabulário FECHADO: código fora daqui é logado e fica sem
 *  chip, nunca vira rótulo cru do `DS_CARGO`. Suplente é rótulo próprio — não é
 *  "concorre ao Senado" (7 parlamentares registraram assim, Jader Barbalho entre eles). */
const CARGOS = new Map([
  [1, { rotulo: () => 'Presidência da República', curto: () => 'Presidência' }],
  [2, { rotulo: () => 'Vice-presidência da República', curto: () => 'Vice-presidência' }],
  [3, { rotulo: (uf) => `Governo de ${uf}`, curto: (uf) => `Gov. ${uf}` }],
  [4, { rotulo: (uf) => `Vice-governo de ${uf}`, curto: (uf) => `Vice-gov. ${uf}` }],
  [5, { rotulo: () => 'Senado', curto: () => 'Senado', reeleicaoDe: 'senado' }],
  [6, { rotulo: () => 'Câmara dos Deputados', curto: () => 'Câmara', reeleicaoDe: 'camara' }],
  [7, { rotulo: (uf) => `Assembleia de ${uf}`, curto: (uf) => `Assembleia ${uf}` }],
  [8, { rotulo: () => 'Câmara Legislativa do DF', curto: () => 'CLDF' }],
  [9, { rotulo: () => 'Suplente de senador', curto: () => 'Suplente', suplente: true }],
  [10, { rotulo: () => 'Suplente de senador', curto: () => 'Suplente', suplente: true }],
]);

/** Cargo fora do mapa — a ingestão loga em vez de adivinhar. */
export const cargoDesconhecido = (r) => !CARGOS.has(Number(r?.CD_CARGO));

/** Só dígitos, 11 posições. O TSE publica CPF sem o zero à esquerda; a Câmara, com. */
export const normCpf = (s) => {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.length && d.length <= 11 ? d.padStart(11, '0') : '';
};

/** Nome para chave: sem acento, caixa alta, só A-Z e espaço simples. */
export const normNomeCivil = (s) =>
  String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

/** `DT_NASCIMENTO` do TSE é dd/mm/aaaa; o Senado devolve ISO. */
export const dataIso = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s ?? '').trim();
};

/**
 * Uma linha do TSE → o que o chip publica. `null` para cargo desconhecido.
 * @param {object} r linha do CSV como objeto {COLUNA: valor}
 * @param {'camara'|'senado'} casa a casa que o parlamentar ocupa HOJE
 */
export function chipDaCandidatura(r, casa, registroEm) {
  const c = CARGOS.get(Number(r?.CD_CARGO));
  if (!c) return null;
  const uf = String(r?.SG_UF ?? '').trim().toUpperCase();
  return {
    cargo: c.rotulo(uf),
    // forma curta do card: do mesmo vocabulário fechado — recortar a string longa
    // na UI quebraria calado quando entrasse rótulo novo
    curto: c.curto(uf),
    reeleicao: c.reeleicaoDe === casa,
    suplente: Boolean(c.suplente),
    uf,
    registroEm,
  };
}

/**
 * Casa as candidaturas do TSE com os parlamentares em exercício. Os três descartes
 * saem SEPARADOS: num balde só, o aviso aponta a causa errada.
 *
 * @param {object[]} linhas  linhas do CSV do TSE como objetos
 * @param {{casa:string,slug:string,uf:string,cpf?:string,nomeCivil?:string,nascimento?:string}[]} parlamentares
 * @param {string} registroEm  `DT_GERACAO` do arquivo, em ISO
 * @returns {{porSlug: Map<string, object>, linhaPorSlug: Map<string, object>,
 *            desconhecidos: object[], ambiguos: object[],
 *            nascimentoDivergente: object[], porCargoTse: Map<number, number>}}
 */
export function casaCandidaturas(linhas, parlamentares, registroEm) {
  const porCpf = new Map();
  const porNome = new Map();
  const desconhecidos = [];
  const porCargoTse = new Map();

  for (const r of linhas ?? []) {
    if (cargoDesconhecido(r)) { desconhecidos.push(r); continue; }
    const cd = Number(r.CD_CARGO);
    porCargoTse.set(cd, (porCargoTse.get(cd) ?? 0) + 1);

    const cpf = normCpf(r.NR_CPF_CANDIDATO);
    // CPF repetido (candidatura substituída na fonte): a primeira basta —
    // sobrescrever faria a mesma pessoa mudar de cargo entre execuções.
    if (cpf && !porCpf.has(cpf)) porCpf.set(cpf, r);

    const nome = normNomeCivil(r.NM_CANDIDATO);
    if (nome) {
      const lista = porNome.get(nome) ?? [];
      lista.push(r);
      porNome.set(nome, lista);
    }
  }

  const porSlug = new Map();
  const linhaPorSlug = new Map();
  const ambiguos = [];
  const nascimentoDivergente = [];

  for (const p of parlamentares ?? []) {
    let achado = porCpf.get(normCpf(p.cpf));

    if (!achado) {
      // Sem CPF (Senado): nome civil + desempate em cascata. Ambíguo até o fim é
      // ausência — nunca "o mais provável".
      let cands = porNome.get(normNomeCivil(p.nomeCivil)) ?? [];
      if (cands.length > 1) {
        const porUf = cands.filter((r) => String(r.SG_UF ?? '').toUpperCase() === p.uf);
        if (porUf.length) cands = porUf;
      }
      if (cands.length > 1 && p.nascimento) {
        const porNasc = cands.filter((r) => dataIso(r.DT_NASCIMENTO) === p.nascimento);
        if (porNasc.length) cands = porNasc;
      }
      if (cands.length > 1) { ambiguos.push({ slug: p.slug, n: cands.length }); continue; }
      achado = cands[0];
    }

    if (!achado) continue;

    // Divergência de data é AUDITORIA, não filtro: exigir igualdade descartava
    // Carlos Viana (22×23/03) e Jader Barbalho (1944×1945), candidatos reais.
    if (p.nascimento && dataIso(achado.DT_NASCIMENTO) !== p.nascimento) {
      nascimentoDivergente.push({ slug: p.slug, base: p.nascimento, tse: dataIso(achado.DT_NASCIMENTO) });
    }

    const chip = chipDaCandidatura(achado, p.casa, registroEm);
    if (chip) { porSlug.set(p.slug, chip); linhaPorSlug.set(p.slug, achado); }
  }

  return { porSlug, linhaPorSlug, desconhecidos, ambiguos, nascimentoDivergente, porCargoTse };
}

/**
 * Sucesso vazio: arquivo íntegro sem as duas casas devolveria "o Congresso não se
 * candidatou" — plausível e falso. Sem elas, aborta preservando o cache bom.
 * @returns {string|null} motivo do aborto, ou null se o arquivo está de pé
 */
export function motivoParaAbortar(porCargoTse) {
  if (!(porCargoTse?.get(6) > 0)) return 'nenhuma candidatura a DEPUTADO FEDERAL no arquivo';
  if (!(porCargoTse?.get(5) > 0)) return 'nenhuma candidatura a SENADOR no arquivo';
  return null;
}

/**
 * Segundo aviso, mais fino que o portão. Medido em 2026-08-16: Câmara 499/513,
 * Senado 51/81. Piso frouxo de propósito — denuncia colapso de chave, não flutuação.
 */
export const PISO_MATCH = { camara: 0.8, senado: 0.4 };

export function coberturaPorCasa(porSlug, parlamentares) {
  const tot = {}; const com = {};
  for (const p of parlamentares ?? []) {
    tot[p.casa] = (tot[p.casa] ?? 0) + 1;
    if (porSlug.has(p.slug)) com[p.casa] = (com[p.casa] ?? 0) + 1;
  }
  return Object.keys(tot).map((casa) => ({
    casa,
    com: com[casa] ?? 0,
    total: tot[casa],
    taxa: (com[casa] ?? 0) / tot[casa],
    baixa: (com[casa] ?? 0) / tot[casa] < (PISO_MATCH[casa] ?? 0),
  }));
}
