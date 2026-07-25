/**
 * Acesso aos dados pré-computados. TUDO aqui roda apenas em build-time
 * (Server Components + generateStaticParams) — o site exportado não tem
 * runtime de dados; cada página já nasce com o HTML pronto.
 */
import politiciansJson from '../../data/politicians.json';
import insightsJson from '../../data/insights.json';
import guildsJson from '../../data/guilds.json';
import titleDefsJson from '../../data/title-defs.json';
import metaJson from '../../data/meta.json';
import type { Politician, Insights, Guild, TitleDef, Tier, DataMeta } from './types';

export const politicians = politiciansJson as Politician[];
export const insights = insightsJson as Insights;
export const guilds = guildsJson as Guild[];
export const titleDefs = titleDefsJson as TitleDef[];
export const meta = metaJson as DataMeta;

const bySlug = new Map(politicians.map((p) => [p.slug, p]));
const guildBySigla = new Map(guilds.map((g) => [g.sigla, g]));
const titleBySlug = new Map(titleDefs.map((t) => [t.slug, t]));

export const getPolitician = (slug: string) => bySlug.get(slug);
export const getGuild = (sigla: string) => guildBySigla.get(sigla);
export const getTitle = (slug: string) => titleBySlug.get(slug);

export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D', 'F'];

export const TIER_LABEL: Record<Tier, string> = {
  S: 'Lendário', A: 'Excelente', B: 'Consistente', C: 'Mediano', D: 'Fraco', F: 'Figurante',
};

// Descrição canônica de cada atributo — precisa dizer EXATAMENTE o que o gerador
// mede (guardrail: nada que não seja derivável do dado factual).
// Os `weight` aqui são só documentação: o valor exibido vem sempre de `meta.pesos`
// (ver AVAILABLE_STAT_META abaixo), que é emitido pelo gerador. Peso 0 = informativo.
// NÃO escreva "(informativo — não pontua)" nas descrições: a UI já anexa esse sufixo
// a qualquer atributo de `meta.statsInformativos`, e repetir duplica o texto no card.
export const STAT_META = [
  { key: 'ataque', icon: '⚔️', label: 'Ataque', desc: 'PL, PLP, PEC e PDL de autoria apresentados', weight: 24 },
  { key: 'stamina', icon: '🛡️', label: 'Stamina', desc: 'taxa de comparecimento às votações nominais ocorridas no seu exercício — no Senado, incluídas as sabatinas de autoridades', weight: 20 },
  { key: 'eficiencia', icon: '🎯', label: 'Eficiência', desc: 'proposições que avançaram — volume + aproveitamento, com bônus por lei', weight: 28 },
  { key: 'tecnica', icon: '📜', label: 'Técnica', desc: 'relatorias e emendas — trabalho técnico sobre o texto', weight: 16 },
  { key: 'economia', icon: '🪙', label: 'Economia', desc: 'frugalidade no uso da cota parlamentar (CEAP/CEAPS) — gasto mensal médio durante o exercício', weight: 12 },
  // informativos: aparecem no card e nos títulos, mas NÃO pontuam no Poder
  { key: 'fiscalizacao', icon: '🔎', label: 'Fiscalização', desc: 'requerimentos de informação, convocações de ministro e PFC', weight: 0 },
  { key: 'influencia', icon: '📢', label: 'Influência', desc: 'projeção pública — seguidores nas redes sociais', weight: 0 },
  { key: 'comando', icon: '👑', label: 'Comando', desc: 'peso institucional — comissões que integra e presidências que ocupa', weight: 0 },
  { key: 'alinhamento', icon: '🏛️', label: 'Alinhamento', desc: 'votos coincidentes com a orientação da bancada do Governo', weight: 0 },
] as const;

const STATS_INFORMATIVOS = new Set(meta.statsInformativos ?? []);

/** Atributos declarados pelo gerador em `meta.availableStats`, com os pesos do meta.
 *  Nem toda casa tem todos (o Senado não tem Fiscalização nem Alinhamento).
 *  `informativo` = exibido no card/radar mas NÃO pontua no Poder. */
export const AVAILABLE_STAT_META = STAT_META
  .filter((s) => meta.availableStats.includes(s.key))
  .map((s) => ({
    ...s,
    weight: Math.round((meta.pesos[s.key] ?? 0) * 100),
    informativo: STATS_INFORMATIVOS.has(s.key),
  }));

/** Atributos que PONTUAM no Poder (barras do card, radar, rounds da Batalha). */
export const SCORING_STAT_META = AVAILABLE_STAT_META.filter((s) => !s.informativo);
/** Atributos exibidos mas que NÃO pontuam (Influência, Comando, Fiscalização, Alinhamento). */
export const INFO_STAT_META = AVAILABLE_STAT_META.filter((s) => s.informativo);

/** Fora de toda comparação de ranking: mandato parcial OU presidência da Casa. */
export const foraDoRanking = (p: { mandatoParcial?: boolean; presidenteCasa?: boolean }) =>
  !!p.mandatoParcial || !!p.presidenteCasa;

export const casaLabel = (casa: 'camara' | 'senado', short = false) =>
  casa === 'camara' ? (short ? 'Dep.' : 'Câmara dos Deputados') : (short ? 'Sen.' : 'Senado Federal');

/** rótulo e sentido da cor de um título (para a galeria e agregados) */
export const TITLE_COR_META: Record<'green' | 'red' | 'purple', { label: string; icon: string }> = {
  green: { label: 'Elogiosos', icon: '🟢' },
  red: { label: 'Críticos', icon: '🔴' },
  purple: { label: 'Neutros / curiosos', icon: '🟣' },
};

export const RARIDADE_LABEL: Record<'comum' | 'raro' | 'lendario', string> = {
  comum: 'Comum', raro: 'Raro', lendario: 'Lendário',
};
