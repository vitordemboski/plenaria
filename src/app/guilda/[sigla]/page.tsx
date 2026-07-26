import Link from 'next/link';
import { notFound } from 'next/navigation';
import { politicians, guilds, getTitle, SCORING_STAT_META, TIER_ORDER, TIER_LABEL, casaLabel, foraDoRanking, meta } from '@/lib/data';
import { FutStat } from '@/components/FutStat';
import { GuildCrest } from '@/components/GuildCrest';
import { PoliticianLink } from '@/components/PoliticianLink';
import { ShareButton } from '@/components/ShareButton';
import { TitleBadge } from '@/components/TitleBadge';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/jsonld';
import { guildTierOf } from '@/lib/guild-stats';
import { pageMeta } from '@/lib/seo';
import { guildSlug } from '@/lib/slug';
import type { Tier, StatKey } from '@/lib/types';

/**
 * Página da Guilda (partido) — a "carta de facção", mesma linguagem visual
 * da carta de parlamentar (/politico/): silhueta FUT, material por tier,
 * atributos médios abreviados e painéis abaixo. Pré-renderizada no build;
 * agregados computados aqui mesmo a partir de data/politicians.json.
 */
// rota usa slug ASCII (MISSÃO → MISSAO): sigla acentuada quebra o output:export
export function generateStaticParams() {
  return guilds.map((g) => ({ sigla: guildSlug(g.sigla) }));
}
const guildDoSlug = (slug: string) => guilds.find((g) => guildSlug(g.sigla) === slug);

export async function generateMetadata({ params }: { params: Promise<{ sigla: string }> }) {
  const { sigla } = await params;
  const g = guildDoSlug(sigla);
  if (!g) return {};
  const n = politicians.filter((p) => p.partido === g.sigla).length;
  return pageMeta({
    title: `Guilda ${g.sigla} — ${g.nome}`,
    description: `A carta de facção do ${g.sigla} (${g.nome}): Poder médio, distribuição de tiers e os ${n} parlamentares da bancada.`,
    path: `/guilda/${sigla}/`,
  });
}

/** abreviações de 3 letras, mesmas da carta de parlamentar */
const ABBR: Record<StatKey, string> = {
  ataque: 'ATQ', stamina: 'STA', tecnica: 'TEC', eficiencia: 'EFI',
  economia: 'ECO', influencia: 'INF', comando: 'CMD',
  fiscalizacao: 'FIS', alinhamento: 'ALI',
};

/** Poder médio de uma guilda sobre os membros ranqueados (base do rank entre guildas) */
function opsMedioDe(sigla: string): number {
  const ms = politicians.filter((p) => p.partido === sigla && !foraDoRanking(p));
  return Math.round(ms.reduce((s, p) => s + p.ops, 0) / (ms.length || 1));
}

export default async function GuildPage({ params }: { params: Promise<{ sigla: string }> }) {
  const { sigla: slug } = await params;
  const guild = guildDoSlug(slug);
  if (!guild) notFound();

  // fora do ranking (mandato recente ou presidência da Casa) fica fora do roster, listado à parte
  const members = politicians.filter((p) => p.partido === guild.sigla && !foraDoRanking(p));
  const parciais = politicians.filter((p) => p.partido === guild.sigla && foraDoRanking(p));
  const n = members.length || 1;

  const avgStats = Object.fromEntries(
    SCORING_STAT_META.map((s) => {
      const have = members.filter((p) => !p.rawNumbers || p.rawNumbers[s.key]);
      const base = have.length ? have : members;
      return [s.key, Math.round(base.reduce((sum, p) => sum + p.stats[s.key], 0) / (base.length || 1))];
    }),
  ) as Record<StatKey, number>;
  const opsMedio = opsMedioDe(guild.sigla);
  const tier = guildTierOf(opsMedio);
  const pesoDe = (k: string) => Math.round(((meta.pesos as Record<string, number>)[k] ?? 0) * 100);

  // posição no ranking de guildas por Poder médio — derivável 100% dos dados
  const rank = 1 + guilds.filter((g) => opsMedioDe(g.sigla) > opsMedio).length;

  const nCamara = members.filter((p) => p.casa === 'camara').length;
  const nSenado = members.filter((p) => p.casa === 'senado').length;

  const byTier = new Map<Tier, typeof members>(TIER_ORDER.map((t) => [t, []]));
  for (const p of members) byTier.get(p.tier)!.push(p);
  for (const l of byTier.values()) l.sort((a, b) => b.ops - a.ops);

  const top3 = [...members].sort((a, b) => b.ops - a.ops).slice(0, 3);

  // títulos mais comuns dentro da guilda
  const titleCounts = new Map<string, number>();
  for (const p of members) for (const t of p.titles) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
  const topTitles = [...titleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <main>
      <JsonLd data={breadcrumbLd([
        { nome: 'Guildas', path: '/guildas/' },
        { nome: `Guilda ${guild.sigla}`, path: `/guilda/${slug}/` },
      ])} />
      <div className="carta-stage">
        <div className="carta-hero">
          <div className={`futc-glow${tier === 'S' || tier === 'A' ? ` glow-${tier}` : ''}`}>
            <div className={`futc tier-${tier}`}>
              <div className="futc-in">
                <div className="futc-head">
                  <div className="futc-rail">
                    <b className="futc-ops">{opsMedio}</b>
                    <span className="futc-ops-lbl">Poder médio</span>
                    <span className="futc-pos">GLD</span>
                    <i className="futc-rail-sep" />
                    <span className="futc-tier" title={`Tier ${tier} · ${TIER_LABEL[tier]} (pelo Poder médio)`}>
                      {tier}
                    </span>
                  </div>
                  <div
                    className="futc-photo futc-crestwin"
                    style={{ background: `radial-gradient(90% 70% at 50% 24%, ${guild.cor}33, #0d1018 78%)` }}
                  >
                    <GuildCrest sigla={guild.sigla} cor={guild.cor} size={96} />
                  </div>
                </div>

                {/* h1 da página — ver a nota gêmea em politico/[slug]/page.tsx */}
                <h1 className={`futc-name${guild.nome.length > 24 ? ' futc-name-sm' : ''}`}>{guild.nome}</h1>
                <div className="futc-rule" />

                <div
                  className="futc-stats"
                  style={{ gridTemplateRows: `repeat(${Math.ceil(SCORING_STAT_META.length / 2)}, auto)` }}
                >
                  {SCORING_STAT_META.map((s) => {
                    const v = avgStats[s.key];
                    return (
                      <FutStat
                        key={s.key}
                        value={v}
                        abbr={ABBR[s.key]}
                        cls={v >= 70 ? 'hi' : v < 40 ? 'lo' : ''}
                        tipTitle={`${s.icon} ${s.label} · ${ABBR[s.key]} ${v}`}
                        tipLines={[
                          s.desc,
                          `média dos percentis dos ${members.length} membros da guilda`,
                          `peso ${pesoDe(s.key)}% do Poder`,
                        ]}
                      />
                    );
                  })}
                </div>

                <div className="futc-foot">
                  <span className="plate" title={`${nCamara} na Câmara dos Deputados`}>{nCamara} DEP</span>
                  <span className="futc-foot-gem" aria-hidden>◆</span>
                  <span className="plate" title={`${nSenado} no Senado Federal`}>{nSenado} SEN</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="carta-cta">
          <Link className="btn" href={`/batalha/?ga=${guild.sigla}`}>⚔️ Batalhar</Link>
          <Link className="btn ghost" href="/insights/">📊 Insights</Link>
          <ShareButton
            className="btn ghost"
            title={`Guilda ${guild.sigla} — ${guild.nome} · PLENÁRIA`}
            text={`🛡️ A guilda ${guild.sigla} é Tier ${tier} (Poder médio ${opsMedio}, ${members.length} membros) na PLENÁRIA! #PLENARIA`}
            card={{
              variant: 'guilda',
              heading: guild.nome,
              sub: `Guilda ${guild.sigla} · ${members.length} membros`,
              tier,
              ops: opsMedio,
              opsLabel: 'Poder médio',
              accent: guild.cor,
              sigla: guild.sigla,
              stats: SCORING_STAT_META.map((s) => ({ icon: s.icon, label: s.label, value: avgStats[s.key] })),
              story: {
                rank: `#${rank} de ${guilds.length} guildas`,
                destaque: `${members.length} membros · por Poder médio`,
                tierLabel: TIER_LABEL[tier],
              },
            }}
          />
        </div>

        <div className="panel carta-rank">
          <div className="big">#{rank} de {guilds.length} guildas</div>
          <p className="sub">por Poder médio · Tier {tier} — {TIER_LABEL[tier]} · {members.length} membros ranqueados</p>
        </div>

        <div className="panel">
          <h3>🏰 Composição por tier</h3>
          <p className="sub">quantos membros a guilda tem em cada rank</p>
          <div className="carta-titles">
            {TIER_ORDER.map((t) => {
              const count = byTier.get(t)!.length;
              if (!count) return null;
              return (
                <span key={t} className={`badge purple tier-${t}`} style={{ gap: 6 }}>
                  <span className="tier-chip display" style={{ width: 16, height: 16, fontSize: 10, borderRadius: 5 }}>{t}</span>
                  × {count}
                </span>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h3>⭐ Campeões da Guilda</h3>
          <p className="sub">os três membros de maior Poder</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {top3.map((p, i) => (
              <PoliticianLink key={p.slug} slug={p.slug} className={`mini-card tier-${p.tier}`}>
                <span className="pos display" style={{ color: 'var(--gold-2)', fontWeight: 900, width: 18 }}>{i + 1}</span>
                <span className={`tier-chip display tier-${p.tier}`}>{p.tier}</span>
                <span className="nm">
                  <b>{p.nome}</b>
                  <small>{casaLabel(p.casa, true)} · {p.uf}</small>
                </span>
                <span className="ops">{p.ops}</span>
              </PoliticianLink>
            ))}
          </div>
        </div>

        {topTitles.length > 0 && (
          <div className="panel">
            <h3>🎖️ Títulos na Guilda</h3>
            <p className="sub">
              🟢 elogiosos · 🔴 críticos · 🟣 neutros — os mais comuns entre os membros; passe o mouse para ver a regra
            </p>
            <div className="carta-titles">
              {topTitles.map(([tslug, count]) => {
                const t = getTitle(tslug);
                if (!t) return null;
                return <TitleBadge key={tslug} label={t.label} cor={t.cor} regra={t.regra} count={count} />;
              })}
            </div>
          </div>
        )}

        <div className="panel carta-note">
          <h3 style={{ marginBottom: 8 }}>📖 Como ler esta carta</h3>
          A carta da guilda agrega seus {members.length} parlamentares: cada atributo é a{' '}
          <b>média dos percentis dos membros</b>, e o tier da guilda ({tier} · {TIER_LABEL[tier]}) vem do
          Poder médio — sem os gates individuais do Rank S.
          <div style={{ marginTop: 10 }} className="muted">
            Atributos = média dos {members.length} membros · {meta.fonte}
          </div>
        </div>
      </div>

      {/* roster completo */}
      <section style={{ marginTop: 40 }}>
        <div className="page-title" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22 }}>MEMBROS</h2>
          <p>todos os parlamentares da guilda, por tier</p>
        </div>
        {TIER_ORDER.map((t) => {
          const list = byTier.get(t)!;
          if (!list.length) return null;
          return (
            <section key={t} className={`tier-section tier-${t}`}>
              <div className="tier-head">
                <span className="big display">{t}</span>
                <span className="lbl">
                  <b className="display">{TIER_LABEL[t]}</b>
                  <small>{list.length} parlamentares</small>
                </span>
              </div>
              <div className="roster">
                {list.map((p) => (
                  <PoliticianLink key={p.slug} slug={p.slug} className={`mini-card tier-${p.tier}`}>
                    <span className="tier-chip display">{p.tier}</span>
                    <span className="nm">
                      <b>{p.nome}</b>
                      <small>{casaLabel(p.casa, true)} · {p.uf}</small>
                    </span>
                    <span className="ops">{p.ops}</span>
                  </PoliticianLink>
                ))}
              </div>
            </section>
          );
        })}
        {parciais.length > 0 && (
          <section className="tier-section" style={{ marginTop: 8 }}>
            <div className="sub" style={{ marginBottom: 10 }}>
              🕓 Fora do ranking (sem Tier — mandato recente ou presidência da Casa): {parciais.map((p) => p.nome).join(', ')}
            </div>
            <div className="roster">
              {parciais.map((p) => (
                <PoliticianLink key={p.slug} slug={p.slug} className="mini-card">
                  <span className="tier-chip display">—</span>
                  <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.uf}</small></span>
                  <span className="ops">—</span>
                </PoliticianLink>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
