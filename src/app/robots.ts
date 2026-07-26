import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt estático. Tudo liberado — `/data/*.json` é a mesma informação já
 * renderizada nas páginas. A linha que importa é a `Sitemap:`.
 */
// Obrigatório com `output: 'export'`: sem isto o Next trata a rota de metadata
// como dinâmica e o build ABORTA (não é aviso — é erro).
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
