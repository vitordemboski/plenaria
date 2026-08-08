/**
 * "Virou lei" agregado por bancada.
 *
 * Diferente das prioridades (soma ÷ soma) e dos atributos (média de percentis),
 * aqui a conta é uma SOMA SIMPLES de eventos: cada proposição transformada em
 * norma é um fato inteiro, não uma taxa. Por isso não há denominador de bancada —
 * "o PT emplacou 14 leis" é uma afirmação completa, e comparar guildas de tamanhos
 * diferentes é trabalho do leitor, com o nº de membros ao lado.
 *
 * Inclui quem está FORA do ranking (mandato parcial, presidência da Casa): aqui
 * ninguém é comparado com ninguém por percentil, e uma lei sancionada não deixa de
 * existir porque o autor tomou posse há pouco.
 */
import { agruparLeis } from '../../scripts/lib/leis-temas.mjs';
import { politicians } from './data';
import type { AgregadoLeis, Politician } from './types';

export interface LeisDaBancada {
  total: number;
  /** membros que emplacaram ao menos uma, do maior para o menor */
  autores: (Politician & { n: number })[];
  /** perfil temático das NORMAS da bancada, já deduplicado por proposição:
   *  autoria coletiva credita a mesma lei a vários membros, e sem a dedupe uma
   *  única lei de bancada viraria dezenas na barra */
  temas: AgregadoLeis;
}

export function leisDaGuilda(sigla: string): LeisDaBancada {
  const autores = politicians
    .filter((p) => p.partido === sigla && (p.leisAprovadas ?? 0) > 0)
    .map((p) => ({ ...p, n: p.leisAprovadas }))
    .sort((a, b) => (b.n - a.n) || (b.ops - a.ops));
  const leis = autores.flatMap((p) => p.leis ?? []);
  return {
    total: autores.reduce((s, p) => s + p.n, 0),
    autores,
    temas: agruparLeis(leis) as AgregadoLeis,
  };
}
