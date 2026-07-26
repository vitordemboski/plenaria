import { notFound } from 'next/navigation';
import { politicians, titleDefs, getTitle, casaLabel, meta } from '@/lib/data';
import type { StatKey } from '@/lib/types';
import { PoliticianLink } from '@/components/PoliticianLink';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';

/**
 * Página de título — lista todos os parlamentares que carregam o título,
 * com a regra factual no topo. generateStaticParams pré-renderiza uma
 * página por título definido em title-defs.json (o meta decide quais existem).
 */
export function generateStaticParams() {
  return titleDefs.map((t) => ({ slug: t.slug }));
}

/** Tira o emoji inicial do label ("🔒 Guardião do Cofre" → "Guardião do Cofre").
 *  O emoji é a identidade visual do título nas badges, mas no <title> da aba ele
 *  seria só um glifo que muda de desenho por plataforma. Remove tudo antes da 1ª
 *  letra/dígito, então um label sem emoji passa intacto. */
const semEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '');

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTitle(slug);
  if (!t) return {};
  // A description descreve a PÁGINA, não é a regra: como regra (467 chars no
  // "Blogueiro de Plenário") o Google cortava em ~155, justo antes da cláusula que
  // absolve — selo vermelho sem a parte que o limita é acusação descontextualizada.
  // A regra íntegra fica no topo da página.
  const n = politicians.filter((p) => p.titles.includes(slug)).length;
  const quantos = n === 1 ? '1 parlamentar carrega' : `${n} parlamentares carregam`;
  const label = semEmoji(t.label);
  return pageMeta({
    title: label,
    description: `${quantos} o título ${label} na legislatura atual. Veja a regra factual completa que o dispara e o número bruto de cada um.`,
    path: `/titulo/${slug}/`,
  });
}

// atributo cujo dado bruto explica o título — vira a linha factual de cada parlamentar
const RAW_KEY: Record<string, StatKey> = {
  'blogueiro-de-plenario': 'influencia',
  'nobre-gastador': 'economia',
  'guardiao-do-cofre': 'economia',
  'dragao-do-tesouro': 'economia',
  'fantasma-do-plenario': 'stamina',
  'cacador-de-votos': 'stamina',
};

export default async function TitlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const titulo = getTitle(slug);
  if (!titulo) notFound();

  const portadores = politicians
    .filter((p) => p.titles.includes(slug))
    .sort((a, b) => b.ops - a.ops);
  const rawKey = RAW_KEY[slug];

  return (
    <main>
      <JsonLd data={breadcrumbLd([
        { nome: 'Insights', path: '/insights/' },
        { nome: 'Títulos', path: '/insights/titulos/' },
        { nome: semEmoji(titulo.label), path: `/titulo/${slug}/` },
      ])} />
      <div className="page-title">
        <h1>{titulo.label.toUpperCase()}</h1>
        <p>{titulo.regra}</p>
      </div>

      <div className="brmap-info" style={{ maxWidth: 760, margin: '0 auto 18px' }}>
        ⚠︎ Título 100% factual — a regra acima é derivada integralmente dos dados abertos.
      </div>

      <div className="panel" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h3 style={{ color: titulo.cor === 'green' ? 'var(--gold-2)' : 'var(--red-soft)' }}>
          {portadores.length} {portadores.length === 1 ? 'parlamentar carrega' : 'parlamentares carregam'} este título
        </h3>
        <div className="sub">Ordenados por Poder</div>
        {portadores.map((p, i) => (
          <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
            <span className="pos">{i + 1}</span>
            <span className="nm">
              <b>{p.nome}</b>
              <small>
                {casaLabel(p.casa, true)} · {p.uf} · {p.partido}
                {rawKey && p.rawNumbers?.[rawKey] ? ` — ${p.rawNumbers[rawKey]}` : ''}
              </small>
            </span>
            <span className={`badge ${titulo.cor === 'green' ? 'green' : 'red'}`}>Tier {p.tier}</span>
            <span className="sc" style={{ color: titulo.cor === 'green' ? 'var(--gold-2)' : 'var(--red-soft)' }}>{p.ops}</span>
          </PoliticianLink>
        ))}
        {!portadores.length && <div className="sub">Ninguém carrega este título no momento.</div>}
      </div>
    </main>
  );
}
