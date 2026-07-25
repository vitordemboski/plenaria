'use client';

import { useMemo, useState } from 'react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { BrazilMap, type UfValue } from './BrazilMap';
import type { MapDataset, MapFamily } from '@/lib/map-data';

function rampColor(t: number) {
  const c1 = [58, 47, 24], c2 = [246, 227, 155];
  return `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(',')})`;
}

function fmt(kind: MapDataset['kind'], v: number): string {
  switch (kind) {
    case 'money': return `R$ ${v} mil/mês`;
    case 'age': return `${v} anos`;
    case 'pct': return `${v}%`;
    default: return `${v}`;
  }
}

/**
 * Explorador de camadas do mapa (ilha client). Recebe datasets pré-computados
 * no build e apenas escolhe a camada ativa, pinta o BrazilMap e monta a legenda
 * e o ranking de UFs. Sem nenhum fetch — puro estado de seleção.
 */
export function MapExplorer({ families, datasets }: { families: MapFamily[]; datasets: Record<string, MapDataset> }) {
  const [familyId, setFamilyId] = useState(families[0].id);
  const [optByFamily, setOptByFamily] = useState<Record<string, string>>(
    Object.fromEntries(families.map((f) => [f.id, f.options[0]?.id])),
  );

  const family = families.find((f) => f.id === familyId)!;
  const option = family.options.find((o) => o.id === optByFamily[family.id]) ?? family.options[0];
  const dataset = datasets[option.datasetKey];

  // quando "maior é pior" (Gasto), invertemos a rampa: dourado/claro = valor MENOR
  // (o bom), escuro = valor maior — porque tom claro é lido intuitivamente como positivo.
  const invert = family.higherIsBetter === false;

  const { fills, lo, hi, ranking, shadeOf } = useMemo(() => {
    const entries = Object.entries(dataset.values).filter(([, v]) => v != null) as [string, number][];
    const nums = entries.map(([, v]) => v);
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const span = hi - lo || 1;
    const shadeOf = (v: number) => (invert ? 1 - (v - lo) / span : (v - lo) / span);
    const metric = family.options.length > 1 ? `${family.label} · ${option.label}` : family.label;
    const fills: Record<string, UfValue> = {};
    for (const [uf, v] of Object.entries(dataset.values)) {
      if (v == null) {
        fills[uf] = { fill: '#2a2f3a', lightFill: false, label: `${uf} — sem dado` };
      } else {
        const shade = shadeOf(v);
        fills[uf] = { fill: rampColor(shade), lightFill: shade > 0.55, label: `${uf} — ${metric}: ${fmt(dataset.kind, v)}` };
      }
    }
    // ranking "melhor primeiro": desc no normal, asc quando maior é pior
    const ranking = [...entries].sort((a, b) => (invert ? a[1] - b[1] : b[1] - a[1]));
    return { fills, lo, hi, ranking, shadeOf };
  }, [dataset, family, option, invert]);

  return (
    <div className="map-explorer">
      {families.length > 1 ? (
        <div className="map-controls" role="tablist" aria-label="Camadas do mapa">
          {families.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={f.id === familyId}
              className={`chip${f.id === familyId ? ' is-active' : ''}`}
              onClick={() => setFamilyId(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : (
        <h3 className="map-heading">{family.label} por UF</h3>
      )}

      {family.options.length > 1 && (
        family.options.length > 4 ? (
          <select
            className="map-select"
            value={option.id}
            onChange={(e) => setOptByFamily((s) => ({ ...s, [family.id]: e.target.value }))}
            aria-label="Escolher título"
          >
            {family.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ) : (
          <div className="map-subcontrols" role="tablist" aria-label={family.label}>
            {family.options.map((o) => (
              <button
                key={o.id}
                role="tab"
                aria-selected={o.id === option.id}
                className={`chip sm${o.id === option.id ? ' is-active' : ''}`}
                onClick={() => setOptByFamily((s) => ({ ...s, [family.id]: o.id }))}
              >
                {o.label}
              </button>
            ))}
          </div>
        )
      )}

      <div className="map-hint">{family.hint}</div>

      <div className="grid2 map-grid">
        <div className="panel">
          <BrazilMap values={fills} />
          <div className="maplegend">
            <span>{fmt(dataset.kind, invert ? hi : lo)}</span><span className="ramp" /><span>{fmt(dataset.kind, invert ? lo : hi)}</span>
          </div>
        </div>
        <div className="panel">
          <h3>Ranking por UF</h3>
          <div className="sub">{family.options.length > 1 ? `${family.label} · ${option.label}` : family.label} — maior primeiro</div>
          <div className="uf-rank">
            {ranking.map(([uf, v], i) => (
              <PrefetchLink className="uf-rank-item" key={uf} href={`/estado/${uf}/`} title={`${uf} — ver bancada`}>
                <span className="pos">{i + 1}</span>
                <i style={{ background: rampColor(shadeOf(v)) }} />
                <b>{uf}</b>
                <span className="sc">{fmt(dataset.kind, v)}</span>
              </PrefetchLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
