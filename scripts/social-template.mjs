#!/usr/bin/env node
/**
 * Gera/atualiza data/social.csv — a CURADORIA MANUAL de seguidores que alimenta
 * o atributo Influência (Instagram ou X, o que fizer mais sentido
 * por parlamentar).
 *
 * - Preserva linhas já preenchidas; só adiciona parlamentares que faltam.
 * - Pré-preenche handle com as redes OFICIALMENTE declaradas à Câmara
 *   (campo redeSocial de /deputados/{id}) — o curador confere e preenche
 *   `seguidores` e `coletado_em`.
 * - data/social.csv é VERSIONADO no git (curadoria é fonte, não artefato).
 *
 * Formato (separador ';'):
 *   casa;id;nome;rede;handle;seguidores;coletado_em;perfil_id
 *   camara;204379;Acácio Favacho;instagram;acaciofavacho;;;
 *   camara;220639;Nikolas Ferreira;instagram;nikolasferreiradm;1500000;2026-07-01;418737605
 *   (perfil_id = id numérico do perfil no Instagram, salvo quando descoberto via Apify)
 *
 * Uso: npm run social:template   (requer data/politicians.json — rode a ingestão antes)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const CSV = join(ROOT, 'data', 'social.csv');
mkdirSync(RAW, { recursive: true });

const politicians = JSON.parse(readFileSync(join(ROOT, 'data', 'politicians.json'), 'utf8'));

// linhas existentes (preserva curadoria já feita)
const existentes = new Map();
if (existsSync(CSV)) {
  for (const line of readFileSync(CSV, 'utf8').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [casa, id] = line.split(';');
    existentes.set(`${casa}:${id}`, line.trim());
  }
}

// redes oficiais declaradas à Câmara (513 requests, cacheadas em data/raw/)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function redeOficial(id) {
  const file = join(RAW, `dep-detalhe-${id}.json`);
  let body;
  if (existsSync(file)) body = readFileSync(file, 'utf8');
  else {
    const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`,
      { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    body = await res.text();
    writeFileSync(file, body);
    await sleep(100);
  }
  const redes = JSON.parse(body).dados?.redeSocial ?? [];
  // preferência: instagram → x/twitter → primeira
  const pick = (re) => redes.find((u) => re.test(u));
  const url = pick(/instagram\.com/i) ?? pick(/twitter\.com|(^|\.)x\.com/i) ?? redes[0];
  if (!url) return null;
  const rede = /instagram/i.test(url) ? 'instagram' : /twitter|x\.com/i.test(url) ? 'x' : 'outra';
  const handle = url.replace(/\/+$/, '').split('/').pop().replace(/^@/, '');
  return { rede, handle };
}

const linhas = [];
let n = 0;
for (const p of politicians.sort((a, b) => a.casa.localeCompare(b.casa) || a.nome.localeCompare(b.nome))) {
  const key = `${p.casa}:${p.id}`;
  if (existentes.has(key)) { linhas.push(existentes.get(key)); continue; }
  let rede = '', handle = '';
  if (p.casa === 'camara') {
    const r = await redeOficial(p.id);
    if (r) { rede = r.rede; handle = r.handle; }
  }
  linhas.push(`${p.casa};${p.id};${p.nome};${rede};${handle};;;`);
  if (++n % 50 === 0) console.log(`[social] ${n} novos processados`);
}

writeFileSync(CSV, 'casa;id;nome;rede;handle;seguidores;coletado_em;perfil_id\n' + linhas.join('\n') + '\n');
const preenchidos = linhas.filter((l) => l.split(';')[5]).length;
const comHandle = linhas.filter((l) => l.split(';')[4]).length;
console.log(`[social] ${linhas.length} parlamentares · ${comHandle} com handle oficial · ${preenchidos} com seguidores preenchidos`);
