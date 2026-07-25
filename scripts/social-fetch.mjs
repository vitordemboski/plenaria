#!/usr/bin/env node
/**
 * Preenche `seguidores`/`coletado_em` em data/social.csv buscando o número de
 * seguidores do Instagram via Apify (ator instagram-profile-scraper).
 *
 * - Requer APIFY_TOKEN no ambiente (https://console.apify.com/account#/integrations).
 * - É serviço PAGO (cobra por perfil raspado): por padrão busca só as linhas com
 *   `rede=instagram` + handle e SEM seguidores; use `--tudo` para reatualizar todas.
 * - Roda em lotes e regrava o CSV após CADA lote — falha no meio não perde nada.
 * - Falha de scraping NUNCA vira zero: a linha fica intacta e o parlamentar
 *   segue sem o atributo Influência (Poder renormaliza).
 *
 * Uso: APIFY_TOKEN=... npm run social:fetch [-- --tudo]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env')); } catch {}
const CSV = join(ROOT, 'data', 'social.csv');
const ACTOR = 'dSCLg0C3YEZ83HzYX'; // apify/instagram-profile-scraper
const LOTE = 25; // run-sync tem teto de 300 s — lotes pequenos ficam bem abaixo
const TUDO = process.argv.includes('--tudo');

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('[social] defina APIFY_TOKEN (https://console.apify.com/account#/integrations)');
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
const alvo = rows.filter((r) => r[3] === 'instagram' && r[4] && (TUDO || !r[5]));
if (!alvo.length) {
  console.log('[social] nada a buscar — todas as linhas de Instagram já têm seguidores (use --tudo p/ reatualizar)');
  process.exit(0);
}
console.log(`[social] ${alvo.length} perfis de Instagram a buscar via Apify (lotes de ${LOTE})`);

async function fetchLote(usernames) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames, includeAboutSection: false }),
    },
  );
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const gravar = () => writeFileSync(CSV, header + '\n' + rows.map((r) => r.join(';')).join('\n') + '\n');
const hoje = new Date().toISOString().slice(0, 10);
let ok = 0, semDado = 0;

for (let i = 0; i < alvo.length; i += LOTE) {
  const lote = alvo.slice(i, i + LOTE);
  let items;
  try {
    items = await fetchLote(lote.map((r) => r[4]));
  } catch (e) {
    console.error(`[social] lote ${i / LOTE + 1} falhou (${e.message}) — linhas mantidas intactas`);
    continue;
  }
  const porHandle = new Map(
    items
      .filter((it) => it.username && Number.isFinite(it.followersCount))
      .map((it) => [String(it.username).toLowerCase(), it]),
  );
  for (const r of lote) {
    const it = porHandle.get(r[4].toLowerCase());
    if (!it) { semDado++; continue; } // perfil não encontrado/privado — não zera
    r[5] = String(it.followersCount);
    r[6] = hoje;
    if (it.id) r[7] = String(it.id); // id do perfil no Instagram — evita nova busca
    ok++;
  }
  gravar(); // resultado parcial persiste lote a lote
  console.log(`[social] lote ${i / LOTE + 1}/${Math.ceil(alvo.length / LOTE)} · ${ok} preenchidos até aqui`);
}

console.log(`[social] concluído: ${ok} preenchidos · ${semDado} sem dado (perfil não encontrado) · CSV: data/social.csv`);
