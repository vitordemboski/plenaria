import { rampColor } from '@/lib/ramp';
import type { Casa, Insights } from '@/lib/types';

/**
 * "Onde o Congresso gasta a cota" — barra 100% empilhada por casa da distribuição
 * agregada da cota (CEAP/CEAPS) por categoria. INFORMATIVO: descreve, não julga.
 * Reusa as classes .cota-* (carta.css, globais) da quebra individual.
 */

type Cat = { categoria: string; totalMil: number; pct: number };

const rotuloCasa = (c: Casa) => (c === 'camara' ? 'Câmara' : 'Senado');
const fmtMi = (mi: number) => `R$ ${mi.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;

/** top-N + "Outros" por último (mescla um "Outros" cru da fonte no mesmo balde;
 *  os pcts da lista já somam 100, então o resto só soma) */
function dobra(cats: Cat[], top: number): Cat[] {
  const head = cats.slice(0, top).map((c) => ({ ...c }));
  const tail = cats.slice(top);
  const restoMil = tail.reduce((s, c) => s + c.totalMil, 0);
  const restoPct = tail.reduce((s, c) => s + c.pct, 0);
  if (restoMil > 0) {
    const ex = head.find((c) => c.categoria === 'Outros');
    if (ex) { ex.totalMil += restoMil; ex.pct += restoPct; }
    else head.push({ categoria: 'Outros', totalMil: restoMil, pct: restoPct });
  }
  head.sort((a, b) => (a.categoria === 'Outros' ? 1 : 0) - (b.categoria === 'Outros' ? 1 : 0) || b.totalMil - a.totalMil);
  return head;
}

export function GastoCategorias({ dados }: { dados: Insights['gastoCategorias'] }) {
  return (
    <div className="panel">
      <h3>🏛️ Onde o Congresso gasta a cota</h3>
      <div className="sub">
        Distribuição da cota parlamentar por categoria — separada por casa (CEAP e CEAPS têm tetos
        e regras distintas). Informativo: descreve para onde a verba vai, não julga.
      </div>
      {(['camara', 'senado'] as Casa[]).map((casa) => {
        const bloco = dados[casa];
        if (!bloco?.categorias.length) return null;
        const cats = dobra(bloco.categorias, 6);
        const pctTxt = (pct: number) => (pct === 0 ? '<1' : String(pct));
        const n = cats.length;
        const cor = (i: number) => rampColor(n === 1 ? 1 : 1 - i / (n - 1));
        return (
          <div key={casa} className="cota-agg">
            <h4>{rotuloCasa(casa)} <small>{fmtMi(bloco.totalMi)} no mandato</small></h4>
            <div className="cota-bar" role="img" aria-label={`${rotuloCasa(casa)}: ${cats.map((c) => `${c.categoria} ${c.pct}%`).join(', ')}`}>
              {cats.map((c, i) => (
                <i key={c.categoria} className="cota-seg" style={{ width: `${c.pct}%`, background: cor(i) }}
                   title={`${c.categoria}: ${fmtMi(c.totalMil / 1000)} (${c.pct}%)`} />
              ))}
            </div>
            <div className="cota-legend">
              {cats.map((c, i) => (
                <span key={c.categoria} className="cota-leg" title={fmtMi(c.totalMil / 1000)}>
                  <i style={{ background: cor(i) }} />
                  {c.categoria} <b>{pctTxt(c.pct)}%</b>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
