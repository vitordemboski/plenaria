# PLENÁRIA — Arquitetura

## Visão geral

Site **100% estático** (Next.js 15, App Router, `output: 'export'`). A premissa que
governa tudo: **os dados quase não mudam** — são atualizados por batch (no máximo diário).
Logo, não existe servidor de aplicação: cada página nasce pronta no build e é servida
de CDN com cache agressivo.

```
scripts/ingest-real.mjs            (única fonte: Câmara + Senado)
   src/lib/types.ts é o contrato entre o gerador e a UI
        │
        ├── data/politicians.json      1 registro completo por parlamentar em exercício (hoje 593)
        ├── data/insights.json         agregados do dashboard
        ├── data/guilds.json           partidos (guildas)
        ├── data/title-defs.json       regras de títulos (exibidas na metodologia)
        ├── data/meta.json             atributos disponíveis, pesos por casa, aviso
        └── public/data/index.json     índice slim p/ o Modo Batalha (client)
        │
   next build (output: export)
        │
        └── out/                       ~675 páginas HTML estáticas
              ├── index.html                    tier list (todos os políticos em HTML)
              ├── politico/<slug>/index.html    1 card pré-renderizado por político
              ├── guilda/<sigla>/index.html     1 card por partido · guildas/ = ranking
              ├── titulo/<slug>/index.html      1 página por título factual
              ├── estado/<uf>/index.html        1 página por UF
              ├── batalha/index.html            shell estático + ilha client
              ├── insights/<secao>/index.html   dashboard — 1 rota por seção (page view próprio)
              ├── como-calculamos/index.html    metodologia
              ├── sobre/index.html              responsável, privacidade (LGPD) e canal de correção
              └── data/index.json               único fetch do site (Batalha)
```

## Por que assim (decisões e trade-offs)

| Decisão | Racional |
|---|---|
| `output: 'export'` em vez de ISR/SSR | Dados mudam ~1×/dia → rebuild agendado é mais simples e barato que servidor. Nada para escalar, nada para invadir, TTFB de CDN. |
| Todas as páginas pré-renderizadas (1 por parlamentar/guilda/UF/título/seção) | O usuário navega de card em card; prefetch do Next + HTML pronto = navegação instantânea. |
| JSON importado em build (não `fetch`) | `src/lib/data.ts` importa os JSONs direto — o bundler resolve em build; runtime não tem I/O de dados. |
| Ilhas client mínimas, alimentadas por dado estático | Só o `BattleClient` faz fetch (`/data/index.json`, ~240 KB, imutável). As demais ilhas (`TierListClient`, `BrazilMap`, `MapExplorer`, `ScatterChart`, `GuildRanking`, `FutStat`, `ShareButton`, `SiteNav`, `TitleBadge`) recebem tudo por prop serializada no build — o HTML inicial já vem renderizado e nenhum fetch acontece em runtime. |
| Charts do Insights server-rendered | SVG/HTML puro com tooltips via `<title>` nativo — zero JS de biblioteca de gráfico. |
| Fontes via `next/font` | Cinzel + Sometype Mono self-hosted no build: sem request a Google Fonts em runtime, sem FOUT de terceiros. |
| Cloudflare Web Analytics (beacon) | Único script externo em runtime: cookieless, sem consentimento necessário. Só é emitido onde `NEXT_PUBLIC_CF_BEACON_TOKEN` existe (produção). |
| Fotos oficiais baixadas p/ `public/fotos/` | As origens não mandam header CORS: `<img>` remota renderiza, mas contamina o `<canvas>` do ShareButton (`toBlob()` lança). `scripts/fetch-fotos.mjs` baixa tudo same-origin, normaliza em 480px (sharp) e grava WebP q75 (~23% menor que o mozjpeg q82). |
| Slugs derivados de nome+id | URLs estáveis entre ingestões — pré-requisito p/ cache imutável e diffs de build legíveis. |

## Cache em produção (CDN)

```
/_next/static/*   Cache-Control: public, max-age=31536000, immutable
/data/*.json      Cache-Control: public, max-age=31536000, immutable   (nome muda a cada release se necessário)
/fotos/*.webp     Cache-Control: public, max-age=31536000, immutable   (id-keyed, só muda em redeploy)
*.html            Cache-Control: public, max-age=0, must-revalidate    (revalida rápido, corpo raramente muda → 304)
```

Na Netlify isso é versionado no `netlify.toml` da raiz. O `@netlify/plugin-nextjs` já
marca `/_next/static/*` (content-hash) e o HTML; o `netlify.toml` cobre o que ele NÃO
marca — `/data/*` e `/fotos/*`. Brotli/gzip a Netlify negocia sozinha p/ texto.

Atualização de dados = rodar `npm run data:real && npm run build` no CI (cron diário) e
publicar `out/`. Nenhuma invalidação além do HTML.

## Camadas do código

| Caminho | Papel |
|---|---|
| `scripts/ingest-real.mjs` | **Única fonte de dados**: ingestão + TODO o cálculo (percentis, Poder, tiers, gates, títulos, agregados). Cache incremental em `data/raw/`. |
| `scripts/check-data.mjs` | Guarda do `dev`/`build`: falha alto se `data/` estiver vazio. **Não** existe fallback sintético — subir o site com parlamentares inventados seria pior que não subir. |
| `scripts/lib/` | **Lógica pura e testável** da ingestão: `csv.mjs` (parser correto), `classificacao.mjs` (allowlist de tipos, alinhamento), `cota.mjs` (quebra da cota por categoria), `escala.mjs` (escalas de Economia, Stamina e Técnica), `evidencia.mjs` (número bruto + mediana da casa por trás de cada selo vermelho), `resumo-stat.mjs` (o bruto em uma linha, para a imagem de compartilhamento), `voto-senado.mjs` (comparecimento × voto registrado no Senado, por código), `guilda-bruto.mjs` (o bruto agregado da bancada). Coberto por `npm test` (`node --test`). |
| `scripts/fetch-fotos.mjs` | Fotos oficiais → `public/fotos/` como WebP q75 (same-origin p/ o canvas do ShareButton) + normalização 480px. `npm run data:real` já o roda no fim. |
| `scripts/make-og.mjs` | Gera `public/og.jpg` (card OG de compartilhamento). |
| `src/lib/types.ts` | **Contrato de dados** entre o gerador e a UI. |
| `src/lib/data.ts` | Loaders tipados + metadados de exibição (pesos, labels, ordem de tiers), derivados do `meta.json`. |
| `src/lib/map-data.ts` | Famílias/datasets do mapa por UF. `higherIsBetter: null` = métrica neutra (a cor não pode julgar). |
| `src/app/**` | Páginas — Server Components. |
| `src/components/` | Compartilhados. As ilhas `'use client'` vivem aqui (só o `BattleClient` faz fetch; as demais recebem dados por prop). |
| `docs/product-spec.md` | Especificação de produto: fórmula, regras de título. |

## Fontes de dados

### Câmara dos Deputados

`scripts/ingest-real.mjs` (`npm run data:real`) ingere os Dados Abertos da Câmara:

| Dado | Fonte | Vira |
|---|---|---|
| 513 deputados atuais (nome, partido, UF, foto oficial) | API `/deputados` + `/partidos` | identidade + brasões de guilda reais |
| Votos nominais (~1.600 votações, ~500k votos) | bulk `votacoesVotos-{ano}.csv` — só voto EFETIVO (a Câmara não publica presença sem voto) | **Stamina** |
| Autorias de PL/PLP/PEC/PDL | bulk `proposicoesAutores-{ano}.csv` + `proposicoes-{ano}.csv` (tipo/status) | **Ataque** + produção anual |
| Situação das proposições ("Transformada em norma") | bulk `proposicoes-{ano}.csv` | **Eficiência** |
| Cota parlamentar (~R$ 840 mi, 748k lançamentos) | API `/deputados/{id}/despesas` (por deputado, cacheada em `cota-{id}.json`) — **não** o bulk `cotas/Ano-{ano}.csv.zip`, que parou de publicar as passagens SIGEPA em ago/2025 | **Economia** + scatter Gasto × Entrega |
| Relator designado + emendas de autoria (EMC/EMP/EMR) | API `/proposicoes/{id}/tramitacoes` (relator de CADA etapa, ~24k chamadas cacheadas em `relatores-historico.json`) + bulk `proposicoesAutores` | **Técnica** — trabalho sobre o texto alheio. O `ultimoStatus_uriRelator` do bulk só traz o relator ATUAL e capturava 65% das relatorias |
| RIC + PFC + convocação de ministro (~9k atos/ano) | bulk `proposicoes-{ano}.csv` (allowlist por `descricaoTipo`) | **Fiscalização** (informativa) |
| Orientação da bancada "Governo" por votação | bulk `votacoesOrientacoes-{ano}.csv` × votos individuais | **Alinhamento** (informativo) |

- Downloads cacheados em `data/raw/` (~1GB) — reexecutar com cache quente é rápido.
- **`data/meta.json` declara** os atributos disponíveis, os pesos POR CASA e o aviso;
  toda a UI se adapta por ele (stats exibidos, rounds da batalha, KPIs, painéis do
  Insights, rodapés).
- **Guardrail** (spec §9): só exibimos o que é FACTUAL.
  Títulos e gates existem — o que não existe é qualquer regra que não seja
  100% derivável dos dados, com o texto exato no tooltip.
- Pesos do Poder (as DUAS casas): 0,24 Ataque · 0,20 Stamina · 0,28 Eficiência · 0,16
  Técnica · 0,12 Economia. A renormalização por parlamentar segue viva (cobre quem não
  tem Influência), mas Câmara e Senado têm hoje os mesmos 5 atributos que pontuam.
  **Fonte da verdade: `WEIGHTS_CAMARA`/`WEIGHTS_SENADO` no gerador** — se divergir daqui,
  o gerador está certo e este doc está velho.
- Normalização: percentil dentro da casa, EXCETO Economia, Stamina e Técnica — ancoradas na
  mediana da casa (`scripts/lib/escala.mjs`, com teste); as duas primeiras lineares no valor
  bruto, a Técnica em LOG. Percentil descarta a magnitude (Economia), faz a inclinação seguir
  a densidade local de colegas (Stamina: 1 p.p. de voto registrado valia de 0 a 7,5 pontos no Senado)
  e satura na cauda alta (Técnica: 1,9x o trabalho de um colega no topo valia 1 ponto). O
  Ataque fica em percentil DE PROPÓSITO — em log a magnitude do volume bruto volta a mandar e
  desfaz o motivo de ele pesar menos que a Eficiência. A âncora na mediana é o que mantém a
  paridade entre as casas, já que os cortes de Tier são absolutos.
  **Fonte da verdade: o módulo, não este doc.**
- **Informativos** (exibidos, NÃO pontuam): Influência, Comando, Fiscalização, Alinhamento.
  Fiscalização e Alinhamento ficam fora do Poder porque medem POSIÇÃO POLÍTICA, não
  entrega: a oposição protocola ~192 atos de fiscalização por deputado, a base ~20.
- A API limita janelas de proposições a 3 meses → use SEMPRE os bulks para séries.

**rawNumbers**: cada político carrega os números brutos formatados por atributo
("1.086 votos em 1.586 votações", "R$ 40 mil/mês de cota"), exibidos no card em
"🔎 De onde vêm os números".

### Senado Federal

- `senador/lista/atual` + `{cod}/autorias|votacoes|relatorias` (JSON; 3×81 requests
  cacheadas) + CEAPS (`despesa_ceaps_{ano}.csv`, latin1, match por nome).
- **Stamina = voto REGISTRADO, não presença.** A API marca o `P-NRV` ("Presente – Não
  registrou voto", ~15% dos registros e ~22% nas secretas) ao lado dos motivos de
  ausência, no mesmo campo do voto; classificar por CÓDIGO fica em `scripts/lib/
  voto-senado.mjs`, com teste. Contar presença aqui e voto na Câmara faria a mesma
  palavra medir coisas diferentes, com cortes de Tier absolutos entre as casas.
  Abstenção conta (é voto registrado; a Stamina não julga o conteúdo do voto). A taxa
  de presença sobra na ficha como 2ª taxa (`compareceuN`), e o painel "A Sabatina" usa
  a MESMA definição — senão suas duas metades param de somar o numerador da Stamina.
- Senadores têm os **5 atributos** que pontuam. A Eficiência vem do `/processo`
  (`?sigla=X&ano=Y`, em lote — 16 chamadas), único endpoint com `situacaoAtual`; as
  situações que contam como "avançou" são uma allowlist explícita em `scripts/lib/
  classificacao.mjs`, com teste. O que o Senado NÃO tem é Fiscalização e Alinhamento.
- Disponibilidade por parlamentar: `rawNumbers` (páginas) e `avail` (index.json)
  guiam a UI — batalha dep × sen compara apenas os atributos em comum; médias de
  guilda ignoram membros sem o atributo.
- Endpoints do Senado estão marcados como deprecados (2025-03) porém ativos —
  monitorar; a migração seria para os novos serviços de "processo".

### Influência — seguidores no Instagram

Influência = **seguidores nas redes sociais**, lidos de `data/social.csv`
(versionado no git — o CSV é a fonte, não artefato). O fluxo tem duas etapas:

1. `npm run social:template` gera/atualiza o esqueleto do CSV com os handles
   OFICIAIS declarados à Câmara (`redeSocial` de `/deputados/{id}`), preferindo
   Instagram; preserva linhas já preenchidas.
2. `npm run social:fetch` preenche `seguidores`/`coletado_em` das linhas com
   `rede=instagram` via **Apify** (ator `instagram-profile-scraper`,
   `dSCLg0C3YEZ83HzYX`), chamado pela REST `run-sync-get-dataset-items` em
   lotes. Requer `APIFY_TOKEN` no ambiente; é serviço pago (cobra por perfil).

- Falha de scraping NUNCA vira zero: a linha fica intacta e o parlamentar
  simplesmente não tem o atributo (Poder renormaliza os pesos).
- **Não pontua no Poder** (é informativa): alcance social não é entrega legislativa, e
  puni-lo penalizava quem trabalha muito e tem pouca rede — enquanto quem sequer tem
  Instagram ficava neutro (assimetria invertida). Segue no card e nos títulos
  (📱 Blogueiro de Plenário, 🏆 Ídolo das Redes, 🔧 Operário Silencioso), com tooltip
  citando rede, handle e data de coleta.
- **Recuperação sem custo:** os datasets das execuções ficam guardados na conta do
  Apify e LER dataset já computado é grátis (só re-executar cobra) —
  `GET /v2/actor-runs` → `defaultDatasetId` → `GET /v2/datasets/{id}/items`.

### Fiscalização e Alinhamento (informativos)

O aprendizado que vale carregar: **antes de deixar uma métrica nova pontuar, meça-a
contra o eixo governo/oposição.** Se o gap for de ordem de grandeza, ela é política,
não técnica — e pontuá-la faria o ranking tomar partido com cara de objetividade.
Foi o que quase aconteceu com a Fiscalização (oposição ~192 atos/deputado × base ~20).

## Próximos incrementos

1. Caçador de Votos real: exige baseline anual consolidada (2026 ainda parcial).
2. Handles de Instagram dos senadores (a Câmara declara `redeSocial`; o Senado
   não — curadoria manual no CSV libera o fetch via Apify para eles também).

## Docker — avaliação (decidido: NÃO usar por ora)

- O site é estático e o pipeline de dados roda em Node puro no build — **não há
  serviço de runtime para containerizar**.
- Reprodutibilidade de ambiente já vem do CI (GitHub Actions + `package-lock.json`);
  um Dockerfile só duplicaria isso.
- **Quando passaria a valer**: se algum dia entrar um Postgres para a série histórica
  mensal (spec §5), aí sim um `docker-compose.dev.yml` com o banco local se justifica —
  e apenas para desenvolvimento; produção continua CDN estática.

## Limitações conhecidas / próximos passos

- Tooltips de Insights usam `<title>` nativo — funcional, mas sem estilo; um upgrade
  seria uma micro-ilha de tooltip compartilhada.
- Compartilhamento de resultado da Batalha (imagem OG por batalha) exigiria geração de
  imagens no build ou serviço externo — fora do escopo estático atual.
- `out/` não está versionado; deploy = artefato de CI.
