// Gera a imagem de compartilhamento (Open Graph / Twitter) em public/og.png.
//
// É um ASSET REPRODUZÍVEL, no mesmo espírito do fetch-fotos: roda com rede
// (baixa as fontes do Google Fonts uma vez), mas a SAÍDA é um PNG versionado,
// então o `next build` continua 100% offline e estático. Re-rodar regenera.
//
// Compõe a arte heráldica de fundo (assets/og-bg.png — brasão dourado sobre
// fundo dark, versionada no repo) com a wordmark do site desenhada por cima na
// FONTE REAL do site (Cinzel display + Sometype Mono corpo), via next/og
// (satori + resvg). A função `render()` recebe título/subtítulo, então o dia em
// que quisermos cartas por político é só chamá-la em laço emitindo
// public/og/<slug>.png.

import { ImageResponse } from 'next/og.js';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200, H = 630;
const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length <= 1 ? children[0] : children } });

// Instâncias TTF ESTÁTICAS por peso (o parser do @vercel/og não digere fonte
// variável). Via google-webfonts-helper, que resolve cada peso para um .ttf
// estático no gstatic — as mesmas famílias do site (Cinzel + Sometype Mono).
async function loadFont(gwfhId, variantId) {
  const meta = await (await fetch(`https://gwfh.mranftl.com/api/fonts/${gwfhId}?subsets=latin`)).json();
  const url = meta.variants?.find((v) => v.id === variantId)?.ttf;
  if (!url) throw new Error(`sem TTF para ${gwfhId}:${variantId}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`falha ao baixar ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Tons amostrados do PRÓPRIO metal do escudo (assets/og-bg.png): brilho no topo
// → bronze na sombra. Assim a wordmark é o "mesmo dourado" da arte, com relevo
// metálico em vez de um dourado chapado.
const GOLD_GRAD = 'linear-gradient(180deg, #f7eaa6 0%, #d8b060 46%, #a5762f 78%, #6f4a1c 100%)';
const GOLD_SUB = '#c6a256';
const GOLD_RULE = '#8a6a2f';

/** Elemento da carta OG (1200×630): arte de fundo + wordmark no miolo do escudo. */
function card({ bg, title, subtitle }) {
  return h('div', {
    style: {
      width: `${W}px`, height: `${H}px`, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundImage: `url(${bg})`, backgroundSize: `${W}px ${H}px`,
      // paddingTop > paddingBottom empurra o bloco pra baixo, centralizando-o
      // na cavidade do escudo (cujo centro visual fica abaixo do meio da arte).
      fontFamily: 'Sometype Mono', paddingTop: '36px', paddingBottom: '4px',
    },
  },
    // o texto vive dentro da cavidade do escudo — largura contida
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '500px' } },
      h('div', {
        style: {
          display: 'flex', fontFamily: 'Cinzel', fontWeight: 900, fontSize: '72px',
          letterSpacing: '1px', lineHeight: 1,
          color: 'transparent', backgroundImage: GOLD_GRAD,
          backgroundClip: 'text', WebkitBackgroundClip: 'text',
        },
      }, title),
      h('div', { style: { width: '190px', height: '2px', background: `${GOLD_RULE}cc`, margin: '22px 0 16px', display: 'flex' } }),
      h('div', { style: { display: 'flex', fontSize: '21px', fontWeight: 600, color: GOLD_SUB, letterSpacing: '0.5px', textAlign: 'center' } }, subtitle),
    ),
  );
}

const FONTS = {};

async function render(out, data) {
  const img = new ImageResponse(card(data), {
    width: W, height: H,
    fonts: [
      { name: 'Cinzel', data: FONTS.cinzel900, weight: 900, style: 'normal' },
      { name: 'Sometype Mono', data: FONTS.mono600, weight: 600, style: 'normal' },
    ],
  });
  // JPEG compacto: o WhatsApp não mostra preview de og:image acima de ~300 KB,
  // e a arte é fotográfica/degradê (JPEG encolhe muito sem perda perceptível).
  const buf = await sharp(Buffer.from(await img.arrayBuffer()))
    .jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  console.log(`✓ ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  console.log('Baixando fontes (Cinzel + Sometype Mono)…');
  [FONTS.cinzel900, FONTS.mono600] = await Promise.all([
    loadFont('cinzel', '900'),
    loadFont('sometype-mono', '600'),
  ]);

  // arte de fundo normalizada para exatamente 1200×630 (cover, centralizada)
  console.log('Preparando arte de fundo…');
  const bgPng = await sharp(join(ROOT, 'assets/og-bg.png'))
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .png().toBuffer();
  const bg = `data:image/png;base64,${bgPng.toString('base64')}`;

  await render(join(ROOT, 'public/og.jpg'), {
    bg,
    title: 'PLENÁRIA',
    subtitle: 'O RPG da Política Brasileira',
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
