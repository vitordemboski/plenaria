import type { Insights } from '@/lib/types';

/**
 * "Empresas que mais receberam da cota" + "Concentração do mercado da cota".
 *
 * INFORMATIVO, e o painel é desenhado para NÃO insinuar captura: a maior empresa
 * fica com ~1,3% de um universo de 43 mil CNPJs, e é o bloco de concentração que
 * diz isso em voz alta. Sem esse segundo bloco, um top 15 solto convida o leitor a
 * concluir o oposto do que o dado mostra.
 *
 * Duas regras que o rodapé cumpre e que não podem sair daqui:
 *  • o % é fatia do universo COM CNPJ, não do total da cota — 16% da verba não
 *    identifica pessoa jurídica (SIGEPA) ou saiu para pessoa física (CPF, que nunca
 *    entra em ranking público);
 *  • "Cia Aérea - TAM" e "CELULAR FUNCIONAL" são rótulos de faturamento da própria
 *    Câmara, não uma contratação escolhida pelo parlamentar.
 */

type Dados = NonNullable<Insights['fornecedoresCota']>;

const fmtMi = (mi: number) => `R$ ${mi.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
/** R$ mil → "R$ 9,4 mi" acima de mil, senão "R$ 740 mil" */
const fmtMilReais = (mil: number) => (mil >= 1000 ? fmtMi(mil / 1000) : `R$ ${mil.toLocaleString('pt-BR')} mil`);
const fmtPct = (pct: number) => `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * A Câmara lança o próprio faturamento (celular funcional, passagem SIGEPA) com um
 * documento-carimbo de zeros. Exibir "CNPJ 00.000.000/0000-01" daria ao leitor um
 * identificador que não existe em registro nenhum — melhor dizer o que é.
 */
const semCnpjReal = (cnpj: string) => cnpj.startsWith('00.000.000');

export function FornecedoresCota({ dados }: { dados: Dados }) {
  if (!dados.empresas.length) return null;
  const max = dados.empresas[0].valorMil || 1;

  return (
    <>
      <div className="panel">
        <h3>🏢 Empresas que mais receberam da cota</h3>
        <div className="sub">
          Quem está do outro lado da nota fiscal: fornecedores agregados por <b>CNPJ</b>, somando
          Câmara e Senado no mandato. Informativo e descritivo — receber da cota é prestar serviço
          contratado, não indício de irregularidade.
        </div>
        <div className="gsp">
          {dados.empresas.map((e, i) => (
            <div className="gsp-row" key={e.cnpj}>
              <div className="gsp-head">
                <span className="gsp-pos">{i + 1}</span>
                <b className="gsp-sigla forn-nome">{e.nome}</b>
                <span className="gsp-val">{fmtMilReais(e.valorMil)}</span>
              </div>
              <div className="gsp-bar">
                <i style={{ width: `${Math.max((e.valorMil / max) * 100, 1.5)}%` }} />
              </div>
              <div className="gsp-meta">
                {fmtPct(e.pct)} do universo · {e.nParl} {e.nParl === 1 ? 'parlamentar' : 'parlamentares'} ·{' '}
                {semCnpjReal(e.cnpj) ? 'faturamento da própria Câmara (documento-carimbo na fonte)' : `CNPJ ${e.cnpj}`}
              </div>
            </div>
          ))}
        </div>
        <div className="forn-nota">
          Universo: {fmtMi(dados.totalMi)} pagos a {dados.nEmpresas.toLocaleString('pt-BR')} CNPJs distintos.
          Ficam fora {fmtMi(dados.semCnpjMi)} — as passagens do SIGEPA, que a Câmara fatura sem
          identificar pessoa jurídica, e os lançamentos em CPF, que são pessoas físicas e não entram
          em ranking público. O percentual acima é fatia desse universo, não do total da cota.
          &quot;Cia Aérea&quot; e &quot;Celular funcional&quot; são rótulos de faturamento da própria
          Câmara, não uma empresa escolhida pelo parlamentar.
        </div>
      </div>

      {dados.concentracao.length > 0 && (
        <div className="panel">
          <h3>📊 Concentração do mercado da cota</h3>
          <div className="sub">
            Quanto do universo com CNPJ cabe às maiores empresas. É a leitura que impede a inferência
            errada: o mercado da cota é <b>pulverizado</b> — nenhuma empresa chega a 2%.
          </div>
          <div className="conc-grid">
            {dados.concentracao.map((c) => (
              <div key={c.top}>
                <b>{c.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b>
                <small>{c.top === 1 ? 'a maior empresa' : `as ${c.top} maiores`}</small>
              </div>
            ))}
          </div>
          <div className="forn-nota">
            Acumulado sobre os {fmtMi(dados.totalMi)} pagos a {dados.nEmpresas.toLocaleString('pt-BR')} CNPJs.
          </div>
        </div>
      )}
    </>
  );
}
