import { rampColor } from '@/lib/ramp';
import { REPO_URL } from '@/lib/site';
import type { AgregadoTemas, LinhaAssinatura } from '@/lib/prioridades';
import type { Analise } from '@/lib/types';

/**
 * "No que trabalha" — distribuição temática das proposições de autoria.
 * Server Components puros: recebem os agregados já computados no build.
 *
 * INFORMATIVO. Não pontua no Poder, não gera Tier, não gera título — e nenhuma
 * cor julga o assunto (legislar sobre Defesa não é melhor nem pior que legislar
 * sobre Saúde). A rampa dourada codifica MAGNITUDE, como na barra da cota; não
 * há paleta divergente de bom/ruim em lugar nenhum desta feature.
 */

const pct1 = (v: number) => v.toFixed(1).replace('.', ',');
const nf = new Intl.NumberFormat('pt-BR');

/** a frase que impede a barra de ser lida como fatia de um bolo de 100% */
function NotaDoDenominador({ porProposicao, nSemTema }: { porProposicao: number; nSemTema: number }) {
  return (
    <p className="prio-nota">
      Uma proposição pode tratar de mais de um tema ({pct1(porProposicao)} em média), então
      cada linha é uma conta própria e <b>os percentuais não somam 100%</b>.
      {nSemTema > 0 && (
        <> {nf.format(nSemTema)} {nSemTema === 1 ? 'proposição ficou' : 'proposições ficaram'} sem
        classificação temática na fonte oficial.</>
      )}
    </p>
  );
}

/**
 * Perfil absoluto: o que a pessoa (ou a bancada) de fato apresentou.
 * Cada linha carrega o próprio denominador — é o que torna a afirmação literal
 * ("41 das 120 proposições tocam Saúde") em vez de uma fatia sem referência.
 */
export function Prioridades({
  agregado, titulo = '🗂️ No que trabalha', sub, limite = 8,
}: {
  // aceita tanto o agregado de uma bancada quanto o `prioridades` de um único
  // parlamentar: o percentual é derivado aqui, então quem chama nunca precisa
  // recalcular a mesma divisão (e nunca pode errá-la de um jeito diferente)
  agregado: Pick<AgregadoTemas, 'nComTema' | 'nSemTema' | 'temasPorProposicao'> & {
    temas: { tema: string; n: number }[];
  };
  titulo?: string;
  sub?: string;
  limite?: number;
}) {
  const { temas, nComTema } = agregado;
  if (!nComTema || !temas.length) return null;
  const lista = temas.slice(0, limite).map((t) => ({ ...t, pct: (t.n / nComTema) * 100 }));
  const maior = lista[0].pct || 1;
  const n = lista.length;

  return (
    <div className="panel prio-panel">
      <h3>{titulo}</h3>
      <p className="sub">
        {sub ?? <>{nf.format(nComTema)} proposições de autoria com tema oficial (PL, PLP, PEC, PDL)</>}
      </p>
      <ul className="prio-list">
        {lista.map((t, i) => (
          <li key={t.tema} className="prio-row">
            <span className="prio-tema">{t.tema}</span>
            <span className="prio-track">
              {/* largura relativa ao MAIOR tema, não a 100: com percentuais que não
                  somam 100 e um topo de 34%, barras sobre 100 ficariam todas curtas
                  e a comparação entre elas — que é o ponto — sumiria */}
              <i
                className="prio-fill"
                style={{ width: `${Math.max((t.pct / maior) * 100, 1.5)}%`, background: rampColor(n === 1 ? 1 : 1 - i / (n - 1)) }}
              />
            </span>
            <span className="prio-num">
              <b>{Math.round(t.pct)}%</b>
              <small>{nf.format(t.n)} de {nf.format(nComTema)}</small>
            </span>
          </li>
        ))}
      </ul>
      <NotaDoDenominador porProposicao={agregado.temasPorProposicao} nSemTema={agregado.nSemTema} />
    </div>
  );
}

/**
 * Assinatura: onde a bancada desvia do Congresso, em pontos percentuais.
 *
 * Existe porque o perfil ABSOLUTO não distingue guilda nenhuma — "Administração
 * Pública" e "Direitos Humanos e Minorias" dominam quase todas as bancadas
 * porque dominam o Congresso. O desvio é comparação, não juízo: o número
 * nacional vai ao lado justamente para o leitor ver contra o que se compara.
 */
export function AssinaturaDaGuilda({
  linhas, sigla, limite = 5,
}: {
  linhas: LinhaAssinatura[];
  sigla: string;
  limite?: number;
}) {
  const top = linhas.slice(0, limite).filter((l) => l.desvio > 0);
  if (!top.length) return null;
  const maior = top[0].desvio || 1;

  return (
    <div className="panel prio-panel prio-assinatura">
      <h3>🧭 Assinatura da guilda</h3>
      <p className="sub">
        Os temas em que o {sigla} legisla <b>mais que o Congresso</b> — a mesma conta para os dois lados,
        em pontos percentuais
      </p>
      <ul className="prio-list">
        {top.map((l) => (
          <li key={l.tema} className="prio-row prio-row-asn">
            <span className="prio-tema">{l.tema}</span>
            <span className="prio-track">
              <i className="prio-fill prio-fill-asn" style={{ width: `${Math.max((l.desvio / maior) * 100, 2)}%` }} />
            </span>
            <span className="prio-num">
              <b>+{pct1(l.desvio)}</b>
              <small>{Math.round(l.pct)}% aqui · {Math.round(l.pctNacional)}% no Congresso</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="prio-nota">
        Comparação, não avaliação: nenhum tema vale mais que outro aqui. O eixo diz apenas em que esta
        bancada se distingue da média das duas casas.
      </p>
    </div>
  );
}

/**
 * O parágrafo de leitura escrito por IA.
 *
 * Nunca aparece sozinho — é sempre vizinho das barras que ele descreve, e só é
 * renderizado quando o `fonteHash` bate (ver scripts/lib/analises.mjs), então o
 * texto na tela sempre fala dos números na tela.
 *
 * O selo é obrigatório: transparência sobre a origem do texto é o motivo desta
 * camada existir num projeto aberto que fala de gente com nome e sobrenome.
 */
export function AnaliseIA({ analise }: { analise: Analise | null }) {
  if (!analise) return null;
  return (
    <div className="panel prio-ia">
      <div className="prio-ia-selo">
        <span className="prio-ia-tag">🤖 Análise gerada por IA</span>
        <span className="prio-ia-meta">
          {analise.modelo} · {analise.geradoEm}
          {analise.revisadoPor && <> · revisada por {analise.revisadoPor}</>}
        </span>
      </div>
      <p className="prio-ia-texto">{analise.texto}</p>
      <p className="prio-nota">
        Texto interpretativo, e por isso separado do resto do site: <b>não pontua no Poder, não muda
        o Tier e não gera título</b>. Os números acima são a classificação temática oficial das duas
        casas — a IA leu as ementas e os rótulos, não produziu quantidade nenhuma.{' '}
        <a href={`${REPO_URL}/blob/main/docs/prompts/prioridades-${analise.promptVersao}.md`} target="_blank" rel="noopener">
          ver o prompt ({analise.promptVersao})
        </a>
      </p>
    </div>
  );
}
