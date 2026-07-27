<p align="center">
  <img src="docs/logo.png" alt="Brasão do PLENÁRIA" width="200">
</p>

# 🏛️ PLENÁRIA — O RPG da Política Brasileira

Plataforma web gamificada que transforma dados públicos (Câmara, Senado e
Instagram) em **cards de personagem estilo RPG/TCG**: Tier List, Guildas (partidos),
Títulos factuais, Modo Batalha 1v1, páginas por estado e Dashboard de Insights.

> **Dados 100% reais** das duas casas — todos os parlamentares em exercício
> (hoje 593: 512 deputados + 81 senadores) com foto oficial, ficha civil, atributos que pontuam (Ataque, Stamina,
> Eficiência, Técnica, Economia), atributos informativos (Influência, Comando,
> Fiscalização¹, Alinhamento¹) e comissões.
> **TODO título e métrica deriva 100% de dado factual**, com a regra exata no tooltip
> (guardrail anti-difamação). Não existe gerador de dados sintéticos: se `data/`
> faltar, o build falha em vez de inventar parlamentares.
>
> ¹ só na Câmara — o Senado não expõe requerimentos de fiscalização por autoria nem
> orientação de bancada; os pesos da casa são redistribuídos (`meta.pesosPorCasa`).
> Cada atributo é percentil DENTRO da própria casa: deputado compara com deputado.

## Rodando

```bash
npm install
npm run data:real       # ingesta os dados (1ª vez leva ~1h; cache incremental em data/raw/)
npm run fotos           # baixa as fotos oficiais (WebP) p/ public/fotos/ (data:real já roda no fim)
npm run dev             # http://localhost:3001
npm run build           # export estático completo em out/ (~675 páginas)
npm run start           # serve out/
npm test                # testes da lógica pura de ingestão (node --test)
npm run typecheck       # tsc --noEmit

# Influência (seguidores no Instagram):
npm run social:template # gera/atualiza data/social.csv com os handles oficiais
npm run social:fetch    # preenche seguidores via Apify (requer APIFY_TOKEN no .env)
npm run social:discover # busca perfil pelo nome p/ quem não declarou handle (Apify)
```

## Estrutura

```
plenaria/
├── AGENTS.md                  ← instruções p/ agentes de IA (leia antes de mexer)
├── CLAUDE.md                  ← só importa o AGENTS.md (compat. Claude Code)
├── docs/
│   ├── product-spec.md        ← especificação de produto (fórmula, títulos, schema)
│   └── architecture.md        ← arquitetura, decisões e fontes de dados
├── scripts/
│   ├── ingest-real.mjs        ← ÚNICA fonte: Câmara + Senado
│   ├── check-data.mjs         ← guarda do dev/build (falha se data/ estiver vazio)
│   ├── fetch-fotos.mjs        ← fotos oficiais (WebP) p/ public/fotos/ (same-origin p/ o canvas)
│   ├── make-og.mjs            ← gera public/og.jpg (card OG de compartilhamento)
│   ├── lib/                   ← lógica pura testável (parser CSV, classificação, cota)
│   ├── social-template.mjs    ← esqueleto do data/social.csv (handles oficiais)
│   ├── social-discover.mjs    ← descobre handles não declarados à Câmara
│   └── social-fetch.mjs       ← seguidores do Instagram via Apify
├── src/
│   ├── lib/                   ← types (contrato de dados) e loaders
│   ├── components/            ← compartilhados (brasão, mapa, scatter etc.)
│   └── app/                   ← páginas Next.js (App Router, export estático)
│       ├── page.tsx                   🃏 Tier List (home)
│       ├── politico/[slug]/           🃏 Character Card (1 página SSG por parlamentar)
│       ├── guilda/[sigla]/            🛡️ Card de Facção (1 página SSG por partido)
│       ├── guildas/                   🛡️ Ranking das guildas
│       ├── estado/[uf]/               🗺️ Bancada por estado (27 páginas SSG)
│       ├── titulo/[slug]/             🏷️ Quem carrega cada título
│       ├── batalha/                   ⚔️ Modo Batalha (única ilha client)
│       ├── insights/                  📊 Dashboard (1 rota por seção)
│       └── como-calculamos/           📐 Metodologia pública
├── data/
│   ├── social.csv             ← curadoria de redes sociais (VERSIONADO)
│   └── raw/                   ← cache das APIs (~1GB, git-ignored)
└── data/*.json · public/data/ ← JSONs gerados (git-ignored; `npm run data:real`)
```

## Princípios

- **Estático por padrão** — dados quase não mudam → todas as páginas pré-renderizadas,
  zero servidor de aplicação, cache imutável de CDN (`docs/architecture.md`).
- **Fórmula pública** — pesos, gates e regras de título publicados em `/como-calculamos`
  vêm do MESMO `meta.json` usado no cálculo; alterou um, alterou os dois.
- **Guardrail anti-difamação** — nada é exibido sem base factual com
  fonte citada.
- **Mobile-first** — layout verificado a 390px.

## Fontes de dados

| Dado | Fonte |
|---|---|
| Autorias, votos nominais, normas geradas, relatorias, CEAP, ficha civil, comissões | Dados Abertos da Câmara |
| Autorias, votações, relatorias, CEAPS, comissões e cargos | Dados Abertos do Senado |
| Seguidores no Instagram (Influência) | Apify (instagram-profile-scraper), handles oficiais |

Nenhum dado sensível é tratado: o pipeline não lê CPF, telefone, endereço nem
filiação — só o exercício do mandato. Quem publica e como pedir correção está em
`/sobre`; como cada número sai, em `/como-calculamos`.

## Licença

O **código** está sob licença MIT (veja `LICENSE`). Ela **não** cobre os dados nem as
imagens, que têm termos próprios das fontes:

- **Fotos oficiais da Câmara** — Termo de Uso do portal (item 7): reprodução livre
  citando "Câmara dos Deputados".
- **Fotos oficiais do Senado** — Guia de Direitos Autorais: exige crédito
  "Agência Senado", proíbe alterar/descaracterizar e **veda uso comercial,
  político-ideológico e a inserção de anúncios**. Quem reaproveitar este projeto com
  publicidade precisa trocar a origem das fotos ou obter autorização expressa.
- **Dados abertos** de Câmara e Senado seguem os termos de cada portal.
