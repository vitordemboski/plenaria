import { Suspense } from 'react';
import { BattleClient } from './BattleClient';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Batalha',
  description: 'Dois parlamentares (ou duas guildas) frente a frente: cada atributo é um round, decidido pelos números oficiais. Determinístico — não há voto nem palpite.',
  path: '/batalha/',
});

/**
 * Modo Batalha — única página com interatividade real (ilha client).
 * O índice slim de políticos vem de /data/index.json (estático, cacheável
 * de forma imutável); o resto do site continua sem JS de dados.
 */
export default function BattlePage() {
  return (
    <main>
      <div className="page-title">
        <h1>⚔ BATALHA ⚔</h1>
        <p>Político 1v1 ou Guilda vs Guilda — cada atributo é um round</p>
      </div>
      <Suspense fallback={<p style={{ textAlign: 'center', color: 'var(--muted)' }}>Preparando arena…</p>}>
        <BattleClient />
      </Suspense>
    </main>
  );
}
