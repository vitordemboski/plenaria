import { politicians, meta, foraDoRanking } from '@/lib/data';
import { ReadingDisclaimer } from '@/components/ReadingDisclaimer';
import { TierListClient, type TierListEntry } from '@/components/TierListClient';
import { JsonLd } from '@/components/JsonLd';
import { websiteLd } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';

// sem `title`: a home usa o título padrão do site (não leva o sufixo do template)
export const metadata = pageMeta({
  description: `Todos os ${politicians.length} deputados e senadores em exercício ranqueados por Poder, do Tier S ao F, a partir dos Dados Abertos da Câmara e do Senado.`,
  path: '/',
});

/**
 * Home — Tier List com busca e filtro Câmara/Senado.
 * A lista slim é serializada como props no build (continua export estático:
 * o HTML inicial já vem com todos os cards renderizados); busca/filtro são
 * a segunda ilha client do site, sem nenhum fetch em runtime.
 */
export default function Home() {
  // mandato parcial (posse recente) fica fora da Tier List — continua buscável na página
  const list: TierListEntry[] = politicians.filter((p) => !foraDoRanking(p)).map((p) => ({
    slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partido,
    tier: p.tier, ops: p.ops,
  }));

  return (
    <main>
      <JsonLd data={websiteLd()} />
      <div className="page-title">
        <h1>TIER LIST</h1>
        <p>Deputados e Senadores ranqueados pelo Poder</p>
      </div>
      <ReadingDisclaimer className="home" />
      <TierListClient list={list} />
    </main>
  );
}
