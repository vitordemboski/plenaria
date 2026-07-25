/**
 * Brasão heráldico da guilda (partido), gerado por SVG a partir da cor/sigla.
 * Formato único para TODAS as siglas: escudo com ornamento no campo e a sigla
 * numa banderola (fita com pontas em "V") que cruza o escudo — a fita pode ser
 * mais larga que o escudo (overflow visível), o que mantém legível até
 * REPUBLICANOS/SOLIDARIEDADE em tamanhos pequenos.
 * Presentacional de propósito (recebe `cor` em vez de resolver via lib/data):
 * assim pode ser usado em ilhas client sem arrastar os JSONs de build p/ o bundle.
 */
export function GuildCrest({ sigla, cor = '#d4af37', size = 46 }: {
  sigla: string;
  cor?: string;
  size?: number;
}) {
  const gid = `crest-${sigla}-${size}`;
  const fontSize =
    sigla.length > 10 ? 7.2
    : sigla.length > 8 ? 8.4
    : sigla.length > 6 ? 8.8
    : sigla.length > 4 ? 9.2
    : sigla.length === 4 ? 10
    : 11;
  // só as siglas quilométricas (SOLIDARIEDADE) precisam de squeeze na fita.
  // 48 (não 56): os pontos internos do "V" ficam em x=-5 e x=51 (largura 56), então
  // textLength 56 encostava o texto nas bordas — 48 deixa ~4 de respiro por lado.
  const fit = sigla.length > 12
    ? { textLength: 48, lengthAdjust: 'spacingAndGlyphs' as const } : {};
  return (
    <svg width={size} height={(size * 54) / 46} viewBox="0 0 46 54" overflow="visible"
      role="img" aria-label={`Brasão da guilda ${sigla}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4e2a1" />
          <stop offset="1" stopColor={cor} />
        </linearGradient>
      </defs>
      <path d="M23 2 44 9v20c0 13-9 20-21 23C11 49 2 42 2 29V9z" fill="#12161f" stroke={`url(#${gid})`} strokeWidth="2" />
      {/* ornamento no campo do escudo (o texto vive na fita, não dentro dele) */}
      <path d="M23 12 l4.5 4.5 L23 21 l-4.5 -4.5 Z" fill={`url(#${gid})`} />
      <path d="M13 44h20" stroke={`url(#${gid})`} strokeWidth="1.5" opacity="0.8" />
      {/* banderola com pontas em "V", mais larga que o escudo */}
      <path d="M-9 25 H55 L51 31.75 55 38.5 H-9 L-5 31.75 Z"
        fill="#0d1119" stroke={`url(#${gid})`} strokeWidth="1.1" />
      <text x="23" y="34.4" textAnchor="middle"
        fontFamily="var(--font-mono), monospace" fontWeight="700" fontSize={fontSize}
        fill={`url(#${gid})`} {...fit}>
        {sigla}
      </text>
    </svg>
  );
}
