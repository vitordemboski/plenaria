'use client';

import { useState } from 'react';

/**
 * Badge de título com tooltip estilizado (mesmo padrão do mapa/scatter):
 * hover mostra a regra factual que concedeu o título; toque alterna.
 * Nos selos vermelhos vem junto a `evidencia` — o número bruto deste parlamentar
 * e a mediana da casa, para o rótulo não ficar sendo só a nossa palavra.
 */
export function TitleBadge({ label, cor, regra, count, evidencia }: {
  label: string;
  cor: 'green' | 'red' | 'purple';
  regra: string;
  count?: number;
  /** número BRUTO deste parlamentar + mediana da casa (só selos vermelhos): o gate é
   *  percentílico, mas o rótulo acusa em absoluto — sem o dado, vira palavra nossa. */
  evidencia?: string;
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <span
        className={`badge ${cor}`}
        style={{ cursor: 'help' }}
        // Hover (reposiciona o tooltip) só para MOUSE. No toque, o navegador emite
        // um mousemove sintético antes do click; com onMouseMove, ele abria o tip
        // e o onClick seguinte — vendo-o já aberto — fechava: o toque "não pegava".
        // Com pointerType!=='mouse' ignorado aqui, no toque só o onClick alterna.
        onPointerMove={(e) => { if (e.pointerType === 'mouse') setTip({ x: e.clientX, y: e.clientY }); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setTip(null); }}
        onClick={(e) => setTip((cur) => (cur ? null : { x: e.clientX, y: e.clientY }))}
        role="button"
        aria-label={`${label}: ${regra}${evidencia ? ` Neste parlamentar: ${evidencia}` : ''}`}
      >
        {label}{count !== undefined ? ` × ${count}` : ''}
      </span>
      {tip && (
        <div
          // com evidência o tooltip é mais largo (regra + números brutos): o clamp
          // tem que usar a MESMA largura, senão ele vaza pela direita no mobile.
          className={`brmap-tip${evidencia ? ' wide' : ''}`}
          style={{
            left: Math.max(8, Math.min(tip.x + 14, window.innerWidth - (evidencia ? 308 : 240))),
            top: tip.y + 14,
          }}
        >
          <b>{label}</b><br />{regra}
          {evidencia && (
            <><hr className="tip-sep" /><span className="tip-evid"><b>Neste parlamentar:</b> {evidencia}</span></>
          )}
        </div>
      )}
    </>
  );
}
