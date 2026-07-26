import { AVAILABLE_STAT_META, politicians, titleDefs, meta, TIER_LABEL, TIER_ORDER } from '@/lib/data';
import { JsonLd } from '@/components/JsonLd';
import { datasetLd } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';
import { REPO_URL } from '@/lib/site';

export const metadata = pageMeta({
  title: 'Como calculamos',
  description: 'A fórmula do Poder aberta atributo por atributo: de onde vem cada número, como ele é normalizado dentro da casa e qual regra factual dispara cada título.',
  path: '/como-calculamos/',
});

/**
 * Página de metodologia — o escudo reputacional do produto.
 * A fórmula é pública, versionada junto do código e explicada em linguagem
 * simples. Toda regra de título exibida aqui é a MESMA usada no gerador.
 */
export default function MethodologyPage() {
  // fórmula montada dos MESMOS pesos do meta.json — nunca hardcodar aqui.
  // Atributos informativos (ex.: Influência) NÃO entram no Poder → fora da fórmula.
  const statsQuePontuam = AVAILABLE_STAT_META.filter((s) => !s.informativo);
  const statsInformativos = AVAILABLE_STAT_META.filter((s) => s.informativo);
  const temFiscalizacao = statsInformativos.some((s) => s.key === 'fiscalizacao');
  const temAlinhamento = statsInformativos.some((s) => s.key === 'alinhamento');
  const temTecnica = AVAILABLE_STAT_META.some((s) => s.key === 'tecnica');
  // "A, B e C" em vez de "A e B e C" quando há mais de dois informativos.
  const joinPt = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  const formula = statsQuePontuam
    .map((s) => `${(s.weight / 100).toFixed(2)}×${s.label}`)
    .join(' + ');
  const pesoProducao = statsQuePontuam
    .filter((s) => ['ataque', 'eficiencia', 'tecnica'].includes(s.key))
    .reduce((t, s) => t + s.weight, 0);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto' }}>
      <JsonLd data={datasetLd(politicians.length)} />
      <div className="page-title">
        <h1>COMO CALCULAMOS</h1>
        <p>Fórmula pública, auditável e versionada</p>
      </div>

      <div className="panel detail-block">
        <h3>1. Atributos (0–100)</h3>
        <p>
          Cada atributo é o <span className="key">percentil do parlamentar dentro da própria casa</span> —
          deputados só são comparados com deputados; senadores, com senadores.
        </p>
        <p>
          <span className="key">Economia, Stamina e Técnica são as exceções</span>, todas ancoradas na
          mediana da casa (= 50). Percentil mede colocação na fila e descarta a magnitude: em dinheiro,
          quem gastava o dobro da cota de um colega frugal caía só um punhado de pontos, porque quase toda
          a casa gasta perto do teto. Na presença o efeito era outro — a inclinação seguia a densidade
          local de colegas, e no Senado, onde a mediana comparece a 92% das votações, o mesmo 1 ponto
          percentual valia de 0 a 7,5 pontos conforme o senador caísse num aglomerado ou num vazio. Na
          Técnica o percentil saturava no topo: quem fazia o dobro do trabalho sobre texto de um colega
          já bem colocado ganhava 1 ponto. Ela usa escala <span className="key">logarítmica</span>, onde
          cada dobro de trabalho vale o mesmo incremento em qualquer altura da escala. O{' '}
          <span className="key">Ataque</span> segue percentil de propósito: em log, a magnitude do volume
          bruto voltaria a mandar, desfazendo o motivo de ele pesar menos que a Eficiência.
        </p>
        <div className="legend-list">
          {AVAILABLE_STAT_META.map((s) => (
            <div key={s.key}>
              <b>{s.icon} {s.label}</b> — {s.desc} · {s.informativo ? 'informativo (não pontua no Poder)' : `peso ${s.weight}%`}
            </div>
          ))}
        </div>
        {statsInformativos.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Por que {joinPt(statsInformativos.map((s) => s.label))}{' '}
            <span className="key">não pontuam</span>: <span className="key">Influência</span> mediria
            popularidade, não trabalho — engajamento puro não compra Tier (rende o título &quot;Blogueiro
            de Plenário&quot;). <span className="key">Comando</span> (comissões e presidências) é
            distribuído por tamanho de bancada e senioridade, não por mérito individual — pontuá-lo
            enviesaria a nota a favor de veteranos e partidos grandes, contra estreantes.
            {temFiscalizacao && (
              <> <span className="key">Fiscalização</span> fica de fora porque fiscalizar o Executivo é,
              na prática, fazer oposição a ele: na base atual, a oposição protocola em média{' '}
              <b>192 atos</b> por deputado contra <b>20</b> da base do governo (extremos: NOVO 306, PT
              3). Se pontuasse, o Poder estaria premiando posição política travestida de entrega
              legislativa — o ranking passaria a dizer &quot;a oposição trabalha mais&quot;, que é uma
              afirmação política, não factual.</>
            )}
            {temAlinhamento && (
              <> <span className="key">Alinhamento</span> fica de fora pelo mesmo motivo: votar com o
              Governo ou contra ele é posição política, não mérito nem demérito — pontuar isso faria o
              Poder recompensar um lado do espectro.</>
            )}
            {' '}Todos são exibidos porque informam — aparecem no card e nos títulos — mas ficam fora do
            Poder.
          </p>
        )}
        {temFiscalizacao && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            O que conta como <span className="key">Fiscalização</span>: RIC (requerimento de informação a
            ministro), PFC (proposta de fiscalização e controle) e requerimentos de convocação de
            ministro de Estado, no Plenário ou na Comissão — allowlist explícita pelo rótulo oficial da
            proposição, nunca regex em texto livre. O tipo genérico &quot;Requerimento&quot; sozinho{' '}
            <span className="key">não</span> entra: ele mistura fiscalização de verdade com voto de
            regozijo ou louvor (2.553 só em 2025), moção, sessão solene e requerimento de audiência
            pública. Contar o tipo inteiro transformaria voto de elogio em trabalho de fiscalização —
            por isso a allowlist exclui esses subtipos de propósito.
          </p>
        )}
        {temTecnica && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Nota sobre a <span className="key">Técnica</span>: mede trabalho técnico sobre o texto alheio
            — relatorias designadas em proposições relevantes mais emendas de autoria (EMC = na
            comissão, EMP = de plenário, EMR = de relator). O Senado não expõe emendas por autor nos
            Dados Abertos, então lá o atributo conta só relatorias; o peso do atributo não muda por isso.
            A relatoria é contada em <span className="key">qualquer ponto da tramitação</span>, não só
            onde o parlamentar é o relator do momento: uma proposição passa por várias comissões, cada
            uma com o seu relator, e considerar apenas o último apagava o trabalho de quem relatou antes
            — desigualmente, porque quem relata cedo, na comissão de mérito, é justamente quem some.
          </p>
        )}
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
          Nota sobre a <span className="key">Economia</span>: o que se compara é o{' '}
          <span className="key">gasto mensal médio durante os meses em exercício</span>, não o total da
          legislatura — comparar totais faria quem assumiu tarde (ou passou anos licenciado) parecer
          frugal só por ter estado menos tempo sentado, o mesmo princípio da taxa de comparecimento da
          Stamina. Ela premia usar pouco da cota, então quem quase não a aciona pontua alto — seja por
          frugalidade real, seja por baixa atividade. Isso é
          intencional e tem impacto limitado (peso {AVAILABLE_STAT_META.find((s) => s.key === 'economia')?.weight ?? 10}%):
          quem falta e não trabalha já afunda na Stamina e no Ataque, que a Economia sozinha não resgata.
          A carta de cada parlamentar traz ainda a <span className="key">quebra da cota por categoria</span>{' '}
          (para onde a verba foi: escritório, passagens, combustível, divulgação…) e o maior fornecedor —
          tudo <span className="key">informativo</span>: descreve o gasto, mas não altera a nota (que é só o
          gasto mensal médio). Os valores são líquidos (estornos abatidos), somando o mesmo total da Economia.
        </p>
      </div>

      <div className="panel detail-block">
        <h3>2. Poder — a nota geral (0–100)</h3>
        <p style={{ fontFamily: 'var(--font-mono)', background: '#0c1018', padding: 14, borderRadius: 10, margin: '10px 0', fontSize: 12 }}>
          Poder = {formula}
        </p>
        <p>
          Produção legislativa real domina ({pesoProducao}%).{statsInformativos.some((s) => s.key === 'influencia') && (
            <> A <span className="key">Influência</span> (Instagram) é <span className="key">informativa</span>:
            aparece no card e nos títulos, mas <span className="key">não pontua no Poder</span> — alcance social não é
            entrega legislativa, e contá-lo penalizava quem trabalha muito e tem pouca rede (enquanto quem nem tem
            Instagram ficava neutro). Engajamento puro segue sem virar Tier e ainda rende o título &quot;Blogueiro de
            Plenário&quot;; o oposto — entrega alta com alcance modesto — vira &quot;Operário Silencioso&quot;.</>
          )} Quem não tem um atributo que pontua sai da conta e os pesos são{' '}
          <span className="key">renormalizados</span> — ninguém é punido por falta de dado.{meta.pesosPorCasa?.senado && !meta.pesosPorCasa.senado.eficiencia && (
            <> No <span className="key">Senado</span> não há Eficiência (a casa não expõe &quot;norma gerada&quot; por
            autoria), então os pesos da casa são redistribuídos:{' '}
            {AVAILABLE_STAT_META
              .filter((s) => meta.pesosPorCasa!.senado[s.key])
              .map((s) => `${s.label} ${Math.round((meta.pesosPorCasa!.senado[s.key] ?? 0) * 100)}%`)
              .join(', ')}.</>
          )} Nada além dos atributos entra na conta: <span className="key">o Poder não tem penalidade
          externa</span> — mede o exercício do mandato, e só.
        </p>
      </div>

      <div className="panel detail-block" id="gates">
        <h3>3. Tiers e os gates do Rank S</h3>
        <div className="legend-list">
          {TIER_ORDER.map((t) => (
            <div key={t}><b>Tier {t}</b> — {TIER_LABEL[t]}</div>
          ))}
        </div>
        <p>
          Poder ≥ 85 <span className="key">não basta</span> para o Tier S: exigimos Stamina ≥ 70, Eficiência ≥ 60,{' '}
          <span className="key">nenhum atributo que pontua no vermelho</span> (qualquer um de Ataque, Stamina,
          Eficiência, Técnica ou Economia abaixo de 40 — o mesmo limiar que pinta a barra de vermelho na ficha),
          e nenhum título negativo ativo. Não dá para ser lendário com um atributo crítico.
          Quem falha num gate é exibido como Tier A com o selo &quot;S bloqueado por [motivo]&quot;.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          <span className="key">Câmara e Senado usam a mesma fórmula:</span> desde que a tramitação das matérias
          do Senado passou a ser lida, a casa tem os mesmos cinco atributos que pontuam e os mesmos pesos — o gate
          de Eficiência ≥ 60 vale para senador também. O que continua separado é o{' '}
          <span className="key">universo do percentil</span>: deputado só é comparado com deputado, senador com
          senador. As duas casas trabalham em escalas diferentes (o Senado fez 413 votações nominais na
          legislatura; a Câmara, milhares), então misturá-las numa régua só seria comparar coisas distintas.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          <span className="key">Mandato parcial fica fora do ranking:</span> quem esteve em exercício efetivo
          por menos de 12 meses no período — cerca de um ano dos ~41 da legislatura — tem amostra pequena
          demais para comparar com justiça. Isso cobre tanto <span className="key">posse recente</span>
          {' '}(suplente/efetivado empossado há pouco) quanto <span className="key">licença ou ministério
          prolongados</span> (parlamentar afastado no Executivo quase o mandato todo). Some da Tier List, das
          guildas e dos rankings, mas continua no site — página própria, buscável, com selo &quot;sem
          Tier&quot;. Critério 100% factual: soma dos períodos em exercício no histórico oficial da
          Câmara/Senado, robusto a licenças curtas — não confundir com gastar pouco ou faltar a votações.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          <span className="key">&quot;Fora do ranking&quot; vale em todo lugar, não só na Tier List:</span> quem
          está sem Tier não recebe título, não entra na média da guilda, não pode ser escalado na Batalha, e a
          imagem de compartilhamento da ficha sai <b>sem Tier e sem Poder</b> — com a faixa do motivo no lugar.
          O Poder de quem mal esteve em exercício é baixo porque falta mandato medido, não porque o trabalho foi
          ruim; deixá-lo circular numa imagem, longe desta explicação, seria publicar a conclusão errada.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          <span className="key">Presidência da Casa também fica fora do ranking:</span> quem preside a Câmara ou o
          Senado não vota (salvo desempate/secreto), nem autora ou relata como os demais — o cargo institucional
          suprime justamente a atividade que medimos (Stamina, Ataque, Técnica de uma vez). Comparar o presidente a
          um deputado de bancada seria injusto, então ele sai do ranking com selo &quot;sem Tier&quot;, pela mesma
          lógica do ministro licenciado. Detectado nos órgãos oficiais (Mesa Diretora, cargo Presidente); quem
          presidiu antes nesta legislatura entra por registro público.
        </p>
      </div>

      <div className="panel detail-block">
        <h3>4. Títulos dinâmicos</h3>
        <p>
          Concedidos automaticamente por regras factuais sobre os dados. Os selos <b>críticos</b> trazem, na
          carta do parlamentar, o <span className="key">número bruto que os disparou e a mediana da casa</span> —
          o gate é percentílico, mas o rótulo fala em termos absolutos, então o dado tem que estar à vista.
          Discorda de um número? <a href="/sobre/#correcoes">Peça correção</a>. As regras exatas:
        </p>
        <div className="legend-list">
          {titleDefs.map((t) => (
            <div key={t.slug}><b>{t.label}</b> — {t.regra}</div>
          ))}
        </div>
      </div>

      <div className="panel detail-block">
        <h3>5. De onde vêm os dados</h3>
        <p>
          <span className="key">Dados reais</span>, atualizados em {meta.updatedAt}. Fontes:
          Dados Abertos da <span className="key">Câmara</span> (autorias, votos nominais, normas geradas,
          relatorias, emendas, requerimentos de fiscalização, orientação das bancadas, cota CEAP, ficha
          civil, comissões) e do <span className="key">Senado</span> (autorias,
          votações, relatorias, CEAPS, comissões); <span className="key">Instagram</span> (contagem pública de
          seguidores dos perfis oficiais). Quem não tem um dado simplesmente fica sem o
          atributo, com os pesos renormalizados.
        </p>
      </div>

      <div className="panel detail-block">
        <h3>6. Auditar por conta própria</h3>
        <p>
          Nada nesta página é uma promessa que só nós podemos verificar: o{' '}
          <span className="key">código é aberto</span>, sob licença MIT, em{' '}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">github.com/vitordemboski/plenaria</a>.
          O mesmo programa que baixa os dados oficiais é o que calcula os atributos, os tiers e os títulos —
          e os pesos exibidos aqui saem do <span className="key">mesmo arquivo</span> usado no cálculo, não de
          um texto mantido à parte. Quem quiser conferir clona o repositório, roda a ingestão e compara.
        </p>
        <p>
          Achou divergência? <a href="/sobre/#correcoes">Escreva</a> ou abra uma issue no repositório. Erro de
          dado é corrigido e o que dele deriva — título, tier, ranking — cai junto.
        </p>
      </div>
    </main>
  );
}
