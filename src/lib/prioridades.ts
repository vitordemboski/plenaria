/**
 * "No que trabalha" — agregação das prioridades para guilda, casa e Congresso.
 *
 * Os números por parlamentar já vêm prontos do gerador (`p.prioridades`); o que
 * se faz aqui é somar bancadas, como a página da guilda já faz com o
 * `brutoDaGuilda`. Tudo em build-time: nenhuma destas funções roda no navegador.
 *
 * INFORMATIVO em todas as superfícies: prioridade não pontua no Poder, não gera
 * Tier e não gera título. E nenhuma cor de bom/ruim acompanha as barras —
 * legislar sobre Defesa não é melhor nem pior que legislar sobre Saúde, e pintar
 * isso seria a plataforma tomando partido pela paleta (o mesmo motivo pelo qual
 * as famílias neutras do mapa têm `higherIsBetter: null`).
 */
import { agregarPrioridades, percentuaisPorTema, assinatura } from '../../scripts/lib/temas.mjs';
import { analiseDe, alvoGuilda, alvoNacional } from '../../scripts/lib/analises.mjs';
import analisesJson from '../../data/analises.json';
import { politicians } from './data';
import type { Analise, Casa, Politician } from './types';

export const analises = analisesJson as Analise[];

export interface AgregadoTemas {
  temas: { tema: string; n: number; pct: number }[];
  nComTema: number;
  nSemTema: number;
  nParlamentares: number;
  temasPorProposicao: number;
}

export interface LinhaAssinatura {
  tema: string; n: number; pct: number; pctNacional: number; desvio: number;
}

const agregar = (lista: Politician[]): AgregadoTemas => agregarPrioridades(lista) as AgregadoTemas;

/**
 * O Congresso inteiro — a referência contra a qual a assinatura de cada guilda é
 * medida. As DUAS casas juntas de propósito: uma guilda tem bancada mista, e a
 * métrica é fatia de proposições (soma ÷ soma), não um percentil por casa. A
 * quebra por casa existe logo abaixo para o leitor ver que "nacional" é dominado
 * pela Câmara — são 513 deputados contra 81 senadores.
 */
export const prioridadesNacionais = agregar(politicians);

export const prioridadesPorCasa: Record<Casa, AgregadoTemas> = {
  camara: agregar(politicians.filter((p) => p.casa === 'camara')),
  senado: agregar(politicians.filter((p) => p.casa === 'senado')),
};

const pctNacional = percentuaisPorTema(prioridadesNacionais);

/**
 * Prioridades de uma bancada + sua ASSINATURA.
 *
 * A assinatura não é enfeite: medido na legislatura, o top-3 ABSOLUTO de 7 dos 8
 * maiores partidos contém "Administração Pública" e/ou "Direitos Humanos e
 * Minorias", que dominam o Congresso inteiro — um ranking absoluto por guilda
 * pareceria funcionar e não distinguiria bancada nenhuma. O desvio distingue.
 *
 * Inclui quem está fora do ranking (mandato parcial, presidência): aqui ninguém
 * é comparado com ninguém — descreve-se o que a bancada apresentou, e quem
 * apresentou pouco pesa pouco, porque a conta é soma ÷ soma.
 */
export function prioridadesDaGuilda(sigla: string) {
  const bancada = politicians.filter((p) => p.partido === sigla);
  const agregado = agregar(bancada);
  return {
    agregado,
    assinatura: assinatura(agregado.temas, agregado.nComTema, pctNacional) as LinhaAssinatura[],
  };
}

/** guildas ordenadas pelo maior desvio positivo — o ranking da /insights */
export function assinaturasDasGuildas(siglas: string[], minParlamentares = 5) {
  return siglas
    .map((sigla) => ({ sigla, ...prioridadesDaGuilda(sigla) }))
    // bancada minúscula produz desvios enormes por acidente aritmético: um
    // deputado com 3 proposições de Turismo viraria "a guilda do Turismo"
    .filter((g) => g.agregado.nParlamentares >= minParlamentares && g.assinatura.length)
    .map((g) => ({ ...g, topo: g.assinatura[0] }))
    .sort((a, b) => b.topo.desvio - a.topo.desvio);
}

/**
 * A análise de IA deste alvo, se ela ainda descreve os números atuais.
 * Hash diferente → null, e a página mostra só as barras. Ver analises.mjs.
 */
export function analiseDaGuilda(sigla: string, agregado: AgregadoTemas): Analise | null {
  return analiseDe(analises, alvoGuilda(sigla), agregado) as Analise | null;
}
export function analiseNacional(agregado: AgregadoTemas): Analise | null {
  return analiseDe(analises, alvoNacional(), agregado) as Analise | null;
}
