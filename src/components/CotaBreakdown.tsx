import { dobrarCategorias } from '../../scripts/lib/cota.mjs';
import { rampColor } from '@/lib/ramp';
import type { Politician } from '@/lib/types';

/**
 * "Onde foi a cota" — barra 100% empilhada + legenda da quebra da cota
 * parlamentar (CEAP/CEAPS) por categoria, mais o maior fornecedor.
 * INFORMATIVO: descreve a distribuição do gasto; não pontua no Poder.
 * Server Component puro (sem estado) — recebe o cotaResumo já computado no build.
 */

const fmtReais = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(2).replace('.', ',')} mi`
  : v >= 1e3 ? `R$ ${Math.round(v / 1e3)} mil`
  : `R$ ${Math.round(v)}`;

/** 0% mas com gasto real → "<1" (evita "Outros 0%", que parece bug) */
const pctTxt = (c: { pct: number; valor: number }) => (c.pct === 0 && c.valor > 0 ? '<1' : String(c.pct));

export function CotaBreakdown({
  resumo,
  sigla,
}: {
  resumo: NonNullable<Politician['cotaResumo']>;
  sigla: 'CEAP' | 'CEAPS';
}) {
  // resumo.categorias é a lista COMPLETA; dobra em top-5 + "Outros" só p/ exibição
  const cats = dobrarCategorias(resumo.categorias, 5) as typeof resumo.categorias;
  if (!cats.length || resumo.total <= 0) return null;
  const n = cats.length;
  // maior categoria = tom mais claro (mais dourado); menores escurecem em degrau
  const cor = (i: number) => rampColor(n === 1 ? 1 : 1 - i / (n - 1));
  const resumoAria = cats.map((c) => `${c.categoria} ${pctTxt(c)}%`).join(', ');

  return (
    <div className="panel cota-panel">
      <h3>🪙 Onde foi a cota</h3>
      <p className="sub">
        {fmtReais(resumo.total)} de cota ({sigla}) no mandato — para onde a verba foi
      </p>
      <div className="cota-bar" role="img" aria-label={`Distribuição da cota: ${resumoAria}`}>
        {cats.map((c, i) => (
          <i
            key={c.categoria}
            className="cota-seg"
            style={{ width: `${c.pct}%`, background: cor(i) }}
            title={`${c.categoria}: ${fmtReais(c.valor)} (${pctTxt(c)}%)`}
          />
        ))}
      </div>
      <div className="cota-legend">
        {cats.map((c, i) => (
          <span key={c.categoria} className="cota-leg" title={fmtReais(c.valor)}>
            <i style={{ background: cor(i) }} />
            {c.categoria} <b>{pctTxt(c)}%</b>
          </span>
        ))}
      </div>
      {resumo.fornecedor && (
        <p className="cota-forn">
          Maior fornecedor:{' '}
          {resumo.fornecedor.pessoaFisica ? (
            // pessoa física: o que foi contratado, não quem é. Ver `ehCpf` em cota.mjs —
            // nomear quem não é agente público não acrescenta nada ao que o painel mede.
            <>
              <b>pessoa física</b> ({resumo.fornecedor.nome.toLowerCase()})
            </>
          ) : (
            <b>{resumo.fornecedor.nome}</b>
          )}{' '}
          — {fmtReais(resumo.fornecedor.valor)} ({resumo.fornecedor.pct}% da cota)
          {resumo.fornecedor.pessoaFisica && (
            <span className="cota-forn-nota">
              Fornecedor pessoa física — em geral o locador do escritório ou um prestador de serviço do
              gabinete. Não publicamos o nome: a pessoa não é agente público, e o que este painel informa
              é a concentração do gasto, que o percentual já diz. O lançamento é público no {sigla}.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
