import type { Metadata } from 'next';
import { politicians, meta, foraDoRanking } from '@/lib/data';
import { ReadingDisclaimer } from '@/components/ReadingDisclaimer';
import { TierListClient, type TierListEntry } from '@/components/TierListClient';

export const metadata: Metadata = { alternates: { canonical: '/' } };

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
      <div className="page-title">
        <h2>TIER LIST</h2>
        <p>Deputados e Senadores ranqueados pelo Poder</p>
      </div>
      <ReadingDisclaimer className="home" />
      <TierListClient list={list} />
    </main>
  );
}
