# Prompt `leis-v1` — leitura do que o Congresso APROVA

Prompt exato dos parágrafos marcados como **"Análise gerada por IA"** ao lado das barras
de `/insights/leis` e do painel "O que a bancada aprovou, por tema" nas guildas. É
versionado aqui e linkado de toda análise publicada: quem lê o texto no site consegue
ler, aqui, sob quais instruções ele foi escrito.

Trocar qualquer coisa abaixo exige **subir a versão** (`leis-v2.md`) e regravar
`promptVersao` nas análises novas. Análise antiga continua apontando para o prompt que
de fato a produziu.

## O que esta camada é (e o que não é)

**O modelo não agrupa lei nenhuma.** O agrupamento temático sai da classificação
**oficial** das duas casas — a mesma das Prioridades, com 100% de cobertura nas normas
(medido: 139/139 na Câmara, 52/52 no Senado) — normalizada pela tabela determinística e
testada de `scripts/lib/temas.mjs`. Pedir ao modelo que lesse as ementas e inventasse
"segmentos" jogaria fora dado oficial auditável e produziria agrupamentos diferentes a
cada execução, que ninguém poderia contestar na fonte.

O papel do modelo é **ler** a tabela pronta e escrever um parágrafo. A regra mais
importante do prompt segue sendo negativa: **o modelo não produz nenhuma quantidade**.

Esta tabela é a das normas APROVADAS — não confundir com a das Prioridades, que conta o
que foi apresentado. Por isso os alvos têm chave própria (`leis:nacional`,
`leis:guilda:<sigla>`): um texto escrito sobre uma tabela nunca pode aparecer ao lado
da outra.

## Prompt

```
Você vai escrever UM parágrafo em português do Brasil descrevendo o que <ALVO>
efetivamente APROVOU — as proposições que foram transformadas em norma jurídica.

DADOS (a única fonte que você pode usar):

<TABELA>
  Uma linha por tema, sobre as NORMAS (não sobre o que foi apresentado):
  tema | nº de normas no tema | % das normas | nº de proposições apresentadas no
  mesmo tema | taxa de conversão (normas ÷ apresentadas), quando publicada
  Total de normas distintas: <N>
  Normas com classificação "Homenagens e Datas": <H> (<E> tratam só disso)
</TABELA>

<EMENTAS>
  Uma amostra das ementas reais das normas, agrupadas por tema.
</EMENTAS>

REGRAS — todas obrigatórias:

1. NÃO cite nenhum número que não esteja literalmente na TABELA. Não calcule, não
   arredonde para um número diferente, não estime, não some linhas.
2. Toda porcentagem que você citar deve vir acompanhada do que ela mede. Distinga
   sempre "% das normas" (composição) de "taxa de conversão" (quanto do que se
   apresenta chega a virar norma) — são grandezas diferentes e confundi-las é o
   erro mais provável aqui.
3. Os percentuais de composição NÃO somam 100% — uma norma pode ter vários temas.
   Nunca descreva a distribuição como divisão de um todo.
4. Onde a taxa de conversão não estiver na tabela, ela não existe para você: foi
   omitida por estar abaixo do piso de normas, e inventá-la transformaria ruído em
   fato.
5. Descreva o que foi APROVADO. Não afirme intenção, estratégia, motivação,
   coerência ideológica ou oportunismo eleitoral de ninguém.
6. Sobre "Homenagens e Datas" (títulos de "Capital Nacional", datas comemorativas,
   Livro dos Heróis da Pátria): você PODE dizer quanto do que foi aprovado é disso,
   porque é o número da tabela e é o dado mais informativo desta análise. Você NÃO
   PODE chamar essas normas de inúteis, vazias, menores, irrelevantes, "para inglês
   ver" ou equivalente, nem afirmar que o Congresso "perde tempo" com elas. Relate a
   proporção e deixe o juízo para quem lê. A mesma regra vale ao contrário: não
   defenda nem minimize.
7. Não compare com outras bancadas além do que a tabela permitir, e ao comparar diga
   sempre contra o quê.
8. Não mencione nomes de pessoas.
9. Não conclua nada sobre desempenho, eficiência, presença ou gasto de ninguém.
10. Se os dados forem escassos (poucas normas), diga isso em vez de generalizar.

FORMA: um parágrafo, 3 a 5 frases, sem título, sem lista, sem markdown. Tom
descritivo e sóbrio, como uma legenda de gráfico — não é opinião nem manchete.
```

## Por que estas regras específicas

- **(2)** é a armadilha central desta tabela. "Homenagens e Datas é 31% das normas" e
  "3,6% das proposições de homenagem viram norma" são fatos diferentes sobre a mesma
  linha, e trocá-los produz uma afirmação falsa que soa plausível.
- **(4)** protege o piso: a taxa é omitida quando o tema tem poucas normas justamente
  porque "50% de aproveitamento" a partir de 2 leis é ruído. Um modelo que a
  reconstruísse dividindo as colunas desfaria a proteção.
- **(6)** é a regra mais delicada da camada e existe porque este recorte foi pedido
  exatamente para dar visibilidade a ele. A saída honesta é publicar o **número** e
  recusar o **adjetivo**: a classificação é oficial e contestável na fonte, o
  julgamento não seria. É a mesma disciplina que renomeou o título "Safra Eleitoral"
  para "Produção Concentrada em 2026" — a plataforma conta, o leitor conclui.
- **(5) e (9)** repetem o contrato das Prioridades: a análise é sobre o que foi
  aprovado, não sobre quem aprovou.

## Fluxo de publicação

1. Gerar o parágrafo com o prompt acima.
2. Calcular `fonteHash` do agregado exibido (`scripts/lib/analises.mjs`).
3. Acrescentar a entrada em `data/analises.json` com `alvo` (`leis:nacional` ou
   `leis:guilda:<sigla>`), `texto`, `modelo`, `geradoEm`, `promptVersao`, `fonteHash`
   e `revisadoPor`.
4. **Revisar a olho** antes do commit.

Se os números mudarem numa reingestão, o `fonteHash` deixa de bater e o site para de
exibir o texto — sem erro, sem aviso ao leitor, e sem nunca mostrar análise velha ao
lado de dado novo.
