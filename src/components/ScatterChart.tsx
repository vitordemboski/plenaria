'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Casa, Tier } from '@/lib/types';

export interface ScatterPoint {
  slug: string; nome: string; casa: Casa; uf: string; partido: string; tier: Tier;
  x: number; y: number;
  /** destaque visual (ex.: título factual ativo) — opcional, nem todo eixo tem um */
  flag?: boolean;
}

/** formato de exibição do valor — funções não podem cruzar a fronteira server/client,
 *  então o componente formata internamente a partir de um enum */
export type Fmt = 'money' | 'pct' | 'plain';

// Dimensões do viewBox por layout. Desktop é largo (720×340). No mobile encolhe
// para ~quadrado (400×360): a MESMA nuvem de pontos num viewBox mais estreito é
// desenhada em escala maior, então cabe na largura da tela SEM scroll lateral e
// os pontos ficam legíveis. (O scroll horizontal quebrava o painel "ver card",
// que rolava junto e sumia.) M e SNAP são fixos em unidades de viewBox — num box
// menor ficam proporcionalmente maiores, o que ajuda a acertar no toque.
const DIMS = {
  wide: { W: 720, H: 340, axis: 9, label: 9 },
  compact: { W: 400, H: 360, axis: 12, label: 11 },
} as const;
const M = { l: 46, r: 16, t: 14, b: 36 };
/** raio de captura do hover, em unidades do viewBox */
const SNAP = 28;

const fmtVal = (v: number, fmt: Fmt) =>
  fmt === 'money' ? `R$ ${v} mil/mês` : fmt === 'pct' ? `${v}%` : `${v}`;

/**
 * Dispersão genérica X × Y com hover "magnético": o ponteiro captura o
 * ponto MAIS PRÓXIMO (não precisa acertar o pixel), tooltip estilizado,
 * e clique/toque fixa a seleção num painel com link para o card.
 *
 * O eixo Y é sempre 0–100 (serve tanto a Poder quanto a percentis) — só o
 * rótulo muda por prop. O eixo X é livre: `xMax` (topo, calculado sobre
 * TODOS os pontos do gráfico) e `xFmt`/`yFmt` controlam a formatação, já
 * que funções não podem ser passadas como prop de Server → Client.
 */
export function ScatterChart({
  points, xMax, xLabel, yLabel, xFmt = 'plain', yFmt = 'plain', ariaLabel, flagLabel,
}: {
  points: ScatterPoint[];
  xMax: number;
  xLabel: string;
  yLabel: string;
  xFmt?: Fmt;
  yFmt?: Fmt;
  ariaLabel: string;
  /** texto extra na tooltip quando o ponto tem `flag` ativa (ex.: "🚩 flag de gasto ativa") */
  flagLabel?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ p: ScatterPoint; cx: number; cy: number } | null>(null);
  const [selected, setSelected] = useState<ScatterPoint | null>(null);
  // Mobile (<=640px): viewBox compacto (cabe sem scroll), pontos maiores/mais
  // opacos (tela menor, sem hover) e dica em linguagem de toque. Detectado após
  // montar — o HTML pré-renderizado não tem window — com estado inicial `false`
  // para o 1º render client bater com o do server (sem mismatch de hidratação).
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(max-width: 640px)');
    const upd = () => setCompact(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);
  const { W, H, axis, label } = compact ? DIMS.compact : DIMS.wide;

  const X = (v: number) => M.l + (v / xMax) * (W - M.l - M.r);
  const Y = (o: number) => H - M.b - (o / 100) * (H - M.t - M.b);

  // coordenadas em viewBox pré-calculadas (recalcula ao trocar de layout)
  const coords = useMemo(
    () => points.map((p) => ({ p, x: X(p.x), y: Y(p.y) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, xMax, compact],
  );

  const findNearest = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * W;
    const my = ((clientY - rect.top) / rect.height) * H;
    let best: { p: ScatterPoint; x: number; y: number } | null = null;
    let bestD = SNAP * SNAP;
    for (const c of coords) {
      const d = (c.x - mx) ** 2 + (c.y - my) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  };

  const onMove = (e: React.PointerEvent) => {
    const near = findNearest(e.clientX, e.clientY);
    setHover(near ? { p: near.p, cx: e.clientX, cy: e.clientY } : null);
  };

  const onClick = (e: React.MouseEvent) => {
    const near = findNearest(e.clientX, e.clientY);
    setSelected((cur) => (near && cur?.slug !== near.p.slug ? near.p : null));
  };

  const active = hover?.p ?? selected;

  return (
    <div className="scatter-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="scatter-svg"
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={onClick}
        // pan-y: deixa a página rolar na vertical com o dedo sobre o gráfico.
        // Não há mais scroll horizontal (o viewBox compacto cabe na tela).
        style={{ cursor: hover ? 'pointer' : 'default', touchAction: 'pan-y' }}
      >
        {/* grid + eixos */}
        {[0, 25, 50, 75, 100].map((o) => (
          <g key={o}>
            <line x1={M.l} x2={W - M.r} y1={Y(o)} y2={Y(o)} stroke="rgba(255,255,255,.05)" />
            <text x={M.l - 8} y={Y(o) + 3} textAnchor="end" fontSize={axis} fill="#8a8f9e">{o}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * xMax)).map((g) => (
          <text key={g} x={X(g)} y={H - M.b + 16} textAnchor="middle" fontSize={axis} fill="#8a8f9e">{g}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" fontSize={label} fill="#8a8f9e" letterSpacing="1.5">
          {xLabel}
        </text>
        <text x={12} y={(M.t + H - M.b) / 2} textAnchor="middle" fontSize={label} fill="#8a8f9e" letterSpacing="1.5"
          transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>{yLabel}</text>

        {/* pontos: menores/translúcidos p/ densidade; flags mais visíveis.
            No mobile ficam maiores e mais opacos (tela menor, sem hover). */}
        {coords.map(({ p, x, y }) => (
          <circle key={p.slug} cx={x} cy={y}
            r={p.flag ? (compact ? 5 : 4) : (compact ? 4 : 3)}
            fill={p.flag ? '#e5484d' : '#c9962b'}
            fillOpacity={p.flag ? 0.95 : (compact ? 0.62 : 0.4)}
            stroke="#161b28" strokeWidth="1" />
        ))}

        {/* destaque do ponto ativo por cima de tudo */}
        {active && (() => {
          const c = coords.find((c) => c.p.slug === active.slug)!;
          return (
            <g pointerEvents="none">
              <line x1={c.x} x2={c.x} y1={M.t} y2={H - M.b} stroke="rgba(244,226,161,.25)" strokeDasharray="3 3" />
              <line x1={M.l} x2={W - M.r} y1={c.y} y2={c.y} stroke="rgba(244,226,161,.25)" strokeDasharray="3 3" />
              <circle cx={c.x} cy={c.y} r={7.5}
                fill={active.flag ? '#e5484d' : '#e0b84a'}
                stroke="#f4e2a1" strokeWidth="2" />
            </g>
          );
        })()}
      </svg>

      {hover && (
        <div className="brmap-tip"
          style={{ left: Math.min(hover.cx + 14, window.innerWidth - 240), top: hover.cy + 14 }}>
          <b>{hover.p.nome}</b> · Tier {hover.p.tier}<br />
          {hover.p.casa === 'camara' ? 'Dep.' : 'Sen.'} · {hover.p.uf} · {hover.p.partido}<br />
          {xFmt === 'money' && '💰 '}{fmtVal(hover.p.x, xFmt)} · {yLabel} {fmtVal(hover.p.y, yFmt)}
          {hover.p.flag && flagLabel && <><br />{flagLabel}</>}
        </div>
      )}

      <div className="brmap-info">
        {selected ? (
          <>
            📍 <b>{selected.nome}</b> · Tier {selected.tier} · {fmtVal(selected.x, xFmt)} · {yLabel} {fmtVal(selected.y, yFmt)}
            {selected.flag && ' · 🚩'}
            {' — '}
            <Link href={`/politico/${selected.slug}/`} style={{ color: 'var(--gold-2)', textDecoration: 'underline' }}>
              ver card →
            </Link>
          </>
        ) : (
          compact
            ? 'Toque perto de um ponto — o mais próximo é capturado; toque de novo para fixar'
            : 'Passe o mouse ou clique perto de um ponto — o mais próximo é capturado; clique para fixar'
        )}
      </div>
    </div>
  );
}
