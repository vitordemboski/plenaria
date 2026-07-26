import type { Metadata } from 'next';

/** Domínio canônico — base do `metadataBase`, do canonical de cada rota e do sitemap. */
export const SITE_URL = 'https://plenariarpg.com';
export const SITE_NAME = 'PLENÁRIA';
export const SITE_TITLE = 'PLENÁRIA — O RPG da Política Brasileira';
export const SITE_DESC =
  'Cards de personagem, tiers, guildas e batalhas 1v1 gerados a partir dos Dados Abertos da Câmara e do Senado. Fórmula pública e auditável.';

/** Ainda a MESMA para todas as rotas: uma imagem por parlamentar exigiria gerar
 *  1200×630 no pipeline (o ShareButton compõe no canvas, o que scraper não lê). */
export const OG_IMAGE = { url: '/og.jpg', width: 1200, height: 630, alt: SITE_TITLE };

/**
 * Metadados de uma rota — use SEMPRE isto em vez de montar o objeto à mão. Três
 * armadilhas do Next que não quebram nada (por isso passavam batido):
 *
 * 1. `openGraph`/`twitter` não herdam o `title`/`description` da página — o bloco
 *    do layout raiz vence, e as 673 rotas dividiam o mesmo cartão de link.
 * 2. O merge é RASO: declarar `openGraph` na página descarta `type`/`siteName`/
 *    `locale`/`images` do layout. Omiti-los aqui apagaria a og:image da rota.
 * 3. `og:url` não sai do `alternates.canonical`.
 *
 * `title` omitido = título padrão do site (só a home).
 */
export function pageMeta({
  title,
  description,
  path,
  image,
}: {
  title?: string;
  description: string;
  path: string;
  /** cartão próprio da rota; sem ele vai o do site */
  image?: string;
}): Metadata {
  // O template '%s · PLENÁRIA' do layout raiz só vale para o `title` da página;
  // og:title é texto absoluto, então o sufixo é aplicado à mão.
  const ogTitle = title ? `${title} · ${SITE_NAME}` : SITE_TITLE;
  const og = image ? { ...OG_IMAGE, url: image, alt: ogTitle } : OG_IMAGE;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'pt_BR',
      images: [og],
      title: ogTitle,
      description,
      url: path,
    },
    twitter: {
      card: 'summary_large_image',
      images: [og.url],
      title: ogTitle,
      description,
    },
  };
}
