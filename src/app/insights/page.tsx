import { InsightsShell, buildSectionNodes, sectionDesc } from './sections';
import { pageMeta } from '@/lib/seo';

// mesma descrição do Panorama (esta rota É o Panorama) — vem do SECTION_META p/ não divergir
export const metadata = pageMeta({
  title: 'Insights',
  description: sectionDesc('panorama'),
  path: '/insights/',
});

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
