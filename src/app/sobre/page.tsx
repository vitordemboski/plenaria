import type { Metadata } from 'next';
import Link from 'next/link';
import { meta } from '@/lib/data';
import { REPO_URL } from '@/lib/site';

export const metadata: Metadata = { title: 'Sobre, privacidade e correções', alternates: { canonical: '/sobre/' } };

/**
 * Página institucional — o par da /como-calculamos: lá está COMO o número sai,
 * aqui está QUEM publica, sob que base legal e como pedir correção.
 *
 * Existe por uma razão prática: o site descreve nominalmente ~600 pessoas reais
 * cruzando fontes públicas. Sem responsável identificado e sem canal de correção,
 * a primeira discordância chega como notificação judicial em vez de e-mail — e o
 * titular do dado tem direito (LGPD art. 18) a pedir correção a ALGUÉM.
 *
 * Mantenha o CONTATO real: um canal que não responde é pior que nenhum, porque
 * promete o que não existe.
 *
 * Por que o NOME do responsável não aparece: o que a lei e a prática exigem é ser
 * CONTACTÁVEL e identificável — não o nome estampado na home. Rotular parlamentares
 * em ano eleitoral com o nome exposto atrai assédio direto, e o anonimato de vitrine
 * não atrapalha quem tem legitimidade: parlamentar retratado, autoridade e Justiça
 * recebem a identificação pelo contato abaixo. Em compensação, a responsabilidade
 * editorial é assumida em texto — não se pode cobrar transparência de 593 pessoas e
 * publicar como se ninguém respondesse pelo site.
 */
const CONTATO = 'contato@plenariarpg.com';

export default function SobrePage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-title">
        <h2>SOBRE</h2>
        <p>Quem publica, de onde vêm os dados e como pedir correção</p>
      </div>

      <div className="panel detail-block">
        <h3>1. O que é a PLENÁRIA</h3>
        <p>
          Um projeto <span className="key">independente e sem fins lucrativos</span> de acompanhamento da
          atividade parlamentar. Ele lê os dados abertos oficiais da Câmara e do Senado e os apresenta
          na forma de cartas, tiers e duelos — a linguagem é de jogo, os números são de registro público.
        </p>
        <p>
          <span className="key">O que os números medem:</span> esforço e entrega no exercício do mandato —
          presença, produção, tramitação, gasto de cota. <span className="key">O que eles não medem:</span> o
          mérito da posição política. É por isso que Alinhamento e Fiscalização aparecem como informativos e
          não pontuam: fiscalizar o Executivo ou votar com ele é posição, não desempenho.
        </p>
        <p>
          <span className="key">O projeto é de código aberto.</span> O programa que baixa os dados oficiais,
          calcula cada atributo e monta as cartas está publicado sob licença MIT em{' '}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">github.com/vitordemboski/plenaria</a>.
          Não é só uma declaração de método: dá para ler a conta linha a linha, rodar a ingestão na sua
          própria máquina e chegar aos mesmos números — ou abrir uma issue apontando onde ela erra.
        </p>
        <p>
          <span className="key">O que a PLENÁRIA não é:</span> não é propaganda eleitoral e não pede voto em
          ninguém; não é pesquisa nem enquete eleitoral — nenhuma página coleta ou divulga preferência de
          voto, e o Modo Batalha é uma comparação determinística de atributos já publicados, sem opinião de
          usuário; e não é filiada a partido, campanha, órgão público ou empresa.
        </p>
      </div>

      <div className="panel detail-block">
        <h3>2. Responsável e contato</h3>
        <p>
          A PLENÁRIA é mantida por <span className="key">uma pessoa física</span>, de forma independente e
          sem fins lucrativos, sem vínculo com partido, campanha, órgão público ou empresa. Quem publica
          responde pelo que está aqui: erro apontado é corrigido, e a régua está toda exposta em{' '}
          <Link href="/como-calculamos/">como calculamos</Link>.
        </p>
        <p>
          Contato para dúvidas, correções e exercício de direitos:{' '}
          <span className="key">{CONTATO}</span> — resposta em até 7 dias.
        </p>
        <p>
          A <span className="key">identificação do responsável</span> é fornecida a parlamentar retratado,
          a autoridade pública e à Justiça, mediante solicitação pelo contato acima.
        </p>
      </div>

      <div className="panel detail-block">
        <h3>3. Dados, fontes e licenças</h3>
        <p>
          Tudo o que o site exibe vem de fonte pública e é reprocessado em lote (última atualização:{' '}
          <span className="key">{meta.updatedAt}</span>). As fontes, atributo por atributo, estão em{' '}
          <Link href="/como-calculamos/">como calculamos</Link>: Dados Abertos da Câmara e do Senado, cota
          parlamentar (CEAP/CEAPS) e a contagem pública de seguidores dos perfis oficiais.
        </p>
        <p>
          <span className="key">Fotos oficiais:</span> Câmara dos Deputados e Senado Federal. São
          reproduzidas com finalidade informativa, redimensionadas e sem alteração de conteúdo, creditadas
          à casa de origem. Pedidos de remoção ou substituição de imagem seguem o canal do item 5.
        </p>
        <p>
          <span className="key">Licenças:</span> o <b>código</b> é MIT — livre para usar, modificar e
          redistribuir. Isso <b>não</b> se estende aos dados nem às imagens, que seguem os termos de cada
          fonte: as fotos exigem crédito à casa de origem e as do Senado vedam alteração, uso comercial e
          inserção de anúncios. Quem reaproveitar o projeto responde por essas condições.
        </p>
        <p>
          Nenhum dado é inventado ou estimado. Quando um dado não existe para um parlamentar, o atributo
          simplesmente não aparece — não há preenchimento por suposição.
        </p>
      </div>

      <div className="panel detail-block">
        <h3>4. Privacidade</h3>
        <p>
          <span className="key">Sobre parlamentares.</span> Tratamos dados pessoais tornados públicos pelos
          próprios órgãos oficiais, referentes exclusivamente ao <b>exercício de função pública</b>. A base
          legal é o legítimo interesse no controle social da atividade parlamentar (LGPD, art. 7º, IX,
          combinado com o art. 7º, §3º, que trata do dado manifestamente público). Não publicamos endereço,
          telefone, CPF, dado de saúde, origem racial, opinião religiosa nem qualquer dado sensível, e não
          tratamos dados de familiares — o CPF sequer é lido pelo processo de ingestão.
        </p>
        <p>
          <span className="key">Sobre você, visitante.</span> O site é estático: não há login, não há
          formulário, não há cookie de sessão e nada que você faz aqui é enviado a um servidor nosso. A
          única medição é o Cloudflare Web Analytics, agregado e <b>sem cookies</b>, que não identifica
          visitantes nem permite rastreamento entre sites.
        </p>
      </div>

      <div className="panel detail-block" id="correcoes">
        <h3>5. Correções e direito de resposta</h3>
        <p>
          Erro de dado acontece — por falha de ingestão nossa ou por inconsistência na fonte. Qualquer
          pessoa, e em especial o parlamentar retratado, pode escrever para{' '}
          <span className="key">{CONTATO}</span> apontando o ponto contestado.
        </p>
        <p>Compromisso:</p>
        <div className="legend-list">
          <div><b>Resposta em até 7 dias</b> — sobre qualquer pedido de correção, retificação ou remoção.</div>
          <div><b>Dado errado é corrigido</b>, com o site republicado, e o título ou ranking dele derivado cai junto.</div>
          <div><b>Divergência de critério vira nota</b> — se o dado estiver certo e a discordância for sobre a
            régua, publicamos a manifestação do parlamentar junto do que ele contesta.</div>
          <div><b>Direitos do titular (LGPD, art. 18)</b> — confirmação, acesso, correção e oposição são
            atendidos pelo mesmo contato.</div>
        </div>
        <p>
          Os selos críticos são <span className="key">conclusões derivadas de dados públicos</span>, com a
          regra e o número bruto que os disparou exibidos na própria carta, ao lado da mediana da casa. A
          régua está inteira em <Link href="/como-calculamos/">como calculamos</Link> — discordar dela é
          legítimo, e é para isso que ela é publicada.
        </p>
      </div>
    </main>
  );
}
