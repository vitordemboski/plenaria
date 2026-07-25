'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { BRAZIL_VIEWBOX, UF_PATHS } from './brazil-paths';

// ordem de pintura dos estados (= ordem das chaves); os shapes da fonte se
// SOBREPÕEM muito (o path do TO, p.ex., invade 58% dos vizinhos) e o mapa só
// fica correto porque quem é pintado depois cobre a sobreposição. A "região
// visível" de um estado é, portanto, seu path MENOS a união dos pintados depois.
const UF_ORDER = Object.keys(UF_PATHS);
const [, , VB_W, VB_H] = BRAZIL_VIEWBOX.split(' ').map(Number);

export interface UfValue {
  /** cor de preenchimento já calculada (rampa sequencial) */
  fill: string;
  /** texto do tooltip/painel com os dados da UF */
  label: string;
  /** true quando o preenchimento é claro → rótulo escuro */
  lightFill: boolean;
}

/**
 * Mapa coroplético do Brasil — shapes reais por UF.
 * Micro-ilha client: hover mostra tooltip estilizado (desktop) e
 * clique/toque fixa a seleção num painel abaixo do mapa (mobile-friendly).
 */
export function BrazilMap({ values }: { values: Record<string, UfValue> }) {
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const maskId = useId(); // único por instância (há 3 mapas: Nacional/Câmara/Senado)

  const active = hover?.uf ?? selected;

  // estados pintados DEPOIS do selecionado — sua união recorta a região visível
  const laterUfs = selected ? UF_ORDER.slice(UF_ORDER.indexOf(selected) + 1) : [];

  return (
    <div className="brmap-wrap">
      <svg viewBox={BRAZIL_VIEWBOX} className="brmap" role="img" aria-label="Mapa do Brasil por UF">
        {Object.entries(UF_PATHS).map(([uf, { d }]) => {
          const v = values[uf];
          const isActive = active === uf;
          return (
            <path
              key={uf}
              d={d}
              className="brmap-uf"
              fill={v?.fill ?? '#3a2f18'}
              stroke="#0a0d14"
              strokeWidth={1.2}
              style={{ filter: isActive ? 'brightness(1.35)' : undefined, cursor: 'pointer' }}
              onMouseMove={(e) => setHover({ uf, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              onClick={() => setSelected((cur) => (cur === uf ? null : uf))}
              role="button"
              aria-label={v?.label ?? uf}
            />
          );
        })}
        {/* Realce da seleção limitado à REGIÃO VISÍVEL do estado (path menos a
            união dos pintados depois). Redesenhar o path cru por cima mostrava o
            shape inteiro — que invade os vizinhos — fazendo o estado "crescer".
            A máscara resolve: branco = o path do selecionado; preto = cada vizinho
            pintado depois. Resultado = só a fatia realmente visível. */}
        {selected && UF_PATHS[selected] && (
          <>
            <mask id={maskId}>
              <path d={UF_PATHS[selected].d} fill="#fff" />
              {laterUfs.map((uf) => (
                <path key={uf} d={UF_PATHS[uf].d} fill="#000" />
              ))}
            </mask>
            {/* tom dourado por cima da fatia visível */}
            <rect x={0} y={0} width={VB_W} height={VB_H} fill="#f4e2a1" opacity={0.22}
              mask={`url(#${maskId})`} pointerEvents="none" />
            {/* contorno: traço do próprio path (divisas com vizinhos ANTERIORES) +
                traço dos vizinhos posteriores (as divisas internas), tudo mascarado
                à região visível → borda completa, sem vazar nem inflar o estado */}
            <g mask={`url(#${maskId})`} fill="none" stroke="#f4e2a1" strokeWidth={2.5}
              strokeLinejoin="round" pointerEvents="none">
              <path d={UF_PATHS[selected].d} />
              {laterUfs.map((uf) => (
                <path key={uf} d={UF_PATHS[uf].d} />
              ))}
            </g>
          </>
        )}
        {/* rótulos por cima, sem interceptar o mouse */}
        {Object.entries(UF_PATHS).map(([uf, { lx, ly }]) => (
          <text key={`t-${uf}`} x={lx} y={ly} textAnchor="middle" fontSize="9.5" fontWeight="700"
            pointerEvents="none" fill={values[uf]?.lightFill ? '#0a0d14' : '#e8e3d3'}>
            {uf}
          </text>
        ))}
      </svg>

      {hover && values[hover.uf] && (
        <div
          className="brmap-tip"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 230), top: hover.y + 14 }}
        >
          {values[hover.uf].label}
        </div>
      )}

      <div className="brmap-info">
        {selected && values[selected]
          ? (
            <>
              📍 {values[selected].label}{' — '}
              <Link href={`/estado/${selected}/`} style={{ color: 'var(--gold-2)', textDecoration: 'underline' }}>
                ver bancada →
              </Link>
            </>
          )
          : 'toque ou passe o mouse num estado'}
      </div>
    </div>
  );
}
