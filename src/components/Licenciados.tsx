import Link from 'next/link';
import { dataBR, casaLabel } from '@/lib/data';
import type { Licenciado } from '@/lib/types';

/**
 * Bloco "quem está faltando aqui" — os titulares licenciados do mandato.
 *
 * NÃO é uma variação do bloco "fora do ranking": aquele lista quem tem ficha e
 * dado, só não tem Tier; este lista quem não tem ficha nenhuma, porque a fonte
 * oficial deixa de publicar a atividade de quem se afasta. Daí o ícone diferente
 * (⏸, não 🕓) — os dois blocos aparecem lado a lado na página da guilda.
 *
 * O que se pode afirmar aqui é NOME e DATA, nada mais: nenhuma das duas casas
 * publica o motivo da licença (o `descricaoStatus` da Câmara vem vazio até para
 * quem assumiu ministério). Não escreva "assumiu o governo/ministério" aqui —
 * seria imputar um motivo que o dado não tem, contra a regra do projeto de que
 * todo rótulo é derivável da fonte.
 *
 * `escopo` muda só a segunda linha de cada item: na guilda o partido é redundante
 * (é a página dele), no estado a UF é.
 */
export function Licenciados({ lista, escopo }: { lista: Licenciado[]; escopo: 'guilda' | 'uf' }) {
  if (!lista.length) return null;

  return (
    <div className="lic">
      <div className="sub">⏸ Licenciados do mandato — sem ficha no site</div>
      {lista.map((l) => (
        <div key={`${l.casa}-${l.nome}`} className="lic-row">
          <span className="nm">
            <b>{l.nome}</b>
            <small>{casaLabel(l.casa, true)} · {escopo === 'guilda' ? l.uf : l.partido}</small>
          </span>
          <span className="lic-desde">desde {dataBR(l.desde)}</span>
        </div>
      ))}
      <p className="lic-nota">
        Parlamentar licenciado sai da lista oficial da Câmara/Senado e deixa de ter atividade publicada — por
        isso não tem carta, atributos nem Tier aqui. Quem ocupa a cadeira é o suplente empossado, esse sim no
        ranking.{' '}
        <Link href="/como-calculamos/#licenciados">Por que</Link>.
      </p>
    </div>
  );
}
