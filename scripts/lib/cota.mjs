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

/** só os dígitos do CNPJ/CPF — a pontuação do CEAP vem torta ("085.324.290/0013-1") */
export const soDigitos = (doc) => String(doc ?? '').replace(/\D/g, '');

/** true p/ CNPJ (14 dígitos). CPF (11) é pessoa física: nunca entra em ranking público. */
export const ehCnpj = (doc) => soDigitos(doc).length === 14;

/**
 * true p/ CPF (11 dígitos) — fornecedor PESSOA FÍSICA (em geral o locador do
 * escritório ou um prestador de serviço do gabinete).
 *
 * O nome dessa pessoa NUNCA é emitido. O dado é público na origem (a Câmara o
 * publica sob a LAI), mas publicidade na origem não dispensa a necessidade na
 * reutilização: o que o painel informa é CONCENTRAÇÃO ("35% da cota num só
 * fornecedor, aluguel de escritório"), e o nome não acrescenta nada a essa frase.
 * Ela não é agente público — e nomeá-la ao lado do parlamentar, com um percentual e
 * sem explicação, faz o leitor completar sozinho uma acusação que o dado não
 * sustenta. É a mesma regra dos títulos: rótulo não imputa o que a regra não deriva.
 */
export const ehCpf = (doc) => soDigitos(doc).length === 11;

/** 14 dígitos → "08.532.429/0001-31" (a fonte pontua errado; reformatamos do dígito) */
export function formataCnpj(doc) {
  const d = soDigitos(doc);
  return d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : d;
}

const SEP = '\u0000';

/**
 * Chave de acumulação de um lançamento de fornecedor. Existe porque o CEAP grava o
 * NOME em texto livre: um mesmo CNPJ aparece com 81 grafias (Vivo) e até 630
 * (A&T Turismo). Agrupar por nome estilhaça a empresa e SUBESTIMA a concentração —
 * era o que acontecia antes: chaveando por CNPJ, 40% dos deputados sobem de fatia
 * e um caso vai de 23% p/ 63% (R$ 994 mil num só CNPJ espalhados em várias grafias).
 * Sem documento (SIGEPA não traz), cai no nome — nunca se dropa o lançamento.
 */
export const chaveFornecedor = (doc, nome, categoria = '') =>
  `${soDigitos(doc)}${SEP}${nome}${SEP}${categoria}`;

/** desfaz chaveFornecedor: Map<chave, R$> → [doc, nome, categoria, R$][] */
export const destrincharFornecedores = (mapa) =>
  [...(mapa?.entries() ?? [])].map(([k, v]) => {
    const [doc, nome, categoria = ''] = k.split(SEP);
    return [doc, nome, categoria, v];
  });

/**
 * Resume os lançamentos de cota de UM parlamentar. Devolve a lista COMPLETA de
 * categorias (sem truncar) — a dobra em "Outros" p/ exibição fica no consumidor
 * (dobrarCategorias), para os agregados de Insights poderem somar o dado inteiro.
 * @param {Array<[string, number]>} categoriaValores  [rótulo cru, R$] já somados por categoria
 * @param {Array<[string, string, string, number]>} fornecedorValores  [doc, nome, categoria, R$] já somados
 * @returns {{ total: number, categorias: {categoria: string, valor: number, pct: number}[], fornecedor: {nome: string, valor: number, pct: number, pessoaFisica?: true} | null }}
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

  // maior fornecedor: agrupa por DOCUMENTO (ver chaveFornecedor), não por nome.
  // O nome exibido é a grafia que concentra mais R$ dentro do mesmo documento.
  const porDoc = new Map();
  let totalF = 0;
  for (const [doc, nome, categoria, valor] of fornecedorValores) {
    const chave = soDigitos(doc) || nome;
    let e = porDoc.get(chave);
    if (!e) porDoc.set(chave, (e = { doc: soDigitos(doc), total: 0, grafias: new Map(), cats: new Map() }));
    e.total += valor;
    e.grafias.set(nome, (e.grafias.get(nome) ?? 0) + valor);
    e.cats.set(categoria, (e.cats.get(categoria) ?? 0) + valor);
    totalF += valor;
  }
  let fornecedor = null;
  // estorno pode zerar/negativar o fornecedor inteiro — esse não concorre
  const candidatos = [...porDoc.values()].filter((e) => e.total > 0);
  if (candidatos.length && totalF > 0) {
    const top = candidatos.reduce((max, cur) => (cur.total > max.total ? cur : max));
    const maior = (m) => [...m.entries()].reduce((max, cur) => (cur[1] > max[1] ? cur : max))[0];
    fornecedor = { valor: top.total, pct: Math.round((top.total / totalF) * 100) };
    if (ehCpf(top.doc)) {
      // pessoa física: no lugar do nome vai O QUE FOI CONTRATADO (ver ehCpf).
      // O nome não é gravado no JSON — minimização começa na emissão, não na UI.
      fornecedor.nome = rotuloCategoria(maior(top.cats));
      fornecedor.pessoaFisica = true;
    } else {
      fornecedor.nome = maior(top.grafias); // grafia com mais R$ dentro do documento
    }
  }

  return { total, categorias, fornecedor };
}

/** degraus do acumulado exibidos no painel de concentração do mercado da cota */
const DEGRAUS_CONCENTRACAO = [1, 10, 20, 100];

/**
 * Agregado nacional das empresas que receberam cota parlamentar.
 *
 * Só CNPJ: 3,3% do gasto vai para CPF, e essa lista é gente física (locador do
 * escritório, prestador de serviço) com nome completo e um único parlamentar —
 * ranking público de CPF exporia pessoa privada, e o projeto deliberadamente
 * deixou de ler CPF quando o Karma saiu. Também é por isso que `semCnpjMi` é
 * emitido: 16% da cota (SIGEPA, que não identifica pessoa jurídica nenhuma, +
 * lançamentos em CPF) fica FORA do universo, e o painel tem de declarar o
 * denominador em vez de deixar o leitor achar que o % é do total da cota.
 *
 * @param {Iterable<[string, string, string, number]>} lancamentos  [chaveParl, doc, nome, R$]
 * @param {number} totalCota  total da cota da mesma população (p/ derivar o que ficou fora)
 * @param {number} [top]  quantas empresas na lista
 */
export function rankFornecedores(lancamentos, totalCota, top = 15) {
  const porCnpj = new Map();
  for (const [parl, doc, nome, valor] of lancamentos) {
    if (!ehCnpj(doc)) continue;
    const d = soDigitos(doc);
    let e = porCnpj.get(d);
    if (!e) porCnpj.set(d, (e = { total: 0, grafias: new Map(), parls: new Set() }));
    e.total += valor;
    e.grafias.set(nome, (e.grafias.get(nome) ?? 0) + valor);
    e.parls.add(parl);
  }
  const todas = [...porCnpj.entries()]
    .filter(([, e]) => e.total > 0)
    .sort((a, b) => b[1].total - a[1].total);
  const soma = todas.reduce((t, [, e]) => t + e.total, 0);
  const acumulado = (k) =>
    soma > 0 ? +((todas.slice(0, k).reduce((t, [, e]) => t + e.total, 0) / soma) * 100).toFixed(1) : 0;

  return {
    totalMi: +(soma / 1e6).toFixed(1),
    semCnpjMi: +(Math.max(totalCota - soma, 0) / 1e6).toFixed(1),
    nEmpresas: todas.length,
    empresas: todas.slice(0, top).map(([doc, e]) => ({
      nome: [...e.grafias.entries()].reduce((max, cur) => (cur[1] > max[1] ? cur : max))[0],
      cnpj: formataCnpj(doc),
      valorMil: Math.round(e.total / 1000),
      // 1 casa decimal: com o topo em 1,3% um inteiro arredondaria tudo p/ "1%"
      pct: soma > 0 ? +((e.total / soma) * 100).toFixed(2) : 0,
      nParl: e.parls.size,
    })),
    concentracao: DEGRAUS_CONCENTRACAO.filter((k) => k <= todas.length).map((k) => ({ top: k, pct: acumulado(k) })),
  };
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
