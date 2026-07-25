import { PrefetchLink } from '@/components/PrefetchLink';
import { politicians as allPoliticians, titleDefs, guilds, meta, TITLE_COR_META, RARIDADE_LABEL, foraDoRanking } from '@/lib/data';
import type { TitleDef } from '@/lib/types';

// mandato parcial (posse recente) não recebe títulos e fica fora das contagens
const politicians = allPoliticians.filter((p) => !foraDoRanking(p));

const CORES: TitleDef['cor'][] = ['green', 'red', 'purple'];

/**
 * Galeria de títulos + analytics (Server Component). Conta portadores por título,
 * casa e guilda direto de politicians.json no build. Reutilizável como aba de
 * Insights. Cada card leva à página do título (/titulo/[slug]).
 */
export function TitlesGallery() {
  if (!meta.titulosDisponiveis) {
    return <div className="panel"><div className="sub">Nenhum título ativo.</div></div>;
  }

  const stat = (slug: string) => {
    const cs = politicians.filter((p) => p.titles.includes(slug));
    return { total: cs.length, camara: cs.filter((p) => p.casa === 'camara').length, senado: cs.filter((p) => p.casa === 'senado').length };
  };
  const stats = Object.fromEntries(titleDefs.map((t) => [t.slug, stat(t.slug)]));

  const concessoes = politicians.reduce((s, p) => s + p.titles.length, 0);
  const comTitulo = politicians.filter((p) => p.titles.length > 0).length;
  const pctComTitulo = Math.round((comTitulo / politicians.length) * 100);
  const countCor = (cor: TitleDef['cor']) => titleDefs.filter((t) => t.cor === cor).reduce((s, t) => s + stats[t.slug].total, 0);

  // distribuição por guilda: pares (parlamentar × título) por cor
  const corBySlug = Object.fromEntries(titleDefs.map((t) => [t.slug, t.cor]));
  const guildBySigla = Object.fromEntries(guilds.map((g) => [g.sigla, g]));
  const perGuild: Record<string, { green: number; red: number; purple: number; total: number }> = {};
  for (const p of politicians) {
    for (const s of p.titles) {
      const c = corBySlug[s];
      if (!c) continue;
      (perGuild[p.partido] ??= { green: 0, red: 0, purple: 0, total: 0 });
      perGuild[p.partido][c]++;
      perGuild[p.partido].total++;
    }
  }
  const topBy = (cor: 'green' | 'red') =>
    Object.entries(perGuild).filter(([, v]) => v[cor] > 0).sort((a, b) => b[1][cor] - a[1][cor]).slice(0, 6);

  const rarBadge = (t: TitleDef) => t.raridade ? <span className={`rarity rar-${t.raridade}`}>{RARIDADE_LABEL[t.raridade]}</span> : null;

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="k-lbl">Títulos no catálogo</div><div className="k-val">{titleDefs.length}</div><div className="k-sub">{CORES.map((c) => `${countCor(c)} ${TITLE_COR_META[c].label.toLowerCase()}`).join(' · ')}</div></div>
        <div className="kpi"><div className="k-lbl">Concessões</div><div className="k-val">{concessoes.toLocaleString('pt-BR')}</div><div className="k-sub">somando todos os portadores</div></div>
        <div className="kpi"><div className="k-lbl">Parlamentares com título</div><div className="k-val">{pctComTitulo}%</div><div className="k-sub">{comTitulo} de {politicians.length}</div></div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3 className="cor-green">🟢 Guildas mais elogiadas</h3>
          <div className="sub">Partidos com mais títulos elogiosos concedidos aos seus membros</div>
          {topBy('green').map(([sigla, v], i) => (
            <PrefetchLink key={sigla} href={`/guilda/${sigla}/`} className="lrow">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{guildBySigla[sigla]?.nome ?? sigla}</b><small>{sigla}</small></span>
              <span />
              <span className="sc" style={{ color: 'var(--gold-2)' }}>{v.green}</span>
            </PrefetchLink>
          ))}
        </div>
        <div className="panel">
          <h3 className="cor-red">🔴 Guildas mais criticadas</h3>
          <div className="sub">Partidos com mais títulos críticos concedidos aos seus membros</div>
          {topBy('red').map(([sigla, v], i) => (
            <PrefetchLink key={sigla} href={`/guilda/${sigla}/`} className="lrow">
              <span className="pos">{i + 1}</span>
              <span className="nm"><b>{guildBySigla[sigla]?.nome ?? sigla}</b><small>{sigla}</small></span>
              <span />
              <span className="sc" style={{ color: 'var(--red-soft)' }}>{v.red}</span>
            </PrefetchLink>
          ))}
        </div>
      </div>

      {CORES.map((cor) => {
        const defs = titleDefs.filter((t) => t.cor === cor).sort((a, b) => stats[b.slug].total - stats[a.slug].total);
        if (!defs.length) return null;
        return (
          <div className="panel" key={cor} style={{ marginTop: 12 }}>
            <h3 className={`cor-${cor}`}>{TITLE_COR_META[cor].icon} {TITLE_COR_META[cor].label}</h3>
            <div className="sub">{defs.length} {defs.length === 1 ? 'título' : 'títulos'}</div>
            <div className="title-gallery">
              {defs.map((t) => {
                const s = stats[t.slug];
                return (
                  <PrefetchLink key={t.slug} href={`/titulo/${t.slug}/`} className={`title-card tc-${cor}`}>
                    <div className="tc-head"><b>{t.label}</b>{rarBadge(t)}</div>
                    <div className="tc-count">{s.total}<small>{s.total === 1 ? 'parlamentar' : 'parlamentares'}</small></div>
                    {s.camara > 0 && s.senado > 0 && (
                      <div className="tc-split">Câmara {s.camara} · Senado {s.senado}</div>
                    )}
                    <p className="tc-regra">{t.regra}</p>
                  </PrefetchLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
