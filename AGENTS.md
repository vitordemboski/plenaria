# PLENÁRIA — instruções para agentes de IA

Plataforma web gamificada de acompanhamento cívico (RPG/TCG de Deputados e Senadores).
Leia `docs/product-spec.md` para o produto e `docs/architecture.md` para a arquitetura.

> **Não escreva aqui número que descreve o ESTADO ATUAL dos dados.** Contagem de
> parlamentares, de páginas, de arquivos, tamanho de cache, "hoje só o fulano", "são 23
> fichas" — tudo isso muda sozinho, ninguém revisa, e um número errado num arquivo de
> instruções é pior que número nenhum: ele é lido como verdade e vira premissa de decisão.
> Prefira a FORMA da resposta ("unidades é normal, dezenas é a fonte quebrada") ou um
> comando que meça na hora.
>
> A exceção é **evidência de investigação passada** — "capturávamos 10.989 de 16.860
> relatorias (65%)", "29 dos 81 senadores vieram vazios". Esses não envelhecem: são fato
> histórico congelado, e é deles que a regra tira autoridade. Escreva-os no passado, para
> que ninguém os leia como retrato de agora.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run data:real` | Ingesta DADOS REAIS (Câmara + Senado) — cache em `data/raw/` (alguns GB); já roda o `fotos` no fim. Do zero leva ~1h (a API da Câmara devolve 504 em rajada); com cache quente, minutos |
| `npm run data:fresh` | O mesmo com `--fresh`: ignora o TTL e re-baixa TODA fonte volátil (ver "Validade do cache" abaixo) |
| `npm run fotos` | Baixa as fotos oficiais p/ `public/fotos/` como **WebP** e repõe os `fotoUrl` p/ caminho local |
| `npm run og` | Gera os cards de compartilhamento: `public/og.jpg` (site), `public/og/<slug>.jpg` (parlamentar) e `og/guilda-<sigla>.jpg` (guilda) — um por parlamentar, guilda e o site; já roda no fim do `data:real`. `--only=<slug>`/`--guildas`/`--site` p/ iterar |
| `npm run social:template` | Gera/atualiza o esqueleto de `data/social.csv` com handles oficiais |
| `npm run social:discover` | Descobre handles não declarados à Câmara |
| `npm run social:fetch` | Preenche seguidores do Instagram em `data/social.csv` via Apify (`APIFY_TOKEN`) — **PAGO** |
| `npm run dev` | Dev server (falha alto se `data/` estiver vazio — ver `check-data.mjs`) |
| `npm run build` | Export estático completo → `out/` (uma página por parlamentar, guilda, estado, título e seção de insights) |
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
  `ShareButton`, `SiteNav`, `TemaProposicoes`, `TierListClient`, `TitleBadge`. Só
  `BattleClient` (`/data/index.json`) e `TemaProposicoes` (`/data/props/<slug>.json`)
  fazem fetch — de ARQUIVO ESTÁTICO, nunca de API; as demais recebem tudo por prop do
  Server Component. O `TemaProposicoes` busca no PRIMEIRO CLIQUE, nunca no carregamento:
  são ~19 KB que a maioria dos leitores nunca abre. O `InsightsTabs` é só comportamento (recentraliza a aba ativa no carrossel
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
| `data/analises.json` | parágrafos escritos por IA + **revisão humana**; o pipeline só os LÊ, nunca os gera. Está sob uma exceção explícita no `.gitignore` (`!data/analises.json`), porque `data/*.json` é ignorado |

Ele está **versionado no git**. Nunca rode `git clean`, `rm -rf data/` nem nada que varra
untracked/ignored files nesse diretório — e nunca instrua um subagente a "limpar o working
tree" sem blindar `data/`.

**Recuperação do social.csv (se ele sumir):** os datasets das execuções passadas ficam
guardados na conta do Apify, e **ler dataset já computado é grátis** (só re-executar cobra).
`GET https://api.apify.com/v2/actor-runs?token=$APIFY_TOKEN` lista as runs; cada uma tem
`defaultDatasetId`, e `GET /v2/datasets/{id}/items` devolve `username` + `followersCount`.
Foi assim que a coleta de 2026-07-06 foi restaurada sem gastar um centavo.

### ⚠️ SUCESSO VAZIO — a falha nº 1 deste projeto

**Uma fonte que devolve 200 com nada dentro não gera erro: gera um número plausível.**
Aconteceu seis vezes, sempre igual — a resposta é íntegra, sem o campo de dados; o
pipeline conclui "não tem"; o atributo vai a zero; e zero é sempre um valor VÁLIDO na
escala. Ninguém percebe, porque não há o que perceber.

O mais perverso é a Economia: cota vazia não deprime o parlamentar, **ELOGIA** (gasto
mínimo → Economia alta → Guardião do Cofre). Nos demais, deprime em silêncio.

As três regras, para qualquer fonte nova:

1. **Vazio nunca é aceito de primeira** — repita a chamada (4×) antes de concluir.
2. **Vazio nunca é gravado nem sobrescreve cache bom.** Sem isso o erro fica congelado
   pelo TTL, e a execução seguinte herda a conclusão em vez de perguntar de novo.
3. **Só o 404 é resposta definitiva.** 429/5xx são transitórios; tratar "não-OK" como
   vazio custou 935 matérias numa execução. Esgotou a retentativa → **aborta ou loga**,
   nunca segue quieto. E um portão de casa inteira (`> 10%` sem dado) pega o resto.

| Fonte | O que devolveu | Estrago medido |
|---|---|---|
| `/deputados/{id}/despesas` com filtro `ano=` | `dados: []` p/ todo deputado e todo ano, inclusive histórico consolidado (`x-total-count: 0`, `retry-after: 30` num 200) | Câmara inteira com R$ 0 de cota e Economia 50 — o filtro quebrou, não o endpoint: com `idLegislatura=` os mesmos dados vêm |
| `/senador/{id}/*` | envelope sem o nó (`Autorias`, `Votacoes`…), intermitente | 29 dos 81 senadores com Ataque/Eficiência 0 — Alessandro Vieira lia 0 onde há 926 autorias |
| `/processo/{id}` | sem `classificacoes`, intermitente + 429 sob concorrência 8 | cobertura temática do Senado 98% → 48% |
| `/materia/{codigo}` | **descontinuado** (desativado em 2026-02-01), 200 com corpo vazio | mediria a mesma cobertura como 20% |
| `/deputados/{id}/historico` | 504 transitório sob carga (~1 em 3, em rajada de 513) | histórico vazio = 0 meses de exercício = deputado fora do ranking |
| CEAPS (Senado) | match por NOME sem casar | senador vira "o mais frugal" |

Defesas hoje: `senadoJson` recebe um predicado `temDados`; a cota tem portão de sanidade;
`historico` e `relatoresPorProposicao` abortam; a classificação do Senado só grava `null`
após 4 vazios. Pool de concorrência **4**, não 8. Tudo que sobra vazio é LOGADO com `⚠️` —
**leia esses avisos a cada ingestão** e confira com o comando da seção Verificação.
O CEAPS loga quem ficou sem lançamento — **unidades** é normal (há quem renuncie à cota
e recém-empossados); **dezenas** é match nominal quebrado ou fonte vazia.

Armadilhas conhecidas das APIs:
- **Cache com validade — reingerir NÃO garante dado novo.** O `cached()` servia
  qualquer arquivo existente para sempre: com `data/raw/` populado, `data:real` só
  recalculava sobre dados velhos (log 100% `[cache]`, zero byte baixado) e ainda
  carimbava a data de hoje no `meta.json`. Hoje o volátil (bulks, cota, votações,
  autorias, Senado) expira em 24h (`PLENARIA_CACHE_TTL_H`; `--fresh` ignora), e
  `dep-hist-*`/`dep-legs-*` (504 em rajada), `relatores-historico.json` (~24 mil
  chamadas) e `normas-camara.json` (nº da lei; uma lei publicada não muda de número)
  são PERMANENTES — só voltam se o arquivo sumir. Efeito colateral disso:
  relatoria nova em proposição antiga não aparece sem apagar o `relatores-historico`.
- **`updatedAt` é a data da fonte mais velha**, não a da execução (essa é `geradoEm`).
  O dado é tão atual quanto sua parte mais velha, e é o `updatedAt` que
  todas as páginas exibem ao leitor.
- **CSV dos Dados Abertos NÃO se parseia com `split`.** As ementas contêm quebras de
  linha DENTRO das aspas: um `text.split('\n')` parte o registro ao meio e as colunas
  saem deslocadas — 6,69% das linhas de `proposicoes-2025.csv` (7.592 de 113.427).
  O bug era silencioso: a linha corrompida simplesmente não casava com nenhum tipo e
  era descartada. Use SEMPRE `parseCsvBR` (`scripts/lib/csv.mjs`), que é uma máquina
  de estados de verdade. Mesmo cuidado ao ler colunas de texto livre: em
  `votacoesOrientacoes`, o campo `descricao` pode conter `;`, então as 3 últimas
  colunas são lidas pelo FIM (`r.at(-3)`, `r.at(-1)`), não por índice.
- **`ultimoStatus_uriRelator` do CSV bulk é só o relator ATUAL — não serve p/ contar
  relatoria.** Uma proposição passa por várias comissões, cada uma com seu relator, e o
  CSV guarda só o último: capturávamos 10.989 de 16.860 (65%). O agregado não denuncia —
  a variância POR DEPUTADO sim (média 66%, desvio 19 p.p.; três deputados com ZERO
  relatoria visível apesar de terem 13 a 19), porque quem relata cedo é substituído e
  some. Correção: `relatoresPorProposicao` lê `uriUltimoRelator` de CADA tramitação via
  `/proposicoes/{id}/tramitacoes` (~24 mil chamadas, cache incremental em
  `relatores-historico.json`). O bulk `proposicoesTramitacoes` NÃO substitui — não traz o
  campo de relator (conferido). **Nunca amostre só proposições que já têm relator atual**:
  são as mais adiantadas, acumularam mais relatores, e a amostra deu "perdemos 50%"
  contra os 35% reais.
- **Licença das fotos (fontes primárias, 2026-07):** a Câmara permite reproduzir citando
  "Câmara dos Deputados" (Termo de Uso, item 7), sem restrição de corte ou uso comercial.
  O Senado é mais estrito: crédito "Nome/Agência Senado", conteúdo inalterado, e **veda
  uso comercial ou político-ideológico e a inserção de anúncios** (Guia de Direitos
  Autorais). Consequência: **ligar anúncio no site coloca as fotos do Senado FORA dos
  termos** — antes de monetizar, trocar a origem das fotos ou pedir autorização expressa.
  Por isso o crédito vai também NA imagem do ShareButton, que circula sem o rodapé.
- **Foto oficial é baixada para `public/fotos/` (WebP), nunca referenciada remota** —
  sem CORS ela contamina o `<canvas>` e o ShareButton para de gerar imagem. A origem é
  `bandep/{id}.jpgmaior.jpg` reconstruída, NÃO o `urlFoto` da API (miniatura em 134 dos
  512). O mesmo script emite o `fotoLqip`. Detalhe em docs/architecture.md.
- **O card OG por parlamentar segue as regras da imagem do ShareButton** (sem título/selo,
  bruto ao lado do percentil, sem Tier p/ quem está fora do ranking, crédito da foto NA
  imagem). Armadilhas do satori em docs/architecture.md.
- **O bruto do card de GUILDA é OUTRA conta, não o bruto do percentil médio**
  (`scripts/lib/guilda-bruto.mjs`, com teste): contagem vira média por parlamentar, taxa
  vira soma÷soma da bancada. Detalhe em docs/architecture.md.
- **O nº da lei ("Lei 15.172/2025") NÃO existe em campo na Câmara — e o último despacho
  não serve.** O `urnFinal` vem vazio no bulk E na API (conferido nos dois); o número só
  aparece na PROSA do despacho da tramitação que registrou a transformação. E ler o
  `ultimoStatus_despacho` do bulk é a armadilha: depois de virar lei a matéria continua
  tramitando (ofícios, autógrafos, retificações), então em 9 de cada 10 casos o ÚLTIMO
  despacho fala de outra coisa — medido, só 78 de 793 transformadas tinham ali o número.
  Por isso `normasPorProposicao` varre `/proposicoes/{id}/tramitacoes` de cada
  transformada (centenas de chamadas, cache PERMANENTE em `normas-camara.json`). O Senado
  é o oposto: `normaGerada` do `/processo` é campo estruturado com vocabulário fechado
  (Lei / Lei Complementar / Emenda Constitucional / Decreto Legislativo). **Sem match, o
  número é OMITIDO, nunca deduzido** — a linha cai para a identificação do projeto.
  Lógica pura em `scripts/lib/norma.mjs` (com teste). Detalhe em docs/product-spec.md §11.
- **Tema clicável da ficha: a lista fica NO SITE porque nenhum link para fora bate com
  o número.** A busca da Câmara não tem filtro de tema nem campo de nome de autor (só
  partido/UF/situação/órgão — conferido no formulário avançado); a API de Dados Abertos
  cruza os dois, mas devolve JSON cru e conta **42 onde contamos 39** (ela inclui
  coautoria, nós só autoria principal); e o Senado é outro vocabulário e outro portal.
  Mandar o leitor a uma lista que contradiz a tela é pior que não ter link. A lista sai
  do MESMO dado do número (conferido: 303 no arquivo × 303 no painel), em
  `public/data/props/<slug>.json` (~584 arquivos, ~19 KB cada) buscado pela ilha
  `TemaProposicoes` **no primeiro clique** — como campo do `politicians.json` as ~33 mil
  proposições quadruplicariam o JSON lido por TODA página. Detalhe em docs/product-spec.md §11.
- **Quem agrupa as leis por tema é a CLASSIFICAÇÃO OFICIAL, não a IA** — e isso foi
  decidido com o número na mão: a cobertura temática das normas é de **100%** (139/139
  na Câmara, 52/52 no Senado, medido). Trocar isso por "IA lê as ementas e cria
  segmentos" jogaria fora dado auditável, daria agrupamento diferente a cada execução e
  contradiz o contrato da camada (a IA **lê**, não classifica — ver `analises.mjs`). O
  papel dela é o parágrafo, sob alvos próprios (`leis:nacional`, `leis:guilda:<sigla>`)
  para que texto sobre o que se APROVA nunca caia ao lado da tabela do que se APRESENTA.
- **Composição ≠ taxa de conversão** (`scripts/lib/leis-temas.mjs`, com teste). "31% das
  normas são de Homenagens" e "3,6% das proposições de homenagem viram norma" são fatos
  diferentes sobre a MESMA linha. A taxa exige os **dois lados deduplicados** — comparar
  numerador deduplicado com denominador multiplicado por coautoria dá taxa inventada — e
  só é publicada acima de um piso de normas: com 2 leis, "50% de aproveitamento" é ruído
  vendido como fato. Abaixo do piso a taxa é `null`, **nunca 0** ("não dá para afirmar" e
  "0% de aproveitamento" são coisas diferentes, e a segunda seria falsa).
- **Homenagens e datas: publique o NÚMERO, recuse o ADJETIVO.** 60 das 191 normas (31%)
  são honoríficas — título de "Capital Nacional", data comemorativa, Livro dos Heróis —,
  e é o tema de MAIOR taxa de conversão (3,6%, contra 0,5% da Saúde). É o único recorte
  do site em que o leitor avalia o CONTEÚDO do aprovado, e por isso ele existe. Mas o
  rótulo é da fonte (`HOMENAGENS` em temas.mjs), não nosso: chamar de "lei inútil" seria
  a plataforma opinando — o mesmo erro que derrubou a "Safra Eleitoral". Sem cor de
  alarme, e o prompt da IA proíbe o adjetivo explicitamente (`docs/prompts/leis-v1.md`).
- **"Virou lei" NÃO pontua** — a contagem já entra na Eficiência como bônus; o painel só
  a EXIBE. Exibir não pode virar segundo atributo, senão a mesma lei conta duas vezes. E a
  agregação de guilda é **soma simples**, não soma÷soma como as prioridades: uma lei
  sancionada é evento inteiro, não fração — por isso o nº de membros da bancada anda junto
  do total, como denominador à vista do leitor.
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
  `length < itens`. **Recorte por `idLegislatura`, não por `ano`**: o filtro `ano` parou
  de devolver qualquer coisa (ver Sucesso vazio) e o `idLegislatura` varre a legislatura
  inteira numa passada — que é o recorte que a gente já queria. Antes de culpar o
  endpoint, teste os FILTROS um a um: aqui o recurso estava de pé o tempo todo.
- Influência vem de seguidores do Instagram via Apify (ator instagram-profile-scraper,
  `npm run social:fetch`, `APIFY_TOKEN` obrigatório) — é serviço pago: rode em lotes,
  escreva resultados parciais no CSV e NUNCA grave falha como zero seguidores.
- CEAPS do Senado é latin1, decimal com vírgula e só tem NOME do senador — nem sempre o
  nome parlamentar da API (`Weverton` × `WEVERTON ROCHA`): match exato → nome civil →
  prefixo ÚNICO. Sem match o gasto vira 0 (ver Sucesso vazio).
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
  do universo COM CNPJ (parte da cota não identifica PJ) e o painel de concentração é irmão
  obrigatório do top 15: medido, a maior empresa ficava com pouco mais de 1% de dezenas de
  milhares de CNPJs — o top 15 solto sugere captura, o oposto do dado. Detalhe em docs/product-spec.md §8.
- **Fornecedor PESSOA FÍSICA não é nomeado, e a minimização é na EMISSÃO** (`ehCpf` grava o rótulo
  do que foi contratado; o nome não entra em JSON nenhum, com teste). São poucas fichas —
  locador do escritório, prestador do gabinete. Público na origem não dispensa NECESSIDADE na reutilização: o
  nome não acrescenta nada ao que o painel afirma ("35% da cota num só fornecedor, aluguel de
  escritório"), a pessoa não é agente público, e nomeá-la ao lado do parlamentar faz o leitor
  completar a acusação sozinho. Vale p/ toda superfície nova que exiba fornecedor.
- **INVESTIGADO E DESCARTADO — não reintroduza sem reler o motivo** (detalhe em
  docs/product-spec.md §9). Os três caem pelo MESMO teste: uma métrica precisa valer nas
  DUAS casas e medir o exercício do mandato.
  - **Karma (TCU)**: só alcançava deputados (o Senado não expõe CPF) enquanto os cortes de
    Tier são absolutos entre as casas — o viés estrutural que o resto do projeto combate.
    Ainda media fato possivelmente anterior ao mandato. Com ele saiu a leitura do CPF, e a
    `/sobre` afirma isso ao público.
  - **Réu no STF**: o Corte Aberta anonimiza o polo passivo (`*NI*`) em ~99,7% das ações
    penais, o match por nome nunca casa e a integração produziu ZERO portadores. Só volta
    se o STF publicar os nomes.
  - **Auxílio-moradia**: não está nos Dados Abertos, só no portal de transparência (Senado
    publica por NOME — risco de homônimo). É valor ~fixo, quase não move o percentil. A
    Economia é só a cota CEAP/CEAPS; "auxílio-moradia" no spec §1 era drift do design
    original. Só reabre se as duas casas publicarem por ID.
- **A lista das duas casas é só quem está EM EXERCÍCIO**: o titular licenciado não vem, e
  some do site sem explicação. `fetchLicenciados` emite `data/licenciados.json` só para a
  guilda e o estado o NOMEAREM — ele não entra no ranking (não há atividade publicada).
  Duas regras (lógica em `scripts/lib/licenciados.mjs`, com teste): **nunca publique o
  MOTIVO** — as duas APIs o omitem, então "assumiu ministério" é imputação; e no Senado
  classifique por `SiglaCausaAfastamento` em allowlist, senão falecidos e cassados entram
  como "licenciados". Detalhe em docs/product-spec.md §9.
- Classificação temática do Senado: `/processo/{id}` (`classificacoes`), com a ponte
  `codigoMateria → idProcesso` vinda dos `sen-processos-*.json` já cacheados. Cache
  PERMANENTE em `classificacoes-senado.json`, como o de relatores. Para recuperar de uma
  execução ruim: purgue os vazios do cache e reingira.
- **Prioridade temática NÃO pontua e NÃO vira título** (`p.prioridades`,
  `scripts/lib/temas.mjs`): fora do Poder, do Tier e dos gates. "Deputado da Saúde" seria
  rótulo sobre pauta política — o mesmo motivo da Fiscalização informativa —, e nenhuma
  cor julga o assunto (`higherIsBetter: null`). Duas contas que não se confundem: a
  **contagem é CHEIA** (3 temas contam nos 3 → os percentuais NÃO somam 100%, cada linha
  carrega o próprio denominador) e a **agregação de bancada é soma÷soma**, nunca média de
  porcentagens. Na guilda o que informa é o **desvio** do nacional, não o absoluto:
  "Administração Pública" e/ou "Direitos Humanos" estão no top-3 de 7 dos 8 maiores
  partidos, então o ranking absoluto pareceria funcionar sem distinguir bancada nenhuma.
  O mapa dos dois vocabulários oficiais é EDITORIAL e está publicado em
  `/como-calculamos` — mexeu no mapa, mexa lá. Detalhe em docs/product-spec.md §10.
- **Análise de IA só aparece se o `fonteHash` bater** (`scripts/lib/analises.mjs`):
  `data/analises.json` guarda o parágrafo junto do hash dos números que ele descreve, e a
  UI não renderiza quando divergem — senão um texto de julho ficaria ao lado das barras
  de setembro parecendo análise do dado atual. A IA **lê**: não classifica, não conta, e o
  prompt (versionado em `docs/prompts/`) a proíbe de citar quantidade fora da tabela. Todo
  texto exibido leva selo, modelo, data e link do prompt. O escopo (guildas + nacional,
  algumas dezenas de textos) cabe em revisão humana integral; um parágrafo por
  parlamentar — centenas, sobre pessoas nomeadas — não caberia.
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
- **Título de PENALIDADE não pode disparar na mediana da casa.** Os atributos são
  percentis DENTRO da casa, mas um rótulo vermelho faz uma acusação ABSOLUTA ("pouca
  entrega") — e as duas coisas se contradizem quando a distribuição é comprimida. Numa
  casa que comparece muito, `Stamina < 50` marcava como "Blogueiro de Plenário" quem ia
  a 9 de cada 10 votações; e o mesmo "50" valia uma taxa bem menor na outra casa — um
  número, duas realidades. Por isso os gates dos títulos vermelhos usam o **quartil**
  (`< 25`), não a mediana. Antes de criar/afrouxar uma penalidade, traduza o limiar
  percentílico de volta para o número BRUTO em CADA casa e leia em voz alta: se a frase
  resultante ("vota em 9 de cada 10 pautas, logo é blogueiro") soa falsa, o limiar está
  errado.
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
  ABSOLUTOS, valem para as duas casas e vivem SÓ em `meta.tierCortes` (uma segunda tabela
  no guild-stats.ts ficou na calibração antiga e dava Tier A p/ guilda com Poder médio 86
  enquanto parlamentar com 86 era S), então uma escala que desloque uma casa mais que a
  outra embute "senador vale mais que deputado" no Poder. É a âncora na mediana que
  neutraliza isso: reta entre extremos deslocava a Stamina +2,1 (Câmara) × +3,8 (Senado);
  a ancorada, +0,56 × +0,94.
- **Percentil é invariante a transformação monotônica.** Normalizar o log do valor, usar
  "taxa de falta" no lugar de "taxa de presença" ou winsorizar a ENTRADA do percentil não
  mudam nada — são as três primeiras ideias que ocorrem e as três são no-ops. Para mudar a
  sensibilidade é preciso abandonar o rank (ver `scripts/lib/escala.mjs`).
- Fiscalização (RIC/PFC/convocação) e Alinhamento são INFORMATIVOS de propósito.
  Fiscalizar o Executivo é, na prática, fazer oposição a ele: a oposição protocola
  uma ordem de grandeza a mais de atos que a base do governo (medido em 2026-07: ~192
  por deputado da oposição × ~20 da base). Pontuar isso
  faria o Poder premiar posição política travestida de entrega. Vale a mesma regra
  para qualquer métrica nova: antes de deixá-la pontuar, meça-a contra o eixo
  governo/oposição — se o gap for de ordem de grandeza, ela é política, não técnica.

## Pipeline de dados

`scripts/ingest-real.mjs` (`npm run data:real`) é a ÚNICA fonte de dados. Ele ingere
Câmara + Senado (cache incremental em `data/raw/`), normaliza por percentil
DENTRO de cada casa (Câmara ≠ Senado — exceto a Economia, linear no gasto), calcula Poder/Tier/gates e títulos, e emite
`data/politicians.json`, `insights.json`, `guilds.json`, `title-defs.json`, `meta.json`,
`licenciados.json`, `public/data/index.json` e um `public/data/props/<slug>.json` por
parlamentar (proposições com tema, servidas sob demanda). `src/lib/types.ts` é o contrato.

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
- **Ponto percentual não é porcentagem — e o número precisa carregar a unidade.** A
  assinatura da guilda é a DIFERENÇA entre duas porcentagens da mesma linha (37% na
  bancada − 20% no Congresso = 17 **p.p.**), e "+17" sozinho, em destaque dourado ao
  lado de dois percentuais, se lê como pontuação arbitrária. Regra: todo número que for
  diferença de porcentagens sai com `p.p.` (minúsculo — "P.P." não é abreviação de nada)
  e com a frase que o reconstrói ao lado. Vale para qualquer painel novo que compare
  duas taxas.
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

**Reingeriu? Confira o que a fonte pode zerar em silêncio.** Estas três já quebraram, e
nenhuma delas gera erro — todas produzem um número plausível:

```sh
node -e 'const P=require("./data/politicians.json");const z=k=>P.filter(k).length;
console.log("cota zero:", z(p=>!p.gastoMensalMedioMil), "de", P.length);
console.log("ataque zero (senado):", z(p=>p.casa==="senado"&&!p.statRaw?.ataque), "de 81");
console.log("sem prioridades:", z(p=>!p.prioridades), "de", P.length);'
```

Leia a FORMA do número, não um valor de referência (que envelheceria): **unidades** é o
normal — sempre há quem renuncie à cota, tenha tomado posse ontem ou não tenha autoria
principal. **Dezenas** é a fonte devolvendo vazio, não parlamentar inativo. Leia também os
`⚠️` do log da ingestão: eles nomeiam quem ficou sem dado depois de todas as tentativas.
