import Link from 'next/link';
import { insights, politicians, casaLabel, meta, AVAILABLE_STAT_META, foraDoRanking } from '@/lib/data';
import type { StatKey } from '@/lib/types';
import { ScatterChart, type ScatterPoint } from '@/components/ScatterChart';
import { GuildRanking } from '@/components/GuildRanking';
import { GuildSpendRanking } from '@/components/GuildSpendRanking';
import { GastoCasas } from '@/components/GastoCasas';
import { GastoCategorias } from '@/components/GastoCategorias';
import { MapExplorer } from '@/components/MapExplorer';
import { TitlesGallery } from '@/components/TitlesGallery';
import { InsightsTabs } from '@/components/InsightsTabs';
import { buildMapView } from '@/lib/map-data';
import { PoliticianLink } from '@/components/PoliticianLink';

/** R$ a partir de milhares: "R$ 1,6 mi" acima de mil, senão "R$ 740 mil" */
const fmtMilReais = (mil: number) =>
  mil >= 1000 ? `R$ ${(mil / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
  : `R$ ${mil.toLocaleString('pt-BR')} mil`;

/**
 * Seções do dashboard de Insights. Antes eram abas client (toggle `hidden` +
 * hash via replaceState); viraram ROTAS reais (/insights e /insights/{secao})
 * para que cada uma seja um page view próprio, com <title> e URL compartilhável.
 * Continua 100% estático: cada seção é pré-renderizada por generateStaticParams.
 *
 * SECTION_META lista TODAS as seções possíveis, em ordem; availableSectionIds()
 * resolve a disponibilidade real (Governo e Títulos são condicionais aos dados).
 */
export const SECTION_META = [
  { id: 'panorama', label: '📈 Panorama', title: 'Panorama' },
  { id: 'atributos', label: '🏅 Atributos', title: 'Atributos' },
  { id: 'guildas', label: '🛡️ Guildas', title: 'Guildas' },
  { id: 'gastos', label: '💸 Gasto × Entrega', title: 'Gasto × Entrega' },
  { id: 'perfil', label: '👥 Perfil', title: 'Perfil' },
  { id: 'governo', label: '🏛️ Governo × Oposição', title: 'Governo × Oposição' },
  { id: 'titulos', label: '🎖️ Títulos', title: 'Títulos' },
] as const;

/** Governo × Oposição só existe na Câmara (única casa que publica orientação de
 *  bancada) — a UI se adapta por meta.availableStats, nunca por suposição. */
function temGoverno(): boolean {
  const { termometro, dissidentes, topFiscais, politicaScatter } = insights;
  return meta.availableStats.includes('alinhamento')
    && !!termometro && !!dissidentes && !!topFiscais && !!politicaScatter;
}

/** ids das seções realmente disponíveis, em ordem — fonte da navegação e do
 *  generateStaticParams. Mantém nav, rotas e conteúdo em sincronia. */
export function availableSectionIds(): string[] {
  return SECTION_META
    .filter((s) => (s.id === 'governo' ? temGoverno() : s.id === 'titulos' ? meta.titulosDisponiveis : true))
    .map((s) => s.id);
}

/** constrói o nó de conteúdo de cada seção disponível, indexado por id. */
export function buildSectionNodes(): Record<string, React.ReactNode> {
  const { kpis, guildRanking, scatter, fama, vergonha, leis, sabatina, renovacao, genero,
    gastoPorCasa, guildGasto, termometro, dissidentes, topFiscais, politicaScatter,
    gastoCategorias, topDivulgacao, divulgacaoInfluencia, concentracaoFornecedor } = insights;
  const totalParlamentares = guildRanking.reduce((s, g) => s + g.total, 0);
  const mapView = buildMapView();
  const famById = (id: string) => mapView.families.filter((f) => f.id === id);

  const panorama = (
    <>
      <div className="kpis">
        <div className="kpi"><div className="k-lbl">Políticos Tier S</div><div className="k-val">{kpis.tierS}</div><div className="k-sub">de {totalParlamentares} parlamentares</div></div>
        <div className="kpi"><div className="k-lbl">Poder médio nacional</div><div className="k-val">{kpis.opsMedio}</div><div className="k-sub">média das duas casas</div></div>
      </div>

      <MapExplorer families={famById('ops')} datasets={mapView.datasets} />

      <div className="grid2">
        <div className="panel">
          <h3 style={{ color: 'var(--gold-2)' }}>📈 Hall da Fama</h3>
          <div className="sub">Top 10 nacional por Poder</div>
          {fama.map((p, i) => (
            <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido}</small></span>
              <span className="badge green">Tier {p.tier}</span>
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{p.ops}</span>
            </PoliticianLink>
          ))}
        </div>
        <div className="panel">
          <h3 style={{ color: 'var(--red-soft)' }}>📉 Muro da Vergonha</h3>
          <div className="sub">Bottom 10 nacional por Poder</div>
          {vergonha.map((p, i) => (
            <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido}</small></span>
              <span className="badge red">Tier {p.tier}</span>
              <span className="sc" style={{ color: 'var(--red-soft)' }}>{p.ops}</span>
            </PoliticianLink>
          ))}
        </div>
      </div>
    </>
  );

  const guildas = (
    <div className="panel">
      <h3>🏆 Ranking de Guildas</h3>
      <div className="sub">Composição de membros por Tier — ordenado por nº de Rank S</div>
      <GuildRanking ranking={guildRanking} />
    </div>
  );

  // Small multiples por casa: mesma unidade (R$ mil/mês) → eixo X compartilhado, para
  // que a comparação visual entre as facetas continue válida. O topo acompanha o range
  // real dos dados (a cota CEAP fica ≈50).
  const escalaMax = Math.ceil((Math.max(...scatter.map((p) => p.gasto), 1) * 1.05) / 10) * 10;
  const gastoPontos: ScatterPoint[] = scatter.map((p) => ({
    slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido, tier: p.tier,
    x: p.gasto, y: p.ops, flag: p.flag,
  }));
  const facetas = ([['camara', 'Câmara', 'CEAP'], ['senado', 'Senado', 'CEAPS']] as const)
    .map(([casa, nome, cota]) => ({ casa, nome, cota, pts: gastoPontos.filter((p) => p.casa === casa) }))
    .filter((f) => f.pts.length > 0);

  // Divulgação × alcance: os pontos já vêm no formato do ScatterChart (x, y, ...slim, tier)
  const divPontos: ScatterPoint[] = divulgacaoInfluencia;
  const divMax = Math.ceil((Math.max(...divulgacaoInfluencia.map((p) => p.x), 1) * 1.05) / 5) * 5;

  const gastos = (
    <>
      {facetas.length > 0 && (
        <div className="panel">
          <h3>💸 Gasto × Entrega</h3>
          <div className="sub">
            Cota parlamentar (R$ mil/mês em média) vs. Poder — uma faceta por casa, porque CEAP e CEAPS são cotas diferentes
          </div>
          <div className="facets">
            {facetas.map((f) => (
              <div className="facet" key={f.casa}>
                <h4>🏛️ {f.nome}<small>{f.pts.length} parlamentares · cota {f.cota}</small></h4>
                <ScatterChart
                  points={f.pts}
                  xMax={escalaMax}
                  xLabel="GASTO (R$ MIL / MÊS)"
                  yLabel="Poder"
                  xFmt="money"
                  yFmt="plain"
                  ariaLabel={`Dispersão de gasto por Poder — ${f.nome}`}
                  flagLabel="🚩 flag de gasto ativa"
                />
              </div>
            ))}
          </div>
          <div className="sc-legend">
            <span><i style={{ background: '#c9962b' }} />Parlamentar</span>
            {scatter.some((p) => p.flag) && (
              <span><i style={{ background: '#e5484d' }} />💸 Nobre Gastador (título factual)</span>
            )}
          </div>
        </div>
      )}

      <GastoCategorias dados={gastoCategorias} />

      <GastoCasas gastoPorCasa={gastoPorCasa} />

      <div className="grid2">
        {facetas.map((f) => (
          <div className="panel" key={f.casa}>
            <h3>💸 Guildas que mais gastam · {f.nome}</h3>
            <div className="sub">
              Média de cota {f.cota} por parlamentar da bancada
              (R$ mil/mês) — o total só mede o tamanho dela
            </div>
            <GuildSpendRanking rows={guildGasto[f.casa]} />
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>📣 Quem mais gasta com divulgação</h3>
        <div className="sub">
          Maior gasto da cota na categoria oficial &quot;divulgação da atividade parlamentar&quot;
          (publicidade, impulsionamento, material de divulgação) — total no mandato. Ranking nacional.
        </div>
        {topDivulgacao.map((p, i) => (
          <PoliticianLink key={p.slug} slug={p.slug} className="lrow wide">
            <span className="pos">{i + 1}</span>
            <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido}</small></span>
            <span className="sc" style={{ color: 'var(--gold-2)' }}>{fmtMilReais(p.valorMil)}</span>
          </PoliticianLink>
        ))}
      </div>

      {divPontos.length > 0 && (
        <div className="panel">
          <h3>📣×📢 Divulgação × alcance</h3>
          <div className="sub">
            Gasto mensal em divulgação (R$ mil/mês) × percentil de Influência (seguidores no Instagram,
            dentro da própria casa) — mostra quem investe em publicidade e o quanto isso acompanha o
            alcance nas redes. Só quem tem Instagram declarado.
          </div>
          <ScatterChart
            points={divPontos}
            xMax={divMax}
            xLabel="DIVULGAÇÃO (R$ MIL / MÊS)"
            yLabel="Influência (percentil)"
            xFmt="money"
            yFmt="plain"
            ariaLabel="Dispersão de gasto em divulgação por percentil de influência"
          />
        </div>
      )}

      <div className="panel">
        <h3>🎯 Concentração de fornecedor</h3>
        <div className="sub">
          Quem concentra a maior fatia da cota num <b>único fornecedor</b>. Factual e informativo:
          concentração <b>não</b> é irregularidade — um fornecedor só costuma ser o aluguel do
          escritório ou a agência de publicidade contratada.
        </div>
        {concentracaoFornecedor.map((p, i) => (
          <PoliticianLink key={p.slug} slug={p.slug} className="lrow wide">
            <span className="pos">{i + 1}</span>
            <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido} — {p.fornecedor}</small></span>
            <span className="sc" style={{ color: 'var(--gold-2)' }}>{p.pct}%</span>
          </PoliticianLink>
        ))}
      </div>

      <MapExplorer families={famById('gasto')} datasets={mapView.datasets} />
    </>
  );

  const perfil = (
    <>
    <div className="grid2 even">
      {renovacao && (
        <div className="panel">
          <h3>🌱 Renovação & Idade</h3>
          <div className="sub">Quem chega e a idade das duas casas</div>
          <div className="renov-stats">
            <div><b>{renovacao.pctEstreantes}%</b><small>estreantes ({renovacao.estreantes})</small></div>
            <div><b>{renovacao.idadeMediaCamara}</b><small>idade média · Câmara</small></div>
            <div><b>{renovacao.idadeMediaSenado}</b><small>idade média · Senado</small></div>
          </div>
          {renovacao.maisNovo && (
            <PoliticianLink slug={renovacao.maisNovo.slug} className="lrow">
              <span className="pos">👶</span>
              <span className="nm"><b>{renovacao.maisNovo.nome}</b><small>mais novo · {casaLabel(renovacao.maisNovo.casa, true)} · {renovacao.maisNovo.uf}</small></span>
              <span />
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{renovacao.maisNovo.idade}</span>
            </PoliticianLink>
          )}
          {renovacao.maisVelho && (
            <PoliticianLink slug={renovacao.maisVelho.slug} className="lrow">
              <span className="pos">🎖️</span>
              <span className="nm"><b>{renovacao.maisVelho.nome}</b><small>decano · {casaLabel(renovacao.maisVelho.casa, true)} · {renovacao.maisVelho.uf}</small></span>
              <span />
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{renovacao.maisVelho.idade}</span>
            </PoliticianLink>
          )}
        </div>
      )}
      {genero && (
        <div className="panel">
          <h3>⚥ Representatividade de Gênero</h3>
          <div className="sub">Bancada feminina e masculina por casa (fonte: cadastro oficial)</div>
          <div className="genero-bars">
            {([
              ['Congresso', { f: genero.camara.f + genero.senado.f, m: genero.camara.m + genero.senado.m }],
              ['Câmara', genero.camara],
              ['Senado', genero.senado],
            ] as const).map(([nome, d]) => {
              const tot = d.f + d.m || 1;
              const pctF = Math.round((d.f / tot) * 100);
              return (
                <div key={nome} className="genero-row">
                  <div className="genero-head">
                    <b>{nome}</b>
                    <span>{d.f} mulheres · {d.m} homens</span>
                  </div>
                  <div className="genero-bar">
                    <i className="gf" style={{ width: `${pctF}%` }} />
                    <i className="gm" style={{ width: `${100 - pctF}%` }} />
                  </div>
                  <div className="genero-cap">{pctF}% de mulheres</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    <MapExplorer families={famById('perfil')} datasets={mapView.datasets} />
    </>
  );

  const governo = temGoverno() ? (
    <>
      <div className="kpis">
        <div className="kpi"><div className="k-lbl">Base do Governo</div><div className="k-val">{termometro!.base}</div><div className="k-sub">alinhamento ≥ 75%</div></div>
        <div className="kpi"><div className="k-lbl">Independentes</div><div className="k-val">{termometro!.independentes}</div><div className="k-sub">entre 41% e 74%</div></div>
        <div className="kpi"><div className="k-lbl">Oposição</div><div className="k-val">{termometro!.oposicao}</div><div className="k-sub">alinhamento ≤ 40%</div></div>
      </div>

      <div className="panel">
        <h3>🏛️ Alinhamento × Fiscalização</h3>
        <div className="sub">
          Cada ponto é um deputado. Quem vota com o Governo quase não protocola pedidos de
          informação; quem vota contra, protocola muito. É por isso que a Fiscalização aparece
          no card mas NÃO pontua no Poder — ela mede posição política, não entrega.
        </div>
        <ScatterChart
          points={politicaScatter!}
          xMax={100}
          xLabel="ALINHAMENTO COM O GOVERNO (%)"
          yLabel="Fiscalização"
          xFmt="pct"
          yFmt="plain"
          ariaLabel="Dispersão de alinhamento com o Governo por fiscalização ao Executivo"
        />
      </div>

      <div className="grid2">
        <div className="panel">
          <h3>🎭 Os Dissidentes</h3>
          <div className="sub">Top 10 por desvio da média de alinhamento do próprio partido (só partidos com 8+ deputados)</div>
          {dissidentes!.map((p, i) => (
            <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido} · média do partido {p.mediaPartido}%</small></span>
              <span className="badge purple">{p.desvio > 0 ? '+' : ''}{p.desvio}</span>
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{p.alinhamento}%</span>
            </PoliticianLink>
          ))}
        </div>
        <div className="panel">
          <h3>🔎 Quem mais cobra o Executivo</h3>
          <div className="sub">Top 10 por nº bruto de atos de fiscalização ao Executivo (RIC + PFC + convocação de ministro)</div>
          {topFiscais!.map((p, i) => (
            <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido} · alinhamento {p.alinhamento}%</small></span>
              <span />
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{p.atos.toLocaleString('pt-BR')}</span>
            </PoliticianLink>
          ))}
        </div>
      </div>

      <MapExplorer families={famById('alinhamento')} datasets={mapView.datasets} />
    </>
  ) : null;

  const compact = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`;
  const SUB: Record<StatKey, string> = {
    ataque: 'quem mais apresenta proposições relevantes',
    stamina: 'quem mais registra votos nominais',
    eficiencia: 'quem mais emplaca avanços na tramitação',
    tecnica: 'quem mais é designado relator ou autor de emendas',
    fiscalizacao: 'quem mais cobra o Executivo (requerimentos, convocações e PFC)',
    influencia: 'quem tem mais seguidores nas redes',
    economia: 'quem menos usa a cota (mais frugal)',
    comando: 'quem ocupa mais comissões e presidências',
    alinhamento: 'quem mais vota com a orientação do Governo',
  };
  // rankings excluem mandato parcial (posse recente) — mesma regra do resto do produto
  const ranqueaveis = politicians.filter((p) => !foraDoRanking(p));
  const leaderboard = (key: StatKey): { p: (typeof politicians)[number]; score: string }[] => {
    if (key === 'economia') {
      // gasto 0 ENTRA: não gastar nada da cota é o fato mais extremo desta lista, e
      // filtrá-lo escondia exatamente quem ela deveria mostrar. O risco que o filtro
      // cobria (gasto 0 por falha de match, não por frugalidade) é real só no CEAPS
      // do Senado, que casa por NOME — a Câmara casa por id. A ingestão loga quem
      // ficou sem lançamentos a cada rodada; é lá que a checagem tem de acontecer, e
      // exibir "sem gastos" torna a anomalia VISÍVEL em vez de silenciosa.
      return [...ranqueaveis]
        .sort((a, b) => a.gastoMensalMedioMil - b.gastoMensalMedioMil).slice(0, 8)
        .map((p) => ({ p, score: p.gastoMensalMedioMil > 0 ? `R$ ${p.gastoMensalMedioMil} mil` : 'sem gastos' }));
    }
    return ranqueaveis.filter((p) => p.statRaw?.[key] != null)
      .sort((a, b) => (b.statRaw![key]! - a.statRaw![key]!) || (b.ops - a.ops)).slice(0, 8)
      .map((p) => ({ p, score: key === 'influencia' ? compact(p.statRaw![key]!) : p.statRaw![key]!.toLocaleString('pt-BR') }));
  };
  const atributos = (
    <div className="grid2">
      {AVAILABLE_STAT_META.map((s) => (
        <div className="panel" key={s.key}>
          <h3>{s.icon} Top {s.label}</h3>
          <div className="sub">{SUB[s.key]}</div>
          {leaderboard(s.key).map(({ p, score }, i) => (
            // economia mostra "R$ X mil" — não cabe nos 40px do .sc padrão; usa a variante wide (3 col)
            <PoliticianLink key={p.slug} slug={p.slug} className={s.key === 'economia' ? 'lrow wide' : 'lrow'}>
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido}</small></span>
              {s.key !== 'economia' && <span />}
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{score}</span>
            </PoliticianLink>
          ))}
        </div>
      ))}
      {/* métrica própria (proposições que viraram norma), não redundante com Top Eficiência */}
      {leis && (
        <div className="panel">
          <h3>📖 Legisladores Efetivos</h3>
          <div className="sub">{leis.legisladores} parlamentares emplacaram leis — {leis.total} proposições já viraram norma na legislatura</div>
          {leis.ranking.map((p, i) => (
            <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido}</small></span>
              <span />
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{p.n}</span>
            </PoliticianLink>
          ))}
        </div>
      )}
      {/* Competência PRIVATIVA do Senado — a Câmara não tem equivalente. Só a PRESENÇA
          é lida: o voto da sabatina é secreto e a plataforma não o exibe. */}
      {sabatina && (
        <div className="panel span2">
          <h3>🏛️ A Sabatina — o trabalho que só o Senado faz</h3>
          <div className="sub">
            Aprovar autoridades (ministros do STF, STJ e TCU, presidente do Banco Central, diretores de
            agências, embaixadores) é competência privativa do Senado — Constituição, art. 52, III e IV.
            São {sabatina.total} votações nominais na legislatura, contra {sabatina.totalAbertas} de todo o
            resto da pauta: <b>a sabatina é a maior parte do que um senador vota</b>. Em média eles
            comparecem a {sabatina.presencaMedia}% delas, ante {sabatina.presencaMediaAbertas}% das demais
            votações. Abaixo, os que mais destoam para baixo — <b>estão no plenário, mas faltam justamente
            ao que só a casa deles pode fazer</b>. O voto da sabatina é secreto; a presença, não.
          </div>
          {sabatina.faltantes.map((p, i) => (
            <PoliticianLink key={p.slug} slug={p.slug} className="lrow lrow-sab">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido}</small></span>
              <span className="sc" style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {p.abertas}% nas demais
              </span>
              <span className="sc" style={{ color: 'var(--red-soft)', whiteSpace: 'nowrap' }}>
                {p.sabatina}% <small style={{ opacity: 0.75 }}>({p.gap})</small>
              </span>
            </PoliticianLink>
          ))}
        </div>
      )}
    </div>
  );

  const titulos = meta.titulosDisponiveis ? (
    <>
      <TitlesGallery />
      {famById('titulo').length > 0 && <MapExplorer families={famById('titulo')} datasets={mapView.datasets} />}
    </>
  ) : null;

  const nodes: Record<string, React.ReactNode> = { panorama, atributos, guildas, gastos, perfil };
  if (governo) nodes.governo = governo;
  if (titulos) nodes.titulos = titulos;
  return nodes;
}

/** Cabeçalho + navegação compartilhados pelas rotas de Insights. A barra de abas
 *  virou <Link> (navegação real → cada seção é um page view), destacando a ativa. */
export function InsightsShell({ activeId, children }: { activeId: string; children: React.ReactNode }) {
  const disponiveis = new Set(availableSectionIds());
  return (
    <main>
      <div className="page-title">
        <h2>INSIGHTS</h2>
        <p>Análises do reino — {meta.fonte}</p>
      </div>

      {meta.aviso && (
        <details className="metodo-aviso">
          <summary>⚠︎ Como lemos os dados — fonte e o que cada atributo mede</summary>
          <div>{meta.aviso}</div>
        </details>
      )}

      <InsightsTabs>
        {SECTION_META.filter((s) => disponiveis.has(s.id)).map((s) => (
          <Link
            key={s.id}
            href={s.id === 'panorama' ? '/insights/' : `/insights/${s.id}/`}
            className={`tab${activeId === s.id ? ' is-active' : ''}`}
            aria-current={activeId === s.id ? 'page' : undefined}
          >
            {s.label}
          </Link>
        ))}
      </InsightsTabs>

      {children}
    </main>
  );
}
