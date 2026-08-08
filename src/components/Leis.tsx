import { PoliticianLink } from '@/components/PoliticianLink';
import { casaLabel } from '@/lib/data';
import { rampColor } from '@/lib/ramp';
import type { AgregadoLeis, Casa, Lei, LinhaComparativo, RankPessoa } from '@/lib/types';

/**
 * "Virou lei" — o DESFECHO da produção legislativa, não a intenção.
 *
 * O resto do site mede o que foi apresentado (Ataque), o que andou (Eficiência) e
 * sobre o que foi (Prioridades). Este painel mostra o que chegou ao fim: cada
 * proposição de autoria principal que foi transformada em norma jurídica, com o
 * nome da norma, a ementa e o link para a página oficial.
 *
 * Três regras que sustentam o painel:
 *
 * 1. **Nada é estimado.** O nº da norma ("Lei 15.172/2025") é omitido quando a
 *    fonte não o publica — a linha cai para a identificação do projeto, que sempre
 *    existe. Idem a data. Ver `scripts/lib/norma.mjs`.
 * 2. **Não pontua duas vezes.** A contagem já entra na Eficiência como bônus; aqui
 *    ela só é EXIBIDA. O painel não cria atributo, tier nem título.
 * 3. **O recorte é dito em voz alta.** Só contam proposições numeradas nesta
 *    legislatura — um projeto de 2019 sancionado agora não aparece, e omitir isso
 *    faria a lista parecer o currículo completo do parlamentar.
 */

const nf = new Intl.NumberFormat('pt-BR');

/** acima disto o feed conta os autores em vez de nomeá-los (ver LinhaLei) */
const MAX_AUTORES = 3;

/** ISO → "12 dez 2024"; sem data, nada (nunca "data desconhecida", que é ruído) */
function dataCurta(iso?: string) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-');
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mes = MES[Number(m) - 1];
  return mes ? `${Number(d)} ${mes} ${a}` : a;
}

function LinhaLei({ lei, autores, casa }: { lei: Lei; autores?: RankPessoa[]; casa?: Casa }) {
  const data = dataCurta(lei.data);
  return (
    <li className="lei-row">
      <div className="lei-head">
        {/* a NORMA é o destaque: "Lei 15.172/2025" é o nome pelo qual a coisa
            existe no mundo. Sem ela, o destaque é o projeto — e a linha fica
            visivelmente mais modesta, que é a leitura correta. */}
        <span className={`lei-norma${lei.norma ? '' : ' sem'}`}>{lei.norma ?? lei.ref}</span>
        {lei.norma && <span className="lei-ref">de {lei.ref}</span>}
        {data && <span className="lei-data">{data}</span>}
      </div>
      <p className="lei-ementa">{lei.ementa}</p>
      <div className="lei-foot">
        {/* Autoria coletiva é real e frequente: uma matéria chega a ter 59 autores
            principais. Nomear todos vira parede de nomes que soterra a ementa, e
            nomear "os 3 primeiros" seria crédito arbitrário — a ordem da fonte não
            é hierarquia. Acima do limite, o painel conta em vez de escolher, e o
            link leva à lista oficial completa. */}
        {autores && (autores.length > MAX_AUTORES
          ? <span className="lei-coletiva">autoria coletiva — {autores.length} parlamentares em exercício</span>
          : autores.map((a) => (
            <PoliticianLink key={a.slug} slug={a.slug} className="lei-autor">
              <b>{a.nome}</b> <small>{casaLabel(a.casa, true)} · {a.uf} · {a.partido}</small>
            </PoliticianLink>
          )))}
        <a className="lei-fonte" href={lei.url} target="_blank" rel="noopener">
          {/* "na Câmara dos Deputados" × "no Senado Federal" — mesmo idioma dos
              tooltips de atributo, que já resolvem o artigo pela casa */}
          texto e tramitação {casa ? `${casa === 'camara' ? 'na' : 'no'} ${casaLabel(casa)}` : 'na fonte oficial'} ↗
        </a>
      </div>
    </li>
  );
}

/** O painel da ficha do parlamentar e da guilda. */
export function Leis({ leis, casa, titulo = '📜 Virou lei', sub }: {
  leis: Lei[]; casa?: Casa; titulo?: string; sub?: React.ReactNode;
}) {
  if (!leis.length) return null;
  const comNorma = leis.filter((l) => l.norma).length;
  return (
    <div className="panel lei-panel">
      <h3>{titulo}</h3>
      <p className="sub">
        {sub ?? (
          <>
            {nf.format(leis.length)} {leis.length === 1 ? 'proposição de autoria principal' : 'proposições de autoria principal'}{' '}
            {leis.length === 1 ? 'foi transformada' : 'foram transformadas'} em norma jurídica
          </>
        )}
      </p>
      <ul className="lei-list">
        {leis.map((l) => <LinhaLei key={l.url} lei={l} casa={casa} />)}
      </ul>
      <p className="prio-nota">
        Norma jurídica é o desfecho de um projeto: lei ordinária, lei complementar, emenda
        constitucional ou decreto legislativo — o tipo vai no nome de cada linha.{' '}
        {comNorma < leis.length && (
          <>
            {comNorma === 0 ? 'Nenhuma' : `${nf.format(leis.length - comNorma)} de ${nf.format(leis.length)}`}{' '}
            {leis.length - comNorma === 1 ? 'aparece' : 'aparecem'} pela identificação do projeto:
            a casa não publica o número da norma em campo estruturado, e nós não o deduzimos.{' '}
          </>
        )}
        Contam só as proposições numeradas nesta legislatura, o mesmo recorte dos atributos.
      </p>
    </div>
  );
}

/** O feed dos Insights: as normas mais recentes do Congresso, com quem as assinou. */
export function LeisRecentes({ recentes }: { recentes?: (Lei & { autores: RankPessoa[] })[] }) {
  // opcional de propósito: um build sobre dados de antes desta feature tem
  // `insights.leis` sem o feed — a seção some, o site não quebra
  if (!recentes?.length) return null;
  return (
    <div className="panel lei-panel">
      <h3>🆕 As últimas que viraram lei</h3>
      <p className="sub">
        normas mais recentes cuja proposição tem autoria principal de alguém em exercício — o feed
        que transforma a contagem em nome, ementa e fonte
      </p>
      <ul className="lei-list">
        {recentes.map((l) => <LinhaLei key={l.url} lei={l} autores={l.autores} />)}
      </ul>
      <p className="prio-nota">
        Autoria principal do projeto de origem. Uma lei tem muitas mãos — relatoria, emendas,
        articulação — e esta lista credita só a assinatura que a fonte oficial registra como
        proponente. Quem está fora do ranking (mandato parcial, presidência da Casa) aparece aqui:
        aqui não se compara ninguém, e uma lei sancionada não deixa de existir.
      </p>
    </div>
  );
}

/**
 * "O que vira lei, por tema" — o perfil temático das NORMAS.
 *
 * A classificação é OFICIAL das duas casas, a mesma das Prioridades: a Câmara
 * publica os temas em bulk, o Senado as classificações do processo. Nenhuma IA
 * agrupa nada aqui — trocar dado oficial com 100% de cobertura por juízo de
 * modelo tornaria o agrupamento não-auditável e daria segmentos diferentes a
 * cada execução. Onde a IA entra é no parágrafo de leitura, marcado como tal.
 *
 * Herda as regras das Prioridades: contagem CHEIA (percentuais não somam 100%),
 * rampa dourada codificando MAGNITUDE e nenhuma cor de bom/ruim — aprovar sobre
 * Defesa não é melhor nem pior que aprovar sobre Saúde.
 */
export function LeisPorTema({ agregado, comparativo, titulo = '📊 O que vira lei, por tema', sub, limite = 10 }: {
  agregado: AgregadoLeis;
  /** ausente na guilda: com poucas normas a taxa por tema seria ruído */
  comparativo?: LinhaComparativo[];
  titulo?: string;
  sub?: React.ReactNode;
  limite?: number;
}) {
  if (!agregado?.nComTema || !agregado.temas.length) return null;
  const porTema = new Map(comparativo?.map((c) => [c.tema, c]));
  const lista = agregado.temas.slice(0, limite).map((t) => ({ ...t, pct: (t.n / agregado.nComTema) * 100 }));
  const maior = lista[0].pct || 1;
  const n = lista.length;

  return (
    <div className="panel prio-panel">
      <h3>{titulo}</h3>
      <p className="sub">
        {sub ?? <>{nf.format(agregado.nLeis)} normas, pela classificação temática oficial das duas casas</>}
      </p>
      {/* Cabeçalho de COLUNA, não rótulo repetido em miniatura por linha: as duas
          porcentagens têm denominadores diferentes (o total de normas × as propostas
          daquele tema) e, coladas numa micro-linha, se leem como a mesma grandeza.
          Nomear cada uma UMA vez, no topo da coluna, é o que desfaz a ambiguidade. */}
      <ul className={`prio-list leis-tema${comparativo ? ' com-taxa' : ''}`}>
        {comparativo && (
          <li className="leis-tema-head" aria-hidden>
            <span /><span />
            <span>normas</span>
            <span>virou lei</span>
          </li>
        )}
        {lista.map((t, i) => {
          const c = porTema.get(t.tema);
          return (
            <li key={t.tema} className="prio-row leis-tema-row">
              <span className="prio-tema">{t.tema}</span>
              <span className="prio-track">
                <i className="prio-fill" style={{ width: `${Math.max((t.pct / maior) * 100, 1.5)}%`, background: rampColor(n === 1 ? 1 : 1 - i / (n - 1)) }} />
              </span>
              <span className="prio-num">
                <b>{nf.format(t.n)}</b>
                <small>{Math.round(t.pct)}% do total</small>
              </span>
              {comparativo && (
                <span className="prio-num leis-conv">
                  {c?.taxa != null ? (
                    <>
                      <b className="lei-taxa">{c.taxa.toFixed(1).replace('.', ',')}%</b>
                      <small>de {nf.format(c.nApresentadas)} propostas</small>
                    </>
                  ) : (
                    <>
                      <b className="lei-taxa vazio" title="poucas normas neste tema para uma taxa confiável">—</b>
                      <small>{c?.nApresentadas ? `de ${nf.format(c.nApresentadas)} propostas` : ''}</small>
                    </>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="prio-nota">
        As duas colunas respondem perguntas diferentes. <b>Normas</b> é composição — quanto do que
        foi aprovado toca aquele tema; como uma norma pode tratar de mais de um, cada linha é uma
        conta própria e <b>os percentuais não somam 100%</b>. <b>Virou lei</b> é conversão — das
        proposições apresentadas <i>naquele tema</i>, quantas chegaram ao fim.
        {agregado.nSemTema > 0 && <> {nf.format(agregado.nSemTema)} {agregado.nSemTema === 1 ? 'norma ficou' : 'normas ficaram'} sem classificação na fonte.</>}
        {comparativo && (
          <> A conversão aparece como &ldquo;—&rdquo; quando o tema tem poucas normas: com 2 leis,
          &ldquo;50% de aproveitamento&rdquo; seria ruído apresentado como fato.</>
        )}{' '}
        Classificação oficial das duas casas, não nossa e não de IA — o mapa dos dois vocabulários
        está em <a href="/como-calculamos/#prioridades">como calculamos</a>.
      </p>
    </div>
  );
}

/**
 * As normas SIMBÓLICAS — título de "Capital Nacional", data comemorativa,
 * inscrição no Livro dos Heróis da Pátria.
 *
 * É o único recorte do site em que o leitor avalia o CONTEÚDO do que foi
 * aprovado, e não o volume. O rótulo é descritivo de propósito: a plataforma
 * conta, quem julga se é pouco ou demais é quem lê. "Lei inútil" seria opinião
 * nossa — o mesmo motivo pelo qual "Safra Eleitoral" virou "Produção
 * Concentrada". O número de 1 em cada 3 sustenta o argumento melhor que o
 * adjetivo, e por ser classificação oficial ele é contestável na fonte.
 */
export function LeisSimbolicas({ s }: { s: { n: number; exclusivas: number; total: number; pct: number } }) {
  if (!s?.total) return null;
  return (
    <div className="panel lei-simb">
      <h3>🏅 Homenagens, títulos e datas</h3>
      <div className="lei-simb-num">
        <b>{nf.format(s.n)}</b>
        <span>de {nf.format(s.total)} normas <i>({Math.round(s.pct)}%)</i></span>
      </div>
      <p className="sub" style={{ marginTop: 4 }}>
        Normas cuja classificação oficial é <b>Homenagens e Datas</b> — conferir a um município o
        título de &ldquo;Capital Nacional de X&rdquo;, instituir um dia ou semana nacional, inscrever
        um nome no Livro dos Heróis da Pátria, reconhecer uma manifestação cultural.{' '}
        <b>{nf.format(s.exclusivas)}</b> {s.exclusivas === 1 ? 'trata' : 'tratam'} exclusivamente
        disso, sem nenhum outro tema junto.
      </p>
      <p className="prio-nota">
        O rótulo é da fonte, não nosso: &ldquo;Homenagens e Datas Comemorativas&rdquo; na Câmara,
        &ldquo;Honorífico&rdquo; no Senado. A plataforma <b>conta</b> — se isso é pouco ou demais para
        o tempo de plenário do Congresso é juízo de quem lê, e a classificação de cada norma pode ser
        conferida na página oficial dela, linkada abaixo.
      </p>
    </div>
  );
}
