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
| **Stamina** (Vigor) | 🛡️ | Comparecimento às votações nominais | presenças ÷ votações ocorridas durante o exercício (taxa, não contagem bruta — não penaliza quem assumiu tarde ou ficou licenciado). **Escala linear na taxa**, ancorada na mediana da casa (= 50), p5 = 0 e p95 = 100 — não percentil. No percentil a inclinação seguia a densidade local de colegas: no Senado, onde a mediana comparece a 92% e a distribuição encosta no teto de 100%, o mesmo 1 ponto percentual de presença valia de 0 a 7,5 pontos de atributo conforme o senador caísse num aglomerado ou num vazio. Com a escala linear a inclinação é constante dentro de cada metade, e a razão de sensibilidade entre as casas caiu de 2,3x para 1,3x. Resíduo assumido: a metade de cima do Senado segue íngreme (1,25 ponto de Poder por p.p.) porque metade da casa vive nos últimos 8 pontos percentuais — é limite do dado, não da escala. **No Senado entram também as votações secretas** — elas são a sabatina de autoridades (art. 52, III e IV: STF, STJ, TCU, Banco Central, agências, embaixadores), competência privativa da casa e 58% das suas votações nominais. Só a **presença** é lida; como o senador votou é secreto e a plataforma não exibe. A ausência é identificada pelo **código** do campo do voto (`AP` atividade parlamentar, `MIS` missão da Casa, `LS`/`LP`/`LAP` licenças, `NCom` não compareceu — `scripts/lib/voto-senado.mjs`), nunca por texto livre: os motivos convivem na mesma coluna dos votos, e ler a descrição em prosa já deixou "Missão da Casa" passar por presença em 593 votações |
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
| 🛡️ **Presença de Ferro** | 🟢 | Stamina ≥ 95 — top 5% de comparecimento. O oposto do Fantasma |
| 📖 **Legislador Efetivo** | 🟢 | Autor de ≥ 1 proposição já **transformada em norma** na legislatura (as duas casas) |
| 📜 **Relator que Entrega** | 🟢 | Relator em ≥ 5 proposições relevantes **E** ≥ 50% avançaram |
| ⭐ **Ídolo das Redes** | 🟢 | Influência ≥ 90 **com** entrega real (Ataque ≥ 50 **E** Stamina ≥ 50) |
| 🔧 **Operário Silencioso** | 🟢 | Ataque ≥ 80 **E** (Técnica ≥ 80 **OU** Eficiência ≥ 80) **E** Influência ≤ 50 — trabalha muito, aparece pouco |
| 🐕 **Cão de Guarda** | 🟢 | Top 10% que mais cobraram o Executivo (RIC/convocação/PFC) **E** ≥ 50% de presença (só Câmara) |
| 💸 **Nobre Gastador** | 🔴 | Top 10% de maior gasto mensal de cota (CEAP/CEAPS) no exercício **E** Eficiência < 40 — mesmo gate nas duas casas |
| 👻 **Fantasma do Plenário** | 🔴 | Top 10% de **menor** comparecimento às votações nominais do exercício |
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
- 🏆 Ranking de Guildas — barra empilhada por tier.
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
