import { rotuloCurtoCandidatura, explicaCandidatura } from '@/lib/candidatura';
import type { Candidatura, Casa } from '@/lib/types';

/** Chip de candidatura no card da lista. Sem registro correspondido não renderiza
 *  nada: o site não afirma a ausência (ver scripts/lib/candidatura.mjs). Neutro de
 *  propósito — sem verde nem vermelho. */
export function CandMini({ c, casa, uf }: { c?: Candidatura; casa: Casa; uf: string }) {
  if (!c) return null;
  return (
    <em className="cand-mini" title={explicaCandidatura(c, casa, uf)}>
      🗳️ {rotuloCurtoCandidatura(c)}
    </em>
  );
}
