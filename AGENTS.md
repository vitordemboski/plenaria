# PLENÁRIA — instruções para agentes de IA

Plataforma web gamificada de acompanhamento cívico (RPG/TCG de Deputados e Senadores).
Leia `docs/product-spec.md` para o produto e `docs/architecture.md` para a arquitetura.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run data:real` | Ingesta DADOS REAIS (Câmara + Senado) — cache em `data/raw/` (~1GB); já roda o `fotos` no fim. Do zero leva ~1h (a API da Câmara devolve 504 em rajada); com cache quente, minutos |
| `npm run data:fresh` | O mesmo com `--fresh`: ignora o TTL e re-baixa TODA fonte volátil (ver "Validade do cache" abaixo) |
| `npm run fotos` | Baixa as fotos oficiais p/ `public/fotos/` como **WebP** (~8MB) e repõe os `fotoUrl` p/ caminho local |
| `npm run og` | Gera os cards de compartilhamento: `public/og.jpg` (site), `public/og/<slug>.jpg` (parlamentar) e `og/guilda-<sigla>.jpg` (guilda) — 615 imagens, ~41MB; já roda no fim do `data:real`. `--only=<slug>`/`--guildas`/`--site` p/ iterar |
| `npm run social:template` | Gera/atualiza o esqueleto de `data/social.csv` com handles oficiais |
| `npm run social:discover` | Descobre handles não declarados à Câmara |
| `npm run social:fetch` | Preenche seguidores do Instagram em `data/social.csv` via Apify (`APIFY_TOKEN`) — **PAGO** |
| `npm run dev` | Dev server (falha alto se `data/` estiver vazio — ver `check-data.mjs`) |
| `npm run build` | Export estático completo → `out/` (~673 páginas) |
| `npm run start` | Serve o `out/` localmente |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Testes da lógica pura de ingestão (`node --test`, sem dependências) |

## Princípio arquitetural nº 1: tudo é estático

Os dados **quase não mudam** (atualização em batch, no máximo diária). Por isso:

- `next.config.mjs` usa `output: 'export'` — **não introduza** API routes, server actions,
  ISR ou qualquer coisa que exija servidor Node em runtime.
- Todo dado é lido de JSON em build-time (`src/lib/data.ts` importa `data/*.json`).
  Páginas de político usam `generateStaticParams` (todas pré-renderizadas).
- Novas features devem seguir o padrão: computar no gerador → emitir JSON →
  renderizar em Server Component. Se precisar de interatividade, ilha client mínima
  **alimentada por JSON estático** (nunca por fetch de API em runtime).
- As ilhas client (`'use client'`) são hoje: `BattleClient`, `BrazilMap`, `FutStat`,
  `GuildRanking`, `InsightsTabs`, `MapExplorer`, `PoliticianLink`, `ScatterChart`,
  `ShareButton`, `SiteNav`, `TierListClient`, `TitleBadge`. Só o `BattleClient` faz
  fetch (`/data/index.json`, estático); as demais recebem tudo por prop do Server
  Component. O `InsightsTabs` é só comportamento (recentraliza a aba ativa no carrossel
  mobile após a navegação recriar o `<nav>`); não recebe dado, envolve os `<Link>` das
  abas. O `PoliticianLink` também é só comportamento: aquece a foto da ficha no
  `pointerdown` — no apertar, não no hover, que baixaria a foto de todo card que o
  mouse atravessa (a URL sai do slug — as listas não carregam `fotoUrl`). Toda lista
  que leva à ficha usa ele em vez de `<Link>`; as exceções são `BattleClient` e
  `ScatterChart`, onde a foto já está na tela ou o link é único.
- **Não se passa FUNÇÃO como prop de Server → Client** — o Next não serializa. Quando
  uma ilha precisa formatar/derivar algo, passe um enum e resolva dentro dela (ver o
  `Fmt = 'money' | 'pct' | 'plain'` do `ScatterChart`, que serve a dois gráficos com
  eixos diferentes sem duplicar o componente).
- Em produção, sirva `out/` com `Cache-Control: public, max-age=31536000, immutable`
  para `/_next/static/*`, `/data/*` e `/fotos/*`; HTML com `max-age=0, must-revalidate`.
  Na Netlify isso é versionado no `netlify.toml` da raiz: o `@netlify/plugin-nextjs`
  já marca `/_next/static/*` (content-hash) e o HTML, e o `netlify.toml` cobre o que
  ele NÃO marca — `/data/*` e `/fotos/*` (id-keyed, só mudam em redeploy). Brotli/gzip
  a Netlify negocia sozinha p/ texto (HTML/JS/JSON), então compressão já está de pé.

## Modos de dados e o meta.json

`data/meta.json` (emitido por AMBOS os geradores) declara `mode`, `availableStats`,
`pesos`, `titulosDisponiveis` e `aviso`. **Toda a UI se adapta por ele** — nunca
hardcode suposições sobre quais atributos existem; use `AVAILABLE_STAT_META`
(`src/lib/data.ts`) no server e `fetch('/data/meta.json')` nas ilhas client.

**GUARDRAIL INEGOCIÁVEL**: no modo `real` (pessoas reais), NUNCA exibir métricas,
títulos ou penalidades que não venham de dado factual. Todo título ativo no modo
real precisa de regra 100% derivável dos dados, com o texto exato no tooltip.
Disponibilidade de atributo é POR PARLAMENTAR (`rawNumbers`/`avail`) e por casa
(`meta.pesosPorCasa`) — o Senado, por ex., não tem Fiscalização nem Alinhamento.

## ⚠️ DADOS INSUBSTITUÍVEIS — nunca apague `data/`

Quase tudo em `data/` é reproduzível por script. **Um arquivo NÃO é:**

| Arquivo | Por que é insubstituível |
|---|---|
| `data/social.csv` | seguidores do Instagram via Apify — **serviço PAGO**; re-coletar custa crédito |

Ele está **versionado no git**. Nunca rode `git clean`, `rm -rf data/` nem nada que varra
untracked/ignored files nesse diretório — e nunca instrua um subagente a "limpar o working
tree" sem blindar `data/`.

**Recuperação do social.csv (se ele sumir):** os datasets das execuções passadas ficam
guardados na conta do Apify, e **ler dataset já computado é grátis** (só re-executar cobra).
`GET https://api.apify.com/v2/actor-runs?token=$APIFY_TOKEN` lista as runs; cada uma tem
`defaultDatasetId`, e `GET /v2/datasets/{id}/items` devolve `username` + `followersCount`.
Foi assim que a coleta de 2026-07-06 foi restaurada sem gastar um centavo.

Armadilhas conhecidas das APIs:
- **Cache com validade — reingerir NÃO garante dado novo.** O `cached()` servia
  qualquer arquivo existente para sempre: com `data/raw/` populado, `data:real` só
  recalculava sobre dados velhos (log 100% `[cache]`, zero byte baixado) e ainda
  carimbava a data de hoje no `meta.json`. Hoje o volátil (bulks, cota, votações,
  autorias, Senado) expira em 24h (`PLENARIA_CACHE_TTL_H`; `--fresh` ignora), e
  `dep-hist-*`/`dep-legs-*` (504 em rajada) e `relatores-historico.json` (~24 mil
  chamadas) são PERMANENTES — só voltam se o arquivo sumir. Efeito colateral disso:
  relatoria nova em proposição antiga não aparece sem apagar o `relatores-historico`.
- **`updatedAt` é a data da fonte mais velha**, não a da execução (essa é `geradoEm`).
  O dado é tão atual quanto sua parte mais velha, e é o `updatedAt` que ~673 páginas
  exibem ao leitor.
- **CSV dos Dados Abertos NÃO se parseia com `split`.** As ementas contêm quebras de
  linha DENTRO das aspas: um `text.split('\n')` parte o registro ao meio e as colunas
  saem deslocadas — 6,69% das linhas de `proposicoes-2025.csv` (7.592 de 113.427).
  O bug era silencioso: a linha corrompida simplesmente não casava com nenhum tipo e
  era descartada. Use SEMPRE `parseCsvBR` (`scripts/lib/csv.mjs`), que é uma máquina
  de estados de verdade. Mesmo cuidado ao ler colunas de texto livre: em
  `votacoesOrientacoes`, o campo `descricao` pode conter `;`, então as 3 últimas
  colunas são lidas pelo FIM (`r.at(-3)`, `r.at(-1)`), não por índice.
- **`/deputados/{id}/historico` devolve 504 TRANSITÓRIO sob carga** — numa reingestão
  do zero (cache vazio) são 513 chamadas seguidas e ~1 em cada 3 estoura; o mesmo id
  que falha responde 200 minutos depois. Por isso o laço tem pool de concorrência 4,
  retry com backoff longo, e ADIA os que falharem para rodadas extras. **Nunca
  "resolva" um 504 devolvendo histórico vazio**: histórico vazio = 0 meses de
  exercício = deputado apagado do ranking em silêncio. Se esgotar, é para abortar.
- **`ultimoStatus_uriRelator` do CSV bulk é só o relator ATUAL — não serve p/ contar
  relatoria.** Uma proposição passa por várias comissões, cada uma com seu relator, e
  o CSV guarda apenas o último: medido na legislatura inteira, capturávamos 10.989 de
  16.860 relatorias (65%). O erro não aparece no agregado — o que denuncia é a variância
  POR DEPUTADO (média 66% capturado, desvio 19 p.p.; três deputados tinham ZERO
  relatoria visível apesar de terem 13 a 19), porque quem relata cedo, em comissão de
  mérito, é substituído e some, enquanto quem relata na CCJ ou no plenário fica sendo o
  último. A correção é `relatoresPorProposicao`, que lê `uriUltimoRelator` de CADA
  tramitação via `/proposicoes/{id}/tramitacoes`. O bulk `proposicoesTramitacoes`
  **não** substitui: ele não traz o campo de relator (conferido). São ~24 mil chamadas,
  cacheadas num JSON único (`data/raw/relatores-historico.json`) com escrita incremental
  — 24 mil arquivos soltos seriam piores. Mesma regra do histórico acima: falha esgotada
  ABORTA, nunca grava lista vazia.
- **Não conclua nada sobre relatoria a partir de proposições que já têm relator atual.**
  Amostrar só elas infla tudo: são as mais adiantadas na tramitação, logo acumularam
  mais relatores. Foi assim que uma amostra deu "perdemos 50%" contra os 35% reais.
- **Licença das fotos oficiais (conferido nas fontes primárias, 2026-07):** a Câmara permite
  reproduzir "dados, imagens e infografias publicados no portal" citando a fonte "Câmara dos
  Deputados" (Termo de Uso, item 7) — sem restrição de corte ou uso comercial. O Senado é mais
  estrito: uso livre "desde que citada a fonte e o conteúdo não seja alterado, nem
  descaracterizado", crédito "Nome/Agência Senado", e **veda uso comercial ou
  político-ideológico e a inserção de anúncios** (Guia de Direitos Autorais). Consequência
  prática: ligar anúncio no site coloca as fotos do Senado FORA dos termos — antes de qualquer
  monetização, trocar a origem das fotos ou pedir autorização expressa. É por isso que o crédito
  vai também na imagem do ShareButton, que circula longe do rodapé do site.
- Fotos oficiais NÃO têm header CORS. Uma `<img>` remota até renderiza, mas ao ser
  desenhada no `<canvas>` ela o CONTAMINA e o `toBlob()` do ShareButton passa a
  lançar — a imagem de compartilhamento nunca mostraria o rosto. Por isso
  `scripts/fetch-fotos.mjs` baixa tudo p/ `public/fotos/` (same-origin) e reescreve
  `fotoUrl`. O Senado serve 1152×1441 (~1,4MB!): o script normaliza em 480px de
  altura via sharp e grava **WebP q75** (~23% menor que o JPEG mozjpeg q82, mesma
  qualidade visual a 480px; o `<canvas>` do ShareButton desenha WebP sem problema). A
  URL de origem é RECONSTRUÍDA de casa+id, então re-rodar após apagar `public/fotos/`
  funciona mesmo com os JSONs já apontando p/ o local; se sobrar um `.jpg` antigo de
  execução pré-WebP, o script o transcodifica localmente (sem rede) e remove o órfão.
  NB: WebP q75 encodado da FONTE (10M→7,7M) sai menor que transcodificar do JPEG já
  comprimido só se a qualidade cair; a q80 o transcode (lossy-sobre-lossy) engana com
  arquivo menor porém degradado. Encodar da fonte é o caminho reproduzível pelo pipeline.
- **Não use o `urlFoto` da API da Câmara como origem da foto.** Para 134 dos 512
  deputados ele aponta para uma MINIATURA de 114×152 (os outros 378 vêm em 354×472,
  então o defeito passa despercebido numa amostra) — esticada para os 216 CSS px da
  janela da carta em tela 2×, a carta do Kim Kataguiri sai borrada ao lado da do Marcel
  van Hattem. A origem certa é `bandep/{id}.jpgmaior.jpg` (o `maior.jpg` grudado no
  nome não é typo: é como a listagem "Quem são os deputados" monta a URL), que devolve
  354×472 para os 512, sem exceção. Por isso `baixar()` tenta a URL RECONSTRUÍDA antes
  do `p.fotoUrl`, e recusa cache local com largura < 300px: `public/fotos/` é gitignored,
  logo o cache é por máquina, e uma miniatura é um download bem-sucedido — sem a
  checagem de largura, quem já tivesse rodado ficaria com os 134 borrados para sempre.
- **O card OG por parlamentar segue as regras da imagem do ShareButton** (sem título/selo,
  número bruto ao lado de cada percentil, sem Tier p/ quem está fora do ranking, crédito da
  foto NA imagem). Duas armadilhas do satori: ele não decodifica WebP (a foto é convertida
  com sharp antes) e não desenha emoji sem asset extra. `ogImage` só é gravado no
  politicians.json/guilds.json para quem renderizou — a UI não deriva do slug porque `og:image`
  404 faz o scraper não mostrar cartão nenhum, pior que o card genérico.
- **O bruto do card de GUILDA é OUTRA conta, não o bruto do percentil médio.** Média de
  percentis não tem bruto único — por isso o card nasceu sem número ao lado da barra. O que
  existe hoje (`scripts/lib/guilda-bruto.mjs`, com teste; usado pelo card OG, pela página da
  guilda e pelo `nota` do ShareButton) é um agregado INDEPENDENTE sobre os brutos da bancada,
  e as duas contas têm de ser declaradas lado a lado (o rodapé do card diz "Percentil: média
  dos N membros · ao lado, os números da bancada"). Duas regras dele: (1) **contagem vira
  média por parlamentar, taxa vira soma÷soma da bancada** — média de porcentagens de casas
  diferentes (o deputado vota em ~1.589 votações, o senador em ~418) não é a taxa da guilda;
  (2) **emenda só entra na Técnica quando TODA a bancada é da Câmara**, senão a "média por
  parlamentar" embutiria um denominador que nenhum senador podia ter. Toda frase carrega o
  próprio denominador e cabe em 44 caracteres (o teste trava isso — é a largura da linha).
- O mesmo script emite o **`fotoLqip`**: um WebP 12×13 em data-URI (~185B) que a janela
  da carta pinta como `background` enquanto a foto não chega — sem ele a moldura piscava
  do gradiente escuro p/ a foto clara. Três armadilhas: (1) **fundo branco fixo não
  resolve** — só a Câmara fotografa em branco, o Senado varia (bandeira, cortina); o
  placeholder tem que sair da própria foto; (2) o crop tem que ser o MESMO do render
  (`cover`/`top`) ou o borrão pula quando a foto o cobre; (3) o LQIP fica FORA de
  `public/data/index.json` — a `/batalha` o baixa no client, e 185B por parlamentar
  inflariam o índice em ~45% por duas fotos que já são lazy. Não precisa de
  `filter: blur()`: subir 12px p/ 196px já borra na interpolação do browser, de graça.
- Câmara `/proposicoes` limita janelas de data a 3 meses — para séries, use os
  arquivos bulk (`/arquivos/...`), nunca a API paginada.
- **A cota da Câmara vem da API por deputado, NÃO do bulk `cotas/Ano-{ano}.csv.zip`** —
  ele parou de publicar "PASSAGEM AÉREA - SIGEPA" em ago/2025 (não é cache nem parser).
  Passagem é a maior rubrica depois de divulgação, e a perda era DESIGUAL — quem voa
  muito sumia mais, quem é de Brasília nem sentia —, logo reordenava a frugalidade. O
  agregado continua plausível: só bater UM parlamentar contra `/deputados/{id}/despesas`
  denuncia. Confira a cada ingestão que mexer na cota. O CEAPS do Senado não tem o problema.
- **`/deputados/{id}/despesas` pagina instável sem `ordenarPor`**: o mesmo deputado
  devolve centenas de lançamentos a menos (centenas de milhares de reais sumindo sem
  erro) se você não passar `ordem=ASC&ordenarPor=codDocumento`. Ordem explícita + dedupe,
  sempre. E `itens` satura em 100 sem reclamar — pare em `length < 100`, nunca
  `length < itens`. `ano` repetido varre os 4 anos numa passada.
- Influência vem de seguidores do Instagram via Apify (ator instagram-profile-scraper,
  `npm run social:fetch`, `APIFY_TOKEN` obrigatório) — é serviço pago: rode em lotes,
  escreva resultados parciais no CSV e NUNCA grave falha como zero seguidores.
- CEAPS do Senado é latin1, decimal com vírgula e só tem NOME do senador. O CSV nem
  sempre usa o nome parlamentar da API (ex.: API `Weverton` × CSV `WEVERTON ROCHA`):
  o match é exato → nome civil → prefixo ÚNICO. Sem match, o gasto vira 0 e o senador
  aparece como "o mais frugal" — por isso a ingestão loga quem ficou sem lançamentos
  (hoje só o Kajuru, que de fato não usa a cota). **Confira essa lista a cada ingestão.**
- A **quebra da cota por categoria/fornecedor** (`cotaResumo`, painel "Onde foi a cota") é
  INFORMATIVA — descreve o gasto, não pontua (a Economia continua sendo só o TOTAL). Lógica pura em `scripts/lib/cota.mjs` (com teste). Dois cuidados: (1) os valores são
  **líquidos** — os estornos (vlrLiquido negativo) são abatidos por categoria, senão o total do
  painel diverge do total da Economia (bruto 1,92 mi × líquido 1,91 mi para o mesmo deputado);
  (2) rótulo de categoria desconhecido NUNCA é dropado — cai num rótulo limpo genérico, senão a
  fonte inventa uma categoria nova e ela some da barra em silêncio. As duas casas têm taxonomias
  de categoria diferentes (CEAP granular × CEAPS em ~8 grupos); `rotuloCategoria` normaliza as duas.
- **Fornecedor se agrega por DOCUMENTO, nunca pelo nome** (a razão social é texto livre: o mesmo
  CNPJ vem com 81 grafias na Vivo, 630 na A&T Turismo). Agrupar por nome estilhaça a empresa e
  subestima a concentração: um caso ia de 23% p/ 63% e ficava fora do ranking em silêncio. Sem
  documento (SIGEPA), cai no nome — nunca se dropa. No ranking NACIONAL de empresas, o % é fatia
  do universo COM CNPJ (16% da cota não identifica PJ) e o painel de concentração é irmão
  obrigatório do top 15: a maior empresa tem 1,3% de ~43 mil CNPJs, e o top 15 solto sugere
  captura — o oposto do dado. Detalhe em docs/product-spec.md §8.
- **Fornecedor PESSOA FÍSICA não é nomeado, e a minimização é na EMISSÃO** (`ehCpf` grava o rótulo
  do que foi contratado; o nome não entra em JSON nenhum, com teste). São 23 fichas — locador do
  escritório, prestador do gabinete. Público na origem não dispensa NECESSIDADE na reutilização: o
  nome não acrescenta nada ao que o painel afirma ("35% da cota num só fornecedor, aluguel de
  escritório"), a pessoa não é agente público, e nomeá-la ao lado do parlamentar faz o leitor
  completar a acusação sozinho. Vale p/ toda superfície nova que exiba fornecedor.
- **Não reintroduza o auxílio-moradia na Economia.** Investigado e descartado: NÃO está nos Dados
  Abertos (só no portal de transparência). Câmara teria um endpoint interno por ID, mas não
  documentado/versionado; Senado só publica um snapshot mensal por NOME (o mesmo risco de homônimo
  do CEAPS). É um valor ~fixo (R$4–5 mil/mês ou imóvel funcional), então quase não move o
  percentil. O spec (§1) já listava "auxílio-moradia/verba de gabinete" na fórmula — isso era
  drift do design original; a Economia real é só a cota CEAP/CEAPS. Só vale reabrir se as duas
  casas passarem a publicar por ID, legível por máquina.
- **O Karma (TCU) foi REMOVIDO — não reintroduza sem reler o motivo.** A penalidade só podia
  atingir deputados (o Senado não expõe CPF) enquanto os cortes de Tier são absolutos entre as
  casas: era o viés estrutural que o resto do projeto combate. Ainda media fato possivelmente
  anterior ao mandato, contra o disclaimer de toda ficha, e acendia para um único
  parlamentar da base (nenhum Tier S bloqueado). Com ele saiu a leitura do CPF: o
  pipeline não coleta mais esse dado — e a `/sobre` afirma isso ao público. Penalidade nova só se valer nas DUAS casas e medir o
  exercício do mandato. Detalhe em docs/product-spec.md §9.
- API do Senado devolve cargos/comissões de órgãos EXTINTOS sem DataFim — sempre
  recortar por DataInicio >= legislatura atual. **Vale igual para `/votacoes`**: ela
  devolve a votação de TODA a carreira (o Renan Calheiros vem com 1.378 votos de
  1995–2022). Sem o recorte, a Stamina do veterano é a média de 30 anos e a do novato
  a de 3 — e o erro é silencioso, porque a taxa de carreira continua "plausível", só
  alguns pontos acima da real. O denominador em si é honesto: a API registra o senador
  em toda votação do mandato, inclusive as que faltou.
- **A Stamina é VOTO REGISTRADO, não presença — nas duas casas.** O bulk da Câmara só
  publica voto efetivo; o Senado marca também o `P-NRV` ("Presente – Não registrou voto",
  ~15% dos registros e ~22% nas secretas). Contar presença no Senado e voto na Câmara
  fazia a mesma palavra medir coisas diferentes, com os cortes de Tier sendo ABSOLUTOS
  entre as casas. **Abstenção CONTA** — é voto registrado, e a Stamina não julga o
  conteúdo do voto (mesmo princípio do Alinhamento informativo): excluí-la seria dizer
  que uma posição legítima vale menos, e ainda é no-op (0,1% dos registros). A taxa de
  presença sobra na ficha do senador como 2ª taxa (`compareceuN`), e o painel "A Sabatina"
  usa a MESMA definição — senão suas duas metades param de somar a Stamina.
- **O MOTIVO da ausência vem no CAMPO DO VOTO, e é vocabulário controlado — classifique
  por código, nunca por regex na prosa** (`scripts/lib/voto-senado.mjs`, com teste).
  `SiglaDescricaoVoto` traz `Sim`/`Não`/`Abstenção`/`Votou`/`P-NRV` para presença e
  `AP`/`MIS`/`LS`/`LP`/`LAP`/`NCom` para ausência. Um regex sobre a descrição descontava
  "Atividade parlamentar" e deixava passar "Missão da Casa no País/exterior", que é a
  MESMA natureza (ausência a serviço da Casa) — não era limiar discutível, era a mesma
  coisa medida de dois jeitos, e inflava a Stamina de mais da metade da casa de forma
  desigual. Para conferir um código, use `plenario/lista/votacao/{AAAAMMDD}`, que devolve
  a votação inteira — ausência e voto convivem na mesma coluna. Código novo é LOGADO pela
  ingestão (`⚠️ código de voto NÃO classificado`); declare-o, não adivinhe.
- **Não reintroduza o "Réu no STF".** A base "Acervo" do Corte Aberta anonimiza o polo
  passivo (`*NI*`) em ~99,7% das ações penais, então o match por nome civil nunca casa:
  a integração existiu, exigia download MANUAL de um painel Qlik e produziu ZERO
  portadores do título em todas as ingestões. Foi removida. Só vale reimplementar se o
  STF passar a publicar os nomes.
- **Título de PENALIDADE não pode disparar na mediana da casa.** Os atributos são
  percentis DENTRO da casa, mas um rótulo vermelho faz uma acusação ABSOLUTA ("pouca
  entrega") — e as duas coisas se contradizem quando a distribuição é comprimida. O
  Senado comparece muito (mediana 93%, p25 88%), então `Stamina < 50` marcava como
  "Blogueiro de Plenário" quem vai a 9 de cada 10 votações. Pior: o mesmo "50" valia
  59% de presença na Câmara — um número, duas realidades. Por isso os gates dos títulos
  vermelhos usam o **quartil** (`< 25`), não a mediana. Antes de criar/afrouxar uma
  penalidade, traduza o limiar percentílico de volta para o número BRUTO em CADA casa
  e leia em voz alta: se a frase resultante ("comparece a 91% das votações, logo é
  blogueiro") soa falsa, o limiar está errado.
- **Selo vermelho anda com o número bruto — não o separe do rótulo.** O gate é percentílico
  (relativo à casa), o rótulo acusa em absoluto ("é fantasma"): a evidência de
  `scripts/lib/evidencia.mjs` (bruto do parlamentar + mediana da casa, campo `titleEvidence`)
  é o que transforma o selo em conclusão fundamentada em dado público em vez de palavra nossa.
  Título vermelho novo nasce com sua frase de evidência; sem bruto disponível, a frase é
  OMITIDA, nunca estimada. Selos verdes/roxos não têm evidência — não acusam ninguém.
- **A imagem do ShareButton não leva título nenhum.** Selo viaja sem a regra, sem o bruto e
  sem o canal de correção: fora do site é rótulo sem prova. O lugar dele é a ficha. Na imagem
  vão os NÚMEROS (`rawCurto`, uma linha por atributo — `scripts/lib/resumo-stat.mjs`, com
  teste), o crédito da foto (Câmara é CC BY, o Senado exige citar a Agência Senado — e é a
  imagem, não o rodapé do site, que circula sozinha) e o link de `/como-calculamos`. Não
  reintroduza chips de título ali "só os verdes": a coerência é o que sustenta a decisão.
- **A Batalha não pode coletar opinião de usuário.** Ela é determinística (compara atributos já
  publicados) e é exatamente isso que a mantém fora da Lei 9.504/97 art. 33: um "quem você acha
  que vence?" agregado sobre gente que é candidata vira enquete/pesquisa eleitoral não registrada.
  Vale para qualquer voto, curtida ou ranking colaborativo sobre parlamentares.
- **Rótulo de título não pode imputar INTENÇÃO.** As regras derivam fatos (quanto gastou, quanto
  compareceu); motivo interno não é derivável de dado nenhum, e "títulos são 100% factuais" é
  promessa exibida ao leitor. Nome de selo descreve o que foi medido. Foi por isso que a "Safra
  Eleitoral" virou **Produção Concentrada em 2026** (slug `producao-concentrada`): a regra media
  concentração de autorias, o nome acusava oportunismo eleitoral — e ainda em ano de eleição, que
  é quando um rótulo desses vira pedido de remoção no TSE.
- **Trocar a NORMALIZAÇÃO de um atributo dispara a armadilha acima pela porta dos fundos.**
  O `< 40` que pinta a barra de vermelho (UI, em 4 arquivos) e barra o Tier S é convenção
  compartilhada: ele só significa "os 40% de baixo da casa" porque os atributos são
  percentis. Ao tornar a Economia linear no gasto, uma reta simples p5→p95 jogou 72% da
  Câmara no vermelho e passou a acusar quem gasta a MEDIANA — barrando do Tier S a
  deputada com mais leis aprovadas da casa. Por isso a escala é ancorada na mediana
  (=50): mudou a normalização, confira a fração da casa abaixo de 40 CONTRA a dos
  atributos percentílicos antes de dar por pronto. Cuidado gêmeo: os cortes de Tier são
  ABSOLUTOS, valem para as duas casas e vivem SÓ em `meta.tierCortes` (uma segunda
  tabela no guild-stats.ts ficou na calibração antiga e dava Tier A p/ guilda com
  Poder médio 86 enquanto parlamentar com 86 era S), então uma escala que desloque uma casa mais que a
  outra embute "senador vale mais que deputado" no Poder. É a âncora na mediana que
  neutraliza isso — uma reta entre extremos deslocava a Stamina +2,1 na Câmara × +3,8 no
  Senado, a ancorada desloca +0,56 × +0,94. Não descarte uma correção medindo a variante
  errada.
- **Percentil é invariante a transformação monotônica.** Normalizar o log do valor, usar
  "taxa de falta" no lugar de "taxa de presença" ou winsorizar a ENTRADA do percentil não
  mudam nada — são as três primeiras ideias que ocorrem e as três são no-ops. Para mudar a
  sensibilidade é preciso abandonar o rank (ver `scripts/lib/escala.mjs`).
- Fiscalização (RIC/PFC/convocação) e Alinhamento são INFORMATIVOS de propósito.
  Fiscalizar o Executivo é, na prática, fazer oposição a ele: a oposição protocola
  ~192 atos por deputado, a base do governo ~20 (PT: 3; NOVO: 306). Pontuar isso
  faria o Poder premiar posição política travestida de entrega. Vale a mesma regra
  para qualquer métrica nova: antes de deixá-la pontuar, meça-a contra o eixo
  governo/oposição — se o gap for de ordem de grandeza, ela é política, não técnica.

## Pipeline de dados

`scripts/ingest-real.mjs` (`npm run data:real`) é a ÚNICA fonte de dados. Ele ingere
Câmara + Senado (cache incremental em `data/raw/`), normaliza por percentil
DENTRO de cada casa (Câmara ≠ Senado — exceto a Economia, linear no gasto), calcula Poder/Tier/gates e títulos, e emite
`data/politicians.json`, `insights.json`, `guilds.json`, `title-defs.json`, `meta.json`
e `public/data/index.json`. `src/lib/types.ts` é o contrato.

**Não existe gerador de dados sintéticos** — e não reintroduza um. Um fallback que
inventa parlamentares é pior que um erro: se `data/` sumir, o site sobe com gente
fictícia no lugar de gente real e ninguém percebe. Por isso `predev`/`prebuild` chamam
`scripts/check-data.mjs`, que falha alto mandando rodar `npm run data:real`.

Nem todo parlamentar tem todo atributo (o Senado não tem Fiscalização nem Alinhamento).
Isso é declarado em `meta.json` (`availableStats`, `pesosPorCasa`) e por parlamentar
(`rawNumbers`/`avail`) — a UI se adapta, nunca hardcoda. **A Eficiência do Senado existe
desde que a tramitação passou a ser lida do `/processo`** — os pesos das duas casas são
hoje idênticos; o que difere é o universo do percentil, não a fórmula.

`scripts/lib/` guarda a **lógica pura** da ingestão (parser de CSV, classificação de
tipos, cálculo de alinhamento) — é o que `npm test` cobre (`node --test`, zero
dependências). Lógica nova que possa errar em silêncio vai para lá, com teste.

**Regra de ouro:** a fórmula/regras de título implementadas no gerador DEVEM bater com o
que está escrito em `docs/product-spec.md` e exibido em `/como-calculamos`. Se alterar
uma, altere as três — e, se for título vermelho, a frase de evidência é a quarta.

`/sobre` é a página institucional (responsável, base legal do tratamento, canal de correção
com prazo). Ela é o par da `/como-calculamos`: lá está COMO o número sai, aqui QUEM publica e
como contestar. O contato ali precisa ser um endereço que alguém realmente lê.

## Convenções

- Idioma do produto e dos comentários: **português (pt-BR)**.
- Comentários: conciso, o código fala por si. Comente só o não-óbvio — a armadilha,
  o "por que assim e não do jeito intuitivo", o que quebra se alguém mexer. Nada de
  narrar o que a linha já diz.
- Sem Tailwind/CSS-in-JS: estilos em `src/app/globals.css` com CSS custom properties
  (paleta dourado-heráldica dark; classes `tier-S`..`tier-F` setam `--tc`).
- Tipografia: Cinzel (display) + Sometype Mono (corpo), self-hosted via `next/font`
  — não adicionar fontes por `<link>` externo.
- Mobile-first nos ajustes: breakpoints existentes em 640/820/860/900px; qualquer
  componente novo deve ser verificado a 390px de largura.
- Rampa sequencial dourada dos charts (`#3a2f18 → #f6e39b`) foi validada para dark
  surface; degraus escuros exigem "relief" (borda 1px interna + rótulo + tooltip).
- **A cor não pode julgar o que a métrica não julga.** Famílias de mapa (`map-data.ts`)
  têm `higherIsBetter`: use `null` para o que é neutro. Alinhamento com o Governo é
  neutro — pintar "mais governista = verde" (ou = vermelho) seria a plataforma tomando
  partido pela paleta, contrabandeando o juízo que a métrica se recusa a fazer.
- **`metadata` de rota sai do `pageMeta` (`src/lib/seo.ts`), nunca à mão:** o merge do
  Next é RASO — declarar `openGraph` na página apaga a `og:image` do layout, e
  `openGraph`/`twitter` não herdam o `title` da própria página. Erro silencioso; se
  mexeu, confira no HTML de `out/`, não no código.
- **Poder e Tier nunca viram `AggregateRating`/`Review` no JSON-LD** (`src/lib/jsonld.ts`):
  rating sobre pessoa não é elegível no Google e seria a plataforma pondo NOTA numa
  pessoa em formato de máquina. Mesmo princípio da cor neutra acima — estrela na SERP
  julga mais que cor. Números vão como `PropertyValue`, Tier como texto.

## Verificação

Antes de dar algo por pronto: `npm test && npm run typecheck && npm run build`, depois
inspecionar visualmente servindo `out/` (ex.: `python3 -m http.server 8377 -d out`).
Se mexeu no gerador, confira que um SENADOR continua renderizando certo — ele não tem
Eficiência, Fiscalização nem Alinhamento, e é o melhor teste de que a UI está mesmo se
adaptando pelo `meta.json` em vez de hardcodar atributos.
Atenção: o Chrome headless no macOS força largura mínima de janela ~500px — para testar
mobile de verdade, use um iframe de 390px ou o DevTools device mode.
Mexeu em metadado/JSON-LD? Varra o `out/`: 1 `<h1>` por página, `og:title` sem duplicata,
URLs do sitemap existindo em disco, JSON-LD parseável e sem `ratingValue`.
