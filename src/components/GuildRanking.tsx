'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Insights, Tier } from '@/lib/types';
import { guildSlug } from '@/lib/slug';

type GuildRow = Insights['guildRanking'][number];

const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D', 'F'];
const TIER_COLORS: Record<Tier, string> = {
  S: '#f6e39b', A: '#e0b84a', B: '#c9962b', C: '#9a7a1e', D: '#6b5518', F: '#55442a',
};

interface Pick { sigla: string; tier: Tier; }

/**
 * Ranking de Guildas com o mesmo padrão de interação do mapa e do scatter:
 * hover num segmento → tooltip estilizado; clique fixa a seleção num painel
 * com link para batalhar com a guilda.
 */
export function GuildRanking({ ranking }: { ranking: GuildRow[] }) {
  const [hover, setHover] = useState<{ pick: Pick; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Pick | null>(null);
  // dica em linguagem de toque no celular (sem hover); false inicial p/ hidratação
  const [toque, setToque] = useState(false);
  useEffect(() => setToque(matchMedia('(pointer: coarse)').matches), []);

  const maxTotal = Math.max(...ranking.map((g) => g.total));
  const rowOf = (sigla: string) => ranking.find((g) => g.sigla === sigla)!;
  const describe = ({ sigla, tier }: Pick) => {
    const g = rowOf(sigla);
    const n = g.tiers[tier];
    return { g, n, pct: Math.round((n / g.total) * 100) };
  };
  const active = hover?.pick ?? selected;

  return (
    <div>
      {ranking.map((g) => (
        <div className="grow" key={g.sigla}>
          <div className="gn">{g.sigla}</div>
          <div className="gbar" style={{ width: `${(g.total / maxTotal) * 100}%` }}>
            {TIERS.map((t) => {
              const n = g.tiers[t];
              if (!n) return null;
              const isActive = active?.sigla === g.sigla && active?.tier === t;
              const isSelected = selected?.sigla === g.sigla && selected?.tier === t;
              return (
                <div
                  key={t}
                  className="gseg"
                  style={{
                    flex: n,
                    background: TIER_COLORS[t],
                    cursor: 'pointer',
                    filter: isActive ? 'brightness(1.35)' : undefined,
                    boxShadow: isSelected
                      ? 'inset 0 0 0 2px #f4e2a1'
                      : 'inset 0 0 0 1px rgba(255,255,255,.07)',
                  }}
                  role="button"
                  aria-label={`Guilda ${g.sigla} — Tier ${t}: ${n} membros`}
                  onMouseMove={(e) => setHover({ pick: { sigla: g.sigla, tier: t }, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() =>
                    setSelected((cur) =>
                      cur?.sigla === g.sigla && cur?.tier === t ? null : { sigla: g.sigla, tier: t },
                    )
                  }
                />
              );
            })}
          </div>
          <div className="gt">{g.total}</div>
        </div>
      ))}

      <div className="tier-legend">
        {TIERS.map((t) => (
          <span key={t}><i style={{ background: TIER_COLORS[t] }} />Tier {t}</span>
        ))}
      </div>

      {hover && (() => {
        const { g, n, pct } = describe(hover.pick);
        return (
          <div className="brmap-tip"
            style={{ left: Math.min(hover.x + 14, window.innerWidth - 240), top: hover.y + 14 }}>
            <b>🛡️ {g.nome}</b><br />
            Tier {hover.pick.tier}: {n} membros ({pct}%)<br />
            {g.total} membros no total
          </div>
        );
      })()}

      <div className="brmap-info">
        {selected ? (() => {
          const { g, n, pct } = describe(selected);
          return (
            <>
              📍 <b>{g.sigla}</b> ({g.nome}) — Tier {selected.tier}: {n} membros ({pct}%)
              {' — '}
              <Link href={`/guilda/${guildSlug(g.sigla)}/`} style={{ color: 'var(--gold-2)', textDecoration: 'underline' }}>
                🛡️ ver guilda →
              </Link>
              {' · '}
              <Link href={`/batalha/?ga=${g.sigla}`} style={{ color: 'var(--gold-2)', textDecoration: 'underline' }}>
                ⚔️ batalhar →
              </Link>
            </>
          );
        })() : (
          toque ? 'toque num segmento; toque de novo para fixar' : 'passe o mouse ou clique num segmento; clique para fixar'
        )}
      </div>
    </div>
  );
}
