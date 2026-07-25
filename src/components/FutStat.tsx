'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Atributo da carta FUT com tooltip (mesmo padrão do TitleBadge/mapa):
 * hover mostra o que o atributo mede, o peso no Poder e o número bruto
 * por trás dele; toque alterna (mobile).
 */
export function FutStat({ value, abbr, cls, informativo, travado, tipTitle, tipLines }: {
  value: number;
  abbr: string;
  /** destaque visual: 'hi' (≥70), 'lo' (<40) ou '' */
  cls: '' | 'hi' | 'lo';
  informativo?: boolean;
  /** é ESTE atributo que trava o Tier S (gate) — ganha cadeado */
  travado?: boolean;
  tipTitle: string;
  tipLines: string[];
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <div
        className={`futc-stat${cls ? ` ${cls}` : ''}${travado ? ' gate' : ''}`}
        style={{ cursor: 'help' }}
        onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTip(null)}
        onClick={(e) => setTip((cur) => (cur ? null : { x: e.clientX, y: e.clientY }))}
        role="button"
        aria-label={`${tipTitle}: ${tipLines.join('; ')}`}
      >
        <b>{value}</b>
        <span>
          {abbr}
          {informativo && <sup> ⓘ</sup>}
          {travado && <sup> 🔒</sup>}
        </span>
      </div>
      {/* portal: o clip-path/filter da carta viram "containing block" para
          position:fixed — dentro da carta o tooltip seria clipado/deslocado */}
      {tip && createPortal(
        <div
          className="brmap-tip"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 240), top: tip.y + 14 }}
        >
          <b>{tipTitle}</b>
          {tipLines.map((l, i) => (
            <span key={i}><br />{l}</span>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
