/**
 * Baixa as fotos oficiais (Câmara/Senado) para `public/fotos/` e reescreve os
 * `fotoUrl` de data/politicians.json e public/data/index.json para o caminho
 * local (`/fotos/<slug>.webp`).
 *
 * POR QUE: os portais servem as fotos SEM header CORS. Uma <img> remota até
 * aparece na página, mas ao ser desenhada num <canvas> ela o "contamina" e o
 * toBlob() passa a lançar — ou seja, a imagem de compartilhamento (ShareButton)
 * NUNCA poderia mostrar o rosto. Servindo do próprio domínio, a foto é
 * same-origin: o canvas continua limpo e o share sai com a foto.
 * Bônus: o site deixa de depender da disponibilidade dos portais em runtime.
 *
 * Idempotente: pula o que já está em `public/fotos/`. Se um download falhar,
 * MANTÉM a URL remota do parlamentar (a página segue mostrando a foto; só o
 * share dele cai na silhueta) — nunca apaga o dado.
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOTOS = join(ROOT, 'public', 'fotos');
const POLITICIANS = join(ROOT, 'data', 'politicians.json');
const INDEX = join(ROOT, 'public', 'data', 'index.json');

const CONCURRENCY = 8;
// A Câmara serve 354×472 (ver `urlOficial`); o Senado, 1152×1441 (≈1,4 MB cada!).
// Normalizamos em 480px de altura: cobre com folga a janela da carta (216 CSS px)
// em telas 2× e o canvas do share, sem inflar o bundle estático.
const ALTURA_MAX = 480;
// WebP a 480px para retrato. O <canvas> do ShareButton desenha WebP normalmente
// em todos os browsers atuais, e as fotos são same-origin, então o toBlob()
// segue limpo. q68 é o piso seguro: da fonte, é indistinguível de q75 a olho nu
// num rosto detalhado (~10% menor na frota), mas abaixo de q65 começa banding
// nos fundos lisos — e a foto de fundo branco da Câmara é justo o pior caso.
const QUALIDADE = 68;
// Piso de largura para o cache ser considerado válido. As duas casas pousam bem
// acima (Câmara 354, Senado 384); quem estiver abaixo é sobra da era em que se
// baixava a miniatura de 114×152 da Câmara — ver `baixar`.
const LARGURA_MIN = 300;
const local = (slug) => `/fotos/${slug}.webp`;

// Placeholder inline da foto (a janela piscava de escura p/ clara). Fundo branco
// fixo não serve: só a Câmara fotografa em branco. 12×13 é a razão da janela e,
// subido a 196px, o browser borra sozinho. Crop igual ao do render (cover/top).
const LQIP_W = 12, LQIP_H = 13, LQIP_Q = 45;

/** URL oficial da foto. Reconstruível a partir de casa+id: é isso que permite
 *  re-baixar depois que os JSONs já foram reescritos p/ o caminho local
 *  (ex.: `public/fotos/` apagado, ou troca do tamanho de redimensionamento).
 *
 *  ATENÇÃO ao `.jpgmaior.jpg` da Câmara — não é typo, é o nome do arquivo mesmo
 *  (a listagem "Quem são os deputados" monta a URL concatenando "maior.jpg" ao
 *  `urlFoto` da API). O `urlFoto` que a API dos Dados Abertos devolve — o
 *  `{id}.jpg` seco — é uma miniatura de 114×152 para 134 dos 512 deputados
 *  (os outros 378 já vêm em 354×472): a mesma foto, mesmo enquadramento, só que
 *  borrada ao ser esticada para os 216 CSS px da janela da carta em tela 2×.
 *  O `.jpgmaior.jpg` devolve 354×472 para os 512, sem exceção — por isso NÃO se
 *  usa o `p.fotoUrl` da API como origem preferencial (ver `baixar`). */
const urlOficial = (p) =>
  p.casa === 'camara'
    ? `https://www.camara.leg.br/internet/deputado/bandep/${p.id}.jpgmaior.jpg`
    : `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${p.id}.jpg`;

if (!existsSync(POLITICIANS)) {
  console.error('[erro] data/politicians.json não existe — rode `npm run data:real` antes.');
  process.exit(1);
}
mkdirSync(FOTOS, { recursive: true });

const politicians = JSON.parse(readFileSync(POLITICIANS, 'utf8'));

/** baixa (ou converte) uma foto; devolve true se o WebP local existe ao final */
async function baixar(p) {
  const destino = join(FOTOS, `${p.slug}.webp`);
  const antigoJpg = join(FOTOS, `${p.slug}.jpg`);
  // já convertida (e não é um arquivo truncado de uma execução interrompida).
  // A largura também é conferida: `public/fotos/` é gitignored, ou seja, o cache
  // é por máquina — sem esta checagem, quem tivesse rodado antes da troca para o
  // `.jpgmaior.jpg` manteria 134 deputados borrados PARA SEMPRE, e sem erro
  // nenhum, porque uma miniatura de 114×152 é um download bem-sucedido.
  if (existsSync(destino) && statSync(destino).size > 512) {
    try {
      if ((await sharp(destino).metadata()).width >= LARGURA_MIN) return true;
    } catch {
      /* arquivo ilegível: cai no rebaixo abaixo */
    }
    rmSync(destino);
  }

  // Migração barata: se já temos o JPEG local (execuções anteriores, já a 480px),
  // transcodifica p/ WebP SEM tocar nos portais — e remove o .jpg órfão pra não
  // deployar 10 MB a mais. Só quem não tem foto local cai no fetch remoto abaixo.
  if (existsSync(antigoJpg) && statSync(antigoJpg).size > 1024) {
    try {
      await sharp(antigoJpg).webp({ quality: QUALIDADE }).toFile(destino);
      rmSync(antigoJpg);
      return true;
    } catch (e) {
      console.warn(`[falha-transcode] ${p.slug}: ${e.message} — tentando portal`);
    }
  }

  // A URL RECONSTRUÍDA vem primeiro; o `fotoUrl` que veio da API é só a rede de
  // segurança. É o inverso do intuitivo, e é de propósito: na Câmara o `urlFoto`
  // da API aponta para a miniatura de 114×152 (ver `urlOficial`), então preferi-lo
  // gravaria a foto borrada de 134 deputados — em silêncio, porque um JPEG de
  // 114×152 é um download perfeitamente bem-sucedido.
  const candidatos = [urlOficial(p)];
  if (p.fotoUrl && !p.fotoUrl.startsWith('/') && p.fotoUrl !== candidatos[0]) candidatos.push(p.fotoUrl);

  let ultimoErro;
  for (const origem of candidatos) {
    try {
      const res = await fetch(origem, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // páginas de erro dos portais voltam como HTML com 200 — não são foto
      if (buf.length < 1024 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('não é JPEG');
      await sharp(buf)
        .resize({ height: ALTURA_MAX, withoutEnlargement: true }) // não upscala as da Câmara
        .webp({ quality: QUALIDADE })
        .toFile(destino);
      return true;
    } catch (e) {
      ultimoErro = e;
    }
  }
  console.warn(`[falha] ${p.slug}: ${ultimoErro.message}`);
  return false;
}

const fila = [...politicians];
let baixadas = 0, falhas = 0;
const ok = new Set();

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (fila.length) {
      const p = fila.shift();
      const existia = existsSync(join(FOTOS, `${p.slug}.webp`));
      if (await baixar(p)) {
        ok.add(p.slug);
        if (!existia) baixadas++;
      } else {
        falhas++;
      }
    }
  }),
);

// lê o arquivo local, não o buffer do download: roda igual com cache quente
const lqips = new Map();
const filaLqip = [...ok];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (filaLqip.length) {
      const slug = filaLqip.shift();
      try {
        const buf = await sharp(join(FOTOS, `${slug}.webp`))
          .resize(LQIP_W, LQIP_H, { fit: 'cover', position: 'top' })
          .webp({ quality: LQIP_Q, effort: 6 })
          .toBuffer();
        lqips.set(slug, `data:image/webp;base64,${buf.toString('base64')}`);
      } catch (e) {
        // sem placeholder o pior caso é a piscada — não é motivo p/ abortar
        console.warn(`[lqip-falha] ${slug}: ${e.message}`);
      }
    }
  }),
);

// reescreve os fotoUrl: local para quem tem arquivo, remoto (intocado) p/ o resto
const repontar = (arr, comLqip = false) => {
  for (const p of arr) {
    if (ok.has(p.slug)) p.fotoUrl = local(p.slug);
    if (!comLqip) continue;
    const lqip = lqips.get(p.slug);
    // foto que sumiu leva o placeholder junto
    if (lqip) p.fotoLqip = lqip; else delete p.fotoLqip;
  }
  return arr;
};

writeFileSync(POLITICIANS, JSON.stringify(repontar(politicians, true)));
// sem LQIP: o index.json vai pro client e 185 B × 593 inflariam 245 KB → 355 KB
if (existsSync(INDEX)) {
  writeFileSync(INDEX, JSON.stringify(repontar(JSON.parse(readFileSync(INDEX, 'utf8')))));
}

console.log(
  `[ok] ${ok.size}/${politicians.length} fotos locais em public/fotos/ ` +
  `(${baixadas} novas nesta execução${falhas ? `, ${falhas} sem foto local — seguem apontando p/ o portal` : ''})`,
);
