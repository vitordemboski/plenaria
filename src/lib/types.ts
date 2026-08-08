/** Shapes dos JSONs emitidos por scripts/ingest-real.mjs — o contrato entre o
 *  gerador e a UI. Dados reais da Câmara e do Senado. */

export type Casa = 'camara' | 'senado';
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type StatKey = 'ataque' | 'stamina' | 'tecnica' | 'eficiencia' | 'influencia' | 'economia' | 'comando' | 'fiscalizacao' | 'alinhamento';

export interface Stats extends Record<StatKey, number> {}

/**
 * Uma proposição de autoria principal que foi TRANSFORMADA EM NORMA JURÍDICA —
 * o desfecho, não a intenção. `ref` é o nome do projeto ("PL 358/2025") e sempre
 * existe; `norma` é o nome da lei publicada ("Lei 15.172/2025") e é o que o leitor
 * reconhece — mas **é omitido quando a fonte não o dá**, nunca estimado (a Câmara
 * não o publica em campo nenhum; ver scripts/lib/norma.mjs).
 */
export interface Lei {
  /** identificação da PROPOSIÇÃO — "PL 358/2025" */
  ref: string;
  /** identificação da NORMA — "Lei 15.172/2025". Ausente = a fonte não publicou. */
  norma?: string;
  /** ementa oficial, cortada em limite de palavra (o link leva ao texto integral) */
  ementa: string;
  /** data em que virou norma, ISO. Ausente = a fonte não a expôs de forma confiável. */
  data?: string;
  /** página oficial da proposição na casa — a prova auditável de cada linha */
  url: string;
}

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
    /**
     * Maior fornecedor, agregado por CNPJ. Quando é PESSOA FÍSICA (`pessoaFisica`),
     * `nome` não é o nome dela — é o rótulo do que foi contratado ("Escritório").
     * O nome nunca é emitido: ela não é agente público, e o que o painel informa é
     * a concentração, que o percentual já diz. Ver `ehCpf` em scripts/lib/cota.mjs.
     */
    fornecedor?: { nome: string; valor: number; pct: number; pessoaFisica?: true } | null;
  };
  seguidores: number;
  /** proposições relevantes (PL/PLP/PEC/PDL) apresentadas por ano, 2023..2026 */
  producaoAnual: number[];
  /** nº de proposições de autoria principal que viraram norma jurídica. Alimenta o
   *  bônus da Eficiência e o título `legislador-efetivo`. */
  leisAprovadas: number;
  /** as leis em si, da mais recente para a mais antiga. Ausente = nenhuma.
   *  Mesmo recorte de tudo o mais: proposições NUMERADAS nesta legislatura. */
  leis?: Lei[];
  /**
   * "No que trabalha" — classificação temática OFICIAL das proposições de autoria
   * principal (temas da Câmara / classificações do Senado, normalizados em
   * `scripts/lib/temas.mjs`). Ausente para quem não tem nenhuma autoria classificada.
   *
   * INFORMATIVO: não pontua no Poder, não gera Tier e NÃO gera título — um selo
   * "Deputado da Saúde" seria rótulo sobre pauta política, o mesmo motivo pelo qual
   * a Fiscalização não pontua.
   *
   * CONTAGEM CHEIA: uma proposição com 3 temas conta inteira nos 3, então
   * `sum(temas.n) > nComTema` e os percentuais NÃO somam 100% — cada linha é uma
   * afirmação independente ("41 das 120 proposições dele tocam Saúde").
   */
  prioridades?: {
    temas: { tema: string; n: number }[];
    /** proposições de autoria COM tema — o denominador de toda linha */
    nComTema: number;
    /** proposições de autoria SEM classificação na fonte (contadas, nunca escondidas) */
    nSemTema: number;
    /** temas por proposição deste parlamentar — explica por que não soma 100% */
    temasPorProposicao: number;
    /** tema do topo, para a faixa do card. Só existe acima do piso de proposições:
     *  "1 de 2 = 50% Saúde" seria prioridade nascida de ruído. */
    destaque?: { tema: string; n: number; de: number; pct: number };
  };
  /** Senado: votos registrados nas votações de autoridades (sabatina, art. 52) e nas
   *  demais. A Stamina soma as duas — a quebra alimenta o painel "A Sabatina". */
  sabatinas?: { presencas: number; total: number };
  votacoesAbertas?: { presencas: number; total: number };
  /** SENADO — presença no plenário, incluindo o "Presente – Não registrou voto" que a
   *  Stamina não conta. Informativa: a Stamina é voto REGISTRADO nas duas casas (o bulk
   *  da Câmara só traz voto efetivo), e sem esta segunda taxa o senador que comparece
   *  sem votar pareceria simplesmente ausente. */
  compareceuN?: { presencas: number; total: number };
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

/**
 * data/licenciados.json — o titular AFASTADO da cadeira, que as fontes oficiais
 * param de publicar e que por isso não tem ficha no site. Não é um Politician
 * incompleto: não há atividade dele publicada para medir, então não há atributo,
 * Tier nem slug. Existe só para a guilda e o estado poderem nomear quem falta.
 *
 * Nenhuma das duas casas publica o MOTIVO da licença — nunca há campo para ele.
 */
export interface Licenciado {
  nome: string;
  casa: 'camara' | 'senado';
  partido: string;
  uf: string;
  /** data do afastamento (ISO) — o único fato publicável além do nome */
  desde: string;
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
  /** vocabulário comum das prioridades — a UI nunca hardcoda a lista de temas */
  temas?: {
    vocabulario: string[];
    /** rótulo de escape: tema que a fonte publicou e o mapa ainda não conhece */
    outros: string;
    /** média de temas por proposição no Congresso (a razão de não somar 100%) */
    porProposicao: number;
  };
  titulosDisponiveis: boolean;
  aviso: string | null;
}

/**
 * data/analises.json — a camada de leitura GERADA POR IA sobre as prioridades.
 *
 * Os números nunca vêm daqui: eles saem da classificação oficial das duas casas.
 * A IA lê as ementas e os rótulos e escreve um parágrafo; o prompt proíbe citar
 * qualquer quantidade que não esteja na tabela ao lado.
 *
 * `fonteHash` é o que impede a falha silenciosa da feature: se ele não bater com
 * o hash dos números atuais (`fonteHash()` em scripts/lib/analises.mjs), a UI não
 * renderiza o texto. Análise obsoleta some em vez de descrever outro dado.
 */
export interface Analise {
  /** 'nacional' | `guilda:${sigla}` | `parlamentar:${slug}` | `leis:*` */
  alvo: string;
  texto: string;
  /** modelo que escreveu — exibido ao lado do texto, junto da data */
  modelo: string;
  geradoEm: string;
  /** versão do prompt, versionado em docs/prompts/ e linkado na página */
  promptVersao: string;
  /** família do prompt — o arquivo é `docs/prompts/{prompt}-{promptVersao}.md`.
   *  Ausente = 'prioridades', a única família que existia quando o contrato nasceu.
   *  Sem isto, uma análise de leis linkaria o prompt das prioridades, e o leitor
   *  leria as regras erradas achando que são as que produziram o texto. */
  prompt?: 'prioridades' | 'leis';
  fonteHash: string;
  /** quem revisou antes de publicar (a revisão humana é o ponto do volume pequeno) */
  revisadoPor?: string;
}

export interface TitleDef {
  slug: string;
  label: string;
  cor: 'green' | 'red' | 'purple';
  regra: string;
  /** raridade derivada da fração de portadores (comum/raro/lendário) */
  raridade?: 'comum' | 'raro' | 'lendario';
}

/** perfil temático de um conjunto de NORMAS (já deduplicado por proposição) */
export interface AgregadoLeis {
  temas: { tema: string; n: number }[];
  nComTema: number;
  nSemTema: number;
  nLeis: number;
}

/** uma linha de "o que se apresenta × o que vira lei", por tema */
export interface LinhaComparativo {
  tema: string;
  /** normas neste tema */
  n: number;
  /** proposições apresentadas neste tema (universo deduplicado) */
  nApresentadas: number;
  pctAprovadas: number;
  pctApresentadas: number;
  /** normas ÷ apresentadas, em %. `null` abaixo do piso — "não dá para afirmar"
   *  e "0% de aproveitamento" são coisas diferentes, e a segunda seria falsa. */
  taxa: number | null;
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
  leis?: {
    total: number;
    legisladores: number;
    ranking: (RankPessoa & { n: number })[];
    /** normas distintas creditadas a quem está em exercício — menor que a soma das
     *  contagens individuais, porque autoria coletiva credita a mesma lei a vários */
    distintas?: number;
    /** perfil temático das normas (classificação OFICIAL, não IA). Contagem CHEIA:
     *  uma lei com 3 temas conta nos 3, então os percentuais não somam 100%. */
    temas?: AgregadoLeis;
    /** o universo contra o qual a taxa é medida: proposições DISTINTAS de autoria
     *  principal, o mesmo recorte deduplicado do lado das aprovadas */
    apresentadas?: { temas: { tema: string; n: number }[]; nComTema: number };
    /** apresentado × aprovado por tema, com a taxa de conversão */
    comparativo?: LinhaComparativo[];
    /** normas honoríficas: título de "Capital Nacional", data comemorativa,
     *  Livro dos Heróis. Descritivo, não juízo — a plataforma conta, o leitor julga. */
    simbolicas?: { n: number; exclusivas: number; total: number; pct: number };
    /** feed das normas mais recentes, agrupadas por proposição (uma lei com dois
     *  autores principais é UMA linha com dois nomes, nunca duas) */
    recentes: (Lei & { autores: RankPessoa[] })[];
  };
  /**
   * A sabatina — aprovação de autoridades (CF art. 52, III e IV), competência PRIVATIVA
   * do Senado e 58% das suas votações nominais. `faltantes` = maiores gaps NEGATIVOS
   * entre o voto registrado na sabatina e nas demais votações: quem está no plenário e
   * não vota justamente no que só a casa dele pode fazer.
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
  concentracaoFornecedor: (RankPessoa & {
    tier: Tier; fornecedor: string; pct: number; valorMil: number;
    /** fornecedor pessoa física: `fornecedor` é o que foi contratado, não o nome dela */
    pessoaFisica?: true;
  })[];
  /**
   * Empresas que mais receberam da cota, agregadas por CNPJ (as duas casas juntas).
   * `totalMi` é o universo com CNPJ identificado — e `semCnpjMi` é o que ficou fora
   * (SIGEPA não identifica pessoa jurídica; lançamento em CPF é pessoa física e não
   * entra em ranking público). O painel PRECISA exibir os dois: `pct` é fatia de
   * `totalMi`, não do total da cota. `concentracao` é o acumulado do top-k.
   */
  fornecedoresCota?: {
    totalMi: number; semCnpjMi: number; nEmpresas: number;
    empresas: { nome: string; cnpj: string; valorMil: number; pct: number; nParl: number }[];
    concentracao: { top: number; pct: number }[];
  };
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
