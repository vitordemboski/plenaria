'use client';

import { useEffect, useRef, useState } from 'react';

/** Dados para desenhar a imagem de compartilhamento (canvas 1080×1080). */
export interface ShareCardData {
  variant: 'politico' | 'guilda' | 'batalha';
  heading: string;
  sub?: string;
  tier?: string;
  ops?: number;
  opsLabel?: string;
  fotoUrl?: string;
  accent?: string;
  /** sigla da guilda (variant guilda) — desenha o brasão na janela da carta */
  sigla?: string;
  /** `nota` é o número BRUTO em uma linha ("R$ 46 mil/mês de cota"): sem ele, a
   *  imagem afirma um percentil e não mostra o dado de onde ele saiu. */
  stats?: { icon: string; label: string; value: number; nota?: string }[];
  /** Fora do ranking (mandato parcial / presidência da Casa): a imagem sai SEM Tier e
   *  SEM Poder, com este texto no lugar ("mandato parcial · 5 meses em exercício").
   *  A ficha já exibe "—" para essa gente; a peça que circula sozinha, longe do site,
   *  não pode afirmar um Tier F que a própria plataforma se recusa a atribuir — e o
   *  Tier F aqui não é avaliação ruim, é ausência de mandato medido. */
  semRanking?: string;
  /** crédito da foto oficial ("Câmara dos Deputados" / "Agência Senado") — as duas
   *  casas licenciam a imagem com atribuição obrigatória (CC BY na Câmara), e esta
   *  imagem circula SOZINHA, longe do rodapé do site: é aqui que o crédito importa. */
  fotoCredito?: string;
  score?: { a: number; b: number; nameA: string; nameB: string; result: string;
    /** presente quando os rounds empataram e o Poder foi o desempate */
    tie?: { opsA: number; opsB: number; label: string };
    /** detalhe golpe a golpe — usado no layout de Story da batalha */
    rounds?: { label: string; icon: string; a: number; b: number }[] };
  /** dados extras exibidos SÓ no layout de Story (mais alto e detalhado) */
  story?: {
    /** posição no ranking, ex.: "#52 de 471" */
    rank?: string;
    /** linha de destaque, ex.: "TOP 11% da Câmara por Poder" */
    destaque?: string;
    /** rótulo do tier, ex.: "Figurante" */
    tierLabel?: string;
  };
}

const TIER_COLOR: Record<string, string> = {
  S: '#f6e39b', A: '#e0b84a', B: '#c9962b', C: '#9a7a1e', D: '#6b5518', F: '#55442a',
};

/**
 * URL do compartilhamento sem a barra final. O site usa `trailingSlash: true` (canônico
 * para a hospedagem estática), mas a barra polui o link colado/impresso na carta. Tiramos
 * SÓ na exibição: ao abrir `/politico/slug`, o host redireciona para `/politico/slug/`,
 * então o link continua válido — só fica mais limpo. Preserva a raiz ("/") e a query.
 */
function urlCompartilhavel() {
  const { pathname, search } = window.location;
  const limpo = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const host = window.location.host;
  const origin = window.location.origin;

  // host: domínio + caminho (link fundo da carta); dominio: só a plataforma (Story);
  // full: URL absoluta com query (navigator.share / clipboard).
  return { host: host + (limpo === '/' ? '' : limpo), dominio: host, full: origin + limpo + search };
}

/** nome de arquivo distinto por variante e tipo — organiza os downloads
 *  (ex.: plenaria-guilda-mdb-story.png, plenaria-politico-acacio-favacho-card.png) */
function nomeArquivo(card: ShareCardData, tipo: 'card' | 'story'): string {
  const slug = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
  const base =
    card.variant === 'guilda' ? `guilda-${slug(card.sigla ?? card.heading)}`
    : card.variant === 'batalha' ? 'batalha'
    : `politico-${slug(card.heading)}`;
  return `plenaria-${base}-${tipo}.png`;
}

/** gradiente da moldura por tier — espelha os materiais de carta.css (.futc) */
const TIER_FRAME: Record<string, [number, string][]> = {
  S: [[0, '#7a5e18'], [0.22, '#f4e2a1'], [0.46, '#b7902c'], [0.66, '#f9edb9'], [1, '#8a6c1e']],
  A: [[0, '#7a5e18'], [0.22, '#f4e2a1'], [0.46, '#b7902c'], [0.66, '#f9edb9'], [1, '#8a6c1e']],
  B: [[0, '#57503f'], [0.24, '#b3a888'], [0.48, '#6a6250'], [0.7, '#c4b795'], [1, '#4e4737']],
  C: [[0, '#4a4128'], [0.55, '#35301f'], [1, '#423a24']],
  D: [[0, '#2b2f3a'], [1, '#20242e']],
  F: [[0, '#3a362e'], [0.38, '#262420'], [0.62, '#343028'], [1, '#1f1d1a']],
};

/** abreviações de 3 letras (mesmas da carta) a partir do label do atributo */
const LABEL_ABBR: Record<string, string> = {
  Ataque: 'ATQ', Stamina: 'STA', 'Eficiência': 'EFI', 'Técnica': 'TEC',
  Economia: 'ECO', 'Influência': 'INF', Comando: 'CMD',
};

const H = 1080, M = 56; // canvas (altura) e margem da moldura
/** Largura por variante. A carta (político/guilda) é retrato: no quadrado
 *  1080² sobravam ~310px de vazio de cada lado e ela encolhia na pré-
 *  visualização do celular — o canvas estreita p/ 720 (≈2:3) e a carta domina
 *  a imagem. A batalha é uma composição horizontal (A × B) e fica no quadrado. */
const larguraCanvas = (variant: ShareCardData['variant']) => (variant === 'batalha' ? 1080 : 720);

/** resolve o nome real da família do next/font (var(--font-*) não vale em canvas) */
function fontFamily(cssVar: string, fallback: string): string {
  const fam = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return fam || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function carregarFoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // As fotos vivem em /fotos/ (baixadas dos portais no build por
    // scripts/fetch-fotos.mjs) justamente porque Câmara e Senado NÃO mandam
    // header CORS: same-origin mantém o canvas limpo e o toBlob() funciona.
    // O crossOrigin segue para o caso de fallback numa URL remota do portal —
    // aí a foto simplesmente não carrega e cai na silhueta, sem sujar o canvas.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 4000); // rede lenta não trava o share
  });
}

/** encurta um texto até caber na largura dada */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/** silhueta FUT da carta (mesmas frações do --futshape em carta.css) */
function futPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const pts: [number, number][] = [
    [0.09, 0], [0.91, 0], [1, 0.045], [1, 0.81], [0.91, 0.87],
    [0.56, 0.98], [0.5, 1], [0.44, 0.98], [0.09, 0.87], [0, 0.81], [0, 0.045],
  ];
  ctx.beginPath();
  pts.forEach(([fx, fy], i) => {
    const px = x + fx * w, py = y + fy * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

/** janela de arco do retrato (mesma forma do .futc-photo) */
function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rb: number) {
  const rt = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + rt);
  ctx.arc(x + rt, y + rt, rt, Math.PI, 0);
  ctx.lineTo(x + w, y + h - rb);
  ctx.arcTo(x + w, y + h, x + w - rb, y + h, rb);
  ctx.lineTo(x + rb, y + h);
  ctx.arcTo(x, y + h, x, y + h - rb, rb);
  ctx.closePath();
}

/** brasão da guilda rasterizado de um SVG data-URI (mesmo desenho do GuildCrest) */
function carregarCrest(sigla: string, cor: string): Promise<HTMLImageElement | null> {
  const fontSize =
    sigla.length > 10 ? 7.2 : sigla.length > 8 ? 8.4 : sigla.length > 6 ? 8.8
    : sigla.length > 4 ? 9.2 : sigla.length === 4 ? 10 : 11;
  // textLength 48 (não 56): a fita tem os pontos do "V" em x=-5/51, então 56 colava
  // o texto nas bordas; 48 deixa ~4 de respiro por lado (espelha o GuildCrest).
  const fit = sigla.length > 12 ? ' textLength="48" lengthAdjust="spacingAndGlyphs"' : '';
  // width/height explícitos (10× o viewBox): sem eles o navegador rasteriza a
  // <img> SVG no tamanho intrínseco (66×54) e o drawImage AMPLIA esse bitmap —
  // o texto da fita saía borrado no card. Rasterizando grande, o canvas reduz.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="540" viewBox="-10 0 66 54">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4e2a1"/><stop offset="1" stop-color="${cor}"/>
    </linearGradient></defs>
    <path d="M23 2 44 9v20c0 13-9 20-21 23C11 49 2 42 2 29V9z" fill="#12161f" stroke="url(#g)" stroke-width="2"/>
    <path d="M23 12 l4.5 4.5 L23 21 l-4.5 -4.5 Z" fill="url(#g)"/>
    <path d="M13 44h20" stroke="url(#g)" stroke-width="1.5" opacity="0.8"/>
    <path d="M-9 25 H55 L51 31.75 55 38.5 H-9 L-5 31.75 Z" fill="#0d1119" stroke="url(#g)" stroke-width="1.1"/>
    <text x="23" y="34.4" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="${fontSize}" fill="url(#g)"${fit}>${sigla}</text>
  </svg>`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setTimeout(() => resolve(null), 2000);
  });
}

async function montarCanvas(card: ShareCardData): Promise<HTMLCanvasElement | null> {
  await document.fonts.ready;
  let fotoDesenhada = false; // decide se o rodapé credita a casa (CC BY exige atribuição)
  const display = fontFamily('--font-display', 'serif');
  const mono = fontFamily('--font-mono', 'monospace');
  const accent = card.accent ?? TIER_COLOR[card.tier ?? ''] ?? '#d4af37';
  const W = larguraCanvas(card.variant);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // fundo + brilho ambiente dourado
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -100, 0, W / 2, -100, 900);
  glow.addColorStop(0, 'rgba(212,175,55,0.16)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // moldura na cor do tier/guilda
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  roundRect(ctx, M, M, W - 2 * M, H - 2 * M, 30);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, M + 12, M + 12, W - 2 * (M + 12), H - 2 * (M + 12), 22);
  ctx.stroke();

  // marca no topo
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.font = `900 44px ${display}`;
  ctx.fillText('P L E N Á R I A', W / 2, M + 84);
  ctx.fillStyle = '#8a8f9e';
  ctx.font = `600 17px ${mono}`;
  ctx.fillText('O  R P G  D A  P O L Í T I C A  B R A S I L E I R A', W / 2, M + 118);

  if (card.variant === 'batalha' && card.score) {
    const { a, b, nameA, nameB, result, tie } = card.score;
    ctx.font = `900 200px ${display}`;
    ctx.fillStyle = '#f4e2a1';
    ctx.textAlign = 'right';
    ctx.fillText(String(a), W / 2 - 90, 500);
    ctx.fillStyle = '#8a8f9e';
    ctx.font = `900 90px ${display}`;
    ctx.textAlign = 'center';
    ctx.fillText('×', W / 2, 475);
    ctx.fillStyle = '#ff9a9d';
    ctx.font = `900 200px ${display}`;
    ctx.textAlign = 'left';
    ctx.fillText(String(b), W / 2 + 90, 500);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e3d3';
    ctx.font = `700 40px ${display}`;
    ctx.fillText(fitText(ctx, nameA, W - 260), W / 2, 610);
    ctx.fillStyle = '#8a8f9e';
    ctx.font = `600 24px ${mono}`;
    ctx.fillText('vs', W / 2, 660);
    ctx.fillStyle = '#e8e3d3';
    ctx.font = `700 40px ${display}`;
    ctx.fillText(fitText(ctx, nameB, W - 260), W / 2, 716);

    // desempate: mostra o Poder que decidiu, com o vencedor destacado
    let resultY = 852;
    if (tie) {
      ctx.fillStyle = '#8a8f9e';
      ctx.font = `600 22px ${mono}`;
      ctx.fillText(`DESEMPATE · ${tie.label.toUpperCase()}`, W / 2, 792);
      ctx.font = `900 48px ${display}`;
      const av = String(tie.opsA), sep = '   ×   ', bv = String(tie.opsB);
      const aw = ctx.measureText(av).width, sw = ctx.measureText(sep).width, bw = ctx.measureText(bv).width;
      let x = W / 2 - (aw + sw + bw) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = tie.opsA >= tie.opsB ? '#f4e2a1' : '#8a8f9e';
      ctx.fillText(av, x, 848); x += aw;
      ctx.fillStyle = '#8a8f9e';
      ctx.fillText(sep, x, 848); x += sw;
      ctx.fillStyle = tie.opsB >= tie.opsA ? '#f4e2a1' : '#8a8f9e';
      ctx.fillText(bv, x, 848);
      ctx.textAlign = 'center';
      resultY = 940;
    }
    ctx.fillStyle = '#f4e2a1';
    ctx.font = `900 52px ${display}`;
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, result, W - 220), W / 2, resultY);
  } else {
    // político/guilda: desenha a própria CARTA (silhueta FUT em miniatura),
    // com as MESMAS proporções de carta.css — coordenadas em "px de carta"
    // (base 340×528) escaladas por k.
    const ch = 716, cw = (ch * 340) / 528, k = cw / 340;
    const cx0 = (W - cw) / 2, cy0 = 212; // respiro entre a marca e o topo da carta
    const X = (v: number) => cx0 + v * k, Y = (v: number) => cy0 + v * k, S = (v: number) => v * k;
    const tier = card.tier ?? '';

    // moldura no material do tier (glow dourado para S/A)
    ctx.save();
    if (tier === 'S' || tier === 'A') {
      ctx.shadowColor = tier === 'S' ? 'rgba(212,175,55,0.55)' : 'rgba(212,175,55,0.35)';
      ctx.shadowBlur = tier === 'S' ? 70 : 45;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 50;
    }
    const frame = ctx.createLinearGradient(cx0, cy0, cx0 + cw, cy0 + ch);
    for (const [stop, color] of TIER_FRAME[tier] ?? [[0, '#3a3f4d'], [0.5, '#6a7183'], [1, '#565d70']] as [number, string][]) {
      frame.addColorStop(stop, color);
    }
    ctx.fillStyle = frame;
    futPath(ctx, cx0, cy0, cw, ch);
    ctx.fill();
    ctx.restore();

    // face interna
    const face = ctx.createLinearGradient(0, cy0, 0, cy0 + ch);
    face.addColorStop(0, '#151a27');
    face.addColorStop(0.72, '#0b0e15');
    ctx.fillStyle = face;
    futPath(ctx, cx0 + S(3), cy0 + S(3), cw - S(6), ch - S(6));
    ctx.fill();
    const sheen = ctx.createRadialGradient(cx0 + cw / 2, cy0 - S(30), 0, cx0 + cw / 2, cy0 - S(30), S(260));
    sheen.addColorStop(0, 'rgba(212,175,55,0.13)');
    sheen.addColorStop(1, 'transparent');
    ctx.fillStyle = sheen;
    futPath(ctx, cx0 + S(3), cy0 + S(3), cw - S(6), ch - S(6));
    ctx.fill();

    // trilho esquerdo: Poder + posição + chip do tier
    const railCx = X(67);
    ctx.textAlign = 'center';
    const opsGrad = ctx.createLinearGradient(0, Y(22), 0, Y(72));
    opsGrad.addColorStop(0, '#f4e2a1');
    opsGrad.addColorStop(0.6, '#d4af37');
    opsGrad.addColorStop(1, '#9a7a1e');
    ctx.fillStyle = tier === 'F' ? '#b8b09a' : opsGrad;
    ctx.font = `900 ${S(50)}px ${display}`;
    if (card.ops !== undefined) {
      ctx.fillText(String(card.ops), railCx, Y(66));
    } else {
      ctx.fillStyle = '#6f7686';
      ctx.fillText('—', railCx, Y(62));
    }
    ctx.fillStyle = '#8a8f9e';
    ctx.font = `600 ${S(9)}px ${mono}`;
    ctx.fillText((card.semRanking ? 'sem tier' : card.opsLabel ?? 'Poder').toUpperCase(), railCx, Y(80));
    const pos = card.variant === 'guilda' ? 'GLD' : card.sub?.startsWith('Sen') ? 'SEN' : 'DEP';
    ctx.fillStyle = '#e8e3d3';
    ctx.font = `700 ${S(19)}px ${display}`;
    ctx.fillText(pos, railCx, Y(112));
    const sep = ctx.createLinearGradient(railCx - S(20), 0, railCx + S(20), 0);
    sep.addColorStop(0, 'transparent'); sep.addColorStop(0.5, '#d4af37'); sep.addColorStop(1, 'transparent');
    ctx.fillStyle = sep;
    ctx.fillRect(railCx - S(20), Y(124), S(40), 1.5);
    if (tier) {
      ctx.fillStyle = TIER_COLOR[tier] ?? '#d4af37';
      roundRect(ctx, railCx - S(16), Y(136), S(32), S(32), S(9));
      ctx.fill();
      ctx.fillStyle = ['D', 'F'].includes(tier) ? '#ded8c8' : '#0a0d14';
      ctx.font = `900 ${S(17)}px ${display}`;
      // centraliza o glifo no chip (baseline alfabética deixaria a letra caída)
      ctx.textBaseline = 'middle';
      ctx.fillText(tier, railCx, Y(153));
      ctx.textBaseline = 'alphabetic';
    }

    // janela de arco: foto oficial ou brasão da guilda
    const ax = X(120), ay = Y(20), aw = S(196), ah = S(216);
    const winGrad = ctx.createRadialGradient(ax + aw / 2, ay + ah * 0.24, 0, ax + aw / 2, ay + ah * 0.24, ah * 0.9);
    winGrad.addColorStop(0, card.variant === 'guilda' && card.accent ? `${card.accent}33` : '#232a3b');
    winGrad.addColorStop(1, '#0d1018');
    ctx.fillStyle = winGrad;
    archPath(ctx, ax, ay, aw, ah, S(14));
    ctx.fill();
    const foto = card.fotoUrl ? await carregarFoto(card.fotoUrl) : null;
    if (foto) {
      fotoDesenhada = true;
      ctx.save();
      archPath(ctx, ax, ay, aw, ah, S(14));
      ctx.clip();
      // cover: recorta a fonte para preencher a janela sem distorcer
      const sc = Math.max(aw / foto.width, ah / foto.height);
      const sw = aw / sc, sh = ah / sc;
      ctx.drawImage(foto, (foto.width - sw) / 2, 0, sw, sh, ax, ay, aw, ah);
      ctx.restore();
    } else if (card.variant === 'guilda' && card.sigla) {
      const crest = await carregarCrest(card.sigla, accent);
      if (crest) {
        const cwidth = S(132), cheight = (cwidth * 54) / 66;
        ctx.drawImage(crest, ax + (aw - cwidth) / 2, ay + (ah - cheight) / 2, cwidth, cheight);
      }
    } else {
      // Câmara/Senado não mandam CORS na foto oficial — usar a imagem mancharia
      // o canvas e mataria o toBlob. Fallback: a silhueta determinística do site
      // (matiz estável derivado do nome), na mesma pose do componente Portrait.
      let hsh = 0;
      for (let i = 0; i < card.heading.length; i++) hsh = (hsh * 31 + card.heading.charCodeAt(i)) >>> 0;
      const hue = hsh % 360;
      ctx.save();
      archPath(ctx, ax, ay, aw, ah, S(14));
      ctx.clip();
      const silBg = ctx.createRadialGradient(ax + aw / 2, ay + ah * 0.2, 0, ax + aw / 2, ay + ah * 0.2, ah);
      silBg.addColorStop(0, `hsl(${hue}, 30%, 22%)`);
      silBg.addColorStop(0.7, `hsl(${(hue + 40) % 360}, 24%, 12%)`);
      ctx.fillStyle = silBg;
      ctx.fillRect(ax, ay, aw, ah);
      // figura (viewBox 120×150 do Portrait, ancorada no chão da janela)
      const u = (ah * 0.78) / 150, fx0 = ax + aw / 2 - 60 * u, fy0 = ay + ah - 150 * u;
      ctx.fillStyle = `hsl(${hue}, 26%, 42%)`;
      ctx.beginPath();
      ctx.arc(fx0 + 60 * u, fy0 + 46 * u, 30 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(fx0 + 60 * u, fy0 + 150 * u, 48 * u, 52 * u, 0, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(212,175,55,0.45)';
    ctx.lineWidth = 2;
    archPath(ctx, ax, ay, aw, ah, S(14));
    ctx.stroke();

    // nome + divisor heráldico (nomes longos encolhem antes de ganhar reticência)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e3d3';
    const nome = card.heading.toUpperCase();
    let nomePx = 17;
    ctx.font = `900 ${S(nomePx)}px ${display}`;
    while (nomePx > 11.5 && ctx.measureText(nome).width > cw - S(40)) {
      nomePx -= 0.5;
      ctx.font = `900 ${S(nomePx)}px ${display}`;
    }
    ctx.fillText(fitText(ctx, nome, cw - S(40)), X(170), Y(274));
    ctx.fillStyle = '#d4af37';
    const dy = Y(288);
    ctx.beginPath();
    ctx.moveTo(X(170), dy - S(3)); ctx.lineTo(X(174), dy); ctx.lineTo(X(170), dy + S(3)); ctx.lineTo(X(166), dy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(212,175,55,0.4)';
    ctx.fillRect(X(120), dy - 0.75, S(42), 1.5);
    ctx.fillRect(X(178), dy - 0.75, S(42), 1.5);

    // faixa "sem Tier" cruzando o pé do retrato — mesma posição e mesma cor da
    // faixa da ficha (.futc-faixa): a imagem É a carta, e as duas não podem
    // contar histórias diferentes.
    if (card.semRanking) {
      const fy = Y(212), fh = S(20), fx = cx0 + S(3), fw2 = cw - S(6);
      const faixa = ctx.createLinearGradient(fx, 0, fx + fw2, 0);
      faixa.addColorStop(0, 'rgba(28,20,48,0.72)');
      faixa.addColorStop(0.3, 'rgba(74,52,122,0.88)');
      faixa.addColorStop(0.7, 'rgba(74,52,122,0.88)');
      faixa.addColorStop(1, 'rgba(28,20,48,0.72)');
      ctx.fillStyle = faixa;
      ctx.fillRect(fx, fy, fw2, fh);
      ctx.fillStyle = 'rgba(166,132,255,0.55)';
      ctx.fillRect(fx, fy, fw2, 1.5);
      ctx.fillRect(fx, fy + fh - 1.5, fw2, 1.5);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e2d8ff';
      ctx.font = `600 ${S(8)}px ${mono}`;
      ctx.fillText(fitText(ctx, card.semRanking.toUpperCase(), fw2 - S(16)), X(170), fy + fh / 2 + S(3));
    }

    // grade de atributos 2 colunas com divisor central
    if (card.stats?.length) {
      const rows = Math.ceil(card.stats.length / 2);
      const rowStep = 34, gridTop = 314;
      ctx.fillStyle = 'rgba(212,175,55,0.25)';
      ctx.fillRect(X(170), Y(gridTop - 12), 1.5, S(rows * rowStep));
      card.stats.forEach((s, i) => {
        const col = i < rows ? 0 : 1;
        const row = i % rows;
        const colCx = X(col === 0 ? 104 : 236);
        const by = Y(gridTop + row * rowStep);
        ctx.textAlign = 'right';
        ctx.fillStyle = s.value >= 70 ? '#f6e39b' : s.value < 40 ? '#a06055' : '#e8e3d3';
        ctx.font = `900 ${S(21)}px ${display}`;
        ctx.fillText(String(s.value), colCx + S(4), by);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#8a8f9e';
        ctx.font = `600 ${S(11)}px ${mono}`;
        ctx.fillText(LABEL_ABBR[s.label] ?? s.label.slice(0, 3).toUpperCase(), colCx + S(12), by - S(1));
      });
    }

    // rodapé da carta: o "sub" numa placa central (UF · guilda / membros)
    if (card.sub) {
      ctx.font = `700 ${S(11)}px ${mono}`;
      const txt = card.sub.toUpperCase();
      const tw = ctx.measureText(txt).width;
      const pw = tw + S(24), phh = S(24), px = X(170) - pw / 2, py = Y(430);
      ctx.fillStyle = 'rgba(212,175,55,0.06)';
      roundRect(ctx, px, py, pw, phh, S(7));
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,175,55,0.3)';
      ctx.lineWidth = 1;
      roundRect(ctx, px, py, pw, phh, S(7));
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f4e2a1';
      ctx.fillText(txt, X(170), py + phh / 2 + S(4));
    }

  }

  // rodapé: crédito da foto + fórmula, e só então o link da ficha. O crédito vive
  // AQUI (e não só no site) porque é esta imagem que circula sozinha — a licença da
  // Câmara é CC BY e a política do Senado exige citar a Agência: atribuir no rodapé
  // do site e não na peça compartilhada seria cumprir no lugar errado.
  ctx.textAlign = 'center';
  ctx.font = `600 15px ${mono}`;
  ctx.fillStyle = '#4d525e';
  // caminho RELATIVO (não a URL cheia): o domínio já está na linha de baixo, e a
  // versão completa não cabe nos 720px de largura — sairia truncada com reticência.
  const creditos = [
    fotoDesenhada && card.fotoCredito ? `Foto: ${card.fotoCredito}` : null,
    'fórmula em /como-calculamos',
  ].filter(Boolean).join('  ·  ');
  ctx.fillText(fitText(ctx, creditos, W - 2 * M - 20), W / 2, H - M - 66);
  ctx.fillStyle = '#565b68';
  ctx.font = `600 19px ${mono}`;
  ctx.fillText(urlCompartilhavel().host, W / 2, H - M - 34);

  return canvas;
}

function canvasParaBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** carta quadrada/retrato para clipboard e folha nativa */
async function desenharCard(card: ShareCardData): Promise<Blob | null> {
  const canvas = await montarCanvas(card);
  return canvas ? canvasParaBlob(canvas) : null;
}

/** fundo vertical dourado-heráldico compartilhado pelos Stories */
function fundoStory(ctx: CanvasRenderingContext2D, SW: number, SH: number) {
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, SW, SH);
  const glow = ctx.createRadialGradient(SW / 2, SH * 0.27, 0, SW / 2, SH * 0.27, 1100);
  glow.addColorStop(0, 'rgba(212,175,55,0.15)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SW, SH);
}

/**
 * Formato Story do Instagram: 1080×1920 (9:16), com layout PRÓPRIO — não é a carta
 * ampliada, e sim uma composição vertical que usa todo o espaço: retrato grande,
 * Poder + Tier em destaque, ranking, barras de percentil por atributo, títulos
 * factuais e um rodapé com chamada. Os dados extras vêm de `card.story`.
 * A batalha (composição horizontal) reaproveita a carta centralizada.
 */
async function desenharStory(card: ShareCardData): Promise<Blob | null> {
  const SW = 1080, SH = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = SW; canvas.height = SH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // batalha: layout próprio com placar, vencedor e o duelo golpe a golpe
  if (card.variant === 'batalha') {
    const sc = card.score;
    if (!sc || !sc.rounds?.length) {
      // fallback (sem detalhe de rounds): carta centralizada
      const base = await montarCanvas(card);
      if (!base) return null;
      fundoStory(ctx, SW, SH);
      const escala = Math.min((SW - 120) / base.width, (SH * 0.8) / base.height);
      const dw = base.width * escala, dh = base.height * escala;
      ctx.drawImage(base, (SW - dw) / 2, (SH - dh) / 2, dw, dh);
      return canvasParaBlob(canvas);
    }

    await document.fonts.ready;
    const display = fontFamily('--font-display', 'serif');
    const mono = fontFamily('--font-mono', 'monospace');
    const CL = 96, CR = SW - 96, CW = CR - CL;
    const AC = '#f4e2a1', BC = '#ff9a9d'; // lado A (dourado) × lado B (rosa)

    fundoStory(ctx, SW, SH);
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 5;
    roundRect(ctx, 40, 40, SW - 80, SH - 80, 40); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 1.5;
    roundRect(ctx, 56, 56, SW - 112, SH - 112, 30); ctx.stroke();

    // cabeçalho
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4af37'; ctx.font = `900 62px ${display}`;
    ctx.fillText('P L E N Á R I A', SW / 2, 142);
    ctx.fillStyle = '#8a8f9e'; ctx.font = `600 22px ${mono}`;
    ctx.fillText('O  R P G  D A  P O L Í T I C A  B R A S I L E I R A', SW / 2, 182);
    ctx.fillStyle = '#e8e3d3'; ctx.font = `700 34px ${mono}`;
    ctx.fillText('⚔  B A T A L H A', SW / 2, 262);

    // placar gigante A × B
    const scoreY = 440;
    ctx.font = `900 190px ${display}`;
    ctx.textAlign = 'right'; ctx.fillStyle = AC;
    ctx.fillText(String(sc.a), SW / 2 - 70, scoreY);
    ctx.textAlign = 'center'; ctx.fillStyle = '#6b7080'; ctx.font = `900 90px ${display}`;
    ctx.fillText('×', SW / 2, scoreY - 24);
    ctx.textAlign = 'left'; ctx.fillStyle = BC; ctx.font = `900 190px ${display}`;
    ctx.fillText(String(sc.b), SW / 2 + 70, scoreY);

    // nomes dos duelistas
    ctx.textAlign = 'center';
    ctx.fillStyle = AC; ctx.font = `700 40px ${display}`;
    ctx.fillText(fitText(ctx, sc.nameA, CW), SW / 2, scoreY + 96);
    ctx.fillStyle = '#8a8f9e'; ctx.font = `600 24px ${mono}`;
    ctx.fillText('v s', SW / 2, scoreY + 138);
    ctx.fillStyle = BC; ctx.font = `700 40px ${display}`;
    ctx.fillText(fitText(ctx, sc.nameB, CW), SW / 2, scoreY + 186);

    // faixa do resultado
    let by = scoreY + 288;
    ctx.font = `900 56px ${display}`;
    const rw = ctx.measureText(sc.result).width + 80;
    ctx.fillStyle = 'rgba(212,175,55,0.08)';
    roundRect(ctx, SW / 2 - rw / 2, by - 52, rw, 78, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 1.5;
    roundRect(ctx, SW / 2 - rw / 2, by - 52, rw, 78, 18); ctx.stroke();
    ctx.fillStyle = '#f4e2a1'; ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, sc.result, CW - 40), SW / 2, by);

    // desempate pelo Poder, quando houve
    if (sc.tie) {
      by += 62;
      ctx.fillStyle = '#8a8f9e'; ctx.font = `600 22px ${mono}`;
      ctx.fillText(`DESEMPATE · ${sc.tie.label.toUpperCase()}`, SW / 2, by);
      by += 48;
      ctx.font = `900 44px ${display}`;
      const av = String(sc.tie.opsA), sep = '   ×   ', bv = String(sc.tie.opsB);
      const aw = ctx.measureText(av).width, sw = ctx.measureText(sep).width, bw = ctx.measureText(bv).width;
      let x = SW / 2 - (aw + sw + bw) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = sc.tie.opsA >= sc.tie.opsB ? AC : '#8a8f9e'; ctx.fillText(av, x, by); x += aw;
      ctx.fillStyle = '#8a8f9e'; ctx.fillText(sep, x, by); x += sw;
      ctx.fillStyle = sc.tie.opsB >= sc.tie.opsA ? BC : '#8a8f9e'; ctx.fillText(bv, x, by);
      ctx.textAlign = 'center';
    }

    // duelo golpe a golpe (barras de cabo-de-guerra), distribuídas no espaço restante
    const rounds = sc.rounds;
    const secTop = by + 128;
    ctx.textAlign = 'left'; ctx.fillStyle = '#d4af37'; ctx.font = `700 26px ${mono}`;
    ctx.fillText('R O U N D S', CL, secTop);
    const regBot = SH - 128;
    const roundsStart = secTop + 34;
    const rowH = Math.min(170, (regBot - roundsStart) / rounds.length);
    rounds.forEach((r, i) => {
      const mid = roundsStart + i * rowH + rowH / 2; // conteúdo centralizado na linha
      const aWins = r.a >= r.b;
      // rótulo do round + placar do golpe
      ctx.textAlign = 'left'; ctx.fillStyle = aWins ? AC : '#8a8f9e'; ctx.font = `900 32px ${display}`;
      ctx.fillText(String(r.a), CL, mid - 8);
      ctx.textAlign = 'center'; ctx.fillStyle = '#c9c3b2'; ctx.font = `600 23px ${mono}`;
      ctx.fillText(`${r.icon} ${r.label.toUpperCase()}`, SW / 2, mid - 12);
      ctx.textAlign = 'right'; ctx.fillStyle = !aWins ? BC : '#8a8f9e'; ctx.font = `900 32px ${display}`;
      ctx.fillText(String(r.b), CR, mid - 8);
      // barra cabo-de-guerra: A (dourado) cresce da esquerda, B (rosa) da direita
      const ty = mid + 10, th = 16, total = r.a + r.b || 1;
      const aw = Math.max(6, (CW * r.a) / total);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, CL, ty, CW, th, 8); ctx.fill();
      ctx.fillStyle = aWins ? AC : 'rgba(244,226,161,0.5)';
      roundRect(ctx, CL, ty, aw, th, 8); ctx.fill();
      ctx.fillStyle = !aWins ? BC : 'rgba(255,154,157,0.5)';
      roundRect(ctx, CL + aw, ty, CW - aw, th, 8); ctx.fill();
    });

    // rodapé: mesmo link de fórmula do Story do político — a batalha também é um
    // placar derivado de atributos, e quem recebe a imagem precisa da régua.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(212,175,55,0.35)';
    ctx.fillRect(SW / 2 - 60, SH - 118, 120, 1.5);
    ctx.fillStyle = '#d4af37'; ctx.font = `700 30px ${mono}`;
    ctx.fillText(`${urlCompartilhavel().dominio}/como-calculamos`, SW / 2, SH - 78);

    return canvasParaBlob(canvas);
  }

  await document.fonts.ready;
  const display = fontFamily('--font-display', 'serif');
  const mono = fontFamily('--font-mono', 'monospace');
  const tier = card.tier ?? '';
  const accent = card.accent ?? TIER_COLOR[tier] ?? '#d4af37';
  const CL = 96, CR = SW - 96, CW = CR - CL;

  fundoStory(ctx, SW, SH);

  // moldura dupla na cor do tier/guilda
  ctx.strokeStyle = accent; ctx.lineWidth = 5;
  roundRect(ctx, 40, 40, SW - 80, SH - 80, 40); ctx.stroke();
  ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 1.5;
  roundRect(ctx, 56, 56, SW - 112, SH - 112, 30); ctx.stroke();

  // cabeçalho
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37'; ctx.font = `900 62px ${display}`;
  ctx.fillText('P L E N Á R I A', SW / 2, 142);
  ctx.fillStyle = '#8a8f9e'; ctx.font = `600 22px ${mono}`;
  ctx.fillText('O  R P G  D A  P O L Í T I C A  B R A S I L E I R A', SW / 2, 182);

  // ---- retrato / brasão (arco grande) ----
  const pw = 392, ph = 452, px = (SW - pw) / 2, py = 224;
  ctx.save();
  if (tier === 'S' || tier === 'A') { ctx.shadowColor = 'rgba(212,175,55,0.5)'; ctx.shadowBlur = 60; }
  else { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 42; }
  const frame = ctx.createLinearGradient(px, py, px + pw, py + ph);
  for (const [stop, color] of TIER_FRAME[tier] ?? [[0, '#3a3f4d'], [0.5, '#6a7183'], [1, '#565d70']] as [number, string][]) {
    frame.addColorStop(stop, color);
  }
  ctx.fillStyle = frame;
  archPath(ctx, px - 10, py - 10, pw + 20, ph + 20, 26); ctx.fill();
  ctx.restore();

  const win = ctx.createRadialGradient(px + pw / 2, py + ph * 0.24, 0, px + pw / 2, py + ph * 0.24, ph * 0.9);
  win.addColorStop(0, card.variant === 'guilda' && card.accent ? `${card.accent}33` : '#232a3b');
  win.addColorStop(1, '#0d1018');
  ctx.fillStyle = win;
  archPath(ctx, px, py, pw, ph, 22); ctx.fill();

  const foto = card.fotoUrl ? await carregarFoto(card.fotoUrl) : null;
  if (foto) {
    ctx.save(); archPath(ctx, px, py, pw, ph, 22); ctx.clip();
    const sc = Math.max(pw / foto.width, ph / foto.height);
    const sw = pw / sc, sh = ph / sc;
    ctx.drawImage(foto, (foto.width - sw) / 2, 0, sw, sh, px, py, pw, ph);
    ctx.restore();
  } else if (card.variant === 'guilda' && card.sigla) {
    const crest = await carregarCrest(card.sigla, accent);
    if (crest) { const cwd = 280, cht = (cwd * 54) / 66; ctx.drawImage(crest, px + (pw - cwd) / 2, py + (ph - cht) / 2, cwd, cht); }
  } else {
    // silhueta determinística (Câmara/Senado não mandam CORS na foto)
    let hsh = 0;
    for (let i = 0; i < card.heading.length; i++) hsh = (hsh * 31 + card.heading.charCodeAt(i)) >>> 0;
    const hue = hsh % 360;
    ctx.save(); archPath(ctx, px, py, pw, ph, 22); ctx.clip();
    const sb = ctx.createRadialGradient(px + pw / 2, py + ph * 0.2, 0, px + pw / 2, py + ph * 0.2, ph);
    sb.addColorStop(0, `hsl(${hue}, 30%, 22%)`); sb.addColorStop(0.7, `hsl(${(hue + 40) % 360}, 24%, 12%)`);
    ctx.fillStyle = sb; ctx.fillRect(px, py, pw, ph);
    const u = (ph * 0.78) / 150, fx0 = px + pw / 2 - 60 * u, fy0 = py + ph - 150 * u;
    ctx.fillStyle = `hsl(${hue}, 26%, 42%)`;
    ctx.beginPath(); ctx.arc(fx0 + 60 * u, fy0 + 46 * u, 30 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx0 + 60 * u, fy0 + 150 * u, 48 * u, 52 * u, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 2.5;
  archPath(ctx, px, py, pw, ph, 22); ctx.stroke();

  // ---- strip Poder | Tier ----
  const stripBase = 770, xa = SW * 0.34, xb = SW * 0.66;
  if (card.semRanking) {
    // fora do ranking: uma placa única no lugar do par Poder|Tier. Dois traços
    // lado a lado pareceriam falha de renderização, não uma decisão editorial.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(166,132,255,0.09)';
    roundRect(ctx, CL, stripBase - 74, CW, 118, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(166,132,255,0.4)'; ctx.lineWidth = 1.5;
    roundRect(ctx, CL, stripBase - 74, CW, 118, 20); ctx.stroke();
    ctx.fillStyle = '#a684ff'; ctx.font = `900 46px ${display}`;
    ctx.fillText('SEM TIER', SW / 2, stripBase - 18);
    ctx.fillStyle = '#8a8f9e'; ctx.font = `600 23px ${mono}`;
    ctx.fillText(fitText(ctx, card.semRanking, CW - 60), SW / 2, stripBase + 22);
  } else {
  ctx.fillStyle = 'rgba(212,175,55,0.25)';
  ctx.fillRect(SW / 2 - 0.75, stripBase - 52, 1.5, 92);
  ctx.textAlign = 'center';
  const opsGrad = ctx.createLinearGradient(0, stripBase - 60, 0, stripBase);
  opsGrad.addColorStop(0, '#f4e2a1'); opsGrad.addColorStop(1, '#c9962b');
  ctx.fillStyle = tier === 'F' ? '#b8b09a' : opsGrad;
  ctx.font = `900 84px ${display}`;
  if (card.ops !== undefined) ctx.fillText(String(card.ops), xa, stripBase);
  ctx.fillStyle = '#8a8f9e'; ctx.font = `600 22px ${mono}`;
  ctx.fillText((card.opsLabel ?? 'Poder').toUpperCase(), xa, stripBase + 38);
  ctx.fillStyle = TIER_COLOR[tier] ?? '#d4af37';
  ctx.font = `900 84px ${display}`;
  ctx.fillText(tier || '—', xb, stripBase);
  ctx.fillStyle = '#8a8f9e'; ctx.font = `600 22px ${mono}`;
  ctx.fillText((card.story?.tierLabel ?? 'Tier').toUpperCase(), xb, stripBase + 38);
  }

  // ---- nome + divisor heráldico + sub ----
  ctx.textAlign = 'center'; ctx.fillStyle = '#e8e3d3';
  const nome = card.heading.toUpperCase();
  let np = 66; ctx.font = `900 ${np}px ${display}`;
  while (np > 38 && ctx.measureText(nome).width > CW) { np -= 2; ctx.font = `900 ${np}px ${display}`; }
  ctx.fillText(fitText(ctx, nome, CW), SW / 2, 900);
  const dy = 936;
  ctx.fillStyle = '#d4af37';
  ctx.beginPath(); ctx.moveTo(SW / 2, dy - 7); ctx.lineTo(SW / 2 + 8, dy); ctx.lineTo(SW / 2, dy + 7); ctx.lineTo(SW / 2 - 8, dy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(212,175,55,0.4)';
  ctx.fillRect(SW / 2 - 96, dy - 1, 78, 2); ctx.fillRect(SW / 2 + 18, dy - 1, 78, 2);
  if (card.sub) {
    ctx.fillStyle = '#f4e2a1'; ctx.font = `700 28px ${mono}`;
    ctx.fillText(fitText(ctx, card.sub.toUpperCase(), CW), SW / 2, dy + 52);
  }

  // ---- painel de ranking ----
  const rankTop = 1030, rankH = 110;
  if (card.story?.rank) {
    ctx.fillStyle = 'rgba(212,175,55,0.06)';
    roundRect(ctx, CL, rankTop, CW, rankH, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,0.25)'; ctx.lineWidth = 1.5;
    roundRect(ctx, CL, rankTop, CW, rankH, 18); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4e2a1'; ctx.font = `900 50px ${display}`;
    ctx.fillText(card.story.rank, SW / 2, rankTop + 56);
    if (card.story.destaque) {
      ctx.fillStyle = '#8a8f9e'; ctx.font = `600 23px ${mono}`;
      ctx.fillText(fitText(ctx, card.story.destaque, CW - 48), SW / 2, rankTop + 90);
    }
  }

  const stats = card.stats ?? [];
  // Uma linha do bruto por atributo cabe onde antes ficavam os chips de título. A
  // troca é deliberada: o rótulo ("Fantasma do Plenário") viajava sem a regra, sem o
  // número e sem a fonte, e é sobre a peça COMO ELA CIRCULA que se julga se houve
  // crítica fundamentada ou ofensa. O número bruto viaja explicando-se sozinho.
  // rowH generoso de propósito: a nota fica ABAIXO da barra, então um passo curto a
  // deixa mais perto do atributo SEGUINTE do que do dela — e a linha passa a parecer
  // legenda do número errado.
  const rowH = 92, headerGap = 44;

  const statsH = stats.length ? headerGap + stats.length * rowH : 0;
  const regTop = (card.story?.rank ? rankTop + rankH : 1000) + 40;
  const regBottom = SH - 190;
  let y = regTop + Math.min(50, Math.max(0, (regBottom - regTop - statsH) / 2));

  // ---- atributos: barra de percentil + o número bruto por trás dela ----
  if (stats.length) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#d4af37'; ctx.font = `700 26px ${mono}`;
    ctx.fillText('A T R I B U T O S', CL, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#565b68'; ctx.font = `600 19px ${mono}`;
    ctx.fillText('PERCENTIL NA CASA', CR, y);
    stats.forEach((s, i) => {
      const ry = y + headerGap + i * rowH;
      ctx.textAlign = 'left'; ctx.fillStyle = '#c9c3b2'; ctx.font = `600 25px ${mono}`;
      ctx.fillText(s.label.toUpperCase(), CL, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = s.value >= 70 ? '#f6e39b' : s.value < 40 ? '#c98b80' : '#e8e3d3';
      ctx.font = `900 32px ${display}`;
      ctx.fillText(String(s.value), CR, ry);
      const ty = ry + 12, th = 10;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, CL, ty, CW, th, 5); ctx.fill();
      const fw = Math.max(6, (CW * Math.min(100, s.value)) / 100);
      if (s.value < 40) {
        ctx.fillStyle = '#7a5548';
      } else {
        const g = ctx.createLinearGradient(CL, 0, CL + fw, 0);
        g.addColorStop(0, '#8a6c1e'); g.addColorStop(1, s.value >= 70 ? '#f6e39b' : accent);
        ctx.fillStyle = g;
      }
      roundRect(ctx, CL, ty, fw, th, 5); ctx.fill();
      if (s.nota) {
        ctx.textAlign = 'left'; ctx.fillStyle = '#767c8a'; ctx.font = `600 21px ${mono}`;
        ctx.fillText(fitText(ctx, s.nota, CW), CL, ry + 46);
      }
    });
  }

  // ---- rodapé: crédito da foto + link da METODOLOGIA ----
  // O link é o da fórmula, não o domínio solto: quem recebe a imagem no WhatsApp
  // precisa de um caminho para a régua e para o canal de correção, não para a home.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(212,175,55,0.35)';
  ctx.fillRect(SW / 2 - 60, SH - 152, 120, 1.5);
  if (foto && card.fotoCredito) {
    ctx.fillStyle = '#565b68'; ctx.font = `600 20px ${mono}`;
    ctx.fillText(`Foto: ${card.fotoCredito}`, SW / 2, SH - 112);
  }
  ctx.fillStyle = '#d4af37'; ctx.font = `700 30px ${mono}`;
  ctx.fillText(`${urlCompartilhavel().dominio}/como-calculamos`, SW / 2, SH - 66);

  return canvasParaBlob(canvas);
}

/**
 * Toque (celular/tablet) → folha de compartilhamento nativa. É onde ela é boa:
 * manda a carta com legenda direto pro WhatsApp/Instagram.
 * No DESKTOP a folha nativa NÃO é usada: o "Copiar" dela grava o PNG em mais de
 * uma representação (arquivo + dados de imagem) e vários apps colam a imagem
 * DUAS VEZES. Aqui copiamos nós mesmos, com um ÚNICO ClipboardItem — uma
 * imagem, uma colagem.
 */
const ehToque = () =>
  typeof navigator !== 'undefined' &&
  (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);

/* ícones de linha (inline SVG, herdam a cor do texto via currentColor — nada de
 * emoji nem asset externo, fiel à regra estática/self-hosted do projeto) */
const svgBase = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const IconShare = () => (
  <svg {...svgBase} width="16" height="16">
    <path d="M12 15V3" /><path d="M8 7l4-4 4 4" />
    <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
  </svg>
);
const IconCopy = () => (
  <svg {...svgBase} width="18" height="18">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconImage = () => (
  <svg {...svgBase} width="18" height="18">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.8" /><path d="M21 15l-5-5L5 21" />
  </svg>
);
const IconLink = () => (
  <svg {...svgBase} width="18" height="18">
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);
const IconChevron = ({ up }: { up: boolean }) => (
  <svg {...svgBase} width="14" height="14" strokeWidth={2} className={`share-caret${up ? ' up' : ''}`}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function ShareButton({ title, text, card, className = 'btn ghost' }: {
  title: string;
  text?: string;
  card?: ShareCardData;
  className?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'imagem' | 'baixada' | 'story' | 'link'>('idle');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // fecha o menu ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    const foraClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', foraClick);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', foraClick);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const flash = (r: 'imagem' | 'baixada' | 'story' | 'link') => {
    setStatus(r);
    setTimeout(() => setStatus('idle'), 2500);
  };

  /** roda o desenho protegido por estado "gerando" e por try/catch de canvas */
  const gerar = async (fn: () => Promise<Blob | null>): Promise<Blob | null> => {
    setStatus('busy');
    try {
      return await fn();
    } catch {
      setStatus('idle');
      return null; // sem suporte a canvas
    }
  };

  const baixar = (blob: Blob, nome: string) => {
    const a = document.createElement('a');
    const href = URL.createObjectURL(blob);
    a.href = href;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 60_000); // revogar já quebraria o download
  };

  /** celular: folha nativa com o arquivo + legenda. Retorna true se foi tratado nativamente. */
  const tentarNativo = async (blob: Blob, nome: string): Promise<boolean> => {
    const file = new File([blob], nome, { type: 'image/png' });
    if (ehToque() && navigator.canShare?.({ files: [file] })) {
      try {
        const url = urlCompartilhavel().full;
        await navigator.share({ files: [file], title, text: [text, url].filter(Boolean).join('\n') });
      } catch { /* cancelado */ }
      setStatus('idle');
      return true;
    }
    return false;
  };

  // AÇÃO PRIMÁRIA (clique em "Compartilhar"): folha de compartilhamento NATIVA —
  // a rota real p/ WhatsApp/Instagram. Onde não há Web Share (alguns desktops),
  // cai na cópia da imagem como melhor equivalente.
  const compartilharPrimario = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const blob = card ? await gerar(() => desenharCard(card)) : null;
      if (blob && card && await tentarNativo(blob, nomeArquivo(card, 'card'))) return;
      try {
        await navigator.share({ title, text, url: urlCompartilhavel().full });
      } catch { /* cancelado */ }
      setStatus('idle');
      return;
    }
    await copiarImagem();
  };

  // copia a carta (item único). O link não some — está impresso no rodapé da carta.
  const copiarImagem = async () => {
    if (!card) return;
    const blob = await gerar(() => desenharCard(card));
    if (!blob) return;
    const nome = nomeArquivo(card, 'card');
    if (!ehToque() && typeof ClipboardItem === 'function') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        flash('imagem');
        return;
      } catch { /* sem permissão de clipboard (ou aba sem foco) — cai adiante */ }
    }
    if (await tentarNativo(blob, nome)) return;
    baixar(blob, nome);
    flash('baixada');
  };

  // imagem 9:16 p/ os Stories do Instagram — no celular vai pra folha nativa; no desktop baixa
  const formatoStory = async () => {
    if (!card) return;
    const blob = await gerar(() => desenharStory(card));
    if (!blob) return;
    const nome = nomeArquivo(card, 'story');
    if (await tentarNativo(blob, nome)) return;
    baixar(blob, nome);
    flash('story');
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(urlCompartilhavel().full);
      flash('link');
    } catch { /* sem permissão */ }
  };

  const executar = (fn: () => Promise<void>) => {
    setAberto(false);
    void fn();
  };

  const rotulo =
    status === 'busy' ? '⏳ Gerando…'
    : status === 'imagem' ? '✅ Imagem copiada!'
    : status === 'baixada' ? '✅ Imagem baixada!'
    : status === 'story' ? '✅ Story baixado!'
    : status === 'link' ? '✅ Link copiado!'
    : 'Compartilhar';

  return (
    <div className="share-dd" ref={ref}>
      <div className="share-split">
        {/* clique primário: compartilhamento nativo */}
        <button
          className={`${className} share-main`}
          onClick={() => void compartilharPrimario()}
          disabled={status === 'busy'}
        >
          {status === 'idle' && <IconShare />}
          {rotulo}
        </button>
        {/* botão separado: abre o menu de opções */}
        <button
          className={`${className} share-toggle`}
          onClick={() => setAberto((o) => !o)}
          disabled={status === 'busy'}
          aria-haspopup="menu"
          aria-expanded={aberto}
          aria-label="Mais opções de compartilhamento"
        >
          <IconChevron up={aberto} />
        </button>
      </div>

      {aberto && (
        <div className="share-menu" role="menu">
          {card && (
            <button role="menuitem" onClick={() => executar(copiarImagem)}>
              <IconCopy /> Copiar imagem
            </button>
          )}
          {card && (
            <button role="menuitem" onClick={() => executar(formatoStory)}>
              <IconImage /> Formato Story
            </button>
          )}
          <button role="menuitem" onClick={() => executar(copiarLink)}>
            <IconLink /> Copiar link
          </button>
        </div>
      )}
    </div>
  );
}
