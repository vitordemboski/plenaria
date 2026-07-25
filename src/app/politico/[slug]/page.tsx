import Link from 'next/link';
import { notFound } from 'next/navigation';
import { politicians, getPolitician, getTitle, getGuild, SCORING_STAT_META, INFO_STAT_META, TIER_LABEL, casaLabel, meta, foraDoRanking } from '@/lib/data';
import { FutStat } from '@/components/FutStat';
import { CotaBreakdown } from '@/components/CotaBreakdown';
import { GuildCrest } from '@/components/GuildCrest';
import { ReadingDisclaimer } from '@/components/ReadingDisclaimer';
import { ShareButton } from '@/components/ShareButton';
import { TitleBadge } from '@/components/TitleBadge';
import { guildSlug } from '@/lib/slug';
import type { StatKey } from '@/lib/types';

/**
 * Página do político — a "Carta" (estilo carta colecionável de futebol):
 * Poder gigante, retrato em arco, atributos abreviados em duas colunas e
 * "relatório de olheiro" abaixo. generateStaticParams pré-renderiza TODAS as
 * ~594 páginas no build: cada carta é um HTML pronto na CDN, sem fetch em runtime.
 */
export function generateStaticParams() {
  return politicians.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPolitician(slug);
  if (!p) return {};
  return {
    title: `${p.nome} — Tier ${p.tier}`,
    description: `${casaLabel(p.casa)} · ${p.uf} · Guilda ${p.partido} · Poder ${p.ops} (${TIER_LABEL[p.tier]})`,
    alternates: { canonical: `/politico/${slug}/` },
  };
}

/** abreviações de 3 letras no espírito PAC/SHO/PAS das cartas de futebol */
const ABBR: Record<StatKey, string> = {
  ataque: 'ATQ', stamina: 'STA', tecnica: 'TEC', eficiencia: 'EFI',
  economia: 'ECO', influencia: 'INF', comando: 'CMD',
  fiscalizacao: 'FIS', alinhamento: 'ALI',
};

export default async function PoliticianPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPolitician(slug);
  if (!p) notFound();

  const guild = getGuild(p.partido);
  const fora = foraDoRanking(p);
  const maxProd = Math.max(...p.producaoAnual, 1); // escala das barras de produção
  // Gate do Tier S: Poder ≥ 88 mas reprovado num gate → cai para A com o motivo.
  // O motivo vem do gerador começando pelo RÓTULO do atributo culpado
  // ("Economia 37 no vermelho (< 40)") — é assim que achamos qual marcar com 🔒.
  // Motivos que não são de atributo (título negativo) simplesmente não casam.
  const gate = p.sGateBloqueadoPor;
  const gateStat = gate ? SCORING_STAT_META.find((s) => gate.startsWith(s.label))?.key : undefined;
  // A grade da carta mostra SÓ o que pontua no Poder — misturar Influência
  // (informativa) ali confunde. Ela e o Comando seguem nas seções de baixo
  // (relatório de olheiro / como ler), claramente marcadas.
  const temStat = (k: StatKey) => (!p.rawNumbers || p.rawNumbers[k]) && k !== 'comando';
  const statsQuePontuam = SCORING_STAT_META.filter((s) => temStat(s.key));
  const statsInformativos = INFO_STAT_META.filter((s) => temStat(s.key));
  const todosStats = [...statsQuePontuam, ...statsInformativos];
  const pesos = meta.pesosPorCasa?.[p.casa] ?? meta.pesos;
  const pesoDe = (k: string) => Math.round(((pesos as Record<string, number>)[k] ?? 0) * 100);

  // posição no ranking da própria casa (só entre quem ranqueia) — derivável
  // 100% dos dados: ordena por Poder e conta quem está à frente.
  const ranqueados = politicians.filter((x) => x.casa === p.casa && !foraDoRanking(x));
  const rank = 1 + ranqueados.filter((x) => x.ops > p.ops).length;
  const topPct = Math.max(1, Math.round((rank / ranqueados.length) * 100));

  const tierClass = fora ? 'fora tier-F' : `tier-${p.tier}`;

  return (
    <main className="carta-stage">
      {/* moldura de leitura antes de qualquer número (ver ReadingDisclaimer) */}
      <ReadingDisclaimer />

      <div className="carta-hero">
        <div className={`futc-glow${!fora && (p.tier === 'S' || p.tier === 'A') ? ` glow-${p.tier}` : ''}`}>
          <div className={`futc ${tierClass}`}>
            <div className="futc-in">
              <div className="futc-head">
                <div className="futc-rail">
                  <b className="futc-ops">{p.ops}</b>
                  <span className="futc-ops-lbl">Poder</span>
                  <span className="futc-pos">{p.casa === 'camara' ? 'DEP' : 'SEN'}</span>
                  <i className="futc-rail-sep" />
                  <span
                    className={`futc-tier${gate ? ' gate' : ''}`}
                    title={
                      fora ? 'Fora do ranking — sem Tier'
                      : gate ? `Tier S bloqueado por: ${gate} — rebaixado para A`
                      : `Tier ${p.tier} · ${TIER_LABEL[p.tier]}`
                    }
                  >
                    {fora ? '—' : p.tier}
                    {gate && <i className="lock" aria-hidden>🔒</i>}
                  </span>
                </div>
                <div
                  className="futc-photo"
                  // borrão da própria foto (~185 B, sem request) no lugar do gradiente
                  style={p.fotoLqip ? { backgroundImage: `url("${p.fotoLqip}")` } : undefined}
                >
                  {p.fotoUrl ? (
                    // foto é o LCP da página (acima da dobra) — lazy aqui atrasava
                    // o carregamento e a janela ficava vazia por segundos
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.fotoUrl} alt={p.nome} fetchPriority="high" />
                  ) : (
                    <PortraitSilhueta slug={p.slug} />
                  )}
                </div>
              </div>

              <div className="futc-name">{p.nome}</div>
              <div className="futc-rule" />

              <div
                className="futc-stats"
                style={{ gridTemplateRows: `repeat(${Math.ceil(statsQuePontuam.length / 2)}, auto)` }}
              >
                {statsQuePontuam.map((s) => {
                  const v = p.stats[s.key];
                  const raw = p.rawNumbers?.[s.key];
                  return (
                    <FutStat
                      key={s.key}
                      value={v}
                      abbr={ABBR[s.key]}
                      cls={v >= 70 ? 'hi' : v < 40 ? 'lo' : ''}
                      informativo={s.informativo}
                      travado={s.key === gateStat}
                      tipTitle={`${s.icon} ${s.label} · ${ABBR[s.key]} ${v}`}
                      tipLines={[
                        `${s.desc} — percentil ${p.casa === 'camara' ? 'na' : 'no'} ${casaLabel(p.casa)}`,
                        s.informativo ? 'ⓘ informativo — não pontua no Poder' : `peso ${pesoDe(s.key)}% do Poder`,
                        ...(raw ? [`🔎 ${raw}`] : []),
                        ...(s.key === gateStat ? [`🔒 é este atributo que trava o Tier S: ${gate}`] : []),
                      ]}
                    />
                  );
                })}
              </div>

              <div className="futc-foot">
                <span className="plate" title={`Estado: ${p.uf}`}>{p.uf}</span>
                <Link
                  href={`/guilda/${guildSlug(p.partido)}/`}
                  className="crest-link"
                  title={`Guilda ${p.partido}${guild ? ` — ${guild.nome}` : ''}`}
                >
                  <GuildCrest sigla={p.partido} cor={guild?.cor} size={40} />
                </Link>
                <span className="plate" title={casaLabel(p.casa)}>{p.casa === 'camara' ? 'CÂMARA' : 'SENADO'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="carta-cta">
        <Link className="btn" href={`/batalha/?a=${p.slug}`}>⚔️ Batalhar</Link>
        <Link className="btn ghost" href="/como-calculamos/">📐 Fórmula</Link>
        <ShareButton
          className="btn ghost"
          title={`${p.nome} — Tier ${p.tier} · PLENÁRIA`}
          text={`🃏 ${p.nome} é Tier ${p.tier} (Poder ${p.ops}) na PLENÁRIA! #PLENARIA`}
          card={{
            variant: 'politico',
            heading: p.nome,
            sub: `${casaLabel(p.casa, true)} · ${p.uf} · ${p.partido}`,
            tier: p.tier,
            ops: p.ops,
            fotoUrl: p.fotoUrl,
            fotoCredito: p.casa === 'senado' ? 'Agência Senado' : 'Câmara dos Deputados',
            // A imagem NÃO leva títulos — nem os elogiosos. Um selo viaja sem a regra
            // que o concedeu, sem o número bruto e sem o canal de correção; fora do
            // site, vira rótulo sem prova. O que vai no lugar é o próprio dado
            // (`nota`): "ECONOMIA 40 · R$ 46 mil/mês de cota" se explica sozinho.
            stats: statsQuePontuam.map((s) => ({
              icon: s.icon, label: s.label, value: p.stats[s.key], nota: p.rawCurto?.[s.key],
            })),
            story: {
              rank: fora ? undefined : `#${rank} de ${ranqueados.length}`,
              destaque: fora ? undefined : `TOP ${topPct}% da ${casaLabel(p.casa)} por Poder`,
              tierLabel: TIER_LABEL[p.tier],
            },
          }}
        />
      </div>

      {fora ? (
        <div className="panel carta-note">
          {p.presidenteCasa ? (
            <>🪑 <b>Presidência da Casa — sem Tier.</b> Quem preside a {casaLabel(p.casa)} não vota (salvo desempate/secreto),
            nem autora ou relata como os demais — o cargo institucional suprime justamente a atividade que medimos.
            Fica fora da Tier List e dos rankings; os números da carta são informativos.</>
          ) : (
            <>🕓 <b>Mandato parcial — sem Tier.</b> Esteve em exercício efetivo por{' '}
            {p.mesesExercicio != null ? `só ~${Math.round(p.mesesExercicio)} ${Math.round(p.mesesExercicio) === 1 ? 'mês' : 'meses'}` : 'pouco tempo'}{' '}
            no período — amostra pequena demais para ranquear com justiça. Fica fora da Tier List e dos rankings;
            os números da carta são informativos.</>
          )}
        </div>
      ) : (
        <div className="panel carta-rank">
          <div className="big">#{rank} de {ranqueados.length}</div>
          <p className="sub">TOP {topPct}% da {casaLabel(p.casa)} por Poder · Tier {p.tier} — {TIER_LABEL[p.tier]}</p>
        </div>
      )}

      {gate && (
        <div className="panel gate-panel">
          <h3>🔒 Tier S bloqueado</h3>
          <p className="sub">
            Poder {p.ops} daria <b>Tier S</b>, mas um gate reprovou — a carta desce para <b>Tier A</b>.
          </p>
          <div className="gate-motivo">{gate}</div>
          <p className="gate-txt">
            Os gates existem contra <i>farming</i>: um Poder alto não compra o rank supremo se um
            fundamento está no chão. {gateStat
              ? <>Basta {SCORING_STAT_META.find((s) => s.key === gateStat)!.label} sair do vermelho (≥ 40) para o Tier S destravar.</>
              : <>Enquanto o motivo acima valer, o Tier S segue trancado.</>}{' '}
            <Link href="/como-calculamos/#gates" style={{ color: 'var(--gold-2)', textDecoration: 'underline' }}>
              ver todos os gates
            </Link>
          </p>
        </div>
      )}

      {(p.titles.length > 0 || (p.comissoes?.cargos.length ?? 0) > 0) && (
        <div className="panel">
          <h3>🎖️ Títulos</h3>
          <p className="sub">
            🟢 elogiosos · 🔴 críticos · 🟣 neutros — 100% factuais; passe o mouse (ou toque) para ver a regra
            que concedeu cada um. Todo selo crítico mostra o número bruto que o disparou e a mediana da casa.
          </p>
          <div className="carta-titles">
            {p.comissoes?.cargos.filter((c) => /^presidente$/i.test(c.cargo)).map((c) => (
              <TitleBadge key={`${c.sigla}-${c.cargo}`} label={`👑 ${c.cargo} · ${c.sigla}`} cor="purple"
                regra={`${c.cargo} em exercício: ${c.nome} (fonte: Dados Abertos)`} />
            ))}
            {p.titles.map((t) => {
              const def = getTitle(t);
              if (!def) return null;
              return (
                <TitleBadge key={t} label={def.label} cor={def.cor} regra={def.regra}
                  evidencia={p.titleEvidence?.[t]} />
              );
            })}
          </div>
        </div>
      )}

      {p.producaoAnual.some((v) => v > 0) && (
        <div className="panel">
          <h3>📈 Produção legislativa</h3>
          <p className="sub">
            por ano do mandato — proposições relevantes apresentadas (PL, PLP, PEC, PDL)
          </p>
          <div className="carta-spark">
            {p.producaoAnual.map((v, i) => (
              <div className="ano" key={i}>
                <span className="n">{v}</span>
                <i
                  className={`bar${v === 0 ? ' zero' : ''}`}
                  style={{
                    height: `${Math.max(4, Math.round((v / maxProd) * 96))}px`,
                    animationDelay: `${i * 90}ms`,
                  }}
                />
                <span className="yr">{2023 + i}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.rawNumbers && (
        <div className="panel">
          <h3>🔭 Relatório de olheiro</h3>
          <p className="sub">os números brutos por trás de cada atributo</p>
          <div className="scout-list">
            {todosStats.map((s) =>
              p.rawNumbers![s.key] ? (
                <div key={s.key}><b>{s.icon}</b> <span>{p.rawNumbers![s.key]}</span></div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {p.cotaResumo && <CotaBreakdown resumo={p.cotaResumo} sigla={p.casa === 'camara' ? 'CEAP' : 'CEAPS'} />}

      <div className="panel carta-note">
        <h3 style={{ marginBottom: 8 }}>📖 Como ler esta carta</h3>
        Cada atributo é o <b>percentil dentro da própria casa</b>: {ABBR[statsQuePontuam[0].key]} {p.stats[statsQuePontuam[0].key]} significa
        estar à frente de {p.stats[statsQuePontuam[0].key]}% dos colegas nesse quesito.{' '}
        <b>Poder {p.ops}</b> = média ponderada dos atributos que pontuam.
        <div className="scout-list" style={{ marginTop: 10 }}>
          {todosStats.map((s) => (
            <div key={s.key}>
              <b>{s.icon}</b>
              <span><b>{ABBR[s.key]} · {s.label}</b> — {s.desc} {s.informativo ? '(informativo — não pontua)' : `(peso ${pesoDe(s.key)}%)`}</span>
            </div>
          ))}
        </div>
        {p.rawNumbers?.economia && (
          <div style={{ marginTop: 10 }}>
            🪙 <b>Sobre a Economia:</b> a cota parlamentar (CEAP na Câmara, CEAPS no Senado) é a
            verba mensal que custeia o exercício do mandato — passagens, aluguel de escritório,
            combustível, divulgação. O atributo premia usar <b>pouco</b> dela: quanto menor o
            gasto, maior a nota. Pontuar alto pode ser frugalidade real ou apenas baixa atividade —
            por isso pesa só {pesoDe('economia')}% e, sozinha, não resgata quem afunda na Stamina e
            no Ataque.
          </div>
        )}
        {p.comissoes && (
          <div style={{ marginTop: 10 }}>
            🏛️ Membro atual de <b>{p.comissoes.total}</b> {p.comissoes.total === 1 ? 'órgão' : 'órgãos'}
            {p.comissoes.cargos.length > 0 && <> — {p.comissoes.cargos.map((c) => `${c.cargo} da ${c.sigla}`).join(', ')}</>}.
          </div>
        )}
        <div style={{ marginTop: 10 }} className="muted">
          Fonte: {meta.fonte} · atualizado {meta.updatedAt} · fórmula pública
        </div>
      </div>

    </main>
  );
}

/** silhueta determinística p/ quem está sem foto oficial — mesma lógica do Portrait */
function PortraitSilhueta({ slug }: { slug: string }) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const skin = `hsl(${hue}, 26%, 42%)`;
  return (
    <svg width={130} height={162} viewBox="0 0 120 150" fill="none" aria-hidden>
      <circle cx="60" cy="46" r="30" fill={skin} />
      <path d="M12 150c0-33 22-52 48-52s48 19 48 52z" fill={skin} />
    </svg>
  );
}
