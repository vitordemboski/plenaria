import Link from 'next/link';
import { notFound } from 'next/navigation';
import { politicians, casaLabel, foraDoRanking, licenciadosDaUf } from '@/lib/data';
import { Licenciados } from '@/components/Licenciados';
import { PoliticianLink } from '@/components/PoliticianLink';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';
import { UF_NOME } from '@/lib/uf';

/**
 * Página do estado — a bancada completa da UF (deputados + senadores)
 * ordenada por Poder. Uma página estática por UF presente nos dados.
 */
export function generateStaticParams() {
  return [...new Set(politicians.map((p) => p.uf))].map((uf) => ({ uf }));
}

export async function generateMetadata({ params }: { params: Promise<{ uf: string }> }) {
  const { uf } = await params;
  const nome = UF_NOME[uf] ?? uf;
  const n = politicians.filter((p) => p.uf === uf).length;
  return pageMeta({
    title: nome,
    description: `Os ${n} parlamentares de ${nome} — deputados e senadores — ranqueados por Poder, com tier, atributos e títulos de cada um.`,
    path: `/estado/${uf}/`,
  });
}

export default async function StatePage({ params }: { params: Promise<{ uf: string }> }) {
  const { uf } = await params;
  const daUf = politicians.filter((p) => p.uf === uf);
  if (!daUf.length) notFound();
  // fora do ranking (mandato recente ou presidência da Casa) fica listado à parte
  const bancada = daUf.filter((p) => !foraDoRanking(p)).sort((a, b) => b.ops - a.ops);
  const parciais = daUf.filter(foraDoRanking);

  const opsMedio = bancada.length ? Math.round(bancada.reduce((s, p) => s + p.ops, 0) / bancada.length) : 0;

  const nomeUf = UF_NOME[uf] ?? uf;

  return (
    <main>
      <JsonLd data={breadcrumbLd([{ nome: nomeUf, path: `/estado/${uf}/` }])} />
      <div className="page-title">
        <h1>{nomeUf.toUpperCase()}</h1>
        <p>{bancada.length} parlamentares · Poder médio da bancada: {opsMedio}</p>
      </div>

      <div className="panel" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h3>Bancada de {uf}</h3>
        <div className="sub">Deputados e senadores ordenados por Poder</div>
        {bancada.map((p, i) => (
          <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
            <span className="pos">{i + 1}</span>
            <span className="nm">
              <b>{p.nome}</b>
              <small>{casaLabel(p.casa, true)} · {p.partido}</small>
            </span>
            <span className={`badge ${['S', 'A'].includes(p.tier) ? 'green' : ['D', 'F'].includes(p.tier) ? 'red' : 'purple'}`}>Tier {p.tier}</span>
            <span className="sc" style={{ color: 'var(--gold-2)' }}>{p.ops}</span>
          </PoliticianLink>
        ))}
        {parciais.length > 0 && (
          <>
            <div className="sub" style={{ margin: '18px 0 8px' }}>
              🕓 Fora do ranking (sem Tier — mandato recente ou presidência da Casa)
            </div>
            {parciais.map((p) => (
              <PoliticianLink key={p.slug} slug={p.slug} className="lrow">
                <span className="pos">—</span>
                <span className="nm"><b>{p.nome}</b><small>{casaLabel(p.casa, true)} · {p.partido}</small></span>
                <span className="badge purple">sem Tier</span>
                <span className="sc" style={{ color: 'var(--muted)' }}>—</span>
              </PoliticianLink>
            ))}
          </>
        )}
        {/* A bancada é quem está EM EXERCÍCIO — é isso que as fontes oficiais publicam.
            Sem isto, o licenciado some da lista do estado dele sem explicação nenhuma e a
            ausência parece falha nossa. Com licenciado na UF, o bloco os NOMEIA (e já traz
            a explicação); sem nenhum, a regra ainda é dita — ela vale para toda UF. */}
        {licenciadosDaUf(uf).length > 0 ? (
          <Licenciados lista={licenciadosDaUf(uf)} escopo="uf" />
        ) : (
          <p className="sub" style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            Esta é a bancada <b>em exercício</b>: parlamentar licenciado sai da lista oficial da Câmara/Senado e
            não tem ficha aqui; quem consta na cadeira é o suplente empossado.{' '}
            <Link href="/como-calculamos/#licenciados" style={{ color: 'var(--gold-2)', textDecoration: 'underline' }}>
              Por que
            </Link>.
          </p>
        )}
      </div>
    </main>
  );
}
