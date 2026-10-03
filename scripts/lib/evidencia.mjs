/**
 * Evidência dos títulos VERMELHOS: o número BRUTO do parlamentar ao lado da
 * mediana da própria casa.
 *
 * Por que existe: os atributos são percentis DENTRO da casa, mas um selo vermelho
 * faz uma acusação ABSOLUTA ("é fantasma", "gasta demais"). Sozinho, o rótulo é
 * uma afirmação de fato que o parlamentar pode contestar; acompanhado do número
 * que o gerou e da referência da casa, é conclusão fundamentada em dado público —
 * e o leitor consegue discordar do critério vendo o mesmo número que nós vimos.
 * Só os vermelhos têm evidência: um selo elogioso não acusa ninguém.
 *
 * O texto é gerado no PIPELINE (não na UI) porque depende da mediana da casa,
 * que a página não tem. Cuidado ao mexer: a frase precisa continuar dizendo o
 * mesmo que a regra do título — se o gate mudar, a evidência muda junto.
 */

import { PISO_MESES_RITMO } from './exercicio.mjs';

const nf = new Intl.NumberFormat('pt-BR');
const pct = (x) => `${Math.round(x * 100)}%`;
const ritmo = (x) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// com artigo: as frases dizem "mediana DA Câmara" / "mediana DO Senado"
const daCasa = (casa) => (casa === 'senado' ? 'do Senado' : 'da Câmara');
const naCasa = (casa) => (casa === 'senado' ? 'no Senado' : 'na Câmara');

/** mediana de uma lista de números (ignora nulos/NaN); null se não houver dado */
export function mediana(valores) {
  const v = valores.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Referências da casa usadas nas frases. `pessoas` são os registros já montados
 * (com `bruto`), de UMA casa só — misturar as duas produziria a comparação errada.
 */
export function referenciasDaCasa(pessoas) {
  const relatorias = pessoas.reduce((t, p) => t + (p.relatoriasN ?? 0), 0);
  const avancadas = pessoas.reduce((t, p) => t + (p.relatoriasAvancadasN ?? 0), 0);
  return {
    comparecimento: mediana(pessoas.map((p) => p.bruto?.comparecimento)),
    gastoMes: mediana(pessoas.map((p) => p.bruto?.gastoMes)),
    proposicoes: mediana(pessoas.map((p) => p.bruto?.proposicoes)),
    proposicoesMes: mediana(pessoas.map((p) => p.bruto?.proposicoesMes)),
    // taxa AGREGADA (não mediana): "de cada 100 relatorias da casa, quantas andaram"
    relatoriaAvanco: relatorias ? avancadas / relatorias : null,
  };
}

// "Registrou voto", não "compareceu": o numerador é voto efetivo nas DUAS casas
// (o bulk da Câmara só traz isso, e o Senado passou a descontar o P-NRV).
const comparecimentoTxt = (b, ref, casa) =>
  `Registrou voto em ${pct(b.comparecimento)} das votações nominais ocorridas no seu exercício` +
  `${b.votos != null && b.votacoes != null ? ` (${nf.format(b.votos)} de ${nf.format(b.votacoes)})` : ''}` +
  `${ref.comparecimento != null ? ` — mediana ${daCasa(casa)}: ${pct(ref.comparecimento)}` : ''}.`;

const entregaTxt = (b) =>
  b.eficTocou
    ? `Das ${nf.format(b.eficTocou)} matérias que tocou (autoria ou relatoria), ` +
      `${b.eficAndou === 1 ? '1 avançou' : `${nf.format(b.eficAndou)} avançaram`} na tramitação ` +
      `(${pct(b.eficAndou / b.eficTocou)}).`
    : 'Não consta autoria nem relatoria de matéria relevante no período.';

/**
 * @param p registro do parlamentar já com `titles`, `bruto`, `relatoriasN` etc.
 * @param ref saída de `referenciasDaCasa` para a casa DELE
 * @returns { [slug]: frase } — só para os títulos vermelhos que ele tem
 */
export function evidenciaDeTitulos(p, ref) {
  const b = p.bruto ?? {};
  const casa = p.casa;
  const t = new Set(p.titles ?? []);
  const ev = {};

  if (t.has('fantasma-do-plenario') && b.comparecimento != null) {
    ev['fantasma-do-plenario'] = comparecimentoTxt(b, ref, casa);
  }

  if (t.has('nobre-gastador') && b.gastoMes != null) {
    ev['nobre-gastador'] =
      `Média de R$ ${nf.format(Math.round(b.gastoMes / 1000))} mil/mês de cota nos meses em exercício` +
      `${ref.gastoMes != null ? ` — mediana ${daCasa(casa)}: R$ ${nf.format(Math.round(ref.gastoMes / 1000))} mil/mês` : ''}. ` +
      entregaTxt(b);
  }

  if (t.has('blogueiro-de-plenario')) {
    // O gate dispara por Ataque OU Stamina — a frase mostra os dois eixos, para
    // que o leitor veja também aquele em que o parlamentar NÃO está mal.
    const partes = [];
    if (b.seguidores != null) partes.push(`${nf.format(b.seguidores)} seguidores no Instagram`);
    if (b.proposicoes != null && b.exercicioParcial && b.proposicoesMes != null) {
      // Esteve fora parte da legislatura: o Ataque que disparou o gate é o RITMO no
      // exercício, então comparar o total com a mediana de quem esteve sentado o tempo
      // todo diria outra coisa que a regra (ver lib/exercicio.mjs).
      partes.push(
        `${nf.format(b.proposicoes)} proposições relevantes apresentadas em ${nf.format(Math.round(b.mesesExercicio))} meses em exercício, ` +
        // abaixo do piso o divisor da nota é o piso, não os meses — dizer "por mês" sem
        // isso publicaria um ritmo que não é a divisão que o leitor faz de cabeça
        `${ritmo(b.proposicoesMes)} por mês${b.mesesExercicio < PISO_MESES_RITMO ? ` contado sobre o piso de ${PISO_MESES_RITMO} meses` : ''}` +
        `${ref.proposicoesMes != null ? ` (mediana ${daCasa(casa)}: ${ritmo(ref.proposicoesMes)} por mês)` : ''}`,
      );
    } else if (b.proposicoes != null) {
      partes.push(
        `${nf.format(b.proposicoes)} proposições relevantes apresentadas` +
        `${ref.proposicoes != null ? ` (mediana ${daCasa(casa)}: ${nf.format(ref.proposicoes)})` : ''}`,
      );
    }
    if (b.comparecimento != null) {
      partes.push(
        `${pct(b.comparecimento)} das votações com voto registrado` +
        `${ref.comparecimento != null ? ` (mediana: ${pct(ref.comparecimento)})` : ''}`,
      );
    }
    if (partes.length) ev['blogueiro-de-plenario'] = `${partes.join(' · ')}.`;
  }

  if (t.has('relator-de-gaveta') && p.relatoriasN) {
    ev['relator-de-gaveta'] =
      `Relator designado em ${nf.format(p.relatoriasN)} matérias relevantes; nenhuma avançou na tramitação` +
      `${ref.relatoriaAvanco != null ? ` — ${naCasa(casa)}, ${pct(ref.relatoriaAvanco)} das relatorias avançam` : ''}.`;
  }

  return ev;
}
