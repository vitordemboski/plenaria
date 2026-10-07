import type { Casa, ResultadoEleicao } from './types';
import * as t from '../../scripts/lib/eleicao-texto.mjs';

/**
 * Textos do resultado de 2026 — tipados para o site. A redação vive em
 * scripts/lib/eleicao-texto.mjs, que o make-og.mjs também lê: ficha, cards, filtro e
 * imagens dizem a mesma frase. Estado factual, como partido e UF — não julga, não pontua.
 */
type Sexo = 'M' | 'F' | null | undefined;

export const chipEleicao = (e: ResultadoEleicao | undefined, casa: Casa): string | null => t.chipCurto(e, casa);
export const motivoSaida = (e: ResultadoEleicao, sexo?: Sexo): string => t.motivoSaida(e, sexo);
export const resumoEleicao = (e: ResultadoEleicao, casa: Casa, sexo?: Sexo): string => t.resumo(e, casa, sexo);
export const explicaEleicao = (e: ResultadoEleicao, casa: Casa, sexo?: Sexo): string => t.explica(e, casa, sexo);
export const linhaEleicaoShare = (e: ResultadoEleicao, casa: Casa, sexo?: Sexo): string => t.linhaShare(e, casa, sexo);
