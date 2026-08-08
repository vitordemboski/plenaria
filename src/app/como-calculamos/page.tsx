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
  // vocabulário das prioridades sai do meta.json (o gerador o emite) — hardcodar a
  // lista aqui a faria divergir do mapa em silêncio no dia em que ele mudar
  const vocabTemas = meta.temas?.vocabulario ?? [];
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
          frugal só por ter estado menos tempo sentado, o mesmo princípio da taxa de voto registrado da
          Stamina. Ela premia usar pouco da cota, então quem quase não a aciona pontua alto — seja por
          frugalidade real, seja por baixa atividade. Isso é
          intencional e tem impacto limitado (peso {AVAILABLE_STAT_META.find((s) => s.key === 'economia')?.weight ?? 10}%):
          quem falta e não trabalha já afunda na Stamina e no Ataque, que a Economia sozinha não resgata.
          A carta de cada parlamentar traz ainda a <span className="key">quebra da cota por categoria</span>{' '}
          (para onde a verba foi: escritório, passagens, combustível, divulgação…) e o maior fornecedor —
          tudo <span className="key">informativo</span>: descreve o gasto, mas não altera a nota (que é só o
          gasto mensal médio). Os valores são líquidos (estornos abatidos), somando o mesmo total da Economia.
          O fornecedor é agregado pelo <span className="key">CNPJ</span>, não pelo nome: a fonte grava a razão
          social em texto livre, e um mesmo CNPJ aparece com dezenas de grafias — somar por nome subestimaria
          a fatia. Nos Insights, o mesmo dado vira o ranking nacional de empresas que receberam da cota
          (só CNPJ: lançamento em CPF é pessoa física e não entra em ranking público). Quando o maior
          fornecedor de um parlamentar é <span className="key">pessoa física</span> — em geral o locador
          do escritório ou um prestador de serviço do gabinete — publicamos o valor, o percentual e o que
          foi contratado, mas <span className="key">não o nome</span>: a pessoa não é agente público, e o
          que a informação mede é a concentração do gasto, que o percentual já diz. O lançamento segue
          público na fonte oficial.
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
          <span className="key">A Stamina conta voto registrado, não presença.</span> A distinção existe porque o
          Senado publica as duas coisas e a Câmara só uma: o dado da Câmara traz apenas o voto efetivo, enquanto o
          do Senado marca também quem estava no plenário e não votou (&ldquo;Presente – Não registrou voto&rdquo;,
          cerca de 15% dos registros, e 22% nas sabatinas). Se contássemos presença no Senado e voto na Câmara, a
          mesma palavra mediria coisas diferentes nas duas casas. <span className="key">Abstenção conta como
          voto</span> — é posição formal, e a Stamina mede se o parlamentar participou, nunca como ele votou. Na
          ficha do senador as duas taxas aparecem lado a lado.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }} id="licenciados">
          <span className="key">Quem está licenciado não aparece no site.</span> A lista de parlamentares vem
          das fontes oficiais das duas casas, e ambas publicam apenas quem está <b>em exercício</b> — a Câmara
          em <span className="key">/deputados</span>, o Senado na <span className="key">lista de parlamentares
          em exercício</span>. Um deputado que assume um ministério, uma secretaria ou uma licença longa sai
          dessa lista, e quem passa a constar na cadeira é o suplente que tomou posse — é ele que você encontra
          aqui. Não é juízo nosso sobre o afastamento: é a cadeira sendo ocupada por outra pessoa no período que
          medimos. Se você procurou um parlamentar conhecido e não o achou, esse costuma ser o motivo; a ficha
          dele volta quando ele reassume e a fonte oficial volta a listá-lo.{' '}
          <span className="key">O ausente é nomeado onde ele faria falta:</span> a página da guilda e a do
          estado listam quem está licenciado, com a data do afastamento. Só isso — <b>nunca o motivo</b>, porque
          nenhuma das duas casas o publica (a Câmara devolve o campo de status vazio até para quem assumiu
          ministério, e inventar o motivo contrariaria a regra de que todo rótulo aqui sai do dado). No Senado,
          a causa do afastamento é código oficial: só entram os de licença — falecimento, cassação e renúncia
          encerram o mandato e nunca aparecem como &quot;licenciado&quot;.
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

      <div className="panel detail-block" id="prioridades">
        <h3>5. Prioridades — &ldquo;no que trabalha&rdquo;</h3>
        <p>
          As duas casas publicam a <span className="key">classificação temática oficial</span> de cada
          proposição: a Câmara com 32 temas em lista plana, o Senado com uma hierarquia de 10 macro-classes
          e 63 classes. Nós não classificamos nada — apenas <b>traduzimos os dois vocabulários oficiais</b>{' '}
          para os {vocabTemas.length} rótulos comuns abaixo, para que uma guilda de bancada mista some uma
          coisa só. Esse mapa é decisão nossa, e por isso está publicado aqui e no repositório
          (<code>scripts/lib/temas.mjs</code>).
        </p>
        <div className="legend-list">
          <div><b>Universo</b> — proposições de <span className="key">autoria principal</span> (PL, PLP, PEC, PDL),
            o mesmo recorte do Ataque. Relatoria fica de fora de propósito: ela é designação da mesa ou da
            comissão, então entraria como &ldquo;prioridade&rdquo; uma pauta que não foi escolhida.</div>
          <div><b>Contagem</b> — uma proposição com 3 temas conta <span className="key">inteira nos 3</span>.
            Cada linha é uma afirmação independente (&ldquo;41 das 120 proposições tocam Saúde&rdquo;) e, por
            isso, <b>os percentuais não somam 100%</b> — no Congresso, uma proposição trata de{' '}
            {(meta.temas?.porProposicao ?? 0).toFixed(1).replace('.', ',')} temas em média. A alternativa
            (dar 1/3 a cada tema) somaria 100%, mas embutiria a suposição de que os três pesam igual, o que
            é ponderação nossa e não dado da fonte.</div>
          <div><b>Assinatura da guilda</b> — a distância, em pontos percentuais, entre a bancada e a média
            das duas casas. Existe porque o ranking absoluto por guilda é quase idêntico entre elas: todas
            refletem o que o Congresso inteiro legisla.</div>
          <div><b>Não pontua</b> — prioridade <span className="key">não entra no Poder</span>, não muda o
            Tier e <b>não gera título</b>. Um selo &ldquo;Deputado da Saúde&rdquo; seria rótulo sobre pauta
            política, o mesmo motivo pelo qual a Fiscalização é informativa. E nenhuma cor julga o assunto:
            legislar sobre Defesa não é melhor nem pior que legislar sobre Saúde.</div>
          <div><b>Vocabulário comum</b> — {vocabTemas.join(' · ')}. Tema que a fonte publicar e este mapa
            ainda não conhecer aparece como &ldquo;{meta.temas?.outros ?? 'Outros temas'}&rdquo; em vez de
            sumir da barra.</div>
        </div>
        <p>
          Onde houver um <span className="key">parágrafo escrito por IA</span>, ele vem marcado como tal, com
          o modelo, a data e o link para o prompt no repositório. Esse texto é interpretativo e fica
          deliberadamente separado: os números ao lado são a classificação oficial, e o prompt proíbe a IA de
          citar qualquer quantidade que não esteja na tabela. Se os números mudarem, o texto some da página
          até ser refeito — análise velha nunca é exibida ao lado de dado novo.
        </p>
      </div>

      <div className="panel detail-block" id="leis">
        <h3>6. &ldquo;Virou lei&rdquo; — o desfecho</h3>
        <p>
          O resto do site mede <b>atividade</b>: quanto se apresentou, quanto andou, sobre o quê, quanto
          se gastou. Esta seção mede <span className="key">desfecho</span> — a proposição de{' '}
          <b>autoria principal</b> que foi transformada em <span className="key">norma jurídica</span>.
          É o dado mais duro do site e o mais raro: a maioria dos parlamentares não tem nenhum.
        </p>
        <div className="legend-list">
          <div><b>Autoria principal</b> — a assinatura que a fonte oficial registra como proponente. Uma lei
            tem muitas mãos (relatoria, emendas, articulação) e nós creditamos só essa, porque só ela é
            derivável do dado. Coautor de apoio não entra, e o autor principal não &ldquo;fez a lei
            sozinho&rdquo;.</div>
          <div><b>Norma jurídica</b>, não &ldquo;lei&rdquo; no sentido estrito — lei ordinária, lei
            complementar, emenda constitucional ou decreto legislativo. O tipo vai no nome de cada linha,
            então nada precisa ser deduzido.</div>
          <div><b>Recorte</b> — proposições <span className="key">numeradas nesta legislatura</span>, o mesmo
            de todos os atributos. Um projeto de 2019 sancionado agora <b>não aparece</b>: a lista é o que a
            plataforma consegue medir no período, não o currículo completo de ninguém.</div>
          <div><b>O número da lei</b> — o Senado publica a norma gerada em campo estruturado; a{' '}
            <span className="key">Câmara não publica em campo nenhum</span> (o campo que existiria para isso
            vem vazio), só na prosa do despacho de tramitação. Nós varremos as tramitações atrás dele e,
            quando não achamos, <b>a linha sai sem o número da lei</b> — omitido, nunca deduzido.</div>
          <div><b>Não pontua duas vezes</b> — a contagem já entra na Eficiência como bônus. Aqui ela é só
            exibida: não cria atributo, não muda o Tier e não gera título novo.</div>
          <div><b>O agrupamento por tema é OFICIAL, não de IA</b> — as normas são agrupadas pela mesma
            classificação temática das duas casas usada nas Prioridades (item 5), que cobre 100% delas.
            Pedir a um modelo que lesse as ementas e inventasse segmentos jogaria fora dado oficial
            auditável e daria agrupamentos diferentes a cada execução. Onde a IA entra é no{' '}
            <span className="key">parágrafo</span> ao lado das barras, sempre marcado como tal.</div>
          <div><b>Taxa de conversão</b> — normas ÷ proposições apresentadas no mesmo tema. É o número que
            responde &ldquo;o que o Congresso aprova de fato&rdquo;, e é diferente do percentual de
            composição ao lado dele. Só é publicada acima de um piso de normas: com 2 leis num tema,
            &ldquo;50% de aproveitamento&rdquo; seria ruído apresentado como fato.</div>
          <div><b>Homenagens e datas</b> — títulos de &ldquo;Capital Nacional&rdquo;, dias e semanas
            nacionais, Livro dos Heróis da Pátria. Contamos e publicamos a proporção porque é o único
            recorte em que se avalia o <span className="key">conteúdo</span> do que foi aprovado, não o
            volume. O rótulo é da fonte oficial; se isso é pouco ou demais para o tempo de plenário do
            Congresso é <b>juízo de quem lê</b> — a plataforma não adjetiva essas leis.</div>
          <div><b>Na guilda é soma simples</b>, não taxa: uma lei sancionada é um evento inteiro, não uma
            fração. Por isso o número de parlamentares da bancada vai na mesma frase — comparar bancadas de
            tamanhos diferentes é do leitor, com o denominador à vista.</div>
        </div>
      </div>

      <div className="panel detail-block">
        <h3>7. De onde vêm os dados</h3>
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
        <h3>8. Auditar por conta própria</h3>
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
