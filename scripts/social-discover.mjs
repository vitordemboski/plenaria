#!/usr/bin/env node
/**
 * Descobre o perfil de Instagram dos parlamentares SEM handle oficial no
 * data/social.csv, buscando pelo nome parlamentar via Apify
 * (apify/instagram-search-scraper, searchType=user).
 *
 * - A busca já retorna followersCount → preenche rede/handle/seguidores/coletado_em.
 * - Match conservador: TODOS os tokens do nome precisam aparecer no fullName+username
 *   do candidato; desempate por verificado > bio política > mais seguidores.
 *   Quem não tem match confiável fica como está (sem atributo — Poder renormaliza).
 * - Requer APIFY_TOKEN (lido do ambiente ou do .env na raiz). Serviço PAGO.
 * - Regrava o CSV após CADA lote — falha no meio não perde nada.
 *
 * Uso: npm run social:discover
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const CSV = join(ROOT, 'data', 'social.csv');
const ACTOR = 'apify~instagram-search-scraper';
const LOTE = 10; // nomes por run (a busca aceita termos separados por vírgula)
const POR_NOME = 5; // searchLimit por termo

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('[social] defina APIFY_TOKEN (ambiente ou .env na raiz)');
  process.exit(1);
}
if (!existsSync(CSV)) {
  console.error('[social] data/social.csv não existe — rode `npm run social:template` antes');
  process.exit(1);
}

let [header, ...linhas] = readFileSync(CSV, 'utf8').split('\n');
if (!header.includes('perfil_id')) header += ';perfil_id';
const rows = linhas.filter((l) => l.trim()).map((l) => {
  const r = l.split(';');
  while (r.length < 8) r.push('');
  return r;
});
// colunas: casa;id;nome;rede;handle;seguidores;coletado_em;perfil_id
const alvo = rows.filter((r) => !(r[3] === 'instagram' && r[4]));
if (!alvo.length) {
  console.log('[social] todos os parlamentares já têm handle de Instagram');
  process.exit(0);
}
console.log(`[social] ${alvo.length} parlamentares sem Instagram — buscando pelo nome (lotes de ${LOTE})`);

const norm = (s) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
const tokens = (s) => norm(s).split(/\s+/).filter((t) => t.length >= 2);
const BIO_POLITICA = /deputad|senador|senadora|vereador|prefeit|governador|congresso|brasilia|politic/i;

// o ator rejeita pontuação no campo search (e vírgula separa termos) — sanitizar
const termoBusca = (nome) => nome.replace(/[!?.,:;\-+=*&%$#@/\\~^|<>()[\]{}"'`]+/g, ' ').replace(/\s+/g, ' ').trim();

async function buscar(nomes) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: nomes.join(','), searchType: 'user', searchLimit: POR_NOME }),
    },
  );
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** melhor candidato cujo fullName+username contém TODOS os tokens do nome */
function melhorMatch(nome, pool) {
  const ts = tokens(nome);
  const candidatos = pool.filter((it) => {
    const alvo = `${norm(it.fullName)} ${norm(it.username)}`;
    return ts.every((t) => alvo.includes(t));
  });
  if (!candidatos.length) return null;
  const score = (it) =>
    (it.verified ? 2e9 : 0) + (BIO_POLITICA.test(it.biography ?? '') ? 1e9 : 0) + (it.followersCount ?? 0);
  return candidatos.sort((a, b) => score(b) - score(a))[0];
}

const gravar = () => writeFileSync(CSV, header + '\n' + rows.map((r) => r.join(';')).join('\n') + '\n');
const hoje = new Date().toISOString().slice(0, 10);
let ok = 0, semMatch = 0;

for (let i = 0; i < alvo.length; i += LOTE) {
  const lote = alvo.slice(i, i + LOTE);
  let pool;
  try {
    pool = await buscar(lote.map((r) => termoBusca(r[2])));
  } catch (e) {
    console.error(`[social] lote ${i / LOTE + 1} falhou (${e.message}) — linhas mantidas intactas`);
    continue;
  }
  for (const r of lote) {
    const m = melhorMatch(r[2], pool);
    if (!m?.username) { semMatch++; continue; }
    r[3] = 'instagram';
    r[4] = m.username;
    if (Number.isFinite(m.followersCount)) { r[5] = String(m.followersCount); r[6] = hoje; }
    if (m.id) r[7] = String(m.id); // id do perfil no Instagram — evita nova busca
    ok++;
  }
  gravar();
  console.log(`[social] lote ${i / LOTE + 1}/${Math.ceil(alvo.length / LOTE)} · ${ok} encontrados · ${semMatch} sem match`);
}

console.log(`[social] concluído: ${ok} perfis descobertos · ${semMatch} sem match confiável · CSV: data/social.csv`);
