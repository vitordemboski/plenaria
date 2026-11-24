/**
 * Sanidade PÓS-ingestão — a FORMA do dado, não um valor de referência.
 *
 * Existe porque o sucesso vazio não gera erro: gera número plausível, e a conferência
 * manual (um `node -e` no AGENTS.md + ler os ⚠️ de ~2.400 linhas de log) dependia de
 * alguém lembrar. A cota da Câmara ficou com o sinal invertido no ar por semanas assim.
 *
 * `falhas` = impossível ou fonte quebrada (o script sai com 1); `avisos` = degradação
 * honesta que alguém precisa ver (cache velho, resultado eleitoral com lacuna).
 * Limiares são de FORMA — "unidades é normal, dezenas é a fonte quebrada" —, nunca
 * contagem esperada, que envelheceria.
 */

const CASAS = ['camara', 'senado'];
/** "dezenas": acima disso o zero é a fonte, não o parlamentar */
const DEZENAS = 10;

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};

/**
 * @param {object[]} ps  data/politicians.json
 * @param {object} meta  data/meta.json
 * @param {{nome:string, dias:number}[]} [bulks] idade dos bulks CSV em data/raw na hora da checagem
 * @param {{hoje?:string}} [op]
 * @returns {{falhas:string[], avisos:string[], resumo:string[]}}
 */
export function diagnostico(ps, meta, bulks = [], { hoje } = {}) {
  const falhas = [], avisos = [], resumo = [];
  const pontuam = Object.keys(meta?.pesos ?? {});

  for (const casa of CASAS) {
    const A = ps.filter((p) => p.casa === casa);
    if (!A.length) { falhas.push(`${casa}: nenhum parlamentar`); continue; }

    // cota: total líquido negativo é impossível (estorno não supera gasto) — foi o
    // sintoma do valorLiquido com sinal invertido
    const gastos = A.map((p) => p.gastoMensalMedioMil).filter((x) => typeof x === 'number');
    const neg = A.filter((p) => p.gastoMensalMedioMil < 0);
    if (neg.length) falhas.push(`${casa}: ${neg.length} com gasto mensal NEGATIVO (ex.: ${neg.slice(0, 3).map((p) => p.nome).join(', ')}) — sinal da cota invertido na fonte?`);
    const med = mediana(gastos);
    // faixa larga de propósito: pega sinal/unidade trocados, não variação real
    if (med !== null && (med < 5 || med > 200)) falhas.push(`${casa}: mediana da cota R$ ${med} mil/mês — fora de qualquer faixa plausível (unidade ou sinal?)`);

    const zero = (f) => A.filter(f).length;
    const cotaZero = zero((p) => !p.gastoMensalMedioMil);
    const ataqueZero = zero((p) => !p.statRaw?.ataque);
    const semPrior = zero((p) => !p.prioridades);
    for (const [rot, n] of [['cota zero', cotaZero], ['ataque zero', ataqueZero], ['sem prioridades', semPrior]]) {
      if (n > DEZENAS) falhas.push(`${casa}: ${n} de ${A.length} com ${rot} — dezenas é a fonte devolvendo vazio`);
    }
    resumo.push(`${casa}: ${A.length} · cota mediana R$ ${med} mil/mês · cota zero ${cotaZero} · ataque zero ${ataqueZero} · sem prioridades ${semPrior}`);

    // fração < 40 por atributo que pontua: percentil puro dá ~40%; uma escala nova
    // (ou uma fonte invertida) que jogue a casa no vermelho aparece aqui
    for (const k of pontuam) {
      const v = A.map((p) => p.stats?.[k]).filter((x) => typeof x === 'number');
      if (v.length < A.length / 2) continue;
      const frac = v.filter((x) => x < 40).length / v.length;
      if (frac > 0.6 || frac < 0.15) falhas.push(`${casa}: ${(frac * 100).toFixed(0)}% abaixo de 40 em ${k} — atributo percentílico fica perto de 40%`);
    }
  }

  // bulks: idade > 2 dias numa ingestão de hoje = o download falhou e o cache velho foi usado
  const velhos = bulks.filter((b) => b.dias > 2);
  if (velhos.length) {
    avisos.push(`${velhos.length} bulk(s) servido(s) de cache antigo (download falhou): ${velhos.map((b) => `${b.nome} (${b.dias.toFixed(0)}d)`).join(', ')} — o updatedAt reflete a idade deles`);
  }
  if (meta?.updatedAt && meta?.geradoEm && meta.updatedAt < meta.geradoEm) {
    avisos.push(`updatedAt ${meta.updatedAt} < geradoEm ${meta.geradoEm}: alguma fonte volátil é antiga`);
  }

  // eleições: o campo só vale até a posse; sem ele antes disso, o portão abortou
  const posse = meta?.eleicao2026?.posseEm;
  const comEleicao = ps.filter((p) => p.eleicao2026);
  if (!meta?.eleicao2026) {
    if (!hoje || hoje < '2027-02-01') avisos.push('eleições 2026: nenhum destino emitido — o portão abortou (leia o ⚠️ [eleicao] do log)');
  } else if (!posse || !hoje || hoje < posse) {
    const sem = ps.filter((p) => !p.eleicao2026);
    const porUf = new Map();
    for (const p of sem) porUf.set(p.uf, (porUf.get(p.uf) ?? 0) + 1);
    const concentradas = [...porUf].filter(([, n]) => n >= 3);
    resumo.push(`eleições: ${comEleicao.length} com destino · ${sem.length} sem afirmação`);
    if (sem.length > DEZENAS) avisos.push(`eleições: ${sem.length} sem afirmação — dezenas é chave quebrada ou UF sem resultado na fonte`);
    if (concentradas.length) avisos.push(`eleições: sem afirmação concentrada em ${concentradas.map(([uf, n]) => `${uf} (${n})`).join(', ')} — UF sem resultado no arquivo do TSE; some sozinho quando ele republicar`);
  }

  return { falhas, avisos, resumo };
}
