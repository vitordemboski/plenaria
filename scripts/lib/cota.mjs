/**
 * Quebra da cota parlamentar (CEAP na Câmara, CEAPS no Senado) por categoria e
 * por fornecedor — INFORMATIVO. Não altera a nota de Economia (percentil do total
 * gasto); só descreve para onde a verba foi.
 *
 * GUARDRAIL: rótulo desconhecido NUNCA é dropado. Se a fonte inventar uma
 * categoria nova, ela ainda aparece (com um rótulo limpo genérico) em vez de
 * sumir em silêncio — o mesmo princípio dos parses de CSV do projeto.
 */

/** normaliza o rótulo cru p/ casar no dicionário: sem espaços extras, sem ponto final, minúsculo */
function normKey(s) {
  return String(s).trim().replace(/\s+/g, ' ').replace(/\.+$/, '').trim().toLowerCase();
}

/**
 * Rótulos curtos por categoria. Chaveado pela forma normalizada (normKey) dos
 * rótulos OFICIAIS das duas casas — CEAP (CAIXA ALTA, ponto final) e CEAPS
 * (frases longas). Categorias equivalentes das duas casas apontam p/ o mesmo curto.
 */
const CURTO_POR_CATEGORIA = new Map(
  Object.entries({
    // --- CEAP (Câmara) ---
    'combustíveis e lubrificantes': 'Combustível',
    'passagem aérea - sigepa': 'Passagens',
    'passagem aérea - rpa': 'Passagens',
    'passagem aérea - reembolso': 'Passagens',
    'passagens terrestres, marítimas ou fluviais': 'Passagens',
    'serviço de táxi, pedágio e estacionamento': 'Táxi/pedágio',
    'manutenção de escritório de apoio à atividade parlamentar': 'Escritório',
    'telefonia': 'Telefonia',
    'divulgação da atividade parlamentar': 'Divulgação',
    'fornecimento de alimentação do parlamentar': 'Alimentação',
    'locação ou fretamento de veículos automotores': 'Veículos',
    'locação ou fretamento de aeronaves': 'Aeronaves',
    'locação ou fretamento de embarcações': 'Embarcações',
    'hospedagem ,exceto do parlamentar no distrito federal': 'Hospedagem',
    'serviços postais': 'Correios',
    'serviço de segurança prestado por empresa especializada': 'Segurança',
    'assinatura de publicações': 'Publicações',
    'consultorias, pesquisas e trabalhos técnicos': 'Consultoria',
    'aquisição de tokens e certificados digitais': 'Tokens/certificados',
    'participação em curso, palestra ou evento similar': 'Cursos',
    // --- CEAPS (Senado) ---
    'locomoção, hospedagem, alimentação, combustíveis e lubrificantes': 'Locomoção/hospedagem',
    'aluguel de imóveis para escritório político, compreendendo despesas concernentes a eles': 'Escritório',
    'passagens aéreas, aquáticas e terrestres nacionais': 'Passagens',
    'contratação de consultorias, assessorias, pesquisas, trabalhos técnicos e outros serviços de apoio ao exercício do mandato parlamentar': 'Consultoria',
    'divulgação da atividade parlamentar': 'Divulgação',
    'aquisição de material de consumo para uso no escritório político, inclusive aquisição ou locação de software, despesas postais, aquisição de publicações, locação de móveis e de equipamentos': 'Material de escritório',
    'serviços de segurança privada': 'Segurança',
  }).map(([k, v]) => [normKey(k), v]),
);

/**
 * Rótulo curto de exibição para uma categoria de cota.
 * @param {string} raw rótulo oficial (txtDescricao/CEAP ou TIPO_DESPESA/CEAPS)
 * @returns {string} rótulo curto conhecido; senão a versão limpa; branco → "Outros"
 */
export function rotuloCategoria(raw) {
  const key = normKey(raw);
  if (!key) return 'Outros';
  const curto = CURTO_POR_CATEGORIA.get(key);
  if (curto) return curto;
  // desconhecido: não dropa — sentence case da versão limpa
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** percentuais inteiros que somam exatamente 100 (maior resto / Hamilton) */
export function percentuais(valores, total) {
  if (total <= 0) return valores.map(() => 0);
  const exato = valores.map((v) => (v / total) * 100);
  const piso = exato.map(Math.floor);
  let resto = 100 - piso.reduce((a, b) => a + b, 0);
  const ordem = exato
    .map((v, i) => [i, v - Math.floor(v)])
    .sort((a, b) => b[1] - a[1]);
  const out = piso.slice();
  for (let k = 0; k < ordem.length && resto > 0; k++, resto--) out[ordem[k][0]] += 1;
  return out;
}

/**
 * Resume os lançamentos de cota de UM parlamentar. Devolve a lista COMPLETA de
 * categorias (sem truncar) — a dobra em "Outros" p/ exibição fica no consumidor
 * (dobrarCategorias), para os agregados de Insights poderem somar o dado inteiro.
 * @param {Array<[string, number]>} categoriaValores  [rótulo cru, R$] já somados por categoria
 * @param {Array<[string, number]>} fornecedorValores  [nome do fornecedor, R$] já somados
 * @returns {{ total: number, categorias: {categoria: string, valor: number, pct: number}[], fornecedor: {nome: string, valor: number, pct: number} | null }}
 */
export function resumoCota(categoriaValores, fornecedorValores = []) {
  // agrega por rótulo curto (colapsa as várias "passagens" num só, junta as casas).
  // valor é LÍQUIDO (estornos já abatidos) p/ o total bater com a nota de Economia.
  const porRotulo = new Map();
  for (const [raw, valor] of categoriaValores) {
    const rot = rotuloCategoria(raw);
    porRotulo.set(rot, (porRotulo.get(rot) ?? 0) + valor);
  }
  // categoria que zerou/ficou negativa (só estorno no período) não entra
  const entradas = [...porRotulo.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = entradas.reduce((t, [, v]) => t + v, 0);
  const p = percentuais(entradas.map(([, v]) => v), total);
  const categorias = entradas.map(([categoria, valor], i) => ({ categoria, valor, pct: p[i] }));

  let fornecedor = null;
  const forns = fornecedorValores.filter(([, v]) => v > 0); // ignora fornecedor que só teve estorno
  if (forns.length) {
    const totalF = forns.reduce((t, [, v]) => t + v, 0);
    const [nome, valor] = forns.reduce((max, cur) => (cur[1] > max[1] ? cur : max));
    if (valor > 0) fornecedor = { nome, valor, pct: totalF > 0 ? Math.round((valor / totalF) * 100) : 0 };
  }

  return { total, categorias, fornecedor };
}

/**
 * Dobra a lista completa de categorias em top-N + "Outros" para EXIBIÇÃO (a barra
 * da carta). Os pcts da lista completa já somam 100, então o "Outros" só soma os
 * pcts da cauda — o total continua fechando em 100.
 * @param {{categoria: string, valor: number, pct: number}[]} categorias  saída de resumoCota
 * @param {number} [top]  quantas categorias antes de agrupar o resto
 */
export function dobrarCategorias(categorias, top = 5) {
  const head = categorias.slice(0, top).map((c) => ({ ...c }));
  const tail = categorias.slice(top);
  const restoValor = tail.reduce((t, c) => t + c.valor, 0);
  const restoPct = tail.reduce((t, c) => t + c.pct, 0);
  if (restoValor > 0) {
    const existente = head.find((c) => c.categoria === 'Outros');
    if (existente) { existente.valor += restoValor; existente.pct += restoPct; }
    else head.push({ categoria: 'Outros', valor: restoValor, pct: restoPct });
  }
  head.sort((a, b) => (a.categoria === 'Outros') - (b.categoria === 'Outros') || b.valor - a.valor);
  return head;
}
