import { chipEleicao, explicaEleicao } from '@/lib/eleicao';
import type { Casa, ResultadoEleicao } from '@/lib/types';

/** Chip do resultado de 2026 no card da lista — só para quem sai, muda de casa ou
 *  está no 2º turno. Neutro de propósito: sair não é mérito nem falta. Sem afirmação
 *  (campo ausente) não renderiza nada (ver scripts/lib/resultado2026.mjs). */
export function EleicaoMini({ e, casa }: { e?: ResultadoEleicao; casa: Casa }) {
  const chip = chipEleicao(e, casa);
  if (!e || !chip) return null;
  return <em className="cand-mini" title={explicaEleicao(e, casa)}>{chip}</em>;
}
