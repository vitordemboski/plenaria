import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InsightsShell, buildSectionNodes, availableSectionIds, SECTION_META, sectionDesc } from '../sections';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';

/**
 * Uma seção do Insights por rota (Atributos, Guildas, Gasto × Entrega, Perfil,
 * Governo, Títulos) — o Panorama é o índice /insights. Cada rota é pré-renderizada,
 * então trocar de seção é navegação real (page view próprio, <title> e URL
 * compartilhável) sem abrir mão do "tudo é estático".
 */
export function generateStaticParams() {
  return availableSectionIds().filter((id) => id !== 'panorama').map((secao) => ({ secao }));
}

export async function generateMetadata({ params }: { params: Promise<{ secao: string }> }): Promise<Metadata> {
  const { secao } = await params;
  const s = SECTION_META.find((m) => m.id === secao);
  return pageMeta({
    title: s ? `Insights · ${s.title}` : 'Insights',
    description: sectionDesc(secao) || sectionDesc('panorama'),
    path: `/insights/${secao}/`,
  });
}

export default async function InsightsSecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params;
  const nodes = buildSectionNodes();
  const node = nodes[secao];
  if (!node || secao === 'panorama') notFound();
  const s = SECTION_META.find((m) => m.id === secao);
  return (
    <InsightsShell activeId={secao}>
      <JsonLd data={breadcrumbLd([
        { nome: 'Insights', path: '/insights/' },
        { nome: s?.title ?? secao, path: `/insights/${secao}/` },
      ])} />
      {node}
    </InsightsShell>
  );
}
