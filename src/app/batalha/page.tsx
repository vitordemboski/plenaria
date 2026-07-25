import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BattleClient } from './BattleClient';

export const metadata: Metadata = { title: 'Batalha', alternates: { canonical: '/batalha/' } };

/**
 * Modo Batalha — única página com interatividade real (ilha client).
 * O índice slim de políticos vem de /data/index.json (estático, cacheável
 * de forma imutável); o resto do site continua sem JS de dados.
 */
export default function BattlePage() {
  return (
    <main>
      <div className="page-title">
        <h2>⚔ BATALHA ⚔</h2>
        <p>Político 1v1 ou Guilda vs Guilda — cada atributo é um round</p>
      </div>
      <Suspense fallback={<p style={{ textAlign: 'center', color: 'var(--muted)' }}>Preparando arena…</p>}>
        <BattleClient />
      </Suspense>
    </main>
  );
}
