#!/usr/bin/env bash
# PreToolUse/Bash guard — bloqueia comandos que APAGAM ou revertem `data/`.
#
# Por quê: `data/social.csv` é insubstituível (seguidores via Apify, serviço PAGO)
# e `data/*.json` custa ~1h de reingestão. Nesta base, um subagente já apagou o
# `data/` inteiro uma vez fazendo "higiene de git" (um git clean). Este guarda
# torna isso impossível de forma determinística — nenhuma instrução em prosa tem
# essa garantia, porque quem lê a prosa é um modelo.
#
# O guarda NÃO impede o trabalho legítimo: ler, listar, `git add data/…`,
# `npm run data:real` etc. passam. Ele só barra o irreversível. Se for mesmo
# intencional, o humano roda no terminal.
set -euo pipefail

cmd="$(jq -r '.tool_input.command // ""')"
reason=""

# Casa o comando só quando ele COMEÇA um segmento — início de linha (grep é
# line-oriented) ou logo após `;`, `&&`, `||`, `|`. Assim uma menção em prosa,
# numa mensagem de commit ("...um git clean de higiene...") ou dentro de aspas
# (`echo "rm -rf data"`), NÃO dispara — só o comando de verdade dispara.
SEP='(^|[;&|]) *'

# 1) rm recursivo mirando data/  (rm -rf data, rm -r ./data/raw, etc.)
if printf '%s' "$cmd" | grep -Eq "${SEP}rm " \
   && printf '%s' "$cmd" | grep -Eq ' -[a-zA-Z]*[rR]' \
   && printf '%s' "$cmd" | grep -Eq '\bdata\b'; then
  reason="rm recursivo mirando data/"
fi

# 1b) rm mirando um dos INSUBSTITUÍVEIS pelo nome. A regra acima exige `-r`, então
# `rm -f data/social.csv` passava — e é o comando mais provável de todos, porque não
# "parece" destrutivo. Estes dois não voltam por reingestão: social.csv é coleta paga
# no Apify e analises.json é texto de IA já revisado à mão.
if printf '%s' "$cmd" | grep -Eq "${SEP}rm\b[^;&|]*(social\.csv|analises\.json)"; then
  reason="rm mirando um arquivo insubstituível de data/ (social.csv / analises.json)"
fi

# 2) git clean — varre arquivos NÃO RASTREADOS; foi exatamente assim que data/ sumiu
if printf '%s' "$cmd" | grep -Eq "${SEP}git +clean\b"; then
  reason="git clean varre os arquivos não rastreados de data/ (social.csv inclusive)"
fi

# 3) git checkout/restore descartando alterações em data/
if printf '%s' "$cmd" | grep -Eq "${SEP}git +(checkout|restore)\b[^;&|]*\bdata\b"; then
  reason="git checkout/restore descartando alterações em data/"
fi

if [ -n "$reason" ]; then
  jq -cn --arg r "BLOQUEADO ($reason). data/ contém dado insubstituível (social.csv do Apify, PAGO) e caro de regerar (~1h de ingestão). Se for mesmo intencional, rode você — o humano — no terminal." \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
fi
exit 0
