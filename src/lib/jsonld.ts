import { casaLabel, meta, TIER_LABEL } from './data';
import { SITE_NAME, SITE_TITLE, SITE_URL } from './seo';
import { UF_NOME } from './uf';
import type { Politician } from './types';

/**
 * Dados estruturados (schema.org), computados no build.
 *
 * ⚠️ Poder e Tier NUNCA viram `AggregateRating`/`Review`. É o mapeamento óbvio e
 * está errado duas vezes: rating sobre pessoa não é elegível no Google (e nota
 * auto-atribuída é auto-servida), e seria a plataforma emitindo uma NOTA DE UMA
 * PESSOA em formato legível por máquina — o juízo que o projeto se recusa a
 * fazer (mesmo princípio do `higherIsBetter: null` em map-data.ts). Os números
 * vão como `PropertyValue`.
 */

/** Nunca um `Person` nomeado: a /sobre deliberadamente não estampa o nome do
 *  responsável (ver o comentário lá). */
const PUBLISHER = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  email: 'contato@plenariarpg.com',
};

/** Perfil oficial na própria casa — sem ele o Google casa a página com a pessoa
 *  real por NOME, e há homônimos. Os dois padrões foram conferidos (200). */
const perfilOficial = (p: Politician) =>
  p.casa === 'camara'
    ? `https://www.camara.leg.br/deputados/${p.id}`
    : `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${p.id}`;

/** Flexionado pelo `sexo` oficial: "Deputado" para uma deputada misgenderiza uma
 *  pessoa real num formato que se propaga. Sem `sexo`, o neutro — o cargo fica
 *  descrito pelo `memberOf`. */
function cargo(p: Politician): string {
  if (!p.sexo) return 'Parlamentar';
  const fem = p.sexo === 'F';
  return p.casa === 'camara' ? `Deputad${fem ? 'a' : 'o'} Federal` : fem ? 'Senadora' : 'Senador';
}

export function personLd(p: Politician) {
  const stats = Object.entries(p.stats)
    .filter(([k]) => !p.rawNumbers || p.rawNumbers[k as keyof typeof p.rawNumbers])
    .map(([k, v]) => ({ '@type': 'PropertyValue', name: k, value: v }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.nome,
    jobTitle: cargo(p),
    url: `${SITE_URL}/politico/${p.slug}/`,
    ...(p.fotoUrl ? { image: `${SITE_URL}${p.fotoUrl}` } : {}),
    sameAs: [perfilOficial(p)],
    memberOf: { '@type': 'Organization', name: casaLabel(p.casa) },
    affiliation: { '@type': 'Organization', name: p.partido },
    workLocation: { '@type': 'AdministrativeArea', name: UF_NOME[p.uf] ?? p.uf },
    additionalProperty: [
      // Fora do ranking (mandato parcial/presidência da Casa) não publica Poder nem
      // Tier NEM AQUI: o JSON-LD é lido por máquina e alimenta resultado rico — seria
      // o mesmo rótulo que a página se recusa a exibir, só que sem ninguém ler o aviso.
      ...(p.mandatoParcial || p.presidenteCasa
        ? [{ '@type': 'PropertyValue', name: 'Tier',
             value: `sem Tier — ${p.presidenteCasa ? 'presidência da Casa nesta legislatura' : 'mandato parcial'}, fora do ranking` }]
        : [
            { '@type': 'PropertyValue', name: 'Poder', value: p.ops },
            // Tier como texto: `value` numérico convidaria a tratá-lo como estrela.
            { '@type': 'PropertyValue', name: 'Tier', value: `${p.tier} (${TIER_LABEL[p.tier]})` },
          ]),
      ...stats,
    ],
  };
}

/** O SearchAction é legítimo porque os filtros da Tier List vivem de fato na URL
 *  (?q=&casa=&uf=, ver TierListClient) — o urlTemplate funciona ao ser acionado. */
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_TITLE,
    url: `${SITE_URL}/`,
    inLanguage: 'pt-BR',
    publisher: PUBLISHER,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Sem `license`: o MIT do repo cobre o CÓDIGO. As fotos têm termos próprios (o
 *  Senado veda uso comercial), então declarar MIT aqui seria falso sobre elas. */
export function datasetLd(totalParlamentares: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `PLENÁRIA — atributos e Poder de ${totalParlamentares} parlamentares brasileiros`,
    description:
      `Atributos derivados da atividade parlamentar (autorias, presença em votações, relatorias, tramitação e gasto de cota) de ${totalParlamentares} deputados e senadores em exercício, normalizados por percentil dentro de cada casa. Fórmula pública e auditável.`,
    url: `${SITE_URL}/como-calculamos/`,
    inLanguage: 'pt-BR',
    creator: PUBLISHER,
    publisher: PUBLISHER,
    dateModified: meta.updatedAt,
    isBasedOn: [
      'https://dadosabertos.camara.leg.br/',
      'https://legis.senado.leg.br/dadosabertos/',
    ],
    distribution: [{
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: `${SITE_URL}/data/index.json`,
    }],
  };
}

/** Só emita onde o caminho existe na UI — foi por isso que a ficha ganhou o link
 *  da UF. */
export function breadcrumbLd(trilha: { nome: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ nome: 'Início', path: '/' }, ...trilha].map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.nome,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
