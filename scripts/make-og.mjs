// Gera as imagens de compartilhamento (Open Graph / Twitter):
//   public/og.jpg            → card do site (wordmark sobre a arte heráldica)
//   public/og/<slug>.jpg     → um card POR PARLAMENTAR (foto + números brutos)
//   public/og/guilda-<sigla>.jpg → um card POR GUILDA (brasão + médias da bancada)
//
// ASSET REPRODUZÍVEL, no espírito do fetch-fotos: roda com rede (baixa as fontes
// do Google Fonts uma vez), mas a SAÍDA é arquivo estático, então o `next build`
// continua 100% offline. Re-rodar regenera. Uso:
//   npm run og                      tudo
//   npm run og -- --only=kim-k…     um só (iteração de layout)
//   npm run og -- --site            só o card do site
//   npm run og -- --guildas         só os cards de guilda
//
// O card do parlamentar obedece às MESMAS regras da imagem do ShareButton, que
// são regras de produto, não de estilo (ver CLAUDE.md e ShareCardData):
//   · NENHUM título/selo — selo viaja sem a regra, sem o bruto e sem o canal de
//     correção; fora do site é rótulo sem prova. No lugar vai o próprio dado.
//   · cada atributo leva o número BRUTO (`rawCurto`) ao lado do percentil, senão
//     a peça afirma um percentil sem mostrar de onde ele saiu.
//   · fora do ranking (mandato parcial/presidência) sai SEM Tier e SEM Poder.
//   · crédito da foto NA IMAGEM (Câmara é CC BY, o Senado exige citar a Agência)
//     e só quando a foto foi de fato desenhada.

import { ImageResponse } from 'next/og.js';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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

/** cor do tier — a mesma tabela do ShareButton (TIER_COLOR) */
const TIER_COR = { S: '#f6e39b', A: '#e0b84a', B: '#c9962b', C: '#9a7a1e', D: '#6b5518', F: '#55442a' };

/** Rótulo por atributo. A fonte da verdade é STAT_META (src/lib/data.ts), que é TS
 *  e não dá para importar daqui; o CONJUNTO de atributos que pontuam vem de
 *  `meta.pesos`, então mudar peso não dessincroniza — só renomear rótulo. */
const STAT_LABEL = {
  ataque: 'Ataque', stamina: 'Stamina', eficiencia: 'Eficiência',
  tecnica: 'Técnica', economia: 'Economia',
};

/** Elemento da carta OG do SITE (1200×630): arte de fundo + wordmark no escudo. */
function cardSite({ bg, title, subtitle }) {
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

/** uma linha de atributo: rótulo · percentil · número bruto */
function linhaStat({ label, valor, nota }) {
  return h('div', { style: { display: 'flex', alignItems: 'baseline', width: '100%', marginBottom: '15px' } },
    h('div', { style: { display: 'flex', width: '124px', fontSize: '19px', fontWeight: 600, color: GOLD_SUB, letterSpacing: '0.5px' } }, label),
    h('div', {
      style: {
        display: 'flex', width: '56px', justifyContent: 'flex-end',
        fontFamily: 'Cinzel', fontWeight: 900, fontSize: '27px',
        // >=70 dourado claro, <40 vermelho — o MESMO corte da barra na ficha
        color: valor >= 70 ? '#f6e39b' : valor < 40 ? '#e5484d' : '#c9962b',
      },
    }, String(valor)),
    nota
      ? h('div', { style: { display: 'flex', marginLeft: '18px', fontSize: '17px', color: '#8a90a0', flex: 1 } }, nota)
      : h('div', { style: { display: 'flex', flex: 1 } }, ''),
  );
}

/**
 * Card do PARLAMENTAR (1200×630, paisagem): foto na janela em arco à esquerda,
 * nome + Poder + atributos à direita.
 *
 * Sem og-bg aqui de propósito: aquela arte é uma cavidade de escudo CENTRALIZADA,
 * desenhada para a wordmark — com foto à esquerda e cinco linhas de dado à
 * direita, o ornamento cai no meio do texto. O fundo é composto aqui mesmo
 * (gradiente escuro + moldura dourada), na paleta do site.
 *
 * NB: nada de emoji. O satori só desenha emoji com fonte/asset extra
 * configurado; sem isso o ícone sai como caixa vazia. Os rótulos vão em texto.
 */
function cardPolitico({ p, foto, stats, credito }) {
  const cor = p.semRanking ? '#55442a' : (TIER_COR[p.tier] ?? GOLD_SUB);
  return h('div', {
    style: {
      width: `${W}px`, height: `${H}px`, display: 'flex', fontFamily: 'Sometype Mono',
      padding: '30px', backgroundColor: '#0a0d14',
      backgroundImage: `radial-gradient(120% 80% at 22% -10%, ${cor}1f, transparent 60%), linear-gradient(160deg, #151a27 0%, #0b0e15 70%)`,
    },
  },
    // moldura dourada dupla, ecoando o filete externo da arte do card do site
    h('div', {
      style: {
        display: 'flex', width: '100%', height: '100%', padding: '26px 30px',
        border: `1px solid ${GOLD_RULE}`, borderRadius: '4px',
        boxShadow: `inset 0 0 0 4px #0a0d14, inset 0 0 0 5px ${GOLD_RULE}66`,
      },
    },
      // ---------- coluna da foto ----------
      foto
        ? h('div', {
            style: {
              display: 'flex', width: '318px', height: '100%', marginRight: '34px',
              borderRadius: '159px 159px 14px 14px', overflow: 'hidden',
              border: `1px solid ${cor}73`, backgroundColor: '#121722',
            },
          },
            h('img', { src: foto, width: 318, height: 518, style: { objectFit: 'cover' } }),
          )
        : null,
      // ---------- coluna dos dados ----------
      h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, height: '100%' } },
        h('div', {
          style: {
            display: 'flex', fontFamily: 'Cinzel', fontWeight: 900,
            // flexShrink:0 é OBRIGATÓRIO: numa coluna de altura fixa, o nome em DUAS
            // linhas faz o conteúdo passar dos 518px e o satori encolhe os flex items
            // — a caixa do nome comprimia para uma linha e a segunda saía cortada ao
            // meio ("CARLOS HENRIQUE / GAGUIM" com a metade de baixo faltando).
            flexShrink: 0,
            // e a rampa de tamanho dá folga antes disso: 46px quebra a partir de ~18
            // caracteres na coluna de 712px
            fontSize: p.nome.length > 26 ? '34px' : p.nome.length > 21 ? '38px' : p.nome.length > 17 ? '42px' : '46px',
            lineHeight: 1.1, letterSpacing: '0.5px',
            color: 'transparent', backgroundImage: GOLD_GRAD,
            backgroundClip: 'text', WebkitBackgroundClip: 'text',
          },
        }, p.nome.toUpperCase()),
        h('div', { style: { display: 'flex', marginTop: '8px', fontSize: '17px', fontWeight: 600, color: '#7d8290', letterSpacing: '0.5px' } }, p.sub),
        h('div', { style: { display: 'flex', width: '100%', height: '1px', background: `${GOLD_RULE}99`, margin: '16px 0 14px' } }),

        // Poder + Tier — ou o motivo de estar fora do ranking, nunca Tier F no lugar
        p.semRanking
          ? h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '16px', fontSize: '19px', fontWeight: 600, color: '#c6a256' } },
              `sem Tier — ${p.semRanking}`)
          : h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '14px' } },
              h('div', {
                style: {
                  display: 'flex', fontFamily: 'Cinzel', fontWeight: 900, fontSize: '62px', lineHeight: 1,
                  color: 'transparent', backgroundImage: GOLD_GRAD,
                  backgroundClip: 'text', WebkitBackgroundClip: 'text',
                },
              }, String(p.ops)),
              h('div', { style: { display: 'flex', marginLeft: '13px', marginTop: '26px', fontSize: '13px', letterSpacing: '3.5px', color: '#7d8290' } }, 'PODER'),
              h('div', {
                style: {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '52px', height: '52px', marginLeft: 'auto', borderRadius: '11px',
                  backgroundColor: cor, color: '#0a0d14',
                  fontFamily: 'Cinzel', fontWeight: 900, fontSize: '30px',
                },
              }, p.tier),
            ),

        h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', flexShrink: 0 } },
          ...stats.map(linhaStat)),

        // rodapé colado no fim da coluna: crédito + fórmula + domínio
        h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: '18px', flexShrink: 0 } },
          h('div', { style: { display: 'flex', fontSize: '14px', color: '#4d525e' } },
            [credito ? `Foto: ${credito}` : null, 'fórmula em /como-calculamos'].filter(Boolean).join('  ·  ')),
          h('div', { style: { display: 'flex', marginTop: '6px', fontSize: '18px', fontWeight: 600, color: '#565b68' } }, 'plenariarpg.com'),
        ),
      ),
    ),
  );
}

/** Slug ASCII da guilda — MESMA regra de src/lib/slug.ts (MISSÃO → MISSAO); sigla
 *  acentuada quebra o output:export, então o arquivo tem de casar com a rota. */
const guildSlug = (sigla) => sigla.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Tier da guilda pelos cortes do meta.json — a MESMA tabela do ingest e da
 *  página da guilda. Não reintroduza uma constante local aqui: era exatamente a
 *  divergência que fazia a guilda com Poder médio 86 sair Tier A. */
const tierDaGuilda = (ops, cortes) =>
  Object.keys(cortes).find((t) => ops >= cortes[t]) ?? 'F';

/** Brasão da guilda em PNG, a partir do MESMO desenho do GuildCrest.tsx — mas SEM
 *  o `<text>` da sigla: o librsvg (que o sharp usa) não resolve a fonte do site e
 *  a sigla sairia num tipo qualquer. Ela é escrita depois, pelo satori, na fita. */
const CREST_H = 236; // cabe na janela de 318px COM a fita, que é mais larga que o escudo
const CREST_VB_W = 66, CREST_VB_H = 54; // viewBox do brasão: a fita passa das bordas do escudo
async function crestPng(cor, alturaPx) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(alturaPx * CREST_VB_W / CREST_VB_H)}" height="${alturaPx}" viewBox="-10 0 ${CREST_VB_W} ${CREST_VB_H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4e2a1"/><stop offset="1" stop-color="${cor}"/>
    </linearGradient></defs>
    <path d="M23 2 44 9v20c0 13-9 20-21 23C11 49 2 42 2 29V9z" fill="#12161f" stroke="url(#g)" stroke-width="2"/>
    <path d="M23 12 l4.5 4.5 L23 21 l-4.5 -4.5 Z" fill="url(#g)"/>
    <path d="M13 44h20" stroke="url(#g)" stroke-width="1.5" opacity="0.8"/>
    <path d="M-9 25 H55 L51 31.75 55 38.5 H-9 L-5 31.75 Z" fill="#0d1119" stroke="url(#g)" stroke-width="1.1"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Card da GUILDA (1200×630): brasão à esquerda, médias da bancada à direita.
 *
 * Sem número bruto por atributo, ao contrário do card de parlamentar — e não é
 * omissão: atributo de guilda é MÉDIA DE PERCENTIS dos membros, não existe um
 * bruto único para citar (é o mesmo motivo pelo qual o ShareButton não passa
 * `nota` na variante 'guilda'). No lugar vai a linha que diz o que o número É.
 */
function cardGuilda({ g, crest, stats }) {
  const cor = g.semRoster ? '#55442a' : (TIER_COR[g.tier] ?? GOLD_SUB);
  return h('div', {
    style: {
      width: `${W}px`, height: `${H}px`, display: 'flex', fontFamily: 'Sometype Mono',
      padding: '30px', backgroundColor: '#0a0d14',
      backgroundImage: `radial-gradient(120% 80% at 22% -10%, ${g.cor}26, transparent 60%), linear-gradient(160deg, #151a27 0%, #0b0e15 70%)`,
    },
  },
    h('div', {
      style: {
        display: 'flex', width: '100%', height: '100%', padding: '26px 30px',
        border: `1px solid ${GOLD_RULE}`, borderRadius: '4px',
        boxShadow: `inset 0 0 0 4px #0a0d14, inset 0 0 0 5px ${GOLD_RULE}66`,
      },
    },
      // ---------- janela do brasão (espelha .futc-crestwin: gradiente na cor da guilda) ----------
      h('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          width: '318px', height: '100%', marginRight: '34px',
          borderRadius: '159px 159px 14px 14px',
          border: `1px solid ${cor}73`,
          backgroundImage: `radial-gradient(80% 60% at 50% 30%, ${g.cor}26, #0d1018 74%)`,
        },
      },
        h('img', { src: crest, width: Math.round(CREST_H * CREST_VB_W / CREST_VB_H), height: CREST_H, style: { position: 'absolute' } }),
        // a sigla vai na fita do brasão: y=31.75 de 54 no viewBox ≈ 58,8% da altura
        h('div', {
          style: {
            display: 'flex', position: 'absolute', width: '300px', justifyContent: 'center',
            // a sigla vai no meio da fita: y=31.75 de 54 no viewBox
            // 34.4 e não 31.75 (o centro geométrico da fita): o satori centraliza a
            // CAIXA do texto, e a caixa tem folga de entrelinha acima das maiúsculas —
            // centrar a caixa na fita deixava a sigla montada na borda de cima. O valor
            // é o mesmo `y` do <text> do GuildCrest.tsx, onde ele é a BASELINE.
            marginTop: `${Math.round(CREST_H * (34.4 / CREST_VB_H - 0.5))}px`,
            fontWeight: 700, letterSpacing: '0.5px', color: '#f4e2a1',
            // sigla longa (SOLIDARIEDADE, REPUBLICANOS) tem de caber na fita
            fontSize: g.sigla.length > 11 ? '25px' : g.sigla.length > 8 ? '31px' : '38px',
          },
        }, g.sigla),
      ),
      // ---------- dados ----------
      h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, height: '100%' } },
        h('div', {
          style: {
            display: 'flex', fontFamily: 'Cinzel', fontWeight: 900,
            flexShrink: 0, // ver a nota no cardPolitico
            fontSize: g.nome.length > 26 ? '34px' : g.nome.length > 21 ? '38px' : g.nome.length > 17 ? '42px' : '46px',
            lineHeight: 1.1, letterSpacing: '0.5px',
            color: 'transparent', backgroundImage: GOLD_GRAD,
            backgroundClip: 'text', WebkitBackgroundClip: 'text',
          },
        }, g.nome.toUpperCase()),
        h('div', { style: { display: 'flex', marginTop: '8px', fontSize: '17px', fontWeight: 600, color: '#7d8290', letterSpacing: '0.5px' } }, g.sub),
        h('div', { style: { display: 'flex', width: '100%', height: '1px', background: `${GOLD_RULE}99`, margin: '16px 0 14px' } }),

        g.semRoster
          ? h('div', { style: { display: 'flex', marginBottom: '16px', fontSize: '19px', fontWeight: 600, color: '#c6a256' } },
              'sem membros ranqueáveis')
          : h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '14px' } },
              h('div', {
                style: {
                  display: 'flex', fontFamily: 'Cinzel', fontWeight: 900, fontSize: '62px', lineHeight: 1,
                  color: 'transparent', backgroundImage: GOLD_GRAD,
                  backgroundClip: 'text', WebkitBackgroundClip: 'text',
                },
              }, String(g.opsMedio)),
              h('div', { style: { display: 'flex', marginLeft: '13px', marginTop: '26px', fontSize: '13px', letterSpacing: '3.5px', color: '#7d8290' } }, 'PODER MÉDIO'),
              h('div', {
                style: {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '52px', height: '52px', marginLeft: 'auto', borderRadius: '11px',
                  backgroundColor: cor, color: '#0a0d14',
                  fontFamily: 'Cinzel', fontWeight: 900, fontSize: '30px',
                },
              }, g.tier),
            ),

        // sem roster os atributos seriam média de ninguém — nenhuma linha, como no ShareButton
        h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', flexShrink: 0 } },
          ...stats.map(linhaStat)),

        g.composicao && h('div', { style: { display: 'flex', flexShrink: 0, marginTop: '10px', fontSize: '17px', fontWeight: 600, color: GOLD_SUB, letterSpacing: '0.5px' } }, g.composicao),

        h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: '18px', flexShrink: 0 } },
          h('div', { style: { display: 'flex', fontSize: '14px', color: '#4d525e' } },
            // sem crédito de foto: não há foto. O que precisa ser dito é o que os
            // números são — sem isso a peça exibiria percentil sem dizer de quê.
            stats.length ? `Atributos: média dos percentis ${g.membros === 1 ? 'do único membro' : `dos ${g.membros} membros`}  ·  fórmula em /como-calculamos`
                         : 'fórmula em /como-calculamos'),
          h('div', { style: { display: 'flex', marginTop: '6px', fontSize: '18px', fontWeight: 600, color: '#565b68' } }, 'plenariarpg.com'),
        ),
      ),
    ),
  );
}

const FONTS = {};

async function render(out, element) {
  const img = new ImageResponse(element, {
    width: W, height: H,
    fonts: [
      { name: 'Cinzel', data: FONTS.cinzel900, weight: 900, style: 'normal' },
      { name: 'Sometype Mono', data: FONTS.mono400, weight: 400, style: 'normal' },
      { name: 'Sometype Mono', data: FONTS.mono600, weight: 600, style: 'normal' },
    ],
  });
  // JPEG compacto: o WhatsApp não mostra preview de og:image acima de ~300 KB,
  // e a arte é fotográfica/degradê (JPEG encolhe muito sem perda perceptível).
  const buf = await sharp(Buffer.from(await img.arrayBuffer()))
    .jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  return buf.length;
}

/** foto local → PNG na medida da janela, em data-URI.
 *  Converte com o sharp em vez de entregar o WebP direto: o decodificador de
 *  imagem do satori não lê WebP e a janela sairia vazia, sem erro. */
async function fotoDataUri(fotoUrl) {
  if (!fotoUrl) return null;
  const local = join(ROOT, 'public', fotoUrl.replace(/^\//, ''));
  if (!existsSync(local)) return null;
  const png = await sharp(local)
    .resize(318, 518, { fit: 'cover', position: 'top' })
    .png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** motivo de estar fora do ranking, na mesma linguagem da ficha */
function motivoFora(p) {
  if (p.presidenteCasa) return 'presidência da Casa nesta legislatura';
  const m = p.mesesExercicio != null ? `${Math.round(p.mesesExercicio)} meses em exercício` : null;
  return ['mandato parcial', m].filter(Boolean).join(' · ');
}

async function ogDoParlamentar(p, statKeys) {
  const foto = await fotoDataUri(p.fotoUrl);
  const fora = !!p.mandatoParcial || !!p.presidenteCasa;
  const stats = statKeys
    // atributo que o parlamentar não tem (o Senado não tem todos) não vira linha
    .filter((k) => p.stats?.[k] != null && (!p.rawNumbers || p.rawNumbers[k]))
    .map((k) => ({ label: STAT_LABEL[k] ?? k, valor: p.stats[k], nota: p.rawCurto?.[k] }));

  return cardPolitico({
    p: {
      nome: p.nome,
      sub: `${p.casa === 'senado' ? 'Senado Federal' : 'Câmara dos Deputados'} · ${p.uf} · ${p.partido}`,
      tier: fora ? null : p.tier,
      ops: fora ? null : p.ops,
      semRanking: fora ? motivoFora(p) : null,
    },
    foto,
    stats,
    // crédito SÓ se a foto entrou de fato — creditar imagem não desenhada é ruído
    credito: foto ? (p.casa === 'senado' ? 'Agência Senado' : 'Câmara dos Deputados') : null,
  });
}

/** "2 deputados · 1 senador" — só quando a bancada tem as DUAS casas. Com casa
 *  única a linha repetiria o "N parlamentares" do subtítulo e ainda se confundia
 *  com colocação ("3 na Câmara" lido como terceiro lugar). */
function composicaoDaBancada(bancada) {
  const d = bancada.filter((p) => p.casa === 'camara').length;
  const sen = bancada.length - d;
  if (!d || !sen) return null;
  return `${d} ${d === 1 ? 'deputado' : 'deputados'}  ·  ${sen} ${sen === 1 ? 'senador' : 'senadores'}`;
}

async function ogDaGuilda(g, todos, statKeys, tierCortes) {
  const membros = todos.filter((p) => p.partido === g.sigla && !(p.mandatoParcial || p.presidenteCasa));
  const semRoster = membros.length === 0;
  const bancada = semRoster ? todos.filter((p) => p.partido === g.sigla) : membros;
  const opsMedio = semRoster ? 0 : Math.round(membros.reduce((s, p) => s + p.ops, 0) / membros.length);

  const stats = semRoster ? [] : statKeys.map((k) => {
    // média só sobre quem TEM o atributo — igual ao getGuildStats
    const tem = membros.filter((p) => !p.rawNumbers || p.rawNumbers[k]);
    const base = tem.length ? tem : membros;
    return {
      label: STAT_LABEL[k] ?? k,
      valor: Math.round(base.reduce((s, p) => s + (p.stats[k] ?? 0), 0) / base.length),
    };
  });

  const crest = await crestPng(g.cor ?? '#d4af37', CREST_H);
  return cardGuilda({
    g: {
      nome: g.nome, sigla: g.sigla, cor: g.cor ?? '#d4af37',
      sub: `Guilda ${g.sigla} · ${bancada.length} ${bancada.length === 1 ? 'parlamentar' : 'parlamentares'}`,
      membros: membros.length,
      composicao: composicaoDaBancada(bancada),
      opsMedio, tier: semRoster ? null : tierDaGuilda(opsMedio, tierCortes), semRoster,
    },
    crest,
    stats,
  });
}

/** roda `tarefa` sobre `itens` com no máximo `n` em paralelo (satori+resvg é CPU) */
async function pool(itens, n, tarefa) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) await tarefa(itens[i++]);
  });
  await Promise.all(workers);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.slice(7);
  const soSite = args.includes('--site');
  const soGuildas = args.includes('--guildas');

  console.log('Baixando fontes (Cinzel + Sometype Mono)…');
  [FONTS.cinzel900, FONTS.mono400, FONTS.mono600] = await Promise.all([
    loadFont('cinzel', '900'),
    loadFont('sometype-mono', 'regular'),
    loadFont('sometype-mono', '600'),
  ]);

  // ---------- card do site ----------
  if (!only && !soGuildas) {
    console.log('Preparando arte de fundo…');
    const bgPng = await sharp(join(ROOT, 'assets/og-bg.png'))
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .png().toBuffer();
    const bg = `data:image/png;base64,${bgPng.toString('base64')}`;
    const kb = await render(join(ROOT, 'public/og.jpg'),
      cardSite({ bg, title: 'PLENÁRIA', subtitle: 'O RPG da Política Brasileira' }));
    console.log(`✓ public/og.jpg (${(kb / 1024).toFixed(0)} KB)`);
  }
  if (soSite) return;

  // ---------- um card por parlamentar ----------
  const dataPath = join(ROOT, 'data/politicians.json');
  const db = JSON.parse(readFileSync(dataPath, 'utf8'));
  const todos = Array.isArray(db) ? db : db.politicians;
  const meta = JSON.parse(readFileSync(join(ROOT, 'data/meta.json'), 'utf8'));
  // os que PONTUAM, na ordem dos pesos — mesma seleção da grade da ficha
  const statKeys = Object.keys(meta.pesos ?? {}).filter((k) => STAT_LABEL[k]);

  const alvos = soGuildas ? [] : only ? todos.filter((p) => p.slug === only) : todos;
  if (only && !alvos.length) throw new Error(`nenhum parlamentar casa com --only=${only}`);
  if (alvos.length) console.log(`Gerando ${alvos.length} card(s) de parlamentar…`);

  let feitos = 0, bytes = 0, maior = 0, semFoto = 0;
  const gerados = new Set();
  await pool(alvos, 4, async (p) => {
    const el = await ogDoParlamentar(p, statKeys);
    const n = await render(join(ROOT, 'public/og', `${p.slug}.jpg`), el);
    gerados.add(p.slug);
    bytes += n; maior = Math.max(maior, n);
    if (!p.fotoUrl) semFoto++;
    if (++feitos % 50 === 0 || feitos === alvos.length) {
      console.log(`  ${feitos}/${alvos.length}`);
    }
  });

  // Marca no JSON quem tem card, como o fetch-fotos faz com fotoUrl. O caminho é
  // derivável do slug, então o campo carrega UMA informação e só uma: o arquivo
  // existe. Por isso é gravado a partir dos que renderizaram de fato (e apagado
  // de quem não) — se a UI derivasse o caminho do slug, um `npm run og` que nunca
  // rodou daria og:image 404, e scraper com 404 não mostra cartão nenhum, o que é
  // pior que o card genérico do site. Fora do index.json de propósito: a /batalha
  // não usa, e 593 caminhos inflariam o payload (mesma razão do fotoLqip).
  if (!only && !soGuildas) {
    for (const p of todos) {
      if (gerados.has(p.slug)) p.ogImage = `/og/${p.slug}.jpg`;
      else delete p.ogImage;
    }
    // sem indentação, igual ao fetch-fotos — o arquivo é máquina-para-máquina
    writeFileSync(dataPath, JSON.stringify(db));
    console.log(`✓ politicians.json: ogImage em ${gerados.size} parlamentares`);
  }

  // ---------- um card por guilda ----------
  if (!only) {
    if (!meta.tierCortes) throw new Error('meta.json sem `tierCortes` — rode `npm run data:real`');
    const guildasPath = join(ROOT, 'data/guilds.json');
    const guildas = JSON.parse(readFileSync(guildasPath, 'utf8'));
    console.log(`Gerando ${guildas.length} card(s) de guilda…`);
    await pool(guildas, 4, async (g) => {
      const el = await ogDaGuilda(g, todos, statKeys, meta.tierCortes);
      const n = await render(join(ROOT, 'public/og', `guilda-${guildSlug(g.sigla)}.jpg`), el);
      g.ogImage = `/og/guilda-${guildSlug(g.sigla)}.jpg`;
      bytes += n; maior = Math.max(maior, n); feitos++;
    });
    writeFileSync(guildasPath, JSON.stringify(guildas));
    console.log(`✓ ${guildas.length} cards de guilda (ogImage gravado)`);
  }

  console.log(`✓ ${feitos} cards · média ${(bytes / (feitos || 1) / 1024).toFixed(0)} KB · maior ${(maior / 1024).toFixed(0)} KB`);
  if (maior > 300 * 1024) console.warn(`⚠︎ maior card passa de 300 KB — o WhatsApp deixa de mostrar o preview`);
  if (semFoto) console.log(`ℹ ${semFoto} sem foto oficial (card sem a janela, e sem crédito)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
