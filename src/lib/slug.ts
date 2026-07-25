/**
 * Slug ASCII para rotas de guilda: "MISSÃO" → "MISSAO", "UNIÃO" → "UNIAO".
 * Siglas com acento quebram o `output: export` (a URL chega percent-encoded e
 * não casa com o generateStaticParams). Arquivo separado de lib/data.ts de
 * propósito: ilhas client podem importar sem arrastar os JSONs pro bundle.
 */
export const guildSlug = (sigla: string) =>
  sigla.normalize('NFD').replace(/[̀-ͯ]/g, '');
