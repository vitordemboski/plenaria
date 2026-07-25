import { PrefetchLink } from '@/components/PrefetchLink';
import type { Insights } from '@/lib/types';
import { guildSlug } from '@/lib/slug';

type Row = Insights['guildGasto']['camara'][number];

/** R$ mil/mês → "R$ 2,0 mi/mês" acima de mil; "R$ 357 mil/mês" abaixo */
const fmtTotal = (mil: number) =>
  mil >= 1000 ? `R$ ${(mil / 1000).toFixed(1).replace('.', ',')} mi/mês` : `R$ ${mil} mil/mês`;

/**
 * Guildas ordenadas pelo gasto MÉDIO de cota por parlamentar — o total da bancada
 * mede sobretudo o tamanho dela, então entra como número secundário. Barra sequencial
 * de um hue só (magnitude), sem legenda: cada linha carrega o próprio rótulo.
 */
export function GuildSpendRanking({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map((r) => r.media), 1);
  return (
    <div className="gsp">
      {rows.map((r, i) => (
        <PrefetchLink key={r.sigla} href={`/guilda/${guildSlug(r.sigla)}/`} className="gsp-row">
          <div className="gsp-head">
            <span className="gsp-pos">{i + 1}</span>
            <b className="gsp-sigla">{r.sigla}</b>
            <span className="gsp-val">R$ {r.media} mil</span>
          </div>
          <div className="gsp-bar">
            <i style={{ width: `${Math.max((r.media / max) * 100, 1.5)}%` }} />
          </div>
          <div className="gsp-meta">
            {r.n} {r.n === 1 ? 'parlamentar' : 'parlamentares'} · {fmtTotal(r.totalMil)} no total
          </div>
        </PrefetchLink>
      ))}
    </div>
  );
}
