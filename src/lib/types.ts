/** Shapes dos JSONs emitidos por scripts/ingest-real.mjs — o contrato entre o
 *  gerador e a UI. Dados reais da Câmara e do Senado. */

export type Casa = 'camara' | 'senado';
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type StatKey = 'ataque' | 'stamina' | 'tecnica' | 'eficiencia' | 'influencia' | 'economia' | 'comando' | 'fiscalizacao' | 'alinhamento';

export interface Stats extends Record<StatKey, number> {}

export interface Politician {
  id: number;
  slug: string;
  nome: string;
  casa: Casa;
  uf: string;
  partido: string;
  /** foto oficial da casa; ausente (raro) → silhueta determinística */
  fotoUrl?: string;
  /** placeholder da foto: WebP 12×13 em data-URI. Fora do index.json de propósito. */
  fotoLqip?: string;
  /** card 1200×630 de compartilhamento (`npm run og`). Presente = o arquivo EXISTE;
   *  ausente = a página cai no card do site (og:image 404 não mostra cartão nenhum). */
  ogImage?: string;
  primeiroMandato: boolean;
  stats: Stats;
  ops: number;
  tier: Tier;
  sGateBloqueadoPor: string | null;
  /** < 12 meses em exercício efetivo no período (posse recente ou licença/ministério) → fora dos rankings, sem Tier */
  mandatoParcial?: boolean;
  /** preside a Casa (Mesa Diretora) — cargo institucional suprime a atividade medida → fora dos rankings, sem Tier */
  presidenteCasa?: boolean;
  /** meses em exercício efetivo no período (base do mandatoParcial) */
  mesesExercicio?: number;
  titles: string[];
  /** gasto de cota ÷ meses em exercício efetivo (piso de 1 mês), em R$ mil/mês —
   *  o mesmo número que a Economia percentila (comparar totais da legislatura
   *  premiaria quem ficou menos tempo sentado) */
  gastoMensalMedioMil: number;
  /** quebra INFORMATIVA da cota (CEAP/CEAPS) por categoria e maior fornecedor —
   *  descreve para onde a verba foi; NÃO pontua (a Economia é o percentil do total). */
  cotaResumo?: {
    total: number;
    categorias: { categoria: string; valor: number; pct: number }[];
    fornecedor?: { nome: string; valor: number; pct: number } | null;
  };
  seguidores: number;
  /** proposições relevantes (PL/PLP/PEC/PDL) apresentadas por ano, 2023..2026 */
  producaoAnual: number[];
  /** Senado: presença nas votações de autoridades (sabatina, art. 52) e nas demais.
   *  A Stamina soma as duas — a quebra existe para o painel "A Sabatina". */
  sabatinas?: { presencas: number; total: number };
  votacoesAbertas?: { presencas: number; total: number };
  /** números brutos formatados por atributo — "de onde vem" cada stat */
  rawNumbers?: Partial<Record<StatKey, string>>;
  /** valor bruto NUMÉRICO por atributo — base dos rankings "quem tem mais X" */
  statRaw?: Partial<Record<StatKey, number>>;
  /** o mesmo bruto em UMA LINHA ("R$ 46 mil/mês de cota") — cabe sob a barra do
   *  atributo na imagem de compartilhamento, onde a frase longa seria truncada */
  rawCurto?: Partial<Record<StatKey, string>>;
  /** número BRUTO que disparou cada título VERMELHO, com a mediana da casa ao lado
   *  (slug → frase). Só existe para os vermelhos: o selo acusa em termos absolutos a
   *  partir de um gate percentílico, então precisa mostrar o dado que o gerou. */
  titleEvidence?: Record<string, string>;
  /** sexo declarado — para agregados de representatividade */
  sexo?: 'M' | 'F' | null;
  /** ficha civil — dados cadastrais oficiais */
  ficha?: { idade?: number; naturalidade?: string; escolaridade?: string; condicao?: string;
    /** nº de mandatos exercidos NA CASA ATUAL (Câmara: legislaturas; Senado: mandatos de 8 anos) */
    mandatos?: number };
  /** órgãos/comissões ATUAIS + cargos de comando (presidências etc.) */
  comissoes?: { total: number; cargos: { sigla: string; nome: string; cargo: string }[] };
}

/** Registro slim servido em /data/index.json para busca e Modo Batalha. */
export interface PoliticianIndex {
  slug: string;
  nome: string;
  fotoUrl?: string;
  casa: Casa;
  uf: string;
  partido: string;
  tier: Tier;
  ops: number;
  stats: Stats;
  /** stats existentes p/ este parlamentar (ausente = todos) */
  avail?: StatKey[];
  /** posse recente → fora dos rankings (marca p/ Batalha/busca) */
  mandatoParcial?: boolean;
  /** preside a Casa → fora dos rankings (marca p/ Batalha/busca) */
  presidenteCasa?: boolean;
}

export interface Guild {
  sigla: string;
  nome: string;
  cor: string;
  /** sempre null: NÃO classificamos partidos por espectro ideológico — seria
   *  juízo editorial, não dado factual. O eixo governo/oposição que exibimos é
   *  medido (voto × orientação da bancada do Governo), não atribuído. */
  espectro: null;
  /** card 1200×630 de compartilhamento (`npm run og`) — mesma semântica do
   *  `ogImage` do Politician: presente = o arquivo existe. */
  ogImage?: string;
}

/** data/meta.json — declara o que o gerador produziu. A UI se adapta por ele:
 *  nunca hardcode suposições sobre quais atributos existem. */
export interface DataMeta {
  fonte: string;
  /** data da FONTE mais velha usada na ingestão — é o que o site exibe.
   *  Não confundir com `geradoEm`: recalcular sobre cache não atualiza dado. */
  updatedAt: string;
  /** data em que o gerador rodou (diagnóstico; não é exibido ao leitor) */
  geradoEm?: string;
  availableStats: StatKey[];
  /** piso de Poder de cada Tier (F é o resto). Emitido pelo gerador para que a UI
   *  classifique a MÉDIA da guilda com a mesma tabela dos parlamentares. */
  tierCortes: Record<Exclude<Tier, 'F'>, number>;
  pesos: Partial<Record<StatKey, number>>;
  /** pesos específicos por casa (o Senado não tem Fiscalização nem Alinhamento, por ex.) */
  pesosPorCasa?: Record<Casa, Partial<Record<StatKey, number>>>;
  /** atributos exibidos mas que NÃO pontuam no Poder (Influência, Comando,
   *  Fiscalização, Alinhamento — medem projeção ou posição, não entrega) */
  statsInformativos?: StatKey[];
  titulosDisponiveis: boolean;
  aviso: string | null;
}

export interface TitleDef {
  slug: string;
  label: string;
  cor: 'green' | 'red' | 'purple';
  regra: string;
  /** raridade derivada da fração de portadores (comum/raro/lendário) */
  raridade?: 'comum' | 'raro' | 'lendario';
}

/** pessoa slim usada nos rankings/insights */
export interface RankPessoa { slug: string; nome: string; casa: Casa; uf: string; partido: string }

export interface Insights {
  kpis: { tierS: number; opsMedio: number; cacadores: number; blogueiros: number; dragoes: number };
  /** KPIs derivados dos títulos factuais ativos */
  extraKpis?: { lbl: string; val: number | string; sub: string; titleSlug?: string; href?: string }[];
  /** renovação & idade */
  renovacao?: {
    estreantes: number; pctEstreantes: number;
    idadeMediaCamara: number; idadeMediaSenado: number;
    maisNovo: RankPessoa & { idade: number } | null;
    maisVelho: RankPessoa & { idade: number } | null;
  };
  /** leis que viraram norma (as duas casas) */
  leis?: { total: number; legisladores: number; ranking: (RankPessoa & { n: number })[] };
  /**
   * A sabatina — aprovação de autoridades (CF art. 52, III e IV), competência PRIVATIVA
   * do Senado e 58% das suas votações nominais. `faltantes` = maiores gaps NEGATIVOS
   * entre a presença na sabatina e a presença nas demais votações: quem comparece ao
   * plenário e falta justamente ao que só a casa dele pode fazer.
   */
  sabatina?: {
    total: number; totalAbertas: number;
    presencaMedia: number; presencaMediaAbertas: number;
    faltantes: (RankPessoa & { sabatina: number; abertas: number; gap: number })[];
  };
  /** representatividade de gênero por casa */
  genero?: { camara: { f: number; m: number }; senado: { f: number; m: number } };
  /**
   * Cota parlamentar agregada, em R$ mil/mês. SEMPRE por casa: CEAP (Câmara) e
   * CEAPS (Senado) têm tetos e regras distintas — somar ou ranquear as duas juntas
   * produz comparação inválida.
   */
  gastoPorCasa: Record<Casa, { n: number; media: number; mediana: number; max: number; totalMil: number }>;
  /** guildas por gasto médio de cota por parlamentar (R$ mil/mês), recortadas por casa */
  guildGasto: Record<Casa, { sigla: string; nome: string; n: number; media: number; totalMil: number }[]>;
  /** "Onde o Congresso gasta a cota" — agregado por categoria, POR CASA (nunca soma casas).
   *  Informativo: descreve a distribuição, não pontua. */
  gastoCategorias: Record<Casa, { totalMi: number; categorias: { categoria: string; totalMil: number; pct: number }[] }>;
  /** ranking nacional de maior gasto na categoria "Divulgação" (R$ mil, total no mandato) */
  topDivulgacao: (RankPessoa & { tier: Tier; valorMil: number })[];
  /** scatter divulgação × alcance: x = divulgação mensal média (R$ mil/mês), y = percentil de Influência */
  divulgacaoInfluencia: (RankPessoa & { tier: Tier; x: number; y: number })[];
  /** ranking nacional por concentração da cota num só fornecedor (informativo — concentração ≠ irregularidade) */
  concentracaoFornecedor: (RankPessoa & { tier: Tier; fornecedor: string; pct: number; valorMil: number })[];
  guildRanking: (Guild & { total: number; tiers: Record<Tier, number> })[];
  ufAgg: { uf: string; opsMedio: number; blogueiros: number }[];
  scatter: {
    slug: string; nome: string; gasto: number; ops: number;
    tier: Tier; uf: string; partido: string; casa: Casa; flag: boolean;
  }[];
  fama: { slug: string; nome: string; casa: Casa; uf: string; partido: string; ops: number; tier: Tier }[];
  vergonha: { slug: string; nome: string; casa: Casa; uf: string; partido: string; ops: number; tier: Tier }[];
  /**
   * Eixo Governo × Oposição — só Câmara (só ela publica a orientação de cada
   * bancada por votação). Ausente no Senado.
   */
  termometro?: { base: number; independentes: number; oposicao: number; total: number };
  /** top 10 por |desvio| da média de alinhamento do próprio partido (partidos com >=8 deputados) */
  dissidentes?: (RankPessoa & { alinhamento: number; mediaPartido: number; desvio: number })[];
  /** top 10 por nº bruto de atos de fiscalização ao Executivo */
  topFiscais?: (RankPessoa & { atos: number; alinhamento: number })[];
  /** todos os deputados com alinhamento: x = alinhamento (taxa absoluta), y = percentil de fiscalização */
  politicaScatter?: (RankPessoa & { tier: Tier; x: number; y: number })[];
}
