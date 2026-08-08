# 🏛️ PLENÁRIA — Especificação de Produto

> O RPG da Política Brasileira. Transformamos dados públicos e áridos da Câmara, do Senado e do
> Portal da Transparência em **cards de personagem estilo RPG/TCG**, para que qualquer cidadão
> entenda, compare e "batalhe" seus representantes como se fossem cartas colecionáveis.

**Por que funciona**
- **Reduz atrito cognitivo** — ninguém lê planilha de assiduidade, mas todos entendem "Tier S vs Tier F".
- **Neutralidade por design** — a nota vem de fórmula transparente e auditável sobre dados oficiais.
- **Viralização nativa** — Modo Batalha e Títulos ("Blogueiro de Plenário") são screenshots prontos para compartilhar.

**Fontes de dados** (todas públicas, com API)

| Dado | Fonte |
|---|---|
| Presença, votações, projetos, relatorias | Dados Abertos da Câmara / Senado |
| Gastos (cota parlamentar CEAP/CEAPS) | Dados Abertos da Câmara / Senado (transparência) |
| Engajamento social | Instagram via **Apify** (`instagram-profile-scraper`, serviço pago) |

---

## 1. Atributos (do dado bruto ao stat de RPG)

Atributos normalizados de 0 a 100. Normalização **por percentil dentro da mesma casa**
(Deputado só compete com Deputado; Senador com Senador) — com TRÊS exceções, **Economia**,
**Stamina** e **Técnica**, ancoradas na mediana da casa (`scripts/lib/escala.mjs`): as duas
primeiras lineares no valor bruto, a Técnica em escala LOG. Os motivos estão nas linhas delas,
na tabela abaixo. **Cinco pontuam** no Poder;
**Influência, Comando, Fiscalização e Alinhamento são informativos** — exibidos no
card e nos títulos, fora da nota.

| Stat RPG | Ícone | Métrica real | Cálculo |
|---|---|---|---|
| **Stamina** (Vigor) | 🛡️ | Voto registrado nas votações nominais | votos registrados ÷ votações ocorridas durante o exercício (taxa, não contagem bruta — não penaliza quem assumiu tarde ou ficou licenciado). **Escala linear na taxa**, ancorada na mediana da casa (= 50), p5 = 0 e p95 = 100 — não percentil. No percentil a inclinação seguia a densidade local de colegas: no Senado, onde a mediana comparece a 92% e a distribuição encosta no teto de 100%, o mesmo 1 ponto percentual de presença valia de 0 a 7,5 pontos de atributo conforme o senador caísse num aglomerado ou num vazio. Com a escala linear a inclinação é constante dentro de cada metade, e a razão de sensibilidade entre as casas caiu de 2,3x para 1,3x. Resíduo assumido: a metade de cima do Senado segue íngreme (1,25 ponto de Poder por p.p.) porque metade da casa vive nos últimos 8 pontos percentuais — é limite do dado, não da escala. **No Senado entram também as votações secretas** — elas são a sabatina de autoridades (art. 52, III e IV: STF, STJ, TCU, Banco Central, agências, embaixadores), competência privativa da casa e 58% das suas votações nominais. Só a **presença** é lida; como o senador votou é secreto e a plataforma não exibe. A ausência e o não-voto são identificados pelo **código** do campo do voto (`AP`, `MIS`, `LS`/`LP`/`LAP`, `NCom` para ausência; `P-NRV` para presente sem voto — `scripts/lib/voto-senado.mjs`), nunca por texto livre: os motivos convivem na mesma coluna dos votos. **O numerador é o voto REGISTRADO, não a presença**: `P-NRV` é ~15% dos registros do Senado (22% nas secretas) e a Câmara só publica voto efetivo, então contar presença aqui faria a mesma palavra medir coisas diferentes nas duas casas. **Abstenção CONTA** — é posição formal, e a Stamina não julga o conteúdo do voto, só se o parlamentar participou. A taxa de presença segue visível na ficha do senador, ao lado da de voto |
| **Ataque** (Força) | ⚔️ | Proposições relevantes de **autoria** | contagem de matérias principais apresentadas como autor (PL, PLP, PEC, PDL) — apresentar, não aprovar (o desfecho entra na Eficiência) |
| **Técnica** (Perícia) | 📜 | Relatorias + emendas de autoria | **escala logarítmica** ancorada na mediana da casa (= 50), topo = o maior da casa: cada DOBRO de trabalho vale o mesmo incremento em qualquer altura. No percentil a cauda alta saturava — de 95 a 639 atos tudo cabia entre 83 e 100, e quem fazia 1,9x o trabalho de um colega no topo levava 1 ponto. O **Ataque não acompanha** e segue percentil de propósito: em log a magnitude do volume bruto volta a mandar, o que desfaz o motivo de ele pesar menos que a Eficiência (medido: log nos dois reinstalava o empate entre um autor de 296 matérias com 15,7% de aproveitamento e um de 80 com 41,8%). Conteúdo: trabalho técnico **sobre o texto alheio**: relatorias designadas em proposições relevantes + emendas de autoria (EMC = na comissão, EMP = de plenário, EMR = de relator). **Relatoria conta em QUALQUER ponto da tramitação**, não só onde o parlamentar é o relator atual: uma proposição passa por várias comissões e o CSV bulk só guarda o último relator, o que fazia a plataforma enxergar 10.989 de 16.860 relatorias (65%) — e de forma desigual (três deputados apareciam com zero apesar de terem 13 a 19), porque quem relata cedo é substituído e some. No Senado, que não expõe emendas por autor nos Dados Abertos, o atributo conta só relatorias |
| **Eficiência** | 🎯 | O que andou ÷ o que tocou | conversão de **autorias E relatorias**: `(avançadas + relatorias_avançadas) ÷ (apresentadas + relatorias)`, em blend com o volume que avançou + bônus por lei. Ser designado relator não é entregar — a maioria das relatorias não avança. Relatoria é lida do histórico completo de tramitação (ver Técnica), então quem relatou numa comissão e viu a matéria seguir adiante recebe o crédito, em vez de perdê-lo para o relator seguinte. **Nas duas casas**: na Câmara o desfecho vem do CSV bulk de proposições; no Senado, do `/processo` (`situacaoAtual`), lido por allowlist explícita de situações — "remetida à Câmara dos Deputados" é o análogo exato de "apreciação pelo Senado" (a matéria foi aprovada na casa de origem). Conta só matérias principais (PL, PLP, PEC, PDL) da legislatura, nas duas casas |
| **Influência** (Carisma) | 📢 | Seguidores no Instagram | **INFORMATIVO — não pontua no Poder** (alcance social ≠ entrega legislativa). Segue nos títulos e no card |
| **Economia** (Frugalidade) | 🪙 | Uso da cota parlamentar (CEAP na Câmara, CEAPS no Senado) | **escala linear no gasto mensal**, ancorada na casa: mediana da casa = 50, gasto zero = 100, p95 = 0 (`scripts/lib/escala.mjs`). Gasto total ÷ meses em exercício efetivo (piso de 1 mês); quanto **menos** gasta por mês, maior o stat. É o ÚNICO atributo que não é percentil: percentil mede colocação e descarta magnitude, e a distribuição de gasto é apertada no meio com cauda longa embaixo — quem gastava 2,2x o de um colega frugal perdia 9 pontos, enquanto R$3 mil/mês a mais na mediana derrubava 24. A âncora na mediana existe porque o limiar de vermelho (< 40) é convenção compartilhada com os atributos percentílicos: uma reta simples entre os extremos jogava 72% da Câmara no vermelho e fazia o rótulo acusar quem gasta a mediana. Comparar totais da legislatura faria quem assumiu tarde (ou passou anos licenciado) parecer frugal só por ter estado menos tempo sentado — mesmo princípio da taxa da Stamina. Só a cota entra (não há auxílio-moradia nem verba de gabinete no cálculo — ver Armadilhas no AGENTS.md). A carta exibe também a **quebra por categoria** e o maior fornecedor (agregado por CNPJ), mas isso é informativo e não altera a nota |
| **Comando** | 👑 | Comissões que integra + presidências | **INFORMATIVO — não pontua no Poder.** `total_órgãos + 3×presidências + vice-presidências`. Fora da nota de propósito: presidência é distribuída por tamanho de bancada e senioridade, não por mérito individual — pontuá-la enviesaria o Poder a favor de veteranos e partidos grandes, contra estreantes |
| **Fiscalização** | 🔎 | Atos de cobrança ao Executivo | **INFORMATIVO — não pontua no Poder.** Allowlist explícita (nunca regex em texto livre): RIC (requerimento de informação a ministro), PFC (proposta de fiscalização e controle) e requerimentos de convocação de ministro de Estado (no Plenário ou na Comissão) e de envio de RIC pela Comissão. Só Câmara. **Fica de fora da nota de propósito:** fiscalizar o Executivo é, na prática, fazer oposição a ele — na base atual, a oposição protocola em média **192 atos por deputado**; a base do governo, **20** (extremos: NOVO 306, PT 3). Se Fiscalização pontuasse no Poder, a plataforma estaria premiando posição política travestida de entrega legislativa, e o ranking passaria a dizer "a oposição trabalha mais" — uma afirmação política, não factual |
| **Alinhamento** | 🏛️ | % de votos coincidentes com a orientação da bancada do Governo | **INFORMATIVO — não pontua no Poder.** Só Câmara (que publica a orientação de cada bancada por votação); só entram votos Sim/Não comparáveis (abstenção, obstrução e ausência não dizem se o parlamentar concordou). Fica de fora pelo mesmo motivo da Fiscalização: posição política não é mérito nem demérito — pontuar alinhamento com o Governo faria o Poder recompensar um lado do espectro |

**Não há penalidade externa no Poder.** O antigo *Débito de Karma* (contas julgadas irregulares
no Cadirreg do TCU, −10 pts por processo) foi REMOVIDO — ver §9. Qualquer penalidade futura tem
de valer nas DUAS casas e medir o exercício do mandato. (Ações penais no STF não servem: o Corte
Aberta anonimiza o polo passivo em ~99,7% dos casos.)

---

## 2. Fórmula do Rank (como se atinge o Tier S)

Com cada atributo normalizado (0–100), calcula-se o **Poder** — a nota geral (0–100) do parlamentar:

```
Poder = (0.24 × Ataque)
    + (0.20 × Stamina)
    + (0.28 × Eficiência)
    + (0.16 × Técnica)
    + (0.12 × Economia)

// Influência (Instagram) é INFORMATIVA: NÃO entra no Poder.
```

> Pesos **renormalizados** por parlamentar sobre os atributos que ele tem: quem não
> tem um atributo que pontua sai da conta e o divisor cai junto — ninguém é punido por
> falta de dado. O mecanismo segue valendo (é o que cobre quem não tem Influência), mas
> desde que a Eficiência do Senado passou a ser lida do `/processo`, **as duas casas têm
> os mesmos 5 atributos que pontuam e os mesmos pesos**. O que difere é o universo do
> percentil (Câmara ≠ Senado), não a fórmula.

Pesos-base, idênticos nas duas casas:

| Atributo | Câmara | Senado |
|---|---|---|
| Ataque | 0,24 | 0,24 |
| Stamina | 0,20 | 0,20 |
| Eficiência | 0,28 | 0,28 |
| Técnica | 0,16 | 0,16 |
| Economia | 0,12 | 0,12 |

Informativos — peso 0, não entram na conta: **Fiscalização, Alinhamento, Influência, Comando**
(Fiscalização e Alinhamento só existem na Câmara).

Produção legislativa real (Ataque + Técnica + Eficiência = 68%) domina. **Eficiência (0,28) é o maior
peso da fórmula** — acima de Stamina (0,20) e de Ataque (0,24), nessa ordem, por um único critério:
o custo do ato. Comparecer é dever, mas é o comportamento de menor esforço e a distribuição é
comprimida no topo (mediana ~93% no Senado) — além de a presença já ser piso obrigatório para o Tier S
(`Stamina ≥ 70`), então pesá-la como autoria a contaria duas vezes. Protocolar uma proposição é o ato
legislativo mais barato que existe (custa uma assinatura), então o **insumo não pode valer mais que o
desfecho**: com Ataque acima de Eficiência, quem apresentava ~4x mais matérias com um terço do
aproveitamento empatava com quem convertia. O volume segue sendo o segundo maior peso — mais matérias
avançadas em termos absolutos continuam valendo mais —, só deixou de ganhar do resultado. O que a
plataforma recompensa acima de tudo é *resultado*: matéria que andou em vez de morrer na gaveta. A **Influência
(Instagram) é informativa — não pontua**: alcance social não é entrega legislativa, e contá-lo
penalizava quem trabalha muito e tem pouca rede (enquanto quem nem tem Instagram ficava neutro —
assimetria invertida). O reach segue nos títulos: puro engajamento vira "Blogueiro de Plenário"
(bloqueia o Tier S), e o oposto — entrega alta com alcance modesto — vira "Operário Silencioso".
Economia entra com 12%: gastar pouco ajuda, mas **não substitui entrega** — quem gasta muito com
entrega fraca rende o título "Nobre Gastador" (ver §4). A carta mostra ainda a **quebra da cota por
categoria** (escritório, passagens, combustível, divulgação…) e o maior fornecedor (agregado por
**CNPJ**, não pelo nome em texto livre — ver §8) — **informativo**:
descreve para onde a verba foi, com valores líquidos (estornos abatidos) que somam o mesmo total da
Economia; não altera a nota (só o gasto mensal médio no exercício pontua).


### Faixas de Tier

| Tier | Poder | Leitura |
|---|---|---|
| **S** | ≥ 85 | Lendário |
| **A** | 73–84 | Excelente |
| **B** | 58–72 | Consistente |
| **C** | 45–57 | Mediano |
| **D** | 31–44 | Fraco |
| **F** | < 31 | Figurante |

Os cortes foram recalibrados quando a Técnica passou a usar escala log: ela derruba o
Poder em ~2 pontos, e mantê-los encolheria o Tier S de 11 para 5 como efeito colateral.
A calibração preserva o TAMANHO das bandas — mudar o que "lendário" significa é decisão
de produto, não consequência de uma troca de normalização.

### Gates para o Tier S (anti-farming)

```
Rank == S  SE E SOMENTE SE:
    Poder       ≥ 85
    E  Stamina ≥ 70        // não pode ser faltoso
    E  Eficiência ≥ 60     // não pode só protocolar projeto que não anda
                           // (vale nas DUAS casas)
    E  NENHUM atributo que pontua no vermelho (< 40)
                           // Ataque, Stamina, Eficiência, Técnica e Economia — o mesmo
                           // limiar (< 40) que pinta a barra de vermelho na ficha. Não
                           // dá para ser lendário com um atributo crítico. (Influência e
                           //  Comando são informativos e não contam aqui.)
    E  NÃO possui título negativo (qualquer título de cor vermelha ativo no modo
                                   de dados corrente — ex.: "Blogueiro de Plenário",
                                   "Nobre Gastador", "Relator de Gaveta")
```

Se passar no Poder mas falhar num gate → rebaixado para **A** com selo *"S bloqueado por [motivo]"*.

---

## 3. Guildas (Partidos)

Partidos = **Guildas/Facções**.

- **Brasão da Guilda** — emblema heráldico gerado a partir da cor e sigla; exibido no card.
- **Poder da Guilda** — média/soma ponderada do Poder dos membros → alimenta o Dashboard.
- **Lore de Guilda** — espectro (esquerda/centro/direita) vira "arquétipo" (Ordem/Caos/Neutra), visual, sem juízo de valor.
- **Troca de Guilda** — filiação é versionada; a UI mostra "transferiu-se da Guilda X → Y".

---

## 4. Classes & Títulos Dinâmicos (Conquistas)

Concedidos automaticamente por regras factuais sobre os dados, no **gerador de dados (build)** —
não há job noturno; tudo é recomputado quando a ingestão roda. Cada regra é uma função booleana
sobre os atributos e a série de produção. As regras exatas (limiares e fonte) vivem em uma única
fonte, o `data/title-defs.json` emitido pelo gerador, e aparecem em `/como-calculamos` e no tooltip
de cada selo. **Os 20 títulos ativos hoje:**

| Título | Cor | Regra (resumo) |
|---|---|---|
| 🔒 **Guardião do Cofre** | 🟢 | Economia ≥ 85 (top 15% de menor gasto mensal de cota no exercício) **E** Poder ≥ 60 |
| ⚔️ **Artilheiro** | 🟢 | Ataque ≥ 90 — top 10% em proposições relevantes de autoria (PL/PLP/PEC/PDL) |
| 📜 **Relator-Mor** | 🟢 | Técnica ≥ 90 — top 10% mais designados relatores |
| 🛡️ **Presença de Ferro** | 🟢 | Stamina ≥ 95 — top 5% em voto registrado. O oposto do Fantasma |
| 📖 **Legislador Efetivo** | 🟢 | Autor de ≥ 1 proposição já **transformada em norma** na legislatura (as duas casas) |
| 📜 **Relator que Entrega** | 🟢 | Relator em ≥ 5 proposições relevantes **E** ≥ 50% avançaram |
| ⭐ **Ídolo das Redes** | 🟢 | Influência ≥ 90 **com** entrega real (Ataque ≥ 50 **E** Stamina ≥ 50) |
| 🔧 **Operário Silencioso** | 🟢 | Ataque ≥ 80 **E** (Técnica ≥ 80 **OU** Eficiência ≥ 80) **E** Influência ≤ 50 — trabalha muito, aparece pouco |
| 🐕 **Cão de Guarda** | 🟢 | Top 10% que mais cobraram o Executivo (RIC/convocação/PFC) **E** ≥ 50% de presença (só Câmara) |
| 💸 **Nobre Gastador** | 🔴 | Top 10% de maior gasto mensal de cota (CEAP/CEAPS) no exercício **E** Eficiência < 40 — mesmo gate nas duas casas |
| 👻 **Fantasma do Plenário** | 🔴 | Top 10% de **menor** taxa de voto registrado nas votações nominais do exercício (abstenção conta como voto; presença sem voto não) |
| 📱 **Blogueiro de Plenário** | 🔴 | Influência ≥ 85 **E** (Ataque < 25 **OU** Stamina < 25) **E sem nenhum título verde de entrega**. Limiar no **quartil inferior** da casa, não na mediana — estar na média não rotula ninguém |
| 🗄️ **Relator de Gaveta** | 🔴 | Relator em ≥ 10 proposições relevantes **E** nenhuma avançou |
| 🖋️ **Carimbador** | 🟣 | Top 15% de Técnica **E** terço inferior de Ataque — trabalha o texto alheio mais que o próprio |
| 🏛️ **Base do Governo** | 🟣 | Votou com o Governo em ≥ 85% das votações orientadas (só Câmara) |
| 🏛️ **Oposição** | 🟣 | Votou com o Governo em ≤ 20% das votações orientadas (só Câmara) |
| 🏛️ **Voto Avulso** | 🟣 | Votou com o Governo entre 40% e 60% — não acompanha consistentemente nenhum lado (só Câmara) |
| 🌱 **Estreante** | 🟣 | 1º mandato na casa atual |
| 🎖️ **Veterano** | 🟣 | 5+ mandatos na Câmara ou 3+ no Senado (24+ anos) |
| 🗳️ **Produção Concentrada em 2026** | 🟣 | Em exercício o mandato inteiro **E** concentrou ≥ 60% das proposições relevantes em 2026 (ano eleitoral) |

**Nome de título descreve o que foi MEDIDO, nunca o motivo.** O selo hoje chamado *Produção
Concentrada em 2026* nasceu como "Safra Eleitoral", nome que imputava oportunismo eleitoral —
uma intenção, que dado nenhum deriva. Como a ficha promete ao leitor "títulos 100% factuais", o
rótulo tem que caber dentro da regra que o concedeu. Vale para todo título novo.

**Todo selo 🔴 vermelho carrega EVIDÊNCIA**: no tooltip da carta, além da regra, aparece o número
bruto do parlamentar que disparou o gate e a **mediana da própria casa** ("compareceu a 41% das
votações — mediana da Câmara: 92%"). O motivo é que o gate é *relativo* (percentil na casa) e o
rótulo acusa em termos *absolutos*; sem o número, o selo é palavra da plataforma contra a do
parlamentar. Gerado em `scripts/lib/evidencia.mjs` (puro, com teste) e emitido em `titleEvidence`.
Selos verdes e roxos não têm evidência — não acusam ninguém.

Cada título tem uma **cor**: 🟢 verde = elogioso, 🔴 vermelho = crítico, 🟣 roxo = neutro/informativo.
Título **vermelho** ativo bloqueia o Tier S (é um dos gates); verdes e roxos são reconhecimento e
contexto — não mexem na nota. Nenhum título afeta o Poder diretamente: o Poder sai só da fórmula do §2.

> **Ainda não implementados** (design futuro, ver §5 e `architecture.md` → "Próximos incrementos"):
> detecção do "Buff do Ano Eleitoral" com título **Caçador de Votos** (exige baseline anual
> consolidada — 2026 ainda é parcial) e **Camaleão de Guilda** (trocas de partido em janela
> eleitoral). Não confundir com o **Produção Concentrada em 2026** acima, que já existe e usa uma
> regra mais simples (concentração de autorias em 2026), sem série mensal.

---

## 5. Banco de Dados & detecção do "Buff do Ano Eleitoral"

> ⚠️ **Design-alvo, NÃO o que roda hoje.** A arquitetura atual é **estática**: a ingestão
> (`scripts/ingest-real.mjs`) lê as fontes no build e emite JSON — não há banco relacional
> nem série **mensal** (só agregados anuais de produção, no array `producaoAnual`). O esquema SQL
> e o detector de buff abaixo são o alvo para quando existir série mensal consolidada; a
> `architecture.md` os referencia como incremento futuro ("Caçador de Votos real"). O que existe
> hoje na direção do buff é o título **Produção Concentrada em 2026** (regra simples de
> concentração de autorias), não o algoritmo mensal desta seção.

A chave (do design-alvo) é **não guardar só o estado atual** — guardar **séries temporais mensais** e derivar agregados anuais.

```sql
-- Núcleo
politicians        (id, nome, casa[camara|senado], uf, foto_url, created_at)
parties            (id, sigla, nome, cor_hex, espectro, brasao_url)          -- Guildas
mandates           (id, politician_id, party_id, ano_inicio, ano_fim,
                    ordem_mandato, is_reeleicao_target BOOLEAN)

-- Série temporal (coração da detecção)
activity_monthly   (id, politician_id, ref_year, ref_month,
                    presencas, faltas, votacoes_nominais,
                    projetos_apresentados, projetos_aprovados,
                    relatorias, gasto_cota_centavos)
social_monthly     (id, politician_id, ref_year, ref_month,
                    seguidores, posts, likes, comentarios, shares)
benefit_usage_monthly (id, politician_id, ref_year, ref_month,
                    tipo_beneficio[cota|auxilio_moradia|passagens|verba_gabinete],
                    valor_usado_centavos, teto_centavos)      -- % de uso = valor/teto

-- Derivados (recalculados em batch)
ranks_history      (id, politician_id, ref_period, ops, tier,
                    stamina, ataque, tecnica, eficiencia, influencia, economia,
                    s_gate_bloqueado_por)
titles             (id, politician_id, slug, raridade, cor, ativo, granted_at)
battles            (id, politician_a, politician_b, vencedor_id, placar_json, created_at)
```

### Algoritmo do Buff Eleitoral

```python
def detecta_buff(politician_id, mandato):
    baseline = media(activity_anual, anos=[1, 2, 3])   # anos iniciais
    alvo     = activity_anual(ano=4)                    # ano de reeleição

    ratio_producao = alvo.produtividade / max(baseline.produtividade, 1)
    ratio_presenca = alvo.presenca      / max(baseline.presenca, 1)

    baixa_no_inicio = baseline.percentil < 40
    pico_no_fim     = ratio_producao >= 1.5 or ratio_presenca >= 1.4

    return baixa_no_inicio and pico_no_fim   # → título "Caçador de Votos"
```

A regra é explicável: o card mostra um mini-gráfico "produção por ano" onde o *spike* do ano 4
fica visível — prova visual do título.

---

## 6. UI — Página de Perfil (Character Card)

Formato de carta de RPG/TCG, retrato, moldura que muda de cor conforme o Tier
(S = dourado holográfico; F = cinza rachado).

- Barras de atributo animadas ao carregar.
- Badges de título clicáveis → tooltip com a regra factual que o concedeu.
- Sparkline de produção anual (evidência de buff/consistência).
- Efeito holográfico apenas em S/A.
- Rodapé com fonte do dado + data da última atualização.

Ver mockup: [`mockups/plenaria-mockup.html`](../mockups/plenaria-mockup.html) (aba **Card**).

---

## 7. UI — Modo Batalha (Versus 1v1)

Tela split-screen estilo fighting game.

- Usuário escolhe 2 políticos (autocomplete ou "rival aleatório").
- Cada atributo é um round: maior valor vence; barra tug-of-war acende do lado vencedor.
- Vencedor geral = mais rounds (empate → desempata pelo Poder). Animação de K.O.
- Botão de compartilhar gera imagem do placar.
- Aviso quando cruza casas diferentes (Deputado × Senador).

Ver mockup: [`mockups/plenaria-mockup.html`](../mockups/plenaria-mockup.html) (aba **Batalha**).

---

## 8. Dashboard de Insights

- 📈 Hall da Fama / Muro da Vergonha — top e bottom nacionais por Poder.
- 💸 Gasto × Entrega — scatter (gasto de cota × Poder) para achar "Nobres Gastadores",
  facetado por casa (small multiples, eixo X compartilhado): CEAP e CEAPS são cotas
  distintas. Junto dele: painel comparativo Câmara × Senado (média, mediana, maior
  gasto, total) e ranking de guildas por gasto MÉDIO por parlamentar, também por casa
  (o total da bancada só mede o tamanho dela).
- 🎯 Concentração de fornecedor — maior fatia da cota de um parlamentar num só fornecedor.
  Quando esse fornecedor é **pessoa física** (23 fichas hoje: locador do escritório, prestador
  de serviço do gabinete), entra **o que foi contratado, não o nome dela**. O dado é público na
  origem, mas publicidade na origem não dispensa a necessidade na reutilização: o nome não
  acrescenta nada à frase que o painel afirma ("35% da cota num só fornecedor, aluguel de
  escritório"), a pessoa não é agente público, e nomeá-la ao lado do parlamentar com um
  percentual e sem explicação faz o leitor completar sozinho uma acusação que o dado não
  sustenta. Minimização na EMISSÃO: o nome não é gravado em JSON nenhum (`ehCpf`, cota.mjs).
- 🏢 Empresas que mais receberam da cota + 📊 Concentração do mercado da cota — o outro
  lado da nota fiscal, agregado por **CNPJ** (nome é texto livre: um mesmo CNPJ aparece
  com até 630 grafias). Aqui as duas casas somam, porque o sujeito é a empresa e o teto
  de cota de cada casa não pesa sobre quem recebeu. Três regras: **só CNPJ** (lançamento
  em CPF é pessoa física — nunca em ranking público), **denominador declarado** (o % é
  fatia do universo com CNPJ identificado; ~16% da cota é SIGEPA, que não identifica
  pessoa jurídica, ou CPF) e o **painel de concentração é obrigatório junto** — a maior
  empresa fica com ~1,3% de ~43 mil CNPJs, e sem essa leitura um top 15 solto sugere
  captura, o oposto do que o dado mostra.
- 📜 Virou lei — o DESFECHO (ver §11): total de normas das duas casas, Legisladores
  Efetivos, o feed das mais recentes e o perfil temático do que foi aprovado, com a
  **taxa de conversão** por tema e o recorte de homenagens/datas.
- 🗂️ Prioridades — em que o Congresso legisla, por casa, e a **assinatura** de cada
  guilda (ver §10). O ranking absoluto por guilda seria inútil e não óbvio que é:
  medido na legislatura, "Administração Pública" e/ou "Direitos Humanos e Minorias"
  aparecem no top-3 de 7 dos 8 maiores partidos, porque dominam o Congresso inteiro.
- 🌱 Renovação & Idade — estreantes × veteranos e distribuição etária.
- ⚥ Representatividade de Gênero.
- 🏛️ Alinhamento × Fiscalização — scatter (só Câmara), com "Os Dissidentes" (quem mais
  votou contra a própria bancada) e "Quem mais cobra o Executivo".
- 🗺️ Mapa do Brasil (nas páginas de estado, `/estado`) — heatmap por UF com camadas:
  Poder médio, densidade de qualquer título, gasto de cota, alinhamento e perfil da
  bancada (tamanho, idade, % de mulheres). Rampa **neutra** onde a métrica é neutra
  (alinhamento, títulos) — a cor nunca julga o que a métrica não julga.

> O **Radar de Ano Eleitoral** ("Caçadores de Votos") ainda não existe — depende da
> detecção de buff do §5, que exige série mensal consolidada.

Nota: Top Economia exclui gasto R$ 0 — sem lançamento de cota no período é
indistinguível de falha de match com a base, então não vale como "o mais frugal".

---

## 9. Riscos & Guardrails

1. **Reputação/viés** — fórmula pública e versionada (página "Como calculamos"). Ativo mais valioso.
2. **LGPD/Instagram** — apenas contagem de seguidores de perfis públicos, coletada via Apify; cachear métricas agregadas.
3. **Difamação** — títulos negativos sempre factuais e rastreáveis: a regra fica no tooltip e no
   `/como-calculamos`, e o selo vermelho exibe o **número bruto + a mediana da casa** (`titleEvidence`).
4. **A imagem de compartilhamento não leva títulos — nenhum, nem os elogiosos.** Ela circula
   sozinha, longe da regra, do número bruto e do canal de correção, e é sobre a peça COMO ELA
   CIRCULA que se avalia se houve crítica fundamentada ou ofensa. No lugar dos selos vão os
   números brutos por atributo (`rawCurto`: "ECONOMIA 40 · R$ 46 mil/mês de cota"), que se
   explicam sozinhos, mais o crédito da foto e o link da fórmula. Quem quiser o selo vai à ficha,
   onde há regra, evidência e correção. Sobre a licença das fotos (fontes primárias, jul/2026): a
   Câmara pede só citar a fonte "Câmara dos Deputados" (Termo de Uso, item 7); o Senado exige citar
   a Agência Senado, veda alteração/descaracterização e **proíbe uso comercial, político-ideológico
   e anúncios** — monetizar o site exigiria antes resolver a origem das fotos do Senado.
5. **Nenhuma penalidade externa entra no Poder — e o Karma saiu por isso.** O *Karma Pesado*
   (contas irregulares no Cadirreg do TCU, −10 pts por processo) foi removido em jul/2026. O
   motivo decisivo NÃO foi jurídico: o Senado não expõe CPF, então senador nenhum podia receber
   a penalidade, enquanto deputado podia perder até 25 pontos — e os cortes de Tier são
   ABSOLUTOS entre as casas. Era o mesmo viés estrutural que o projeto combate em todos os
   outros atributos (ver a âncora na mediana, em AGENTS.md). Somou-se a isso que contas
   irregulares podem ser de gestão anterior ao mandato, contrariando o disclaimer que abre toda
   ficha ("medimos o exercício do mandato"), e que o sinal acendia para 1 parlamentar em 593 —
   nenhum Tier S jamais foi bloqueado por ele. Ganho lateral: sem a consulta ao TCU, o CPF
   deixou de ser lido pelo pipeline. **Só reintroduzir se valer nas duas casas e medir o mandato.**
6. **Responsável, privacidade e correção** — a página `/sobre` identifica quem publica, declara a base
   legal do tratamento (LGPD art. 7º, IX e §3º — dado público sobre exercício de função pública) e abre
   canal de correção com prazo de resposta. Sem canal, a primeira discordância chega como notificação
   judicial; e o titular tem direito de retificação (art. 18) contra ALGUÉM.
7. **Ano eleitoral** — a Batalha é determinística e não coleta preferência de voto: **nunca** introduzir
   votação de usuário nela. Um "quem vence?" agregado sobre candidatos vira enquete/pesquisa eleitoral
   não registrada (Lei 9.504/97, art. 33). Pelo mesmo motivo, o site não é impulsionado de forma paga.
8. **Ponderação de projetos** — "aprovado" precisa de peso por relevância (PEC ≠ moção de aplauso).
9. **O universo do site é quem está EM EXERCÍCIO — e a ausência é nomeada, não escondida.** As duas
   casas publicam apenas o parlamentar sentado: o titular licenciado (ministro, secretário, licença
   longa) some da fonte, e com ele todo o dado de atividade. Ele não entra no ranking — não há o que
   medir —, mas some do site inteiro sem explicação, o que faz a plataforma parecer incompleta ou
   seletiva justamente com nomes conhecidos. Por isso `data/licenciados.json` emite **nome, casa,
   partido/UF e a data do afastamento**, exibidos na página da guilda e do estado. Três limites
   inegociáveis: (a) **nunca o motivo da licença** — nenhuma das duas casas o publica (o
   `descricaoStatus` da Câmara vem vazio até para quem assumiu ministério), e escrevê-lo seria
   imputar fato não derivável; (b) no Senado a inclusão é por **código de causa** em allowlist
   (`LCS`, `AFO`, `LP`, `LS`), porque a consulta ingênua devolve junto falecidos, cassados e
   renúncias — chamar isso de "licença" publicaria que um parlamentar morto está temporariamente
   afastado; (c) causa desconhecida é **logada e tratada como não-licença**: omitir um nome é o
   status quo, afirmar errado não. Cache volátil — licença termina.

---

## 10. Prioridades — "no que este parlamentar trabalha"

Descreve o **assunto** da produção legislativa, ao lado do que os atributos já medem
(volume, aproveitamento, presença, gasto). É **informativa**: não pontua no Poder, não
muda o Tier e **não gera título**.

### Fonte: classificação oficial das duas casas, não IA

As duas casas publicam a própria classificação temática, e é dela que sai todo número:

| Casa | Fonte | Vocabulário |
|---|---|---|
| Câmara | bulk `proposicoesTemas-{ano}.csv` | 32 temas, lista plana |
| Senado | `/processo/{id}` → `classificacoes` | hierarquia: 10 macro-classes, 63 classes de nível 2 |

⚠️ **`/materia/{codigo}` do Senado é uma armadilha.** Ele tem o campo `Classificacoes` e
responde **200 com corpo vazio** — foi descontinuado (desativação completa em
2026-02-01) e a própria resposta aponta o substituto. Medida por ele, a cobertura do
Senado "é" de 20%; pelo `/processo/{id}`, é de **98%**. Um endpoint morto que devolve
200 apagaria o tema de 4 em cada 5 senadores sem erro nenhum no log.

Os dois vocabulários viram **20 rótulos comuns** por uma tabela determinística e testada
(`scripts/lib/temas.mjs`), pelo mesmo motivo e no mesmo padrão do `rotuloCategoria` da
cota (CEAP × CEAPS): uma guilda tem bancada mista e precisa somar uma coisa só. Esse
mapa é decisão **editorial**, não dado da fonte — por isso é publicado inteiro em
`/como-calculamos`. Rótulo desconhecido cai em "Outros temas" **e é logado**, nunca
dropado.

### Universo e contagem

- **Universo**: autoria **principal** de PL/PLP/PEC/PDL — o mesmo recorte do Ataque, e a
  pauta que o parlamentar *escolheu*. Relatoria fica de fora: é designação da mesa ou da
  comissão, então entraria como "prioridade" uma pauta imposta.
- **Contagem cheia**: uma proposição com 3 temas conta **inteira nos 3**. Cada linha é
  uma afirmação independente e literal ("41 das 120 proposições tocam Saúde"), e por
  isso **os percentuais não somam 100%** — uma proposição trata de ~2,1 temas em média.
  A alternativa fracionária (1/n por tema) somaria 100%, mas embutiria a suposição de
  que os três temas de uma PEC pesam igual (ponderação nossa, não da fonte) e produziria
  brutos como "13,7 proposições", que não existem.
- **Agregação de bancada**: soma ÷ soma, nunca média das porcentagens individuais — a
  mesma regra que o `guilda-bruto.mjs` já fixou.

### Assinatura da guilda (o desvio, não o absoluto)

O perfil absoluto **não distingue guilda nenhuma**, e isso não é óbvio até medir: em
2025, "Administração Pública" e/ou "Direitos Humanos e Minorias" aparecem no top-3 de 7
dos 8 maiores partidos. O que separa é o desvio da média das duas casas — PL →
Defesa e Segurança (+5,7 p.p.), PT → Trabalho e Emprego (+8,1), MDB → Cidades (+8,6).

É **comparação, não juízo**: o número nacional vai sempre ao lado, e nenhuma cor de
bom/ruim acompanha a barra. Bancadas com menos de 5 parlamentares ficam fora — três
proposições do mesmo assunto produziriam um desvio enorme por acidente aritmético.

### Faixa no card

O card exibe o tema do topo na **mesma faixa** que hoje anuncia "sem Tier" — os dois
estados são mutuamente exclusivos, porque quem está fora do ranking não tem prioridade
para mostrar. Duas travas: o **piso** (≥ 5 proposições, ≥ 3 no tema do topo), porque
"1 de 2 = 50% Saúde" seria prioridade nascida de ruído; e o **bruto nunca truncado** —
só o nome do tema encolhe, já que "Saúde" sozinho seria um selo temático sem prova.

### Camada de IA — o parágrafo, nunca o número

Onde houver um texto interpretativo, ele é escrito por IA, **marcado como tal** com
modelo, data e link para o prompt versionado (`docs/prompts/prioridades-v1.md`). A IA
**lê**; ela não classifica, não conta e o prompt a proíbe de citar qualquer quantidade
que não esteja na tabela ao lado.

A regra que sustenta a camada: cada análise carrega o **`fonteHash`** dos números que
descreve, e a UI só a renderiza se ele bater com o hash calculado no build. Assim a
única falha grave possível — um texto de julho publicado ao lado das barras de setembro,
parecendo análise do dado atual — não acontece em silêncio: a análise simplesmente some,
e o gerador loga quantas ficaram obsoletas.

O escopo desta fase (guildas + panorama nacional, ~25 textos) foi escolhido para caber
em **revisão humana integral**. Estender ao parlamentar individual são 594 parágrafos
sobre pessoas nomeadas, impossíveis de revisar um a um — o contrato já aceita a chave
`parlamentar:<slug>`, mas a decisão de gerá-los é separada.

---

## 11. "Virou lei" — o desfecho, não a intenção

Todo o resto do produto mede **atividade**: quanto se apresentou (Ataque), quanto
andou (Eficiência), sobre o quê (Prioridades), quanto se gastou (Economia). Esta
seção mede **desfecho** — a proposição de autoria principal que foi *transformada em
norma jurídica*. É o dado mais duro do site e o mais raro: a maioria dos
parlamentares não tem nenhum.

### O que conta

- **Autoria principal** (`proponente = 1` na Câmara, `IndicadorAutorPrincipal = Sim`
  no Senado). Uma lei tem muitas mãos — relatoria, emendas, articulação — e a
  plataforma credita só a assinatura que a fonte registra como proponente. A UI diz
  isso em todas as três superfícies.
- **Norma jurídica**, não "lei" no sentido estrito: lei ordinária, lei complementar,
  emenda constitucional ou decreto legislativo. O tipo aparece no nome de cada linha,
  então o leitor nunca precisa deduzir qual é qual.
- **O mesmo recorte dos atributos**: proposições *numeradas nesta legislatura*. Um
  projeto de 2019 sancionado agora não aparece — e a nota de rodapé de cada painel diz
  isso, porque sem ela a lista se leria como o currículo completo do parlamentar.

### O nome da norma: uma casa publica, a outra não

A proposição tem um nome (`PL 358/2025`); a norma tem outro (`Lei 15.172/2025`), e é
o segundo que o leitor reconhece. As duas casas o expõem de formas muito diferentes:

| Casa | Onde está | Confiabilidade |
|---|---|---|
| Senado | campo `normaGerada` do `/processo` ("Lei nº 15.042 de 11/12/2024") | vocabulário fechado, parse trivial |
| Câmara | **em campo nenhum** — só na PROSA do despacho da tramitação | exige varrer todas as tramitações |

⚠️ Duas armadilhas medidas na Câmara: o `urnFinal` vem **vazio** no bulk e na API (é o
campo que existe para isso), e o `ultimoStatus_despacho` do bulk **não serve** — depois
de virar lei a matéria continua tramitando (ofícios, autógrafos, retificações), então
em 9 de cada 10 casos o último despacho fala de outra coisa: só **78 de 793**
proposições transformadas tinham ali o número da norma. Por isso a ingestão busca
`/proposicoes/{id}/tramitacoes` de cada transformada (centenas de chamadas, cache
permanente em `data/raw/normas-camara.json`) e procura o despacho `"Transformado
no(a) …"`.

**Quando não casa, o número é OMITIDO — nunca estimado.** A linha cai para a
identificação do projeto e fica visivelmente mais modesta, que é a leitura correta:
não sabemos o nome da lei. Mesmo princípio da frase de evidência dos títulos
vermelhos.

### Onde aparece

| Superfície | O que mostra |
|---|---|
| Ficha do parlamentar | painel "📜 Virou lei" — cada norma com nome, ementa, data e link para a página oficial da casa |
| Guilda | "📜 O que a bancada emplacou" — soma simples da bancada e quem emplacou, com o nº de membros na mesma frase |
| Insights | seção própria `/insights/leis` — total das duas casas, Legisladores Efetivos (top 20) e o feed das normas mais recentes |

### O que a seção NÃO faz

**Não pontua.** A contagem já entra na Eficiência como bônus (`min(15, 5 × leis)`);
exibi-la aqui é exibição, não um segundo atributo. Não cria Tier, não cria gate e não
cria título — o único título envolvido, `Legislador Efetivo`, já existia e continua
com a mesma regra.

**A agregação de bancada é soma simples**, não taxa: uma lei sancionada é um evento
inteiro, não uma fração. Por isso não há denominador de guilda — "o PT emplacou 14
leis" é afirmação completa —, e o número de parlamentares vai na mesma linha para que a
comparação entre bancadas de tamanhos diferentes seja do leitor.

**Uma lei com dois autores principais é UMA linha com dois nomes** no feed dos
Insights, nunca duas: agrupar por proposição impede que a mesma norma seja contada
duas vezes no que se apresenta como cronologia.

### Autoria coletiva — por que as contagens não somam entre si

Uma matéria pode ter **dezenas de autores principais** (medido: até 59 numa só). Isso
não é ruído da fonte: é como o Congresso assina projetos de bancada. Duas consequências
que a UI precisa dizer em voz alta, porque ambas seriam lidas erradas em silêncio:

1. **A mesma lei entra na conta de cada autor.** Somar as contagens individuais do
   ranking dá um número maior que o de normas distintas (medido: 445 contagens para 191
   normas). Por isso os Insights publicam as duas grandezas lado a lado.
2. **O feed não nomeia autoria coletiva acima de 3.** Nomear os 59 vira parede de nomes
   que soterra a ementa; nomear "os 3 primeiros" seria **crédito arbitrário** — a ordem
   em que a fonte lista os autores não é hierarquia. Acima do limite o painel *conta* em
   vez de escolher ("autoria coletiva — 34 parlamentares em exercício"), e o link leva à
   lista oficial completa. Mesmo princípio da omissão do nome do fornecedor pessoa
   física: quando nomear não acrescenta ao que o painel afirma, não se nomeia.

### O que o Congresso aprova, por tema — e por que NÃO é a IA que agrupa

A contagem de leis responde "quanto". Para responder **"o quê"**, as normas são
agrupadas pela **classificação temática oficial** das duas casas — exatamente a das
Prioridades (§10), com cobertura medida de **100% nas normas** (139/139 na Câmara,
52/52 no Senado).

A alternativa considerada e **descartada** foi pedir à IA que lesse as 191 ementas e
inventasse segmentos. Ela cai por três motivos, na ordem em que importam:

1. **Joga fora dado oficial com cobertura total** para substituí-lo por juízo de modelo.
2. **Deixa de ser auditável**: o leitor não tem contra o que conferir, e duas execuções
   podem produzir segmentos diferentes sobre os mesmos dados.
3. **Contradiz o contrato da camada de IA** deste projeto, que é explícito — a IA *lê*,
   não classifica e não conta (§10 e `scripts/lib/analises.mjs`).

A IA entra onde sempre entrou: escrevendo o **parágrafo de leitura** da tabela, com selo,
modelo, data e link para o prompt versionado (`docs/prompts/leis-v1.md`), sob alvos
próprios (`leis:nacional`, `leis:guilda:<sigla>`) para que um texto sobre o que se
*aprova* nunca apareça ao lado da tabela do que se *apresenta*.

**Duas contas que não se confundem** (`scripts/lib/leis-temas.mjs`, com teste):

| Grandeza | O que é | Armadilha |
|---|---|---|
| **% das normas** | composição — quanto do aprovado toca o tema | contagem CHEIA, não soma 100% |
| **taxa de conversão** | normas ÷ proposições apresentadas no mesmo tema | os dois lados precisam ser DEDUPLICADOS |

A taxa é a que responde "de fato". Ela exige que o denominador seja de proposições
**distintas**, como o numerador: comparar um lado deduplicado com outro multiplicado por
coautoria daria uma taxa inventada. E ela só é publicada acima de um **piso de normas** —
com 2 leis num tema, "50% de aproveitamento" seria ruído vendido como fato; abaixo do
piso a linha existe com a contagem, sem a razão.

### Homenagens e datas — publicar o número, recusar o adjetivo

Um recorte tem tratamento próprio: as normas classificadas como **Homenagens e Datas**
("Homenagens e Datas Comemorativas" na Câmara, "Honorífico" no Senado) — conferir a um
município o título de "Capital Nacional de X", instituir dia ou semana nacional,
inscrever um nome no Livro dos Heróis da Pátria, reconhecer manifestação cultural.

Ele existe porque é **o único lugar do site em que o leitor avalia o CONTEÚDO do que foi
aprovado**, e não o volume. Medido na legislatura: **60 das 191 normas (31%)**, sendo 23
exclusivamente disso. É também o tema de **maior taxa de conversão** — enquanto Saúde
converte 0,5% e Direito/Justiça 0,3%.

A regra editorial é a que sustenta o recorte: **a plataforma conta, o leitor julga.**
O rótulo é da fonte, não nosso, e a classificação de cada norma é conferível na página
oficial dela. Chamar essas leis de "inúteis" ou "vazias" seria opinião da plataforma —
o mesmo erro que derrubou o título "Safra Eleitoral" (§ Convenções). O número de 1 em
cada 3 sustenta o argumento melhor que qualquer adjetivo, e sobrevive à contestação.
Nenhuma cor de alarme acompanha o painel, pela mesma razão do `higherIsBetter: null`.

### Tema clicável — por que a lista fica no site, e não num link para a Câmara

Na ficha do parlamentar, cada tema do painel "No que trabalha" abre as proposições
dele naquele tema, com ementa e link para a página oficial de cada uma.

O caminho óbvio — mandar o leitor para uma busca na Câmara já filtrada — **não existe**:

| Caminho | Por que não serve |
|---|---|
| Busca do portal da Câmara | não tem filtro por tema **nem** campo de nome de autor (só partido, UF, situação, órgão) — verificado no formulário avançado |
| API de Dados Abertos | cruza autor × tema (e aceita vários `codTema`, cobrindo nossos rótulos fundidos), mas devolve **JSON cru** e conta diferente: inclui coautoria, e nós contamos só autoria principal — medido, **42 contra 39** |
| Portal do Senado | outro vocabulário e outro site: nenhuma URL da Câmara serve para metade das fichas |

Mandar o leitor para uma lista que **contradiz o número da tela** seria pior que não
ter link — é a mesma regra que mantém o `fonteHash` nas análises de IA.

A lista servida no site sai do **mesmo dado que produziu o número** (conferido: 303 no
arquivo, 303 no painel), funciona nas duas casas, e cada linha continua levando à fonte
oficial — que era o objetivo.

**Onde os dados moram**: `public/data/props/<slug>.json`, um arquivo por parlamentar
(~584 arquivos, ~11 MB, ~19 KB cada), buscado pela ilha client no **primeiro clique** —
nunca no carregamento. São ~33 mil proposições no total: como campo do
`politicians.json` elas quadruplicariam o JSON lido por toda página do site para servir
a um painel que a maioria não abre.
