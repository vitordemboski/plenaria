import type { Insights } from '@/lib/types';

type PorCasa = Insights['gastoPorCasa'];

const fmtTotal = (mil: number) =>
  mil >= 1000 ? `R$ ${(mil / 1000).toFixed(1).replace('.', ',')} mi` : `R$ ${mil} mil`;

/**
 * Câmara × Senado lado a lado. NÃO é um placar: as duas casas têm cotas com tetos e
 * regras próprias (CEAP × CEAPS), então cada coluna descreve a sua casa. Os números
 * saem do mesmo agregado por casa que alimenta o ranking de guildas.
 */
export function GastoCasas({ gastoPorCasa }: { gastoPorCasa: PorCasa }) {
  const linhas: [string, (c: PorCasa['camara']) => string][] = [
    ['média por parlamentar', (c) => `R$ ${c.media} mil`],
    ['mediana', (c) => `R$ ${c.mediana} mil`],
    ['maior gasto individual', (c) => `R$ ${c.max} mil`],
    ['total da casa', (c) => fmtTotal(c.totalMil)],
  ];

  return (
    <div className="panel">
      <h3>🏛️ Câmara × Senado</h3>
      <div className="sub">
        Cota parlamentar em R$ mil/mês. CEAP (Câmara) e CEAPS (Senado) têm tetos e regras distintas — cada coluna descreve a sua casa, não é um placar entre elas.
      </div>
      <table className="casas-tbl">
        <thead>
          <tr>
            <th />
            <th>Câmara<small>{gastoPorCasa.camara.n} deputados</small></th>
            <th>Senado<small>{gastoPorCasa.senado.n} senadores</small></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([label, val]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{val(gastoPorCasa.camara)}</td>
              <td>{val(gastoPorCasa.senado)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="brmap-info">
        ⚖︎ Só entram parlamentares que ranqueiam (fora: mandato parcial e presidência da Casa).
      </div>
    </div>
  );
}
