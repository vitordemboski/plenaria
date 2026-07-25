import { notFound } from 'next/navigation';
import { politicians, casaLabel, foraDoRanking } from '@/lib/data';
import { PoliticianLink } from '@/components/PoliticianLink';

const UF_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins',
};

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
  return { title: nome, description: `A bancada de ${nome} ranqueada por Poder`, alternates: { canonical: `/estado/${uf}/` } };
}

export default async function StatePage({ params }: { params: Promise<{ uf: string }> }) {
  const { uf } = await params;
  const daUf = politicians.filter((p) => p.uf === uf);
  if (!daUf.length) notFound();
  // fora do ranking (mandato recente ou presidência da Casa) fica listado à parte
  const bancada = daUf.filter((p) => !foraDoRanking(p)).sort((a, b) => b.ops - a.ops);
  const parciais = daUf.filter(foraDoRanking);

  const opsMedio = bancada.length ? Math.round(bancada.reduce((s, p) => s + p.ops, 0) / bancada.length) : 0;

  return (
    <main>
      <div className="page-title">
        <h2>{(UF_NOME[uf] ?? uf).toUpperCase()}</h2>
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
      </div>
    </main>
  );
}
