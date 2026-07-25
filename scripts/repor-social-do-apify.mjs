#!/usr/bin/env node
/**
 * Restaura o `data/social.csv` a partir dos datasets JÁ COMPUTADOS na conta do
 * Apify. Ler dataset existente é GRÁTIS — só re-executar um ator cobra. Este
 * script existe porque o CSV (curadoria + coleta paga) chegou a se perder uma vez.
 *
 * Usa as DUAS famílias de execução que alimentam a Influência:
 *   1. instagram-profile-scraper (`social:fetch`)  → seguidores de um handle conhecido
 *   2. instagram-search-scraper  (`social:discover`) → descobre o handle pelo NOME
 *      (os itens trazem `searchTerm` = nome parlamentar, então dá para remontar o
 *      vínculo nome → perfil sem pagar de novo)
 *
 * O match do caso 2 replica EXATAMENTE `scripts/social-discover.mjs`: todos os
 * tokens do nome precisam aparecer em fullName+username; desempate por
 * verificado > bio política > mais seguidores. Se aquele arquivo mudar, mude aqui.
 *
 * NUNCA grava 0 para quem não achou (regra do CLAUDE.md): a linha fica em branco
 * e o parlamentar simplesmente não tem o atributo (o Poder renormaliza).
 *
 * Uso: node scripts/repor-social-do-apify.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const CSV = join(ROOT, 'data', 'social.csv');
const token = process.env.APIFY_TOKEN;
if (!token) { console.error('[social] defina APIFY_TOKEN (.env ou ambiente)'); process.exit(1); }

// mesmas regras de scripts/social-discover.mjs
const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
const tokens = (s) => norm(s).split(/\s+/).filter((t) => t.length >= 2);
const BIO_POLITICA = /deputad|senador|senadora|vereador|prefeit|governador|congresso|brasilia|politic/i;
const score = (it) => (it.verified ? 2e9 : 0) + (BIO_POLITICA.test(it.biography ?? '') ? 1e9 : 0) + (it.followersCount ?? 0);

function melhorMatch(nome, pool) {
  const ts = tokens(nome);
  const cands = pool.filter((it) => {
    const alvo = `${norm(it.fullName)} ${norm(it.username)}`;
    return ts.every((t) => alvo.includes(t));
  });
  return cands.length ? cands.sort((a, b) => score(b) - score(a))[0] : null;
}

// ---------- baixa TODAS as execuções (leitura é grátis) ----------
const runs = [];
for (let offset = 0; ; offset += 100) {
  const r = await fetch(`https://api.apify.com/v2/actor-runs?token=${token}&limit=100&offset=${offset}&desc=1`);
  const { data } = await r.json();
  runs.push(...data.items);
  if (data.items.length < 100) break;
}

const porHandle = new Map();       // username → { followers, perfilId, data }
const porBusca = new Map();        // searchTerm → [itens candidatos]
for (const run of runs) {
  if (run.status !== 'SUCCEEDED' || !run.defaultDatasetId) continue;
  const r = await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${token}&clean=true`);
  if (!r.ok) continue;
  const items = await r.json();
  if (!Array.isArray(items)) continue;
  const dia = (run.finishedAt ?? run.startedAt ?? '').slice(0, 10);
  for (const it of items) {
    if (!it.username || !Number.isFinite(it.followersCount)) continue;
    const u = String(it.username).toLowerCase();
    // runs vêm em ordem decrescente → o primeiro que vemos é o mais recente
    if (!porHandle.has(u)) porHandle.set(u, { followers: it.followersCount, perfilId: it.id ?? '', data: dia });
    if (it.searchTerm) {
      if (!porBusca.has(it.searchTerm)) porBusca.set(it.searchTerm, []);
      porBusca.get(it.searchTerm).push({ ...it, _dia: dia });
    }
  }
}
console.log(`[apify] ${runs.length} execuções · ${porHandle.size} perfis · ${porBusca.size} buscas por nome`);

// ---------- repõe o CSV ----------
const [header, ...linhas] = readFileSync(CSV, 'utf8').split('\n');
const rows = linhas.filter((l) => l.trim()).map((l) => l.split(';'));

let porHandleOk = 0, descobertos = 0, semMatch = [];
for (const r of rows) {
  const [, , nome, rede, handleBruto] = r;
  if (r[5]?.trim()) continue; // já tem seguidores

  // 1) handle oficial declarado → busca direta no pool de perfis
  const handle = (handleBruto ?? '').toLowerCase().replace(/^@/, '').split('?')[0].trim();
  if (rede === 'instagram' && handle && porHandle.has(handle)) {
    const hit = porHandle.get(handle);
    r[3] = 'instagram'; r[4] = handle; r[5] = String(hit.followers); r[6] = hit.data; r[7] = hit.perfilId;
    porHandleOk++;
    continue;
  }

  // 2) sem handle (ou handle que não bate) → reusa a BUSCA por nome já paga
  const pool = porBusca.get(nome);
  const hit = pool ? melhorMatch(nome, pool) : null;
  if (hit) {
    r[3] = 'instagram'; r[4] = String(hit.username).toLowerCase();
    r[5] = String(hit.followersCount); r[6] = hit._dia; r[7] = hit.id ?? '';
    descobertos++;
    continue;
  }
  semMatch.push(nome);
}

writeFileSync(CSV, header + '\n' + rows.map((r) => r.join(';')).join('\n') + '\n');
console.log(`[social] ${rows.length} linhas no CSV`);
console.log(`[social] ${porHandleOk} por handle oficial + ${descobertos} remontados da busca = ${porHandleOk + descobertos} com seguidores`);
console.log(`[social] ${semMatch.length} sem match (ficam SEM o atributo — nunca zero)`);
semMatch.slice(0, 10).forEach((n) => console.log('   -', n));
if (semMatch.length > 10) console.log(`   … e mais ${semMatch.length - 10}`);
