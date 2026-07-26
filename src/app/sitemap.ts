import type { MetadataRoute } from 'next';
import { politicians, guilds, titleDefs, meta } from '@/lib/data';
import { guildSlug } from '@/lib/slug';
import { availableSectionIds } from './insights/sections';
import { SITE_URL } from '@/lib/seo';

/**
 * Sitemap das 673 rotas, emitido como arquivo estático no build.
 *
 * As rotas saem das MESMAS fontes dos `generateStaticParams`, nunca de uma lista
 * paralela — esta desatualizaria no dia em que um parlamentar assume, e página
 * órfã não dá erro em lugar nenhum. `lastModified` é o `meta.updatedAt` (o site
 * muda todo de uma vez, em batch). Sem `changeFrequency`/`priority`: ignorados
 * pelo Google desde 2023.
 *
 * `/estado/SP/` e `/guilda/PT/` são MAIÚSCULAS de fato e a hospedagem é
 * case-sensitive — normalizar o case aqui produziria um sitemap de 404s.
 */
// Obrigatório com `output: 'export'` — ver o comentário gêmeo em robots.ts.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(meta.updatedAt);
  const rota = (path: string) => ({ url: `${SITE_URL}${path}`, lastModified });

  const estaticas = ['/', '/insights/', '/guildas/', '/batalha/', '/como-calculamos/', '/sobre/'];
  const secoes = availableSectionIds()
    .filter((id) => id !== 'panorama') // panorama é o próprio /insights/
    .map((id) => `/insights/${id}/`);
  const ufs = [...new Set(politicians.map((p) => p.uf))].map((uf) => `/estado/${uf}/`);

  return [
    ...estaticas,
    ...secoes,
    ...politicians.map((p) => `/politico/${p.slug}/`),
    ...guilds.map((g) => `/guilda/${guildSlug(g.sigla)}/`),
    ...ufs,
    ...titleDefs.map((t) => `/titulo/${t.slug}/`),
  ].map(rota);
}
