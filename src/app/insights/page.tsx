import type { Metadata } from 'next';
import { InsightsShell, buildSectionNodes } from './sections';

export const metadata: Metadata = { title: 'Insights', alternates: { canonical: '/insights/' } };

/**
 * Dashboard de Insights — dados 100% pré-computados no build (data/insights.json).
 * Cada seção é uma ROTA própria (ver ./sections.tsx): esta é o índice (Panorama);
 * as demais vivem em /insights/[secao]. O mapa é página à parte (/mapa) e os
 * títulos ganharam galeria dedicada (/titulos).
 */
export default function InsightsPage() {
  const nodes = buildSectionNodes();
  return <InsightsShell activeId="panorama">{nodes.panorama}</InsightsShell>;
}
