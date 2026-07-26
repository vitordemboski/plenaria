#!/usr/bin/env node
/**
 * PLENÁRIA — ingestão de DADOS REAIS (Câmara + Senado).
 *
 * Câmara (dadosabertos.camara.leg.br):
 *   - API /deputados + /partidos                       → identidade + fotos
 *   - BULK votacoesVotos-{ano}.csv                     → Stamina
 *   - BULK proposicoesAutores + proposicoes-{ano}.csv  → Ataque, Eficiência,
 *     Técnica (relator designado) e produção anual
 *   - camara.leg.br/cotas/Ano-{ano}.csv.zip (CEAP)     → Economia
 *
 * Senado (legis.senado.leg.br — endpoints deprecados em 2025-03 mas ativos):
 *   - senador/lista/atual + {cod}/autorias|votacoes|relatorias (JSON)
 *   - senado.leg.br .../despesa_ceaps_{ano}.csv (CEAPS, latin1)
 *   - senadores têm 4 atributos (sem Eficiência) — pesos em meta.pesosPorCasa
 *
 * Downloads cacheados em data/raw/ (git-ignored) — rodar de novo é incremental.
 *
 * GUARDRAIL (docs/product-spec.md §9): com pessoas reais só exibimos o que é
 * factual — títulos apenas os deriváveis 100% dos dados, com regra no tooltip.
 *
 * Uso:  npm run data:real
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync, utimesSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvBR } from './lib/csv.mjs';
import { TIPOS_PRINCIPAIS, TIPOS_EMENDA, ehFiscalizacao, alinhamento, senadoAvancou, senadoVirouNorma } from './lib/classificacao.mjs';
import { resumoCota, percentuais } from './lib/cota.mjs';
import { escalaFrugalidade, escalaComparecimento, escalaLog } from './lib/escala.mjs';
import { referenciasDaCasa, evidenciaDeTitulos } from './lib/evidencia.mjs';
import { resumoCurtoStats } from './lib/resumo-stat.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT_DATA = join(ROOT, 'data');
const OUT_PUBLIC = join(ROOT, 'public', 'data');
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT_PUBLIC, { recursive: true });

const API = 'https://dadosabertos.camara.leg.br';
const YEARS = [2023, 2024, 2025, 2026];

/**
 * Validade do cache bruto. Antes NÃO existia: `if (existsSync(file))` servia o
 * arquivo para sempre, então `npm run data:real` com `data/raw/` populado só
 * RECALCULAVA sobre dados velhos — e ainda carimbava a data de hoje no meta.json.
 * Uma execução inteira podia não baixar um único byte sem que nada avisasse.
 *
 * Duas classes de cache, porque nem todo arquivo custa o mesmo:
 *  - VOLÁTIL (padrão): bulks, cota, votações, autorias. Expira em TTL_H horas.
 *  - PERMANENTE: histórico de exercício (513 chamadas com 504 em rajada) e
 *    relatorias por proposição (~24 mil). Só re-baixa se o arquivo sumir —
 *    expirá-los por tempo transformaria toda ingestão na rodada de ~1h, com o
 *    risco de abortar por 504. Para forçá-los, apague os arquivos à mão.
 */
const FRESH = process.argv.includes('--fresh');
const TTL_H = Number(process.env.PLENARIA_CACHE_TTL_H ?? 24);
/** mtimes das fontes voláteis realmente usadas — base do updatedAt honesto */
const mtimesFontes = [];
/** puro de propósito: é chamado duas vezes por arquivo (cachedGentil + cached) */
function cacheServe(file, permanente = false) {
  if (!existsSync(file)) return false;
  if (permanente) return true;
  if (FRESH) return false;
  return Date.now() - statSync(file).mtimeMs <= TTL_H * 3600e3;
}
/**
 * Data que o site exibe como "atualizado em": a da fonte volátil MAIS VELHA usada.
 * Sem fonte nenhuma registrada (impossível na prática), cai para hoje.
 */
function dataDasFontes() {
  if (!mtimesFontes.length) return new Date().toISOString().slice(0, 10);
  const maisVelha = Math.min(...mtimesFontes);
  const dias = Math.floor((Date.now() - maisVelha) / 86400e3);
  if (dias >= 2) console.log(`[fontes] a mais velha tem ${dias} dias — updatedAt reflete ela, não a data de hoje`);
  return new Date(maisVelha).toISOString().slice(0, 10);
}

/** anota a idade da fonte volátil que alimentou esta execução */
function registraFonte(file, permanente) {
  if (permanente) return; // fonte imutável não define quão atual o site está
  mtimesFontes.push(existsSync(file) ? statSync(file).mtimeMs : Date.now());
}

async function cached(name, url, { json = false, method = 'GET', body: reqBody, permanente = false } = {}) {
  const file = join(RAW, name);
  if (cacheServe(file, permanente)) {
    console.log(`[cache] ${name}`);
    registraFonte(file, permanente);
    return readFileSync(file, 'utf8');
  }
  console.log(`[fetch] ${url}`);
  const res = await fetch(url, {
    method,
    headers: { Accept: json ? 'application/json' : '*/*', ...(reqBody ? { 'Content-Type': 'application/json' } : {}) },
    ...(reqBody ? { body: reqBody } : {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const body = await res.text();
  writeFileSync(file, body);
  registraFonte(file, permanente);
  return body;
}

/** Parser p/ os CSVs da Câmara: campos todos entre aspas, separados por ';'. */
const parseCsv = (text) => parseCsvBR(text, ';');

const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** "R$ 1.764 mil" é ilegível → "R$ 1,76 mi"; abaixo de 1 mi fica "R$ 764 mil". */
const fmtReais = (v) =>
  v >= 1e6
    ? `R$ ${(v / 1e6).toFixed(2).replace('.', ',')} mi`
    : `R$ ${new Intl.NumberFormat('pt-BR').format(Math.round(v / 1000))} mil`;

// ---------- Influência: seguidores nas redes (data/social.csv) ----------
// data/social.csv é versionado: `npm run social:template` gera o esqueleto com os
// handles oficiais declarados à Câmara e `npm run social:fetch` preenche os
// seguidores do Instagram via Apify (requer APIFY_TOKEN). Quem não tem linha
// preenchida simplesmente NÃO tem o atributo (Poder renormaliza por parlamentar).
function lerSocial() {
  const file = join(OUT_DATA, 'social.csv');
  const map = new Map(); // `${casa}:${id}` → { rede, handle, seguidores, coletadoEm }
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, 'utf8').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [casa, id, , rede, handle, seguidores, coletadoEm] = line.split(';');
    const n = parseInt(seguidores, 10);
    if (!n || !rede || !handle) continue;
    map.set(`${casa}:${id}`, { rede, handle, seguidores: n, coletadoEm: (coletadoEm ?? '').trim() });
  }
  return map;
}
/** normaliza nome p/ match (CEAPS do Senado traz só o NOME, sem id) */
const normNome = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const REDE_LABEL = { instagram: 'Instagram', x: 'X (Twitter)', outra: 'rede social' };
const fmtSeg = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} mi` : new Intl.NumberFormat('pt-BR').format(n));

// ---------- 1. Deputados atuais + partidos ----------
async function fetchDeputados() {
  const all = [];
  for (let pag = 1; ; pag++) {
    const body = await cached(`deputados-p${pag}.json`,
      `${API}/api/v2/deputados?itens=100&pagina=${pag}&ordem=ASC&ordenarPor=nome`, { json: true });
    const { dados } = JSON.parse(body);
    all.push(...dados);
    if (dados.length < 100) break;
  }
  return all;
}

async function fetchPartidos() {
  const body = await cached('partidos.json', `${API}/api/v2/partidos?itens=100`, { json: true });
  return new Map(JSON.parse(body).dados.map((p) => [p.sigla, p.nome]));
}

// ---------- 2. Stamina: votos nominais ----------
async function fetchVotos() {
  const votesByDep = new Map(); // id → {total, porAno: {y: n}}
  const votacaoData = new Map(); // idVotacao → 'YYYY-MM-DD' (data da votação)
  const votoPorDep = new Map(); // id → Map<idVotacao, voto> (Alinhamento)
  let totalVotacoes = 0;
  for (const y of YEARS) {
    let body;
    try {
      body = await cached(`votacoesVotos-${y}.csv`, `${API}/arquivos/votacoesVotos/csv/votacoesVotos-${y}.csv`);
    } catch { console.log(`[skip] votacoesVotos-${y} indisponível`); continue; }
    const { header, rows } = parseCsv(body);
    const iVot = header.indexOf('idVotacao');
    const iDep = header.indexOf('deputado_id');
    const iData = header.indexOf('dataHoraVoto');
    const iVoto = header.indexOf('voto');
    const votacoes = new Set();
    for (const r of rows) {
      votacoes.add(r[iVot]);
      if (iData >= 0 && !votacaoData.has(r[iVot])) {
        const dia = (r[iData] ?? '').slice(0, 10);
        if (dia) votacaoData.set(r[iVot], dia);
      }
      const id = Number(r[iDep]);
      if (!id) continue;
      const e = votesByDep.get(id) ?? { total: 0, porAno: {} };
      e.total++;
      e.porAno[y] = (e.porAno[y] ?? 0) + 1;
      votesByDep.set(id, e);

      const vt = r[iVoto];
      if (vt) {
        let m = votoPorDep.get(id);
        if (!m) { m = new Map(); votoPorDep.set(id, m); }
        m.set(r[iVot], vt);
      }
    }
    totalVotacoes += votacoes.size;
    console.log(`[votos] ${y}: ${votacoes.size} votações nominais, ${rows.length} votos`);
  }
  return { votesByDep, totalVotacoes, votacaoData, votoPorDep };
}

// ---------- 2b. Alinhamento com o Governo (informativo) ----------
/** idVotacao → orientação da bancada "Governo" (Sim/Não/Obstrução/Liberado). */
async function fetchOrientacoesGoverno() {
  const orientacaoGov = new Map();
  for (const y of YEARS) {
    let body;
    try {
      body = await cached(`votacoesOrientacoes-${y}.csv`,
        `${API}/arquivos/votacoesOrientacoes/csv/votacoesOrientacoes-${y}.csv`);
    } catch { console.log(`[skip] votacoesOrientacoes-${y} indisponível`); continue; }
    const { header, rows } = parseCsv(body);
    const iVot = header.indexOf('idVotacao');
    for (const r of rows) {
      // o campo `descricao` é texto livre e pode conter ";" — ler as três últimas
      // colunas pelo fim (siglaBancada, uriBancada, orientacao) é imune a isso.
      if (r.at(-3) !== 'Governo') continue;
      orientacaoGov.set(r[iVot], r.at(-1));
    }
    console.log(`[orientacoes] ${y}: ${orientacaoGov.size} votações com orientação do Governo (acumulado)`);
  }
  return orientacaoGov;
}

// ---------- 3. Ataque + Eficiência: proposições de autoria + status ----------
// tipos "principais" (PL/PLP/PEC/PDL) — evita que requerimentos/moções dominem a
// contagem; TIPOS_EMENDA e ehFiscalizacao vêm de ./lib/classificacao.mjs.
const APROVADA_RE = /transformad[oa] em (norma jurídica|lei)/i;
// Eficiência = proposições que AVANÇARAM na tramitação (saíram do limbo inicial
// de comissão rumo a virar lei): prontas para pauta, já no Senado, em chancela/
// autógrafos/redação final, ou já transformadas em norma. Sinal muito mais largo
// que "virou lei" (raro), dando spread real ao atributo — e 100% factual.
const AVANCOU_RE = /transformad|norma jurídica|pronta para pauta|aprecia[çc][ãa]o pelo senado|autógrafos|reda[çc][ãa]o final|chancela/i;

/**
 * Bulk proposicoes-{ano}.csv →
 *   statusById: id → { tipo, aprovada }          (Eficiência)
 *   relatoriasByDep: idDeputado → nº relatorias  (Técnica — relator designado em
 *                    QUALQUER ponto da tramitação, via relatoresPorProposicao)
 *   emendaIds: ids de EMC/EMP/EMR                (Técnica — autoria de emenda)
 *   fiscalIds: ids de RIC/PFC/convocação         (Fiscalização)
 */
/**
 * Relatores de uma proposição ao longo de TODA a tramitação.
 *
 * O CSV bulk só traz `ultimoStatus_uriRelator` — o relator ATUAL. Uma proposição
 * passa por várias comissões, cada uma com seu relator, e só o último sobrevive ali:
 * medido em 3.000 proposições, capturávamos 65% das relatorias. A perda é neutra
 * quanto ao desfecho (0,48 perdida por matéria que avançou × 0,47 nas que não
 * avançaram), mas NÃO é uniforme entre deputados — de uns enxergávamos 1 relatoria
 * em 10, de outros todas (média 68%, desvio 21 p.p.). Quem relata cedo, em comissão
 * de mérito, é substituído e some; quem relata na CCJ ou no plenário fica sendo o
 * último. Isso é ruído arbitrário na Técnica e na Eficiência.
 *
 * O bulk `proposicoesTramitacoes` NÃO resolve: não traz o campo de relator. Só a API
 * por proposição traz, daí o laço. Cache num JSON só — 23 mil arquivos soltos em
 * data/raw/ seria pior — com escrita incremental para sobreviver a interrupção.
 */
async function relatoresPorProposicao(ids, concorrencia = 8) {
  const file = join(RAW, 'relatores-historico.json');
  const cache = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const faltam = ids.filter((id) => !(id in cache));
  if (!faltam.length) {
    console.log(`[relatores] ${Object.keys(cache).length} proposições em cache`);
    return cache;
  }
  console.log(`[relatores] buscando histórico de ${faltam.length} proposições (${Object.keys(cache).length} em cache)…`);
  const gravar = () => writeFileSync(file, JSON.stringify(cache));
  let i = 0, feitos = 0, erros = 0;
  await Promise.all(Array.from({ length: concorrencia }, async () => {
    while (i < faltam.length) {
      const id = faltam[i++];
      let ok = false;
      for (let t = 1; t <= 5 && !ok; t++) {
        try {
          const res = await fetch(`${API}/api/v2/proposicoes/${id}/tramitacoes`, { headers: { Accept: 'application/json' } });
          if (res.status >= 500) throw new Error(`${res.status}`);
          if (!res.ok) { cache[id] = []; ok = true; break; } // 404: proposição sem tramitação exposta
          const { dados } = JSON.parse(await res.text());
          cache[id] = [...new Set((dados ?? [])
            .map((d) => d.uriUltimoRelator)
            .filter((u) => u && u.includes('/deputados/'))
            .map((u) => Number(u.split('/').pop()))
            .filter(Boolean))];
          ok = true;
        } catch { await sleep(1200 * t); }
      }
      if (!ok) { erros++; continue; } // NÃO grava vazio: vazio = relatorias apagadas em silêncio
      if (++feitos % 500 === 0) { gravar(); console.log(`  [relatores] ${feitos}/${faltam.length}`); }
    }
  }));
  gravar();
  if (erros) {
    throw new Error(`[relatores] ${erros} proposições não responderam após 5 tentativas. ` +
      `Seguir gravaria relatoria de menos em silêncio — rode de novo, o cache retoma de onde parou.`);
  }
  console.log(`[relatores] ${Object.keys(cache).length} proposições com histórico`);
  return cache;
}

async function fetchStatusProposicoes() {
  const statusById = new Map();
  const relatoriasByDep = new Map();
  const relatoriasAvancadasByDep = new Map();
  const emendaIds = new Set();   // ids de EMC/EMP/EMR  → Técnica
  const fiscalIds = new Set();   // ids de RIC/PFC/REQ-convocação → Fiscalização
  for (const y of YEARS) {
    let body;
    try {
      body = await cached(`proposicoes-${y}.csv`, `${API}/arquivos/proposicoes/csv/proposicoes-${y}.csv`);
    } catch { console.log(`[skip] proposicoes-${y} indisponível`); continue; }
    const { header, rows } = parseCsv(body);
    const iId = header.indexOf('id');
    const iTipo = header.indexOf('siglaTipo');
    const iDesc = header.indexOf('descricaoTipo');
    const iSit = header.indexOf('ultimoStatus_descricaoSituacao');
    for (const r of rows) {
      const tipo = r[iTipo];
      const desc = r[iDesc] ?? '';
      const principal = TIPOS_PRINCIPAIS.has(tipo);
      const emenda = TIPOS_EMENDA.has(tipo);
      const fiscal = ehFiscalizacao(tipo, desc);
      if (!principal && !emenda && !fiscal) continue;

      if (emenda) emendaIds.add(r[iId]);
      if (fiscal) fiscalIds.add(r[iId]);
      if (!principal) continue; // o resto abaixo só vale para PL/PLP/PEC/PDL

      const sit = r[iSit] ?? '';
      statusById.set(r[iId], { tipo, aprovada: APROVADA_RE.test(sit), avancou: AVANCOU_RE.test(sit) });
    }
    console.log(`[status] ${y}: ${statusById.size} proposições principais · ${emendaIds.size} emendas · ${fiscalIds.size} de fiscalização (acumulado)`);
  }

  // relatorias vêm do histórico completo de tramitação, não do relator atual
  const hist = await relatoresPorProposicao([...statusById.keys()]);
  for (const [id, st] of statusById) {
    for (const depId of hist[id] ?? []) {
      relatoriasByDep.set(depId, (relatoriasByDep.get(depId) ?? 0) + 1);
      // relatoria que EFETIVAMENTE andou: designar ≠ entregar
      if (st.avancou) relatoriasAvancadasByDep.set(depId, (relatoriasAvancadasByDep.get(depId) ?? 0) + 1);
    }
  }
  const totalRel = [...relatoriasByDep.values()].reduce((s, v) => s + v, 0);
  console.log(`[status] ${totalRel} relatorias (histórico completo de tramitação, não só o relator atual)`);
  return { statusById, relatoriasByDep, relatoriasAvancadasByDep, emendaIds, fiscalIds };
}

async function fetchProposicoes(statusById, emendaIds, fiscalIds) {
  const propsByDep = new Map();     // id → {total, aprovadas, avancadas, porAno}
  const emendasByDep = new Map();   // id → nº de emendas de autoria
  const fiscalByDep = new Map();    // id → nº de atos de fiscalização
  for (const y of YEARS) {
    let body;
    try {
      body = await cached(`proposicoesAutores-${y}.csv`, `${API}/arquivos/proposicoesAutores/csv/proposicoesAutores-${y}.csv`);
    } catch { console.log(`[skip] proposicoesAutores-${y} indisponível`); continue; }
    const { header, rows } = parseCsv(body);
    const iDep = header.indexOf('idDeputadoAutor');
    const iProp = header.indexOf('proponente');
    const iId = header.indexOf('idProposicao');
    // um deputado pode assinar a mesma proposição uma vez só
    const seen = new Set();
    let count = 0, aprov = 0, nEmd = 0, nFis = 0;
    for (const r of rows) {
      const id = Number(r[iDep]);
      // proponente=1 → só o autor principal. Sem isso, os 171 signatários de uma
      // PEC virariam 171 "autores".
      if (!id || r[iProp] !== '1') continue;
      const key = `${id}:${r[iId]}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (emendaIds.has(r[iId])) {
        emendasByDep.set(id, (emendasByDep.get(id) ?? 0) + 1); nEmd++;
      }
      if (fiscalIds.has(r[iId])) {
        fiscalByDep.set(id, (fiscalByDep.get(id) ?? 0) + 1); nFis++;
      }

      const st = statusById.get(r[iId]);
      if (!st) continue; // não é tipo principal → não conta no Ataque
      const e = propsByDep.get(id) ?? { total: 0, aprovadas: 0, avancadas: 0, porAno: {} };
      e.total++;
      e.porAno[y] = (e.porAno[y] ?? 0) + 1;
      if (st.avancou) e.avancadas++;
      if (st.aprovada) { e.aprovadas++; aprov++; }
      propsByDep.set(id, e);
      count++;
    }
    console.log(`[props] ${y}: ${count} autorias principais (PL/PLP/PEC/PDL) · ${aprov} viraram norma · ${nEmd} emendas · ${nFis} atos de fiscalização`);
  }
  return { propsByDep, emendasByDep, fiscalByDep };
}

// ---------- 4. Economia: cota parlamentar (CEAP) ----------
// soma total (→ Economia) + quebra por categoria e fornecedor (→ cotaResumo, informativa)
async function fetchCeap() {
  const gastoByDep = new Map(); // ideCadastro → total R$ (vlrLiquido)
  const catByDep = new Map();   // ideCadastro → Map<txtDescricao, R$>
  const fornByDep = new Map();  // ideCadastro → Map<txtFornecedor, R$>
  const acc = (mapa, id, chave, v) => {
    let m = mapa.get(id);
    if (!m) mapa.set(id, (m = new Map()));
    m.set(chave, (m.get(chave) ?? 0) + v);
  };
  for (const y of YEARS) {
    const zipName = `Ano-${y}.csv.zip`;
    const csvName = `Ano-${y}.csv`;
    const csvPath = join(RAW, csvName);
    if (!cacheServe(csvPath)) {
      const zipPath = join(RAW, zipName);
      // o zip segue a validade do csv: expirar um e reaproveitar o outro
      // descompactaria de novo exatamente o mesmo conteúdo velho
      if (!cacheServe(zipPath)) {
        const url = `https://www.camara.leg.br/cotas/${zipName}`;
        console.log(`[fetch] ${url}`);
        const res = await fetch(url);
        if (!res.ok) { console.log(`[skip] CEAP ${y} indisponível`); continue; }
        writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
      }
      registraFonte(zipPath, false);
      execSync(`unzip -o -q ${JSON.stringify(zipPath)} -d ${JSON.stringify(RAW)}`);
      // o unzip PRESERVA o mtime gravado no arquivo — o csv nasceria "velho" e
      // expiraria na execução seguinte, re-baixando 4 zips a cada rodada
      utimesSync(csvPath, new Date(), new Date());
    } else {
      console.log(`[cache] ${csvName}`);
      registraFonte(csvPath, false);
    }
    const { header, rows } = parseCsv(readFileSync(csvPath, 'utf8'));
    const iId = header.indexOf('ideCadastro');
    const iVal = header.indexOf('vlrLiquido');
    const iCat = header.indexOf('txtDescricao');
    const iForn = header.indexOf('txtFornecedor');
    let soma = 0;
    for (const r of rows) {
      const id = Number(r[iId]);
      if (!id) continue;
      const v = parseFloat(r[iVal]) || 0;
      gastoByDep.set(id, (gastoByDep.get(id) ?? 0) + v);
      // net por categoria/fornecedor (estorno negativo abate) → total bate com a Economia
      acc(catByDep, id, r[iCat] ?? '', v);
      const forn = (r[iForn] ?? '').trim();
      if (forn) acc(fornByDep, id, forn, v);
      soma += v;
    }
    console.log(`[ceap] ${y}: R$ ${(soma / 1e6).toFixed(1)} mi em ${rows.length} lançamentos`);
  }
  return { gastoByDep, catByDep, fornByDep };
}

// ---------- percentil ----------
function percentileRank(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
  return Math.round((lo / (sorted.length - 1)) * 100);
}

// Recalibrados quando a Técnica virou escala log: ela derrubou o Poder ~2 pontos, e
// sem descer os cortes junto o Tier S encolheria de 11 para 5 por efeito colateral —
// redefinir "lendário" tem de ser decisão explícita, não carona de normalização.
// Calibração = preservar o tamanho das bandas anteriores.
// Piso de cada Tier. EMITIDO no meta.json (`tierCortes`) porque a UI também precisa
// classificar — o Tier da GUILDA sai da média da bancada, calculada em build-time.
// Havia uma segunda tabela hardcodada no guild-stats.ts que ficou nos valores
// pré-recalibração: uma guilda com Poder médio 86 saía Tier A enquanto um
// parlamentar com 86 era Tier S. Uma tabela, um lugar.
const TIER_CORTES = { S: 85, A: 73, B: 58, C: 45, D: 31 };
const PODER_TIER_S = TIER_CORTES.S;
function tierDe(ops) {
  const t = Object.keys(TIER_CORTES).find((k) => ops >= TIER_CORTES[k]);
  return t ?? 'F';
}

// ---------- pesos do Poder, POR CASA ----------
// Precisam ser separados: a Câmara ganhou Fiscalização e a Eficiência não existe
// no Senado. Um mapa global renormalizado faria o rebalanceamento da Câmara
// vazar para o Poder dos senadores. Influência (Instagram) é INFORMATIVA — não
// pontua no Poder. Alcance social não é entrega legislativa, e puni-lo penalizava
// quem trabalha muito e tem pouca rede (enquanto quem nem tem Instagram ficava
// neutro — assimetria invertida). Reach segue nos títulos (Blogueiro/Ídolo/
// Operário Silencioso) e no card, só não vira nota.
// Fiscalização (RIC/PFC/convocação) é INFORMATIVA — não pontua, pelo mesmo motivo
// do Alinhamento. Fiscalizar o Executivo é, na prática, oposição a ele: a oposição
// protocola 192 atos por deputado em média; a base do governo, 20 (o PT faz 3, o
// NOVO faz 306). Pontuá-la faria o Poder premiar posição política travestida de
// entrega. O trabalho fica VISÍVEL no card e nos títulos — só não vira nota.
// Comparecimento (Stamina) pesa MENOS que resultado (Eficiência): apertar o botão
// de presença é o comportamento de menor esforço, a distribuição é comprimida no
// topo (mediana ~93% no Senado) e a presença JÁ é protegida pelo gate de Tier S
// (Stamina >= 70) — pesá-la como autoria a contaria duas vezes. Eficiência mede
// desfecho (matéria que ANDOU, não morreu na gaveta): por isso 0.28 > 0.20.
// Pelo mesmo motivo Eficiência (0.28) > Ataque (0.24): protocolar custa uma
// assinatura, o insumo não pode valer mais que o desfecho.
const WEIGHTS_CAMARA = {
  ataque: 0.24, stamina: 0.20, eficiencia: 0.28, tecnica: 0.16, economia: 0.12,
};
// O Senado tem os mesmos 5 atributos que pontuam na Câmara (a Eficiência entrou quando
// a tramitação passou a ser lida do /processo). O que a casa NÃO tem é Fiscalização —
// e essa nem pontua em lugar nenhum. Os pesos são, portanto, idênticos: o que difere
// entre as casas é o universo do percentil (Câmara ≠ Senado), não a fórmula.
const WEIGHTS_SENADO = {
  ataque: 0.24, stamina: 0.20, eficiencia: 0.28, tecnica: 0.16, economia: 0.12,
};
const WEIGHTS_POR_CASA = { camara: WEIGHTS_CAMARA, senado: WEIGHTS_SENADO };

/** pesos normalizados (somam 1) de uma casa — para EXIBIÇÃO em meta.pesosPorCasa
 *  e na página de metodologia. */
function pesosNormalizados(casa) {
  const W = WEIGHTS_POR_CASA[casa];
  const soma = Object.values(W).reduce((t, v) => t + v, 0);
  return Object.fromEntries(Object.entries(W).map(([k, v]) => [k, v / soma]));
}

// cores INSTITUCIONAIS dos partidos (aproximadas das marcas oficiais) p/ os
// brasões — partido fora do mapa cai no hash estável da paleta genérica
const CORES_PARTIDOS = {
  PT: '#c4122d',            // vermelho
  PL: '#1d3d8f',            // azul-escuro
  UNIÃO: '#2b3990',         // azul + amarelo
  PP: '#00a0df',            // azul-claro
  PSD: '#2a4e9e',           // azul
  MDB: '#1aa24b',           // verde
  REPUBLICANOS: '#0d4f9e',  // azul
  PSDB: '#0072ba',          // azul-tucano
  PDT: '#a6192e',           // vermelho trabalhista
  PSB: '#e8112d',           // vermelho + amarelo
  PCdoB: '#8f1d21',         // vermelho-escuro
  PSOL: '#e6b800',          // amarelo + vermelho
  PV: '#00a859',            // verde
  REDE: '#007e5e',          // verde-profundo
  NOVO: '#ff6c0f',          // laranja
  AVANTE: '#dd6b20',        // laranja-queimado
  SOLIDARIEDADE: '#f7941e', // laranja
  CIDADANIA: '#ec008c',     // magenta
  PODE: '#00b2a9',          // verde-água
  PRD: '#1f6f43',           // verde + azul
  MISSÃO: '#f5b32a',        // amarelo-ouro (bandeira preto/branco/amarelo)
};
// As duas casas usam abreviações diferentes para o MESMO partido: a Câmara segue a
// sigla oficial do TSE (`PODE`), o Senado devolve `PODEMOS`. Sem unificar, o gerador
// (que identifica guilda pela string da sigla) cria duas guildas Podemos. Canonicaliza
// numa fonte só, aplicada onde a sigla é lida em CADA casa.
const SIGLA_CANONICA = { PODEMOS: 'PODE' };
const normalizaSigla = (s) => SIGLA_CANONICA[s] ?? s;
const PALETTE = ['#c9962b', '#3ecf8e', '#e5484d', '#4f9cf9', '#a684ff', '#f97316', '#14b8a6', '#eab308', '#ec4899', '#8b5cf6', '#22c55e', '#f43f5e', '#0ea5e9', '#d946ef', '#84cc16', '#f59e0b'];
const corDe = (sigla) => {
  if (CORES_PARTIDOS[sigla]) return CORES_PARTIDOS[sigla];
  let h = 0;
  for (const c of sigla) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

// ---------- 4b. Ficha civil + comissões (Câmara) ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** cached() com pausa quando é fetch de verdade — laços de 500+ requests */
async function cachedGentil(name, url, { permanente = false } = {}) {
  const miss = !cacheServe(join(RAW, name), permanente);
  const body = await cached(name, url, { json: true, permanente });
  if (miss) await sleep(60);
  return JSON.parse(body);
}
const idadeDe = (nasc) => {
  const d = new Date(nasc), hoje = new Date();
  let i = hoje.getFullYear() - d.getFullYear();
  if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) i--;
  return i;
};
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

// nº de mandatos = legislaturas em que EXERCEU o mandato: /deputados?id=X
// filtrado por legislatura devolve uma linha por legislatura exercida.
// 38..57 (1967→hoje) cobre com folga qualquer veterano em exercício.
const LEGISLATURAS = Array.from({ length: 20 }, (_, i) => 38 + i).join(',');

/** cachedGentil com retry exponencial — a API da Câmara devolve 504 TRANSITÓRIO sob
 *  carga, e numa reingestão do zero (cache vazio) isso vira regra, não exceção: o
 *  mesmo /historico que falha na 1ª tentativa responde 200 na 2ª. Backoff curto
 *  demais derrubava a ingestão inteira por causa de um único deputado.
 *
 *  NUNCA engula a falha devolvendo vazio: o histórico define meses de exercício,
 *  e histórico vazio = "0 meses" = deputado apagado do ranking em silêncio. Se
 *  esgotar as tentativas, é para explodir mesmo — melhor abortar que corromper. */
async function cachedRetry(name, url, tentativas = 8) {
  for (let i = 1; ; i++) {
    // permanente: são as 513 chamadas que estouram em 504 sob carga. Expirá-las
    // por tempo faria TODA ingestão correr o risco de abortar (ver comentário do
    // cacheServe) — para refazer, apague os `dep-hist-*.json` à mão.
    try { return await cachedGentil(name, url, { permanente: true }); }
    catch (e) {
      if (i >= tentativas || !/^5\d\d /.test(e.message ?? '')) throw e;
      console.log(`  [retry ${i}/${tentativas - 1}] ${e.message}`);
      await sleep(2000 * i); // 2s, 4s, 6s… ~56s no pior caso
    }
  }
}

async function fichaCamara(id) {
  const d = (await cachedGentil(`dep-detalhe-${id}.json`, `${API}/api/v2/deputados/${id}`)).dados;
  const legs = (await cachedRetry(`dep-legs-${id}.json`,
    `${API}/api/v2/deputados?id=${id}&idLegislatura=${LEGISLATURAS}&itens=100`)).dados ?? [];
  const mandatos = new Set(legs.map((l) => l.idLegislatura)).size;
  return {
    // CPF NÃO é lido: a única consulta que o usava (Cadirreg do TCU) saiu do pipeline.
    // Vide docs/product-spec.md §9 — não reintroduzir sem reler o motivo.
    nomeCivil: d.nomeCivil ?? null,
    sexo: d.sexo === 'M' || d.sexo === 'F' ? d.sexo : null,
    ficha: {
      ...(d.dataNascimento ? { idade: idadeDe(d.dataNascimento) } : {}),
      ...(d.municipioNascimento ? { naturalidade: `${d.municipioNascimento}/${d.ufNascimento}` } : {}),
      ...(d.escolaridade ? { escolaridade: d.escolaridade } : {}),
      ...(d.ultimoStatus?.condicaoEleitoral ? { condicao: d.ultimoStatus.condicaoEleitoral } : {}),
      ...(mandatos ? { mandatos } : {}),
    },
  };
}

// datas de referência no meio do mandato (bem antes da eleição de 2026) para
// aferir quem esteve EFETIVAMENTE em exercício — não suplente tardio nem
// ministro/secretário licenciado. Usadas pelo título "Produção Concentrada em 2026".
const REF_EXERCICIO = ['2024-07-01', '2025-07-01'];

/** histórico de situação do deputado (posse, licenças, reassunções) — cacheado. */
async function historicoCamara(id) {
  const d = await cachedRetry(`dep-hist-${id}.json`, `${API}/api/v2/deputados/${id}/historico`);
  return d.dados ?? [];
}
/** estava em "Exercício" (sentado, não licenciado) na data? (última situação ≤ data) */
function emExercicioEm(hist, date) {
  const passados = hist.filter((x) => x.situacao && x.dataHora.slice(0, 10) <= date);
  if (!passados.length) return false;
  passados.sort((a, b) => (a.dataHora < b.dataHora ? -1 : 1));
  return passados[passados.length - 1].situacao === 'Exercício';
}

// ---------- tempo efetivo em exercício no período (p/ mandato parcial) ----------
const TERM_START = '2023-02-01';           // início da legislatura atual
const HOJE = new Date().toISOString().slice(0, 10);
/** soma meses cobertos por intervalos [{start,end}] recortados a [TERM_START, HOJE] */
function mesesDeIntervalos(intervalos) {
  let dias = 0;
  for (const { start, end } of intervalos) {
    if (!start) continue;
    const s = start > TERM_START ? start : TERM_START;
    const e = (end && end < HOJE) ? end : HOJE;
    if (e > s) dias += (Date.parse(e) - Date.parse(s)) / 864e5;
  }
  return Math.round((dias / 30.44) * 10) / 10;
}
/** intervalos "Exercício" do histórico da Câmara (segmento até a próxima mudança) */
function intervalosCamara(hist) {
  const evs = hist.filter((x) => x.dataHora && x.situacao)
    .map((x) => ({ d: x.dataHora.slice(0, 10), s: x.situacao }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const out = [];
  for (let i = 0; i < evs.length; i++) {
    if (evs[i].s === 'Exercício') out.push({ start: evs[i].d, end: i + 1 < evs.length ? evs[i + 1].d : null });
  }
  return out;
}
// ---------- Comando (INFORMATIVO — não pontua no Poder) ----------
// Peso institucional: comissões/órgãos que integra + cargos de comando. Presidência
// vale 3, vice 1. NÃO entra no Poder de propósito: presidência é distribuída por
// tamanho de bancada e senioridade, não por mérito individual — pontuar enviesaria
// a nota a favor de veteranos e partidos grandes, contra estreantes.
const ehPresidente = (cargo) => /^presidente$/i.test(cargo ?? '');
function comandoRawDe(comissoes) {
  const cargos = comissoes?.cargos ?? [];
  const pres = cargos.filter((c) => ehPresidente(c.cargo)).length;
  const vices = cargos.length - pres;
  return (comissoes?.total ?? 0) + 3 * pres + vices;
}
function comandoTexto(comissoes) {
  const cargos = comissoes?.cargos ?? [];
  const pres = cargos.filter((c) => ehPresidente(c.cargo)).length;
  const vices = cargos.length - pres;
  const partes = [`${comissoes?.total ?? 0} comissões/órgãos ativos`];
  if (pres) partes.push(`preside ${pres}`);
  if (vices) partes.push(`vice-presidência em ${vices}`);
  return partes.join(' · ');
}

// menos de 12 meses em exercício efetivo (~1 ano de 41) = mandato parcial: fora do
// ranking. Unifica posse recente E licença/ministério prolongados (quase-ausentes).
const MESES_MIN_RANK = 12;

// ---------- Presidência da Casa: fora do ranking (cargo institucional) ----------
// Quem preside a Câmara/Senado não vota (só desempate/secreto), não autora nem relata
// como os demais — o cargo suprime Stamina, Ataque e Técnica de uma vez. Compará-lo a
// deputados de bancada é injusto (mesma lógica do ministro licenciado = mandato parcial).
// Presidentes ATUAIS são detectados nos órgãos (Mesa Diretora, cargo "Presidente");
// os que presidiram ANTES nesta legislatura (a API só devolve a Mesa vigente) entram por
// lista curada — registro público factual. Legislatura 2023–2026:
//   Câmara: Arthur Lira (id 160541) → Hugo Motta (auto); Senado: Rodrigo Pacheco (id 5732) → Davi Alcolumbre (auto).
const EX_PRESIDENTES_CASA = new Set([160541, 5732]);
/** presidiu a Casa (Mesa Diretora) — exclui vice-presidentes. */
function ehPresidenteMesa(comissoes) {
  return (comissoes?.cargos ?? []).some(
    (c) => /mesa diretora/i.test(c.nome ?? '') && (c.cargo ?? '').trim().toLowerCase() === 'presidente');
}

/** órgãos ATUAIS (comissões, GTs, conselhos) + cargos de comando (presidências) */
async function orgaosCamara(id) {
  const all = [];
  for (let pag = 1; ; pag++) {
    const { dados } = await cachedGentil(`dep-orgaos-${id}-p${pag}.json`,
      `${API}/api/v2/deputados/${id}/orgaos?itens=100&pagina=${pag}`);
    all.push(...dados);
    if (dados.length < 100) break;
  }
  const atuais = all.filter((o) => !o.dataFim);
  return {
    total: atuais.length,
    cargos: atuais
      .filter((o) => /presidente/i.test(o.titulo ?? ''))
      .map((o) => ({ sigla: o.siglaOrgao, nome: o.nomeOrgao, cargo: o.titulo })),
  };
}

// ---------- 5. SENADO (legis.senado.leg.br — JSON) ----------
// Nota: os endpoints /senador/* estão marcados como deprecados desde 2025-03-18,
// mas seguem ativos. A tramitação NÃO usa mais eles: `/processo` é o substituto
// oficial que a própria API aponta, e é o único que traz `situacaoAtual`.
async function senadoJson(name, url) {
  return JSON.parse(await cached(name, url, { json: true }));
}
const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const VOTO_AUSENTE_RE = /não compareceu|ausen|licen|não votou|atividade parlamentar/i;

/**
 * Situação de tramitação das matérias do Senado → Map codigoMateria → situacaoAtual.
 *
 * É o que destrava a Eficiência da casa. As autorias/relatorias do /senador só trazem
 * o Codigo da matéria, sem desfecho; quem tem `situacaoAtual` é o /processo — e ele
 * aceita busca em LOTE por sigla+ano (4 tipos × 4 anos = 16 chamadas, ~4.800 processos),
 * em vez de uma chamada por matéria. Nunca troque isso por /processo/{id} num laço.
 */
async function fetchProcessosSenado() {
  const situacaoPorMateria = new Map();
  for (const sigla of TIPOS_PRINCIPAIS) {
    for (const ano of YEARS) {
      const j = await senadoJson(`sen-processos-${sigla}-${ano}.json`,
        `https://legis.senado.leg.br/dadosabertos/processo?sigla=${sigla}&ano=${ano}`);
      for (const p of asArray(j)) situacaoPorMateria.set(String(p.codigoMateria), p.situacaoAtual ?? '');
    }
  }
  console.log(`[senado] ${situacaoPorMateria.size} processos com situação de tramitação (PL/PLP/PEC/PDL 2023+)`);
  return situacaoPorMateria;
}

async function fetchSenado(socialMap) {
  const situacaoPorMateria = await fetchProcessosSenado();
  const lista = await senadoJson('senado-lista.json', 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json');
  const parls = asArray(lista.ListaParlamentarEmExercicio.Parlamentares.Parlamentar)
    .map((p) => p.IdentificacaoParlamentar)
    .map((i) => ({
      id: Number(i.CodigoParlamentar),
      nome: i.NomeParlamentar,
      partido: normalizaSigla(i.SiglaPartidoParlamentar ?? 'S/PART'),
      uf: i.UfParlamentar,
      foto: i.UrlFotoParlamentar?.replace('http://', 'https://'),
    }));
  console.log(`[senado] ${parls.length} senadores em exercício`);

  // CEAPS (cota do Senado) — CSV latin1, decimal com vírgula, match por NOME
  const gastoByNome = new Map();
  const catByNome = new Map();  // normNome → Map<TIPO_DESPESA, R$>
  const fornByNome = new Map(); // normNome → Map<FORNECEDOR, R$>
  const acc = (mapa, chaveDep, chave, v) => {
    let m = mapa.get(chaveDep);
    if (!m) mapa.set(chaveDep, (m = new Map()));
    m.set(chave, (m.get(chave) ?? 0) + v);
  };
  for (const y of YEARS) {
    const name = `ceaps-${y}.csv`;
    const file = join(RAW, name);
    if (!cacheServe(file)) {
      const url = `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_${y}.csv`;
      console.log(`[fetch] ${url}`);
      const res = await fetch(url);
      if (!res.ok) { console.log(`[skip] CEAPS ${y}`); continue; }
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    } else console.log(`[cache] ${name}`);
    registraFonte(file, false);
    const text = readFileSync(file, 'latin1');
    const lines = text.split('\n');
    // 1ª linha é "ÚLTIMA ATUALIZAÇÃO..."; a 2ª é o cabeçalho
    const header = lines[1].replace(/^"/, '').replace(/"\r?$/, '').split('";"');
    const iNome = header.indexOf('SENADOR');
    const iVal = header.findIndex((h) => h.includes('VALOR_REEMBOLSADO'));
    const iCat = header.indexOf('TIPO_DESPESA');
    const iForn = header.indexOf('FORNECEDOR');
    let soma = 0;
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      if (!line) continue;
      const cols = line.replace(/^"/, '').replace(/"$/, '').split('";"');
      const nome = cols[iNome];
      const v = parseFloat((cols[iVal] ?? '0').replace(/\./g, '').replace(',', '.')) || 0;
      if (!nome) continue;
      const k = normNome(nome);
      gastoByNome.set(k, (gastoByNome.get(k) ?? 0) + v);
      // net por categoria/fornecedor (estorno negativo abate) → total bate com a Economia
      acc(catByNome, k, cols[iCat] ?? '', v);
      const forn = (cols[iForn] ?? '').trim();
      if (forn) acc(fornByNome, k, forn, v);
      soma += v;
    }
    console.log(`[ceaps-sen] ${y}: R$ ${(soma / 1e6).toFixed(1)} mi`);
  }

  // O CEAPS só traz o NOME do senador, e nem sempre o mesmo nome parlamentar da API
  // (ex.: API "Weverton" × CSV "WEVERTON ROCHA"). Resolvemos em 3 passos, do mais
  // seguro ao mais frouxo; prefixo só vale se casar com UM único nome do CSV.
  // resolveKey devolve a CHAVE casada (ou null) — reusada p/ gasto total E p/ a quebra.
  const ceapsKeys = [...gastoByNome.keys()];
  const resolveKey = (nomeParlamentar, nomeCivil) => {
    const k = normNome(nomeParlamentar);
    if (gastoByNome.has(k)) return k;
    if (nomeCivil && gastoByNome.has(normNome(nomeCivil))) return normNome(nomeCivil);
    const pref = ceapsKeys.filter((c) => c.startsWith(`${k} `));
    return pref.length === 1 ? pref[0] : null;
  };
  // null quando não há match — o chamador decide (0 real × dado ausente).
  const resolveGasto = (nomeParlamentar, nomeCivil) => {
    const key = resolveKey(nomeParlamentar, nomeCivil);
    return key === null ? null : gastoByNome.get(key);
  };
  const resolveCota = (nomeParlamentar, nomeCivil) => {
    const key = resolveKey(nomeParlamentar, nomeCivil);
    return resumoCota(
      [...(catByNome.get(key)?.entries() ?? [])],
      [...(fornByNome.get(key)?.entries() ?? [])],
    );
  };
  const semCeaps = [];

  // por senador: autorias, votações, relatorias (3 × 81 requests, cacheadas)
  const out = [];
  let totalSessoesVot = new Set();
  const porSenador = [];
  for (const s of parls) {
    const [aut, vot, rel, det, com, car, man] = await Promise.all([
      senadoJson(`sen-${s.id}-autorias.json`, `https://legis.senado.leg.br/dadosabertos/senador/${s.id}/autorias.json`),
      senadoJson(`sen-${s.id}-votacoes.json`, `https://legis.senado.leg.br/dadosabertos/senador/${s.id}/votacoes.json`),
      senadoJson(`sen-${s.id}-relatorias.json`, `https://legis.senado.leg.br/dadosabertos/senador/${s.id}/relatorias.json`),
      senadoJson(`sen-${s.id}-detalhe.json`, `https://legis.senado.leg.br/dadosabertos/senador/${s.id}.json`),
      senadoJson(`sen-${s.id}-comissoes.json`, `https://legis.senado.leg.br/dadosabertos/senador/${s.id}/comissoes.json`),
      senadoJson(`sen-${s.id}-cargos.json`, `https://legis.senado.leg.br/dadosabertos/senador/${s.id}/cargos.json`),
      senadoJson(`sen-${s.id}-mandatos.json`, `https://legis.senado.leg.br/dadosabertos/senador/${s.id}/mandatos.json`),
    ]);

    // ficha civil + comissões atuais (GP* = grupos de amizade, fora da conta)
    const basicos = det.DetalheParlamentar?.Parlamentar?.DadosBasicosParlamentar ?? {};
    const ident = det.DetalheParlamentar?.Parlamentar?.IdentificacaoParlamentar ?? {};
    const nomeCivil = ident.NomeCompletoParlamentar ?? null;
    const sexo = ident.SexoParlamentar === 'Feminino' ? 'F' : ident.SexoParlamentar === 'Masculino' ? 'M' : null;
    // mandatos como senador = entradas em que foi Titular OU chegou a exercer
    // (suplente que nunca assumiu não conta como mandato exercido)
    const mandatosDoSen = asArray(man.MandatoParlamentar?.Parlamentar?.Mandatos?.Mandato);
    const mandatosSen = mandatosDoSen
      .filter((m) => m.DescricaoParticipacao === 'Titular' || m.Exercicios?.Exercicio).length;
    // esteve em exercício nas datas de referência? (períodos [DataInicio, DataFim])
    const exercicios = mandatosDoSen.flatMap((m) => asArray(m.Exercicios?.Exercicio));
    const seatedFull = REF_EXERCICIO.every((d) =>
      exercicios.some((e) => (e.DataInicio ?? '9999') <= d && (!e.DataFim || e.DataFim >= d)));
    // tempo efetivo em exercício no período → mandato parcial se < 12 meses
    const mesesExercicio = mesesDeIntervalos(exercicios.map((e) => ({
      start: (e.DataInicio ?? '').slice(0, 10), end: (e.DataFim ?? '').slice(0, 10) || null,
    })));
    const mandatoParcial = mesesExercicio < MESES_MIN_RANK;
    const ficha = {
      ...(basicos.DataNascimento ? { idade: idadeDe(basicos.DataNascimento) } : {}),
      ...(basicos.Naturalidade ? { naturalidade: `${basicos.Naturalidade}/${basicos.UfNaturalidade ?? ''}`.replace(/\/$/, '') } : {}),
      ...(mandatosSen ? { mandatos: mandatosSen } : {}),
    };
    // atenção: comissões extintas (MPVs antigas etc.) vêm SEM DataFim na API —
    // o recorte por DataInicio >= 2023 (legislatura atual) filtra esses fósseis
    const comAtuais = asArray(com.MembroComissaoParlamentar?.Parlamentar?.MembroComissoes?.Comissao)
      .filter((c) => !c.DataFim && (c.DataInicio ?? '') >= '2023'
        && !/^GP/.test(c.IdentificacaoComissao?.SiglaComissao ?? ''));
    const cargosVistos = new Set();
    const comissoes = {
      total: comAtuais.length,
      cargos: asArray(car.CargoParlamentar?.Parlamentar?.Cargos?.Cargo)
        .filter((c) => !c.DataFim && (c.DataInicio ?? '') >= '2023'
          && c.IdentificacaoComissao && /presidente/i.test(c.DescricaoCargo ?? '')
          && !/^GP/.test(c.IdentificacaoComissao.SiglaComissao ?? ''))
        .filter((c) => {
          const k = `${c.IdentificacaoComissao.SiglaComissao}|${c.DescricaoCargo}`;
          return cargosVistos.has(k) ? false : (cargosVistos.add(k), true);
        })
        .map((c) => ({
          sigla: c.IdentificacaoComissao.SiglaComissao,
          nome: c.IdentificacaoComissao.NomeComissao,
          cargo: titleCase(c.DescricaoCargo ?? ''),
        })),
    };
    const autorias = asArray(aut.MateriasAutoriaParlamentar?.Parlamentar?.Autorias?.Autoria)
      .filter((a) => a.IndicadorAutorPrincipal === 'Sim')
      .map((a) => a.Materia)
      .filter((m) => TIPOS_PRINCIPAIS.has(m.Sigla) && Number(m.Ano) >= 2023);
    const propsAno = {};
    for (const m of autorias) propsAno[m.Ano] = (propsAno[m.Ano] ?? 0) + 1;

    // A API devolve a votação de TODA a carreira do senador — o Renan Calheiros vem com
    // 1.378 votos de 1995 a 2022. Sem o recorte por legislatura, a Stamina do veterano é
    // a média de 30 anos e a do novato é a de 3: incomparáveis. Mesmo cuidado das
    // comissões/cargos (que já recortavam por DataInicio >= 2023).
    //
    // As SECRETAS entram. Elas são a sabatina — a aprovação de autoridades do art. 52, III
    // e IV (STF, STJ, TCU, Banco Central, agências, embaixadores), competência PRIVATIVA do
    // Senado e 58% das suas votações nominais. Excluí-las media o senador por 42% do seu
    // trabalho de plenário, justamente omitindo a parte que a Câmara não tem — e premiava
    // quem falta à sabatina (o Carlos Fávaro tinha 100% de presença e Stamina 93 faltando a
    // 1 em cada 5). O sigilo é do VOTO, não da PRESENÇA: o DescricaoVoto traz "Não
    // Compareceu"/"Licença saúde" nas secretas igual às abertas, então dá para medir
    // comparecimento sem nunca tocar em COMO o senador votou (que a plataforma não exibe).
    const votacoes = asArray(vot.VotacaoParlamentar?.Parlamentar?.Votacoes?.Votacao)
      .filter((v) => (v.SessaoPlenaria?.DataSessao ?? v.DataSessao ?? '').slice(0, 4) >= '2023');
    const presente = (v) => !VOTO_AUSENTE_RE.test(v.DescricaoVoto ?? '');
    const votos = votacoes.filter(presente).length;
    for (const v of votacoes) totalSessoesVot.add(`${v.CodigoSessaoVotacao}-${v.Sequencial}`);
    // quebra aberta × secreta: a Stamina soma as duas (é tudo votação nominal), mas a
    // SEPARAÇÃO é o que revela quem comparece ao plenário e falta à sabatina — o trabalho
    // que só o Senado faz. Vira o painel "A Sabatina" nos insights.
    const secretas = votacoes.filter((v) => v.IndicadorVotacaoSecreta === 'Sim');
    const abertas = votacoes.filter((v) => v.IndicadorVotacaoSecreta !== 'Sim');
    const sabatinas = { presencas: secretas.filter(presente).length, total: secretas.length };
    const votacoesAbertas = { presencas: abertas.filter(presente).length, total: abertas.length };

    const relatoriasTodas = asArray(rel.MateriasRelatoriaParlamentar?.Parlamentar?.Relatorias?.Relatoria)
      .filter((r) => (r.DataDesignacao ?? '').slice(0, 4) >= '2023');
    const relatorias = relatoriasTodas.length;

    // ---- Eficiência: o que o senador TOCOU (autoria + relatoria) chegou a andar? ----
    // Recorte igual ao da Câmara: só matérias PRINCIPAIS (PL/PLP/PEC/PDL) da legislatura.
    // A Técnica do Senado conta relatoria de qualquer tipo (inclusive RQS/REQ, que andam
    // por rotina); deixá-las entrar aqui inflaria a Eficiência de quem só relata
    // requerimento. Por isso os dois números do card são diferentes — e cada tooltip diz
    // qual é qual.
    const sit = (m) => situacaoPorMateria.get(String(m.Codigo));
    const avancadas = autorias.filter((m) => senadoAvancou(sit(m))).length;
    const aprovadas = autorias.filter((m) => senadoVirouNorma(sit(m))).length;
    const relatoriasPrinc = relatoriasTodas
      .map((r) => r.Materia)
      .filter((m) => m && TIPOS_PRINCIPAIS.has(m.Sigla) && Number(m.Ano) >= 2023);
    const relatoriasAvancadas = relatoriasPrinc.filter((m) => senadoAvancou(sit(m))).length;

    const gasto = resolveGasto(s.nome, nomeCivil);
    if (gasto === null) semCeaps.push(s.nome);

    porSenador.push({ ...s, props: autorias.length, propsAno, votos, nVotacoes: votacoes.length, relatorias,
      sabatinas, votacoesAbertas,
      avancadas, aprovadas, relatoriasPrinc: relatoriasPrinc.length, relatoriasAvancadas,
      gasto: gasto ?? 0, cotaResumo: resolveCota(s.nome, nomeCivil),
      social: socialMap.get(`senado:${s.id}`) ?? null,
      ficha, sexo, comissoes, seatedFull, mandatoParcial, mesesExercicio });
  }
  // sem lançamento no CEAPS = R$ 0. É factual (há quem renuncie à cota), mas também
  // é o sintoma de um match nominal quebrado — confira a lista a cada ingestão.
  if (semCeaps.length) console.log(`[ceaps-sen] sem lançamentos (gasto 0): ${semCeaps.join(', ')}`);
  const totalVotacoesSen = totalSessoesVot.size;
  console.log(`[senado] ${totalVotacoesSen} votações nominais distintas no período`);

  // Stamina do Senado = TAXA de comparecimento às votações nominais da legislatura,
  // ABERTAS (174) + SECRETAS/sabatinas (239) = 413. O denominador é honesto: a API
  // registra o senador em TODA votação do seu mandato, inclusive as que ele faltou (a
  // ausência vem descrita, e o VOTO_AUSENTE_RE a tira do numerador).
  const staxaSen = (r) => (r.nVotacoes ? r.votos / r.nVotacoes : 0);
  const dimA = porSenador.map((r) => r.props).sort((a, b) => a - b);
  const staminaS = escalaComparecimento(porSenador.map(staxaSen));
  // Economia compara o gasto MENSAL durante o exercício, não o total da legislatura:
  // quem assumiu tarde gastou menos no total por ter estado menos tempo sentado, não
  // por frugalidade — mesmo princípio da taxa da Stamina. Piso de 1 mês: extrapolar
  // a partir de dias de exercício produziria uma "média mensal" absurda.
  const gastoMensalS = (r) => r.gasto / Math.max(r.mesesExercicio, 1);
  // Técnica = relatorias em matérias PRINCIPAIS (PL/PLP/PEC/PDL), o mesmo recorte da
  // Câmara. Contar relatoria de qualquer tipo inflava a casa: o Styvenson tinha 129
  // relatorias, das quais 107 eram REQUERIMENTO — e requerimento anda por rotina. Como a
  // Batalha e as Guildas comparam deputado com senador, "Técnica" precisa medir a MESMA
  // coisa nas duas casas. (O Senado segue sem emendas por autor nos Dados Abertos, então
  // aqui é só relatoria; na Câmara é relatoria + emendas.)
  const tecnicaS = escalaLog(porSenador.map((r) => r.relatoriasPrinc));
  const economiaS = escalaFrugalidade(porSenador.map((r) => gastoMensalS(r)));
  const comSoc = porSenador.filter((r) => r.social);
  const dimI = comSoc.length >= 5 ? comSoc.map((r) => r.social.seguidores).sort((a, b) => a - b) : null;

  // Eficiência — MESMA fórmula da Câmara (ver eficBruta lá): blend do percentil da TAXA
  // (andou ÷ tocou) com o do VOLUME (andou + 2× virou lei), mais bônus de +5 por lei
  // (teto +15), e percentil final para restaurar a distribuição 0–100. Ter a fórmula
  // idêntica é o que torna o atributo comparável entre as casas — os percentis é que são
  // calculados DENTRO de cada uma.
  const eficTocouS = (r) => r.props + r.relatoriasPrinc;
  const eficAndouS = (r) => r.avancadas + r.relatoriasAvancadas;
  const eficTaxaS = (r) => (eficTocouS(r) ? eficAndouS(r) / eficTocouS(r) : 0);
  const eficVolS = (r) => eficAndouS(r) + 2 * r.aprovadas;
  const bonusLeiS = (r) => Math.min(15, 5 * r.aprovadas); // não é redundante com o 2x — ver bonusLei da Câmara
  const dimEfTaxaS = porSenador.map(eficTaxaS).sort((a, b) => a - b);
  const dimEfVolS = porSenador.map(eficVolS).sort((a, b) => a - b);
  const eficBrutaS = (r) =>
    (percentileRank(dimEfTaxaS, eficTaxaS(r)) + percentileRank(dimEfVolS, eficVolS(r))) / 2 + bonusLeiS(r);
  const dimEficS = porSenador.map(eficBrutaS).sort((a, b) => a - b);
  console.log(`[senado] eficiência: ${porSenador.reduce((t, r) => t + r.avancadas, 0)} de ${porSenador.reduce((t, r) => t + r.props, 0)} autorias avançaram · ${porSenador.reduce((t, r) => t + r.aprovadas, 0)} viraram norma · ${porSenador.reduce((t, r) => t + r.relatoriasAvancadas, 0)} de ${porSenador.reduce((t, r) => t + r.relatoriasPrinc, 0)} relatorias andaram`);

  // Pesos do Senado (WEIGHTS_SENADO) — a casa não tem Fiscalização. A renormalização
  // por wSum abaixo cobre quem não tem Influência.
  const W = WEIGHTS_SENADO;

  for (const r of porSenador) {
    const ataque = percentileRank(dimA, r.props);
    const stamina = staminaS(staxaSen(r));
    const tecnica = tecnicaS(r.relatoriasPrinc);
    const eficiencia = percentileRank(dimEficS, eficBrutaS(r));
    const economia = economiaS(gastoMensalS(r));
    const influencia = dimI && r.social ? percentileRank(dimI, r.social.seguidores) : null;
    const comp = { ataque, stamina, tecnica, eficiencia, economia }; // Influência NÃO pontua (informativa)
    const wSum = Object.keys(comp).reduce((t, k) => t + W[k], 0);
    const ops = Math.round(Object.entries(comp).reduce((t, [k, v]) => t + W[k] * v, 0) / wSum);
    const tier = tierDe(ops);
    const titles = [];
    if (economia >= 85 && ops >= 60) titles.push('guardiao-do-cofre');
    // Nobre Gastador: agora que o Senado tem Eficiência, usa o MESMO gate da Câmara
    // (Eficiência < 40) em vez do antigo proxy por Poder < 45.
    if (economia <= 10 && eficiencia < 40) titles.push('nobre-gastador');
    if (stamina < 10) titles.push('fantasma-do-plenario');
    if (influencia !== null && influencia >= 85 && (ataque < 25 || stamina < 25)) titles.push('blogueiro-de-plenario');
    out.push({
      id: r.id,
      slug: `${slugify(r.nome)}-${r.id}`,
      nome: r.nome,
      casa: 'senado',
      uf: r.uf,
      partido: r.partido,
      fotoUrl: r.foto,
      primeiroMandato: false,
      stats: { ataque, stamina, tecnica, eficiencia, influencia: influencia ?? 0, economia, comando: 0 },
      ops, tier,
      sGateBloqueadoPor: null,
      titles,
      gastoMensalMedioMil: Math.round(gastoMensalS(r) / 1000),
      cotaResumo: r.cotaResumo,
      seguidores: 0,
      leisAprovadas: r.aprovadas,
      relatoriasN: r.relatoriasPrinc,
      relatoriasAvancadasN: r.relatoriasAvancadas,
      statRaw: {
        ataque: r.props, stamina: r.votos, tecnica: r.relatoriasPrinc, eficiencia: eficAndouS(r),
        ...(influencia !== null ? { influencia: r.social.seguidores } : {}),
      },
      // versão de UMA LINHA do bruto, para a imagem de compartilhamento (a frase
      // longa de rawNumbers seria truncada lá) — Senado não tem Fiscalização/Alinhamento.
      rawCurto: resumoCurtoStats({
        props: r.props, votos: r.votos, votacoes: r.nVotacoes,
        eficTocou: eficTocouS(r), eficAndou: eficAndouS(r),
        relatorias: r.relatoriasPrinc, gastoMes: gastoMensalS(r),
        ...(influencia !== null ? { seguidores: r.social.seguidores } : {}),
      }),
      // brutos NUMÉRICOS que a evidência dos títulos vermelhos cita (e cuja mediana
      // da casa ela calcula) — as frases de rawNumbers não servem: precisam ser somadas.
      bruto: {
        comparecimento: staxaSen(r), votos: r.votos, votacoes: r.nVotacoes,
        gastoMes: gastoMensalS(r), proposicoes: r.props,
        eficTocou: eficTocouS(r), eficAndou: eficAndouS(r),
        ...(influencia !== null ? { seguidores: r.social.seguidores } : {}),
      },
      seatedFull: r.seatedFull, // esteve em exercício em 2024 e 2025 (p/ Produção Concentrada)
      mandatoParcial: r.mandatoParcial, // < 12 meses em exercício → fora do ranking
      mesesExercicio: r.mesesExercicio,
      producaoAnual: YEARS.map((y) => r.propsAno[y] ?? 0),
      sabatinas: r.sabatinas,              // presença nas votações de autoridades (art. 52)
      votacoesAbertas: r.votacoesAbertas,  // presença nas demais votações nominais
      ficha: r.ficha,
      sexo: r.sexo,
      comissoes: r.comissoes,
      rawNumbers: {
        ataque: `${nf.format(r.props)} matérias relevantes de autoria principal (PL, PLP, PEC, PDL)`,
        stamina: `${nf.format(r.votos)} presenças em ${nf.format(r.nVotacoes)} votações nominais ocorridas durante o seu exercício, incluídas as sabatinas de autoridades (${Math.round(staxaSen(r) * 100)}% de comparecimento)`,
        tecnica: `relator designado em ${nf.format(r.relatoriasPrinc)} matérias relevantes (PL, PLP, PEC, PDL) desde 2023`,
        eficiencia: `${nf.format(eficAndouS(r))} de ${nf.format(eficTocouS(r))} matérias que tocou avançaram na tramitação${eficTocouS(r) ? ` (${((eficAndouS(r) / eficTocouS(r)) * 100).toFixed(1).replace('.', ',')}%)` : ''} — ${nf.format(r.avancadas)}/${nf.format(r.props)} de autoria, ${nf.format(r.relatoriasAvancadas)}/${nf.format(r.relatoriasPrinc)} de relatoria (PL, PLP, PEC, PDL)${r.aprovadas ? ` · ${nf.format(r.aprovadas)} já viraram norma (+${bonusLeiS(r)} de bônus na Eficiência)` : ''}`,
        economia: `${fmtReais(r.gasto)} de cota (CEAPS) usados nos ${nf.format(Math.round(Math.max(r.mesesExercicio, 1)))} meses em exercício — média de R$ ${nf.format(Math.round(gastoMensalS(r) / 1000))} mil/mês`,
        ...(influencia !== null ? {
          influencia: `${fmtSeg(r.social.seguidores)} seguidores no ${REDE_LABEL[r.social.rede] ?? r.social.rede} (@${r.social.handle}${r.social.coletadoEm ? `, coletado em ${r.social.coletadoEm}` : ''})`,
        } : {}),
      },
    });
  }
  // Comando (informativo): percentil DENTRO do Senado
  const dimComandoSen = out.map((o) => comandoRawDe(o.comissoes)).sort((a, b) => a - b);
  for (const o of out) {
    const rawC = comandoRawDe(o.comissoes);
    o.stats.comando = percentileRank(dimComandoSen, rawC);
    o.statRaw.comando = rawC;
    o.rawNumbers.comando = comandoTexto(o.comissoes);
  }

  // total de matérias do Senado que viraram norma na legislatura — mesma semântica do
  // leisTotal da Câmara (conta a matéria, não o autor), para o painel "Leis" somar as duas casas.
  const normasSenado = [...situacaoPorMateria.values()].filter(senadoVirouNorma).length;
  return { senadores: out, normasSenado };
}

// ---------- main ----------
const deputados = await fetchDeputados();
const partidoNomes = await fetchPartidos();
const { votesByDep, totalVotacoes, votacaoData, votoPorDep } = await fetchVotos();
const orientacaoGov = await fetchOrientacoesGoverno();
const { statusById, relatoriasByDep, relatoriasAvancadasByDep, emendaIds, fiscalIds } = await fetchStatusProposicoes();
const { propsByDep, emendasByDep, fiscalByDep } = await fetchProposicoes(statusById, emendaIds, fiscalIds);
const { gastoByDep, catByDep, fornByDep } = await fetchCeap();

console.log(`[base] ${deputados.length} deputados atuais · ${totalVotacoes} votações nominais no período`);

// Stamina = TAXA de comparecimento, não contagem bruta: votos registrados ÷ votações
// nominais ocorridas ENQUANTO o deputado estava em exercício. Sem isso, quem assumiu
// tarde (suplente) ou ficou licenciado seria punido por tempo de casa, não por faltar.
// Históricos são cacheados e reaproveitados adiante (mandato parcial, Produção Concentrada).
console.log('[camara] histórico de exercício por deputado (Stamina + mandato parcial)…');
// A API da Câmara devolve 504 TRANSITÓRIO sob carga — numa reingestão do zero são
// 513 chamadas seguidas e alguns deputados estouram mesmo com o retry interno.
// Abortar no primeiro que falha joga fora ~20min de trabalho; então adiamos os
// problemáticos e damos novas chances depois de uma pausa (a API cede quando
// respira). Só aí, se ainda faltar alguém, é que explodimos — NUNCA seguimos com
// histórico vazio: isso viraria "0 meses de exercício" e apagaria o deputado do
// ranking em silêncio.
// Pool de concorrência: sequencial, cada 504 (que demora ~40s p/ estourar) trava a
// fila inteira, e uma reingestão do zero levava HORAS. Os 504 são específicos por
// deputado — a API responde normalmente a outros ao mesmo tempo — então esperar
// parado não ajuda ninguém. 4 é conservador: mantém a API respirando (cachedGentil
// ainda dá a pausa de 60ms por fetch real) e corta o tempo total em ~4×.
const histByDep = new Map();
let pendentes = [];
async function carregarHistoricos(lista, concorrencia = 4) {
  const fila = [...lista];
  const falhas = [];
  await Promise.all(Array.from({ length: concorrencia }, async () => {
    for (let d; (d = fila.shift());) {
      try { histByDep.set(d.id, await historicoCamara(d.id)); }
      catch (e) { falhas.push(d); console.log(`  [hist] adiado: ${d.nome} (${e.message})`); }
    }
  }));
  return falhas;
}
pendentes = await carregarHistoricos(deputados);
for (let rodada = 1; pendentes.length && rodada <= 3; rodada++) {
  console.log(`[camara] ${pendentes.length} histórico(s) pendente(s) — pausa de 30s antes da rodada extra ${rodada}/3…`);
  await sleep(30000);
  // rodada extra em série (2): são poucos e já sabidamente problemáticos — aqui
  // vale ser gentil com a API, não rápido.
  pendentes = await carregarHistoricos(pendentes, 2);
}
if (pendentes.length) {
  throw new Error(
    `histórico indisponível para ${pendentes.length} deputado(s): ${pendentes.map((d) => d.nome).join(', ')}. ` +
    `Abortando de propósito — seguir com histórico vazio zeraria os meses de exercício e os tiraria do ranking. ` +
    `O cache é incremental: rode 'npm run data:real' de novo mais tarde.`,
  );
}
const datasVotacao = [...votacaoData.values()].sort(); // ordenadas p/ contagem por intervalo
// nº de votações nominais cujo dia caiu dentro dos intervalos de exercício do deputado
function votacoesNoExercicio(intervalos) {
  let n = 0;
  for (const { start, end } of intervalos) {
    if (!start) continue;
    const s = start > TERM_START ? start : TERM_START;
    const e = (end && end < HOJE) ? end : HOJE;
    if (e <= s) continue;
    n += datasVotacao.filter((d) => d >= s && d < e).length;
  }
  return n;
}

const social = lerSocial();
const INFL_MIN = 10; // mínimo de curadorias p/ o atributo valer como percentil

const raw = deputados.map((d) => {
  const votos = votesByDep.get(d.id)?.total ?? 0;
  const intervalos = intervalosCamara(histByDep.get(d.id) ?? []);
  const mesesExercicio = mesesDeIntervalos(intervalos);
  // denominador nunca menor que os votos efetivamente dados → taxa sempre ≤ 100%
  // (protege contra lacunas no histórico de exercício)
  const votacoesMandato = Math.max(votacoesNoExercicio(intervalos), votos);
  return {
  id: d.id,
  nome: d.nome,
  partido: normalizaSigla(d.siglaPartido),
  uf: d.siglaUf,
  foto: d.urlFoto,
  votos,
  votacoesMandato,
  stTaxa: votacoesMandato ? votos / votacoesMandato : 0,
  mesesExercicio,
  mandatoParcial: mesesExercicio < MESES_MIN_RANK,
  props: propsByDep.get(d.id)?.total ?? 0,
  aprovadas: propsByDep.get(d.id)?.aprovadas ?? 0,
  avancadas: propsByDep.get(d.id)?.avancadas ?? 0,
  propsAno: propsByDep.get(d.id)?.porAno ?? {},
  relatorias: relatoriasByDep.get(d.id) ?? 0,
  relatoriasAvancadas: relatoriasAvancadasByDep.get(d.id) ?? 0,
  emendas: emendasByDep.get(d.id) ?? 0,
  fiscal: fiscalByDep.get(d.id) ?? 0,
  alinh: alinhamento(votoPorDep.get(d.id) ?? new Map(), orientacaoGov),
  gasto: gastoByDep.get(d.id) ?? 0,
  cotaResumo: resumoCota(
    [...(catByDep.get(d.id)?.entries() ?? [])],
    [...(fornByDep.get(d.id)?.entries() ?? [])],
  ),
  social: social.get(`camara:${d.id}`) ?? null,
  };
});

const dimAtaque = raw.map((r) => r.props).sort((a, b) => a - b);
const staminaCam = escalaComparecimento(raw.map((r) => r.stTaxa)); // TAXA de comparecimento, não contagem
// Eficiência = BLEND de duas dimensões, para não punir quem produz muito:
//   • aproveitamento (taxa): o que andou ÷ o que tocou → recompensa precisão
//   • resultado (volume que andou): + 2×leis            → recompensa entrega,
//     com a lei (rara) valendo o triplo de um mero avanço.
// Média dos dois percentis. Só a taxa faria um autor de muitos projetos com
// vários avanços perder de quem tem poucos projetos e alta fração — sem sentido.
//
// "Tocar" = conversão de TUDO que o parlamentar toca: o que ele PROPÔS e o que
// ele RELATOU. Ser designado relator não é entrega (só 26,6% das relatorias andam);
// o que conta é a matéria avançar. Relator puro (sem autorias) deixa de zerar a taxa.
const eficTocou = (r) => r.props + r.relatorias;
const eficAndou = (r) => r.avancadas + r.relatoriasAvancadas;
const eficTaxa = (r) => (eficTocou(r) ? eficAndou(r) / eficTocou(r) : 0);
const eficVol = (r) => eficAndou(r) + 2 * r.aprovadas;
const dimEficTaxa = raw.map(eficTaxa).sort((a, b) => a - b);
const dimEficVol = raw.map(eficVol).sort((a, b) => a - b);
// bônus direto por lei sancionada (a conquista mais rara e valiosa): +5 por
// lei, teto de +15. Somado ao blend ANTES do percentil final.
//
// Parece redundante com o `2 * r.aprovadas` do eficVol — NÃO É, e a diferença é
// estrutural: aquele entra no valor BRUTO, antes do percentil, e por isso satura
// (quem já está no p97 de volume não tem para onde subir, por mais leis que faça).
// Este entra DEPOIS do percentil, e é o único canal que discrimina no topo. Medido:
// remover o bônus e compensar com multiplicador maior (5x, 8x) não recupera nada —
// o autor de 3 leis cai de 83 para 72 em qualquer variante. Trocar o volume por
// escala log é pior ainda (cai para 58, e a 17ª lei passa a valer 8 pontos em vez
// de 15). A mistura de unidades é proposital; não "limpe" para um mecanismo só.
const bonusLei = (r) => Math.min(15, 5 * r.aprovadas);
// pontuação BRUTA de eficiência = blend (taxa + volume) + bônus por lei.
const eficBruta = (r) =>
  (percentileRank(dimEficTaxa, eficTaxa(r)) + percentileRank(dimEficVol, eficVol(r))) / 2
  + bonusLei(r);
// atributo FINAL = percentil da bruta dentro da casa. Isso restaura a distribuição
// uniforme 0–100 e deixa a Eficiência comparável aos demais atributos (que também são
// percentis puros) — sem o teto/enviesamento que o blend cru introduzia nos gates.
const dimEfic = raw.map(eficBruta).sort((a, b) => a - b);
const efic = (r) => percentileRank(dimEfic, eficBruta(r));
// Técnica = trabalho técnico sobre o texto: relatorias + emendas de autoria.
// Escala LOG (não percentil): no percentil a cauda alta saturava — 1,9x o trabalho
// de um colega no topo virava 1 ponto de atributo. O Ataque NÃO acompanha e segue
// percentil de propósito: em log, a magnitude do volume bruto volta a mandar e
// desfaz o motivo de o Ataque pesar menos que a Eficiência (protocolar é barato).
// Medido: log nos dois reinstalava o empate entre um autor de 296 matérias com
// 15,7% de aproveitamento e um de 80 com 41,8%.
const tecnicaBruta = (r) => r.relatorias + r.emendas;
const tecnicaCam = escalaLog(raw.map(tecnicaBruta));
// Fiscalização = controle do Executivo. Só existe na Câmara: o RQS do Senado não
// tem rótulo de subtipo, e separar fiscalização de "voto de pesar" ali exigiria
// regex em texto livre — o que o guardrail proíbe.
const dimFiscal = raw.map((r) => r.fiscal).sort((a, b) => a - b);
// Economia compara o gasto MENSAL durante o exercício, não o total da legislatura:
// comparar totais fazia quem assumiu tarde (ou passou anos licenciado no Executivo)
// parecer "frugal" só por ter estado menos tempo sentado — a Carla Dickson exibia
// R$ 21 mil/mês (total ÷ 41) e levava Guardião do Cofre gastando ~R$ 47 mil/mês no
// exercício, acima da mediana da casa. Mesmo princípio da taxa da Stamina. Piso de
// 1 mês: extrapolar de dias de exercício produziria uma média mensal absurda.
const gastoMensal = (r) => r.gasto / Math.max(r.mesesExercicio, 1);
const economiaCam = escalaFrugalidade(raw.map((r) => gastoMensal(r))); // menor gasto/mês = maior Economia
const comSocial = raw.filter((r) => r.social);
const dimInfl = comSocial.length >= INFL_MIN
  ? comSocial.map((r) => r.social.seguidores).sort((a, b) => a - b)
  : null;

const nf = new Intl.NumberFormat('pt-BR');
const full = raw.map((r) => {
  const ataque = percentileRank(dimAtaque, r.props);
  const stamina = staminaCam(r.stTaxa);
  const eficiencia = efic(r); // já é o blend 0–100 (taxa + volume)
  const tecnica = tecnicaCam(tecnicaBruta(r));
  const fiscalizacao = percentileRank(dimFiscal, r.fiscal);
  const economia = economiaCam(gastoMensal(r));
  const influencia = dimInfl && r.social ? percentileRank(dimInfl, r.social.seguidores) : null;
  // Alinhamento: taxa ABSOLUTA (não percentil) — a frase factual é o produto.
  // "votou com o governo em 64% das vezes" significa algo; "percentil 64 de
  // alinhamento" não significa nada para o leitor.
  // NÃO entra no `comp`: posição política não é mérito nem demérito.
  const alinhamentoPct = r.alinh.taxa === null ? null : Math.round(r.alinh.taxa * 100);
  // Poder renormalizado: soma ponderada só dos atributos que o parlamentar TEM
  const comp = { ataque, stamina, eficiencia, tecnica, economia }; // Influência/Comando/Fiscalização/Alinhamento NÃO pontuam
  const wSum = Object.keys(comp).reduce((t, k) => t + WEIGHTS_CAMARA[k], 0);
  const ops = Math.round(Object.entries(comp).reduce((t, [k, v]) => t + WEIGHTS_CAMARA[k] * v, 0) / wSum);
  const tier = tierDe(ops);
  return {
    id: r.id,
    slug: `${slugify(r.nome)}-${r.id}`,
    nome: r.nome,
    casa: 'camara',
    uf: r.uf,
    partido: r.partido,
    fotoUrl: r.foto,
    primeiroMandato: false,
    stats: { ataque, stamina, tecnica, eficiencia, influencia: influencia ?? 0, economia, comando: 0, fiscalizacao, alinhamento: alinhamentoPct ?? 0 },
    ops, tier,
    sGateBloqueadoPor: null,
    titles: [],
    gastoMensalMedioMil: Math.round(gastoMensal(r) / 1000),
    cotaResumo: r.cotaResumo,
    seguidores: 0,
    mesesExercicio: r.mesesExercicio,
    mandatoParcial: r.mandatoParcial,
    // internos p/ títulos e insights (persistidos; extras são inofensivos)
    leisAprovadas: r.aprovadas,
    relatoriasN: r.relatorias,
    relatoriasAvancadasN: r.relatoriasAvancadas, // p/ títulos de relatoria (só Câmara)
    producaoAnual: YEARS.map((y) => r.propsAno[y] ?? 0),
    // valor bruto numérico por atributo (base dos rankings "quem tem mais X")
    statRaw: {
      ataque: r.props, stamina: r.votos, eficiencia: eficAndou(r), tecnica: tecnicaBruta(r),
      fiscalizacao: r.fiscal,
      ...(r.social ? { influencia: r.social.seguidores } : {}),
      ...(alinhamentoPct !== null ? { alinhamento: alinhamentoPct } : {}),
    },
    // versão de UMA LINHA do bruto, para a imagem de compartilhamento (a frase
    // longa de rawNumbers seria truncada lá).
    rawCurto: resumoCurtoStats({
      props: r.props, votos: r.votos, votacoes: r.votacoesMandato,
      eficTocou: eficTocou(r), eficAndou: eficAndou(r),
      relatorias: r.relatorias, emendas: r.emendas, gastoMes: gastoMensal(r),
      fiscal: r.fiscal,
      ...(influencia !== null ? { seguidores: r.social.seguidores } : {}),
      ...(alinhamentoPct !== null ? { alinhamentoPct } : {}),
    }),
    // brutos NUMÉRICOS que a evidência dos títulos vermelhos cita (e cuja mediana
    // da casa ela calcula) — as frases de rawNumbers não servem: precisam ser somadas.
    bruto: {
      comparecimento: r.stTaxa, votos: r.votos, votacoes: r.votacoesMandato,
      gastoMes: gastoMensal(r), proposicoes: r.props,
      eficTocou: eficTocou(r), eficAndou: eficAndou(r),
      ...(r.social ? { seguidores: r.social.seguidores } : {}),
    },
    // números brutos exibidos no card ("de onde vem cada atributo")
    rawNumbers: {
      ataque: `${nf.format(r.props)} proposições relevantes apresentadas (PL, PLP, PEC, PDL)`,
      stamina: `${nf.format(r.votos)} votos registrados em ${nf.format(r.votacoesMandato)} votações nominais ocorridas durante o seu exercício (${Math.round(r.stTaxa * 100)}% de comparecimento)`,
      eficiencia: `${nf.format(eficAndou(r))} de ${nf.format(eficTocou(r))} proposições que tocou avançaram na tramitação${eficTocou(r) ? ` (${((eficAndou(r) / eficTocou(r)) * 100).toFixed(1).replace('.', ',')}%)` : ''} — ${nf.format(r.avancadas)}/${nf.format(r.props)} de autoria, ${nf.format(r.relatoriasAvancadas)}/${nf.format(r.relatorias)} de relatoria${r.aprovadas ? ` · ${nf.format(r.aprovadas)} já viraram norma (+${bonusLei(r)} de bônus na Eficiência)` : ''}`,
      tecnica: `${nf.format(tecnicaBruta(r))} atos de trabalho sobre o texto — relator designado em ${nf.format(r.relatorias)} proposições relevantes${r.relatorias ? ` (${nf.format(r.relatoriasAvancadas)} ${r.relatoriasAvancadas === 1 ? 'avançou' : 'avançaram'})` : ''} e autor de ${nf.format(r.emendas)} ${r.emendas === 1 ? 'emenda' : 'emendas'} (na comissão, de plenário ou de relator)`,
      fiscalizacao: `${nf.format(r.fiscal)} atos de cobrança ao Executivo — requerimentos de informação a ministro, convocações de ministro e propostas de fiscalização e controle (PFC)`,
      economia: `${fmtReais(r.gasto)} de cota (CEAP) usados nos ${nf.format(Math.round(Math.max(r.mesesExercicio, 1)))} meses em exercício — média de R$ ${nf.format(Math.round(gastoMensal(r) / 1000))} mil/mês`,
      ...(influencia !== null ? {
        influencia: `${fmtSeg(r.social.seguidores)} seguidores no ${REDE_LABEL[r.social.rede] ?? r.social.rede} (@${r.social.handle}${r.social.coletadoEm ? `, coletado em ${r.social.coletadoEm}` : ''})`,
      } : {}),
      ...(alinhamentoPct !== null ? {
        // sem sufixo "informativo": a UI já anexa isso a todo stat de statsInformativos
        alinhamento: `votou com a orientação do Governo em ${nf.format(r.alinh.iguais)} de ${nf.format(r.alinh.comparaveis)} votações em que o Governo orientou Sim ou Não (${alinhamentoPct}%)`,
      } : {}),
    },
  };
});

// ficha civil + órgãos/comissões (513 × ~3 requests, cacheados)
console.log('[camara] ficha civil e órgãos por deputado…');
for (const p of full) {
  const { nomeCivil, sexo, ficha } = await fichaCamara(p.id);
  p.ficha = ficha;
  p.sexo = sexo;
  p.comissoes = await orgaosCamara(p.id);
  // mesesExercicio/mandatoParcial já vêm calculados do raw (histByDep) — não refazer.
}

// Comando (informativo): percentil DENTRO da Câmara, já com comissões carregadas
const dimComandoCam = full.map((p) => comandoRawDe(p.comissoes)).sort((a, b) => a - b);
for (const p of full) {
  const rawC = comandoRawDe(p.comissoes);
  p.stats.comando = percentileRank(dimComandoCam, rawC);
  p.statRaw.comando = rawC;
  p.rawNumbers.comando = comandoTexto(p.comissoes);
}

// ---------- títulos FACTUAIS (só regras 100% deriváveis dos dados reais) ----------
const TITLE_DEFS_REAIS = [
  { slug: 'guardiao-do-cofre', label: '🔒 Guardião do Cofre', cor: 'green',
    regra: 'Economia ≥ 85 (entre os 15% de menor gasto mensal de cota CEAP/CEAPS durante o exercício) com Poder ≥ 60 — entrega bem gastando pouco.' },
  { slug: 'nobre-gastador', label: '💸 Nobre Gastador', cor: 'red',
    regra: 'Entre os 10% de maior gasto mensal de cota parlamentar (CEAP/CEAPS) durante o exercício COM entrega fraca (Eficiência < 40) — mesmo gate nas duas casas. Gasta muito, entrega pouco.' },
  { slug: 'fantasma-do-plenario', label: '👻 Fantasma do Plenário', cor: 'red',
    regra: 'Entre os 10% com menor taxa de comparecimento às votações nominais ocorridas durante o seu exercício (fonte: votações da Câmara/Senado).' },
  { slug: 'blogueiro-de-plenario', label: '📱 Blogueiro de Plenário', cor: 'red',
    regra: 'Influência ≥ 85 (seguidores nas redes sociais) estando no QUARTIL INFERIOR da própria casa em algum eixo de entrega — Ataque < 25 ou Stamina < 25 — E sem NENHUM título verde de entrega (Artilheiro, Relator-Mor, Legislador Efetivo, Relator que Entrega, Presença de Ferro, Guardião do Cofre): muita projeção, pouca entrega. O limiar é o quartil, não a mediana: estar na média da casa NÃO rotula ninguém. Quem tem prova factual de entrega não é rotulado Blogueiro.' },
  // --- positivos de entrega ---
  { slug: 'artilheiro', label: '⚔️ Artilheiro', cor: 'green',
    regra: 'Ataque ≥ 90 — entre os 10% que mais apresentam proposições relevantes (PL, PLP, PEC, PDL) na sua casa.' },
  { slug: 'relator-mor', label: '📜 Relator-Mor', cor: 'green',
    regra: 'Técnica ≥ 90 — entre os 10% mais designados relatores de proposições na sua casa.' },
  { slug: 'presenca-de-ferro', label: '🛡️ Presença de Ferro', cor: 'green',
    regra: 'Stamina ≥ 95 — entre os 5% com maior taxa de comparecimento às votações nominais do seu mandato. O oposto do Fantasma do Plenário.' },
  { slug: 'legislador-efetivo', label: '📖 Legislador Efetivo', cor: 'green',
    regra: 'Autor principal de pelo menos uma proposição já TRANSFORMADA EM NORMA JURÍDICA nesta legislatura. Vale nas duas casas: o desfecho da Câmara vem do CSV bulk de proposições; o do Senado, da situação da matéria no /processo.' },
  { slug: 'relator-que-entrega', label: '📜 Relator que Entrega', cor: 'green',
    regra: 'Designado relator em 5+ proposições relevantes e METADE OU MAIS delas avançou na tramitação. Ser designado não é entregar: na legislatura, só 26,6% das relatorias avançam Vale nas duas casas — o Senado publica o desfecho da matéria no /processo.' },
  { slug: 'relator-de-gaveta', label: '🗄️ Relator de Gaveta', cor: 'red',
    regra: 'Designado relator em 10+ proposições relevantes e NENHUMA delas avançou na tramitação Vale nas duas casas — o Senado publica o desfecho da matéria no /processo.' },
  { slug: 'idolo-das-redes', label: '⭐ Ídolo das Redes', cor: 'green',
    regra: 'Influência ≥ 90 (seguidores) COM entrega real: Ataque ≥ 50 E Stamina ≥ 50 — projeção pública lastreada em trabalho e presença. O exato oposto do Blogueiro de Plenário (por construção, nunca coincidem).' },
  { slug: 'operario-silencioso', label: '🔧 Operário Silencioso', cor: 'green',
    regra: 'Entrega legislativa de ponta com projeção discreta: Ataque ≥ 80 E (Técnica ≥ 80 OU Eficiência ≥ 80) E Influência ≤ 50 — tem Instagram, mas alcance na metade inferior. Trabalha muito e aparece pouco: o exato oposto do Blogueiro de Plenário.' },
  { slug: 'cao-de-guarda', label: '🐕 Cão de Guarda', cor: 'green',
    regra: 'Está entre os 10% que mais cobraram o Executivo (requerimentos de informação a ministro, convocações de ministro e PFC) e compareceu a pelo menos metade das votações.' },
  { slug: 'carimbador', label: '🖋️ Carimbador', cor: 'purple',
    regra: 'Está entre os 15% de maior Técnica (relatorias + emendas) e no terço inferior de Ataque: trabalha muito mais sobre o texto dos outros do que propondo o próprio.' },
  // --- alinhamento (informativo, descritivo — a plataforma não toma partido) ---
  { slug: 'base-do-governo', label: '🏛️ Base do Governo', cor: 'purple',
    regra: 'Votou com a orientação da bancada do Governo em 85% ou mais das votações em que o Governo orientou Sim ou Não. Informativo — não pontua no Poder.' },
  { slug: 'oposicao', label: '🏛️ Oposição', cor: 'purple',
    regra: 'Votou com a orientação da bancada do Governo em 20% ou menos das votações em que o Governo orientou Sim ou Não. Informativo — não pontua no Poder.' },
  { slug: 'voto-avulso', label: '🏛️ Voto Avulso', cor: 'purple',
    regra: 'Votou com a orientação da bancada do Governo entre 40% e 60% das vezes — não acompanha consistentemente nem o Governo nem a oposição. Informativo — não pontua no Poder.' },
  // --- senioridade (informativo) ---
  { slug: 'estreante', label: '🌱 Estreante', cor: 'purple',
    regra: 'Está no 1º mandato na casa atual (Câmara: legislaturas exercidas; Senado: mandatos de 8 anos). Informativo — não afeta Poder nem Tier.' },
  { slug: 'veterano', label: '🎖️ Veterano', cor: 'purple',
    regra: 'Longa trajetória na casa: 5+ mandatos na Câmara ou 3+ no Senado (24+ anos). Informativo — não afeta Poder nem Tier.' },
  // O nome descreve o que foi MEDIDO (concentração da produção em 2026). "Safra
  // Eleitoral", o nome antigo, imputava INTENÇÃO — oportunismo eleitoral —, e intenção
  // não é derivável de dado nenhum: contradizia o "títulos são 100% factuais" que a
  // própria ficha promete ao leitor.
  { slug: 'producao-concentrada', label: '🗳️ Produção Concentrada em 2026', cor: 'purple',
    regra: 'Esteve em exercício o mandato inteiro (em plenário em jul/2024 e jul/2025, pela posse e histórico — exclui suplentes tardios e ministros/secretários licenciados) E concentrou 60%+ das proposições relevantes apresentadas em 2026, o ano de eleição. Informativo — não afeta Poder nem Tier.' },
];
for (const p of full) {
  if (p.stats.economia >= 85 && p.ops >= 60) p.titles.push('guardiao-do-cofre');
  if (p.stats.economia <= 10 && p.stats.eficiencia < 40) p.titles.push('nobre-gastador');
  if (p.stats.stamina < 10) p.titles.push('fantasma-do-plenario');
  if (p.rawNumbers.influencia && p.stats.influencia >= 85 && (p.stats.ataque < 25 || p.stats.stamina < 25)) p.titles.push('blogueiro-de-plenario');
}

// ---------- Senado: merge ----------
const { senadores, normasSenado } = await fetchSenado(social);
full.push(...senadores);

// ---------- títulos POSITIVOS / de senioridade (ambas as casas) ----------
// aplicados após o merge para cobrir Câmara e Senado com a mesma regra.
// Todos green/purple → nenhum bloqueia o gate do Tier S (que só olha red).
for (const p of full) {
  if (p.stats.ataque >= 90) p.titles.push('artilheiro');
  if (p.stats.tecnica >= 90) p.titles.push('relator-mor');
  if (p.stats.stamina >= 95) p.titles.push('presenca-de-ferro');
  // Estes três eram bloqueados no Senado por FALTA DE DADO, não por regra: a casa não
  // publicava o desfecho da matéria. O /processo publica — então valem para as duas casas.
  if ((p.leisAprovadas ?? 0) >= 1) p.titles.push('legislador-efetivo');
  // relatoria: designar ≠ entregar
  if ((p.relatoriasN ?? 0) >= 5 && (p.relatoriasAvancadasN ?? 0) / p.relatoriasN >= 0.5) p.titles.push('relator-que-entrega');
  if ((p.relatoriasN ?? 0) >= 10 && (p.relatoriasAvancadasN ?? 0) === 0) p.titles.push('relator-de-gaveta');
  // entrega real = NÃO ser Blogueiro: exige Ataque ≥ 50 E Stamina ≥ 50, condição mais
  // forte que a negação da fraqueza do Blogueiro (que dispara com ataque<25 OU
  // stamina<25, cuja negação é ataque≥25 E stamina≥25) → nunca coincidem.
  if (p.rawNumbers.influencia && p.stats.influencia >= 90 && p.stats.ataque >= 50 && p.stats.stamina >= 50) p.titles.push('idolo-das-redes');
  // Operário Silencioso: alta entrega, baixo alcance (tem Instagram, mas modesto) — anti-Blogueiro
  if (p.rawNumbers.influencia && p.stats.influencia <= 50 && p.stats.ataque >= 80 && (p.stats.tecnica >= 80 || p.stats.eficiencia >= 80)) p.titles.push('operario-silencioso');
  // Fiscalização: cobra o Executivo sem sumir das votações (só Câmara tem Fiscalização).
  if (p.rawNumbers.fiscalizacao && p.stats.fiscalizacao >= 90 && p.stats.stamina >= 50) p.titles.push('cao-de-guarda');
  // Trabalha muito mais sobre o texto dos outros do que propondo o próprio.
  if (p.stats.tecnica >= 85 && p.stats.ataque <= 40) p.titles.push('carimbador');
  // Alinhamento: rótulos DESCRITIVOS, nunca julgamento — a plataforma não toma partido (só Câmara).
  if (p.rawNumbers.alinhamento && p.stats.alinhamento >= 85) p.titles.push('base-do-governo');
  if (p.rawNumbers.alinhamento && p.stats.alinhamento <= 20) p.titles.push('oposicao');
  if (p.rawNumbers.alinhamento && p.stats.alinhamento >= 40 && p.stats.alinhamento <= 60) p.titles.push('voto-avulso');
  const m = p.ficha?.mandatos ?? 0;
  p.primeiroMandato = m === 1;
  if (m === 1) p.titles.push('estreante');
  else if (m >= (p.casa === 'senado' ? 3 : 5)) p.titles.push('veterano');
}

// ---------- Blogueiro de Plenário: não coexiste com prova de entrega ----------
// Um título VERDE de entrega (Artilheiro, Relator-Mor, Legislador Efetivo, etc.) é
// prova factual de que o parlamentar entrega — logo NÃO é "pouca entrega". O selo
// crítico é suprimido nesses casos (rodado após todos os títulos verdes atribuídos).
const VERDE_ENTREGA = new Set(TITLE_DEFS_REAIS.filter((t) => t.cor === 'green').map((t) => t.slug));
for (const p of full) {
  if (p.titles.includes('blogueiro-de-plenario') && p.titles.some((t) => VERDE_ENTREGA.has(t))) {
    p.titles = p.titles.filter((t) => t !== 'blogueiro-de-plenario');
  }
}

// ---------- 🗳️ Produção Concentrada em 2026 ----------
// SÓ é justo entre quem esteve em exercício o mandato inteiro (não suplente que
// assumiu em 2025/26, nem ministro/secretário licenciado). Confirma-se pela
// posse/histórico (Câmara) e pelos exercícios do mandato (Senado). Sem esse
// filtro, "só produziu em 2026" seria só suplência e licença — nunca oportunismo.
const concentrou2026 = (p) => {
  const pa = p.producaoAnual;
  if (pa.length !== 4) return false;
  const total = pa[0] + pa[1] + pa[2] + pa[3];
  return total >= 5 && pa[3] >= 0.6 * total; // 2026 é meio ano → limiar já é conservador
};
console.log('[producao-concentrada] verificando exercício integral dos candidatos…');
for (const p of full) {
  if (!concentrou2026(p)) continue;
  let seatedFull;
  if (p.casa === 'camara') {
    const h = histByDep.get(p.id) ?? [];
    seatedFull = REF_EXERCICIO.every((d) => emExercicioEm(h, d));
  } else {
    seatedFull = !!p.seatedFull;
  }
  if (seatedFull) p.titles.push('producao-concentrada');
}
console.log(`[producao-concentrada] ${full.filter((p) => p.titles.includes('producao-concentrada')).length} parlamentares com Produção Concentrada em 2026`);

// ---------- gates do Tier S (spec §3) ----------
// Poder ≥ 88 não basta: Stamina ≥ 70, Eficiência ≥ 60 (onde o atributo existe —
// Senado não tem), NENHUM atributo que pontua no vermelho (< 40 — o mesmo limiar que
// pinta a barra de vermelho na UI) e nenhum título negativo. Falhou →
// Tier A + selo. O gate de atributo vermelho só olha os atributos que PONTUAM
// (Influência e Comando são informativos e nunca ficam vermelhos na ficha).
const TITULOS_NEGATIVOS = new Map(TITLE_DEFS_REAIS.filter((t) => t.cor === 'red').map((t) => [t.slug, t.label]));
const STAT_LABEL = { ataque: 'Ataque', stamina: 'Stamina', eficiencia: 'Eficiência', tecnica: 'Técnica', economia: 'Economia' };
const SCORING_KEYS = Object.keys(STAT_LABEL);
for (const p of full) {
  if (p.ops < PODER_TIER_S) continue;
  const negativo = p.titles.find((t) => TITULOS_NEGATIVOS.has(t));
  // primeiro atributo que pontua no vermelho (existe p/ este parlamentar E < 40)
  const vermelho = SCORING_KEYS.find((k) => p.rawNumbers[k] !== undefined && p.stats[k] < 40);
  const motivo =
    p.stats.stamina < 70 ? `Stamina ${p.stats.stamina} < 70`
    : p.stats.eficiencia < 60 ? `Eficiência ${p.stats.eficiencia} < 60`
    : vermelho ? `${STAT_LABEL[vermelho]} ${p.stats[vermelho]} no vermelho (< 40)`
    : negativo ? `título negativo ativo (${TITULOS_NEGATIVOS.get(negativo)})`
    : null;
  if (motivo) { p.tier = 'A'; p.sGateBloqueadoPor = motivo; }
}

// presidência da Casa: cargo institucional suprime a atividade medida → fora do ranking
for (const p of full) {
  if (ehPresidenteMesa(p.comissoes) || EX_PRESIDENTES_CASA.has(p.id)) p.presidenteCasa = true;
}
console.log(`[presidencia] ${full.filter((p) => p.presidenteCasa).map((p) => p.nome).join(', ') || 'nenhum'} fora do ranking (presidência da Casa)`);

// mandato parcial (posse recente) ou presidência da Casa saem de TODO ranking e não
// recebem títulos — amostra pequena demais / cargo institucional. Continuam no site
// (buscáveis, com página e selo), só não ranqueiam. RANK = conjunto ranqueável.
const foraDoRanking = (p) => p.mandatoParcial || p.presidenteCasa;
for (const p of full) if (foraDoRanking(p)) { p.titles = []; p.sGateBloqueadoPor = null; }
const RANK = full.filter((p) => !foraDoRanking(p));

// ---------- evidência dos títulos VERMELHOS ----------
// Um selo vermelho faz acusação ABSOLUTA a partir de um gate RELATIVO (percentil na
// casa): sozinho, é afirmação de fato contestável. Aqui cada um ganha o número bruto
// que o disparou + a mediana da própria casa, exibidos no tooltip da ficha. Roda por
// ÚLTIMO, depois de toda supressão/limpeza de título — evidência de título que não
// existe mais seria contradição visível. A referência é a casa INTEIRA (mesmo universo
// do percentil que gerou o gate), não só o conjunto ranqueável.
for (const casa of ['camara', 'senado']) {
  const daCasa = full.filter((p) => p.casa === casa);
  const ref = referenciasDaCasa(daCasa);
  for (const p of daCasa) {
    const ev = evidenciaDeTitulos(p, ref);
    if (Object.keys(ev).length) p.titleEvidence = ev;
  }
}
console.log(`[evidencia] ${full.filter((p) => p.titleEvidence).length} parlamentares com número bruto anexado a selo vermelho`);
console.log(`[parcial] ${full.length - RANK.length} fora do ranking (${RANK.length} ranqueáveis)`);

// guildas = partidos reais presentes
const siglas = [...new Set(full.map((p) => p.partido))].sort();
const GUILDS = siglas.map((sigla) => ({
  sigla, nome: partidoNomes.get(sigla) ?? sigla, cor: corDe(sigla), espectro: null,
}));

const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];
const guildRanking = GUILDS.map((g) => {
  const members = RANK.filter((p) => p.partido === g.sigla);
  const tiers = Object.fromEntries(TIERS.map((t) => [t, members.filter((p) => p.tier === t).length]));
  return { ...g, total: members.length, tiers };
})
  // guilda sem NENHUM ranqueável (ex.: a DC, cujo único deputado tomou posse há
  // menos de um mês) viraria uma barra vazia no gráfico de composição — e o gráfico
  // é sobre composição por tier, que ela não tem
  .filter((g) => g.total > 0)
  .sort((a, b) => b.tiers.S - a.tiers.S || b.tiers.A - a.tiers.A);

const UFS = [...new Set(full.map((p) => p.uf))].sort();
const ufAgg = UFS.map((uf) => {
  const ms = RANK.filter((p) => p.uf === uf);
  return {
    uf,
    opsMedio: ms.length ? Math.round(ms.reduce((s, p) => s + p.ops, 0) / ms.length) : 0,
    blogueiros: ms.filter((p) => p.titles.includes('blogueiro-de-plenario')).length,
  };
});

const sorted = [...RANK].sort((a, b) => b.ops - a.ops);
const nGuardioes = full.filter((p) => p.titles.includes('guardiao-do-cofre')).length;
const nGastadores = full.filter((p) => p.titles.includes('nobre-gastador')).length;

// --- novos blocos de insights (100% derivados dos dados já ingeridos) ---
const slim = (p) => ({ slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido });
const comIdade = full.filter((p) => p.ficha?.idade);
const idadeMedia = (casa) => {
  const xs = comIdade.filter((p) => p.casa === casa);
  return xs.length ? Math.round(xs.reduce((s, p) => s + p.ficha.idade, 0) / xs.length) : 0;
};
const porIdade = [...comIdade].sort((a, b) => a.ficha.idade - b.ficha.idade);
const estreantes = full.filter((p) => p.primeiroMandato).length;
const renovacao = {
  estreantes,
  pctEstreantes: Math.round((estreantes / full.length) * 100),
  idadeMediaCamara: idadeMedia('camara'),
  idadeMediaSenado: idadeMedia('senado'),
  maisNovo: porIdade[0] ? { ...slim(porIdade[0]), idade: porIdade[0].ficha.idade } : null,
  maisVelho: porIdade.length ? { ...slim(porIdade.at(-1)), idade: porIdade.at(-1).ficha.idade } : null,
};
// distinct: nº de proposições principais que viraram norma na legislatura
const leisTotal = [...statusById.values()].filter((s) => s.aprovada).length + normasSenado;
const leis = {
  total: leisTotal,
  legisladores: RANK.filter((p) => (p.leisAprovadas ?? 0) >= 1).length,
  ranking: [...RANK].filter((p) => (p.leisAprovadas ?? 0) >= 1)
    .sort((a, b) => b.leisAprovadas - a.leisAprovadas).slice(0, 8)
    .map((p) => ({ ...slim(p), n: p.leisAprovadas })),
};
// ---------- A Sabatina: o trabalho que só o Senado faz ----------
// Aprovar autoridades (CF art. 52, III e IV — STF, STJ, TCU, Banco Central, agências,
// embaixadores) é competência PRIVATIVA do Senado, e responde por 58% das suas votações
// nominais. O painel compara a presença do senador na sabatina com a dele nas DEMAIS
// votações: quem tem gap negativo grande comparece ao plenário e falta justamente ao
// que só a casa dele pode fazer. Os dois números são factuais e vêm do mesmo campo —
// o sigilo da sabatina é do VOTO, não da presença.
const senRank = RANK.filter((p) => p.casa === 'senado' && p.sabatinas?.total);
const taxaPct = (x) => (x.total ? Math.round((x.presencas / x.total) * 100) : 0);
const sabatina = senRank.length ? {
  total: Math.max(...senRank.map((p) => p.sabatinas.total)),
  totalAbertas: Math.max(...senRank.map((p) => p.votacoesAbertas.total)),
  presencaMedia: Math.round(senRank.reduce((t, p) => t + taxaPct(p.sabatinas), 0) / senRank.length),
  presencaMediaAbertas: Math.round(senRank.reduce((t, p) => t + taxaPct(p.votacoesAbertas), 0) / senRank.length),
  // os 8 maiores gaps NEGATIVOS: presente no plenário aberto, ausente na sabatina
  faltantes: [...senRank]
    .map((p) => ({ ...slim(p), sabatina: taxaPct(p.sabatinas), abertas: taxaPct(p.votacoesAbertas) }))
    .map((p) => ({ ...p, gap: p.sabatina - p.abertas }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 8),
} : null;

// Cota parlamentar: CEAP (Câmara) e CEAPS (Senado) têm tetos e regras distintas —
// nunca somamos nem ranqueamos as duas casas juntas, todo agregado é por casa.
const mediana = (xs) => (xs.length ? xs[Math.floor(xs.length / 2)] : 0);
const gastoDaCasa = (casa) => {
  const xs = RANK.filter((p) => p.casa === casa).map((p) => p.gastoMensalMedioMil).sort((a, b) => a - b);
  const totalMil = xs.reduce((s, v) => s + v, 0);
  return {
    n: xs.length, totalMil,
    media: xs.length ? Math.round(totalMil / xs.length) : 0,
    mediana: mediana(xs), max: xs.at(-1) ?? 0,
  };
};
const gastoPorCasa = { camara: gastoDaCasa('camara'), senado: gastoDaCasa('senado') };
// guildas ordenadas pela MÉDIA por parlamentar (o total só mede o tamanho da bancada)
const guildGastoDaCasa = (casa) => GUILDS
  .map((g) => {
    const ms = RANK.filter((p) => p.casa === casa && p.partido === g.sigla);
    if (!ms.length) return null;
    const totalMil = ms.reduce((s, p) => s + p.gastoMensalMedioMil, 0);
    return { sigla: g.sigla, nome: g.nome, n: ms.length, totalMil, media: Math.round(totalMil / ms.length) };
  })
  .filter(Boolean)
  .sort((a, b) => b.media - a.media || b.n - a.n);
const guildGasto = { camara: guildGastoDaCasa('camara'), senado: guildGastoDaCasa('senado') };

// --- Quebra da cota (categoria/fornecedor) → 4 blocos INFORMATIVOS de Insights ---
// Tudo derivado do cotaResumo já computado por parlamentar (lista COMPLETA de categorias).
// Ranqueáveis (RANK) para a mesma população dos demais painéis de gasto.
const CAT_DIVULGACAO = 'Divulgação';
const catValor = (p, rot) => p.cotaResumo?.categorias.find((c) => c.categoria === rot)?.valor ?? 0;

// #1 "Onde o Congresso gasta a cota": agregado por categoria, POR CASA (nunca soma casas)
const gastoCategoriasDaCasa = (casa) => {
  const acc = new Map();
  for (const p of RANK.filter((x) => x.casa === casa))
    for (const c of p.cotaResumo?.categorias ?? []) acc.set(c.categoria, (acc.get(c.categoria) ?? 0) + c.valor);
  const entradas = [...acc.entries()].sort((a, b) => b[1] - a[1]);
  const total = entradas.reduce((s, [, v]) => s + v, 0);
  const ps = percentuais(entradas.map(([, v]) => v), total);
  return {
    totalMi: +(total / 1e6).toFixed(1),
    categorias: entradas.map(([categoria, valor], i) => ({ categoria, totalMil: Math.round(valor / 1000), pct: ps[i] })),
  };
};
const gastoCategorias = { camara: gastoCategoriasDaCasa('camara'), senado: gastoCategoriasDaCasa('senado') };

// #2 "Quem mais gasta com divulgação": ranking nacional (gasto absoluto em R$; casa no selo)
const topDivulgacao = RANK
  .map((p) => ({ ...slim(p), tier: p.tier, valorMil: Math.round(catValor(p, CAT_DIVULGACAO) / 1000) }))
  .filter((x) => x.valorMil > 0)
  .sort((a, b) => b.valorMil - a.valorMil)
  .slice(0, 15);

// #3 "Divulgação × alcance": X = divulgação mensal média (R$ mil/mês), Y = percentil de Influência
//    (o eixo Y do ScatterChart é 0–100, então não cabe seguidor bruto — vai o percentil)
const divulgacaoInfluencia = RANK
  .filter((p) => p.statRaw?.influencia && catValor(p, CAT_DIVULGACAO) > 0)
  .map((p) => ({
    slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido, tier: p.tier,
    // mesma normalização da Economia: média mensal DURANTE O EXERCÍCIO (piso de 1 mês)
    x: Math.round(catValor(p, CAT_DIVULGACAO) / Math.max(p.mesesExercicio ?? 1, 1) / 1000), y: p.stats.influencia,
  }));

// #4 "Concentração de fornecedor": maior fatia da cota num só fornecedor (informativo, com caveat)
const concentracaoFornecedor = RANK
  .filter((p) => p.cotaResumo?.fornecedor && p.cotaResumo.fornecedor.pct >= 25)
  .map((p) => ({
    ...slim(p), tier: p.tier,
    fornecedor: p.cotaResumo.fornecedor.nome,
    pct: p.cotaResumo.fornecedor.pct,
    valorMil: Math.round(p.cotaResumo.fornecedor.valor / 1000),
  }))
  .sort((a, b) => b.pct - a.pct)
  .slice(0, 15);

const generoDe = (casa) => {
  const xs = full.filter((p) => p.casa === casa && (p.sexo === 'F' || p.sexo === 'M'));
  return { f: xs.filter((p) => p.sexo === 'F').length, m: xs.filter((p) => p.sexo === 'M').length };
};
const genero = { camara: generoDe('camara'), senado: generoDe('senado') };

// --- eixo Governo × Oposição (só Câmara — só ela tem orientação de bancada publicada) ---
// Usa `full`, não `RANK`: alinhamento é uma TAXA (não uma pontuação de mérito), então
// presidência da Casa e mandato parcial — fora do ranking de Poder por outros motivos —
// continuam contando aqui. É por isso que o termômetro soma exatamente os 513 titulares.
const comAlinh = full.filter((p) => p.casa === 'camara' && p.rawNumbers?.alinhamento);
const termometro = comAlinh.length ? {
  base: comAlinh.filter((p) => p.stats.alinhamento >= 75).length,
  independentes: comAlinh.filter((p) => p.stats.alinhamento > 40 && p.stats.alinhamento < 75).length,
  oposicao: comAlinh.filter((p) => p.stats.alinhamento <= 40).length,
  total: comAlinh.length,
} : null;
// dissidentes: maior desvio ABSOLUTO da média de alinhamento do próprio partido —
// só entre partidos com pelo menos 8 deputados no eixo (abaixo disso a "média" é ruído)
const mediaPartidoAlinh = new Map();
for (const sigla of new Set(comAlinh.map((p) => p.partido))) {
  const membros = comAlinh.filter((p) => p.partido === sigla);
  if (membros.length >= 8) {
    mediaPartidoAlinh.set(sigla, membros.reduce((s, p) => s + p.stats.alinhamento, 0) / membros.length);
  }
}
const dissidentes = comAlinh
  .filter((p) => mediaPartidoAlinh.has(p.partido))
  .map((p) => {
    const media = mediaPartidoAlinh.get(p.partido);
    return {
      ...slim(p), alinhamento: p.stats.alinhamento,
      mediaPartido: Math.round(media), desvio: Math.round(p.stats.alinhamento - media),
    };
  })
  .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
  .slice(0, 10);
const topFiscais = [...comAlinh]
  .sort((a, b) => (b.statRaw.fiscalizacao ?? 0) - (a.statRaw.fiscalizacao ?? 0))
  .slice(0, 10)
  .map((p) => ({ ...slim(p), atos: p.statRaw.fiscalizacao, alinhamento: p.stats.alinhamento }));
// x = alinhamento (taxa absoluta), y = PERCENTIL de fiscalização (não o nº bruto: a
// distribuição bruta é brutalmente torta — mediana 4, máximo 1.483 — e num eixo
// linear todo mundo colaria no zero; o percentil espalha 0–100 preservando a ordem)
const politicaScatter = comAlinh.map((p) => ({
  slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido, tier: p.tier,
  x: p.stats.alinhamento, y: p.stats.fiscalizacao,
}));

const insights = {
  kpis: {
    tierS: RANK.filter((p) => p.tier === 'S').length,
    opsMedio: Math.round(RANK.reduce((s, p) => s + p.ops, 0) / RANK.length),
    cacadores: 0, dragoes: 0,
    blogueiros: RANK.filter((p) => p.titles.includes('blogueiro-de-plenario')).length,
  },
  extraKpis: [
    { lbl: '📱 Blogueiros de Plenário', val: RANK.filter((p) => p.titles.includes('blogueiro-de-plenario')).length, sub: 'muita projeção pública, pouca entrega', titleSlug: 'blogueiro-de-plenario' },
    { lbl: '🔧 Operários Silenciosos', val: RANK.filter((p) => p.titles.includes('operario-silencioso')).length, sub: 'entrega de ponta, projeção discreta (o oposto do Blogueiro)', titleSlug: 'operario-silencioso' },
    { lbl: '💸 Nobres Gastadores', val: nGastadores, sub: 'top 10% de gasto com eficiência baixa', titleSlug: 'nobre-gastador' },
    { lbl: '🗳️ Produção Concentrada', val: RANK.filter((p) => p.titles.includes('producao-concentrada')).length, sub: 'concentraram 60%+ da produção do mandato em 2026', titleSlug: 'producao-concentrada' },
    // Estreantes e Emplacaram-lei NÃO viram KPI (já aparecem no painel Renovação
  ],
  renovacao, leis, genero,
  ...(sabatina ? { sabatina } : {}),
  gastoPorCasa, guildGasto,
  gastoCategorias, topDivulgacao, divulgacaoInfluencia, concentracaoFornecedor,
  guildRanking, ufAgg,
  // Gasto × Entrega real: cota CEAP média mensal vs. Poder; flag = Nobre Gastador (factual)
  scatter: RANK.map((p) => ({
    slug: p.slug, nome: p.nome, gasto: p.gastoMensalMedioMil, ops: p.ops,
    tier: p.tier, uf: p.uf, partido: p.partido, casa: p.casa,
    flag: p.titles.includes('nobre-gastador'),
  })),
  fama: sorted.slice(0, 10).map((p) => ({ slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido, ops: p.ops, tier: p.tier })),
  vergonha: sorted.slice(-10).reverse().map((p) => ({ slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido, ops: p.ops, tier: p.tier })),
  // eixo Governo × Oposição: só emitido se houver dado de alinhamento (só Câmara)
  ...(comAlinh.length ? { termometro, dissidentes, topFiscais, politicaScatter } : {}),
};

const index = full.map((p) => ({
  slug: p.slug, nome: p.nome, fotoUrl: p.fotoUrl, casa: p.casa, uf: p.uf, partido: p.partido,
  tier: p.tier, ops: p.ops, stats: p.stats,
  avail: Object.keys(p.rawNumbers), // stats existentes p/ este parlamentar
  ...(p.mandatoParcial ? { mandatoParcial: true } : {}), // marca p/ Batalha/busca
  ...(p.presidenteCasa ? { presidenteCasa: true } : {}),
}));

const meta = {
  fonte: 'Dados Abertos da Câmara e do Senado',
  // Data da FONTE mais velha que alimentou esta execução — não a data de execução.
  // `new Date()` aqui carimbava "atualizado em hoje" mesmo quando a rodada só
  // recalculou sobre cache de duas semanas atrás: o rodapé de ~673 páginas e a
  // /sobre afirmavam ao leitor um frescor que o dado não tinha. O dado é tão atual
  // quanto sua parte mais velha, então é o MÍNIMO, não o máximo.
  updatedAt: dataDasFontes(),
  /** quando o gerador rodou — separado, porque não é o que o leitor quer saber */
  geradoEm: new Date().toISOString().slice(0, 10),
  availableStats: full.some((p) => p.rawNumbers.influencia)
    ? ['ataque', 'stamina', 'eficiencia', 'tecnica', 'economia', 'fiscalizacao', 'influencia', 'comando', 'alinhamento']
    : ['ataque', 'stamina', 'eficiencia', 'tecnica', 'economia', 'fiscalizacao', 'comando', 'alinhamento'],
  tierCortes: TIER_CORTES,
  pesos: pesosNormalizados('camara'),
  pesosPorCasa: {
    camara: pesosNormalizados('camara'),
    senado: pesosNormalizados('senado'),
  },
  statsInformativos: ['influencia', 'comando', 'fiscalizacao', 'alinhamento'], // exibidos mas NÃO pontuam no Poder
  titulosDisponiveis: true,
  aviso: 'Dados reais da Câmara e do Senado: Ataque (autorias PL/PLP/PEC/PDL), Stamina (taxa de comparecimento às votações nominais do mandato — no Senado, incluídas as sabatinas de autoridades do art. 52), Eficiência (matérias que o parlamentar tocou, por autoria ou relatoria, e que AVANÇARAM na tramitação em vez de morrer na gaveta da comissão — nas duas casas), Técnica (relatorias e emendas — trabalho técnico sobre o texto alheio; o Senado só conta relatorias) e Economia (gasto MENSAL médio da cota CEAP/CEAPS durante os meses em exercício — comparar totais faria quem assumiu tarde parecer frugal por ter estado menos tempo sentado). Fiscalização = requerimentos de informação a ministro, convocações de ministro e propostas de fiscalização e controle (PFC) de autoria (só Câmara): é INFORMATIVA e NÃO pontua no Poder — fiscalizar o Executivo é, na prática, fazer oposição a ele (a oposição protocola em média 192 atos por deputado; a base do governo, 20), então pontuá-la seria premiar posição política travestida de entrega. Influência = seguidores no Instagram (contagem pública dos handles oficiais declarados à Câmara): é INFORMATIVA — aparece no card e nos títulos, mas NÃO pontua no Poder (alcance social não é entrega legislativa). Alinhamento = % de votos coincidentes com a orientação da bancada do Governo (só Câmara): é INFORMATIVO e NÃO pontua no Poder — posição política não é mérito nem demérito. Presidentes da Casa (que não votam/autoram como os demais por dever institucional) ficam fora do ranking, como os de mandato parcial. Títulos são 100% factuais.',
};

writeFileSync(join(OUT_DATA, 'politicians.json'), JSON.stringify(full));
writeFileSync(join(OUT_DATA, 'insights.json'), JSON.stringify(insights));
writeFileSync(join(OUT_DATA, 'guilds.json'), JSON.stringify(GUILDS));
writeFileSync(join(OUT_DATA, 'meta.json'), JSON.stringify(meta));
// raridade FACTUAL = fração de parlamentares que carregam o título (comum/raro/lendário)
const raridadeDe = (n) => (n / full.length < 0.02 ? 'lendario' : n / full.length < 0.10 ? 'raro' : 'comum');
const titleDefsOut = TITLE_DEFS_REAIS
  .map((t) => ({ ...t, raridade: raridadeDe(full.filter((p) => p.titles.includes(t.slug)).length) }));
writeFileSync(join(OUT_DATA, 'title-defs.json'), JSON.stringify(titleDefsOut));
writeFileSync(join(OUT_PUBLIC, 'index.json'), JSON.stringify(index));
writeFileSync(join(OUT_PUBLIC, 'guilds.json'), JSON.stringify(GUILDS));
writeFileSync(join(OUT_PUBLIC, 'meta.json'), JSON.stringify(meta));

console.log(`[ok] ${full.length} deputados reais · Tier S: ${insights.kpis.tierS} · partidos: ${GUILDS.length}`);
