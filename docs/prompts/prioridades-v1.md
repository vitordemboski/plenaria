# Prompt `prioridades-v1` — leitura das prioridades legislativas

Este é o prompt exato usado para gerar os parágrafos marcados como **"Análise gerada
por IA"** nas páginas de guilda e na `/insights/prioridades`. Ele é versionado no
repositório e linkado a partir de toda análise publicada: quem lê o texto no site
consegue ler, aqui, sob quais instruções ele foi escrito.

Trocar qualquer coisa abaixo exige **subir a versão** (`prioridades-v2.md`) e regravar
`promptVersao` nas análises novas. Análise antiga continua apontando para o prompt que
de fato a produziu.

## O que esta camada é (e o que não é)

Os números não vêm daqui. A distribuição temática sai da classificação **oficial** da
Câmara (`proposicoesTemas-{ano}.csv`) e do Senado (`/processo/{id}.classificacoes`),
normalizada por uma tabela determinística e testada (`scripts/lib/temas.mjs`). O papel
do modelo é **ler** essa tabela e as ementas e escrever um parágrafo.

Por isso a regra mais importante do prompt é negativa: **o modelo não produz nenhuma
quantidade**.

## Prompt

```
Você vai escrever UM parágrafo em português do Brasil descrevendo em que assuntos
<ALVO> concentra sua produção legislativa.

DADOS (a única fonte que você pode usar):

<TABELA>
  Distribuição temática oficial, uma linha por tema:
  tema | nº de proposições que tocam o tema | % sobre o total | % no Congresso inteiro
  Total de proposições de autoria com tema: <N>
  Temas por proposição (média): <M>
</TABELA>

<EMENTAS>
  Uma amostra das ementas reais das proposições, agrupadas por tema.
</EMENTAS>

REGRAS — todas obrigatórias:

1. NÃO cite nenhum número que não esteja literalmente na TABELA. Não calcule, não
   arredonde para um número diferente, não estime, não some linhas. Se quiser dizer
   "mais da metade", confirme na tabela; se não estiver lá, não diga.
2. Toda porcentagem que você citar deve vir acompanhada do que ela mede. "34% das
   proposições tocam Saúde", nunca "34% de prioridade em Saúde".
3. Os percentuais NÃO somam 100% — uma proposição pode ter vários temas. Nunca
   descreva a distribuição como uma divisão de um todo ("metade do esforço foi
   para X").
4. Descreva o que foi PROPOSTO. Não afirme intenção, estratégia, motivação,
   coerência ideológica ou oportunismo eleitoral. "Concentra autorias em segurança
   pública" é permitido; "aposta na pauta de segurança para se cacifar" não é.
5. Não avalie o mérito dos temas. Nenhum assunto é mais nobre, mais importante ou
   mais sério que outro. Não trate "Homenagens e Datas" como produção menor.
6. Não compare com outros parlamentares ou bancadas além do que a coluna "% no
   Congresso inteiro" já permite, e ao comparar diga sempre contra o quê.
7. Não mencione nomes de pessoas que não sejam o próprio alvo da análise.
8. Não conclua nada sobre desempenho, eficiência, presença ou gasto — esta análise
   é só sobre ASSUNTO.
9. Se os dados forem escassos (poucas proposições), diga isso em vez de generalizar.

FORMA: um parágrafo, 3 a 5 frases, sem título, sem lista, sem markdown. Tom
descritivo e sóbrio, como uma legenda de gráfico — não é um texto de opinião nem
uma manchete.
```

## Por que estas regras específicas

- **(1) e (2)** existem porque a promessa do site é que todo número exibido é
  rastreável até a fonte oficial. Um número inventado pelo modelo ao lado de barras
  auditadas contaminaria a credibilidade das barras.
- **(3)** é a armadilha mais provável: a contagem é cheia (uma proposição com 3 temas
  conta nos 3), e a intuição de quem lê uma lista de percentuais é somá-los.
- **(4)** é a mesma regra que renomeou o título "Safra Eleitoral" para "Produção
  Concentrada em 2026": rótulo não pode imputar intenção, porque intenção não é
  derivável de dado nenhum.
- **(5)** é a versão textual do `higherIsBetter: null` das famílias neutras do mapa —
  a plataforma não decide que assunto é mais digno.

## Fluxo de publicação

1. Gerar o parágrafo com o prompt acima.
2. Calcular `fonteHash` do agregado exibido (`scripts/lib/analises.mjs`).
3. Acrescentar a entrada em `data/analises.json` com `alvo`, `texto`, `modelo`,
   `geradoEm`, `promptVersao`, `fonteHash` e `revisadoPor`.
4. **Revisar a olho** antes do commit. O escopo desta fase (guildas + panorama
   nacional, ~25 textos) foi escolhido justamente para caber em revisão humana
   integral.

Se os números mudarem numa reingestão, o `fonteHash` deixa de bater e o site para de
exibir o texto — sem erro, sem aviso ao leitor, e sem nunca mostrar análise velha ao
lado de dado novo. O gerador loga quantas ficaram obsoletas.
