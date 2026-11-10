/**
 * Slug ASCII para rotas de guilda: "MISSÃO" → "MISSAO", "S/Partido" → "S-Partido".
 * Siglas com acento quebram o `output: export` (a URL chega percent-encoded e
 * não casa com o generateStaticParams), e a BARRA vira segmento de caminho: o build
 * grava `S%2FPartido/` enquanto o link aponta `/guilda/S/Partido/` — 404. Por isso
 * tudo fora de [A-Za-z0-9-] vira hífen. Gêmeo em scripts/make-og.mjs (nome do card
 * OG) — mexeu aqui, mexa lá. Arquivo separado de lib/data.ts de propósito: ilhas
 * client podem importar sem arrastar os JSONs pro bundle.
 */
export const guildSlug = (sigla: string) =>
  sigla.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9-]+/g, '-');
