/**
 * "Virou lei" — identificação da NORMA gerada por uma proposição.
 *
 * A proposição tem nome ("PL 358/2025"); a norma tem outro ("Lei 15.172/2025").
 * São coisas diferentes, e é a segunda que o leitor reconhece. Cada casa a publica
 * de um jeito:
 *
 * - **Senado**: campo estruturado `normaGerada` do `/processo` ("Lei nº 15.042 de
 *   11/12/2024"), vocabulário fechado (Lei, Lei Complementar, Emenda Constitucional,
 *   Decreto Legislativo). Parse trivial e confiável.
 * - **Câmara**: NÃO existe campo. O `urnFinal` do bulk e da API vem sempre vazio
 *   (conferido nos dois). O número da norma só aparece em PROSA, no despacho da
 *   tramitação que registrou a transformação — e não no `ultimoStatus_despacho` do
 *   bulk: medido na legislatura, só 78 de 793 proposições transformadas (9,8%)
 *   tinham o número no último despacho, porque depois de virar lei a matéria segue
 *   tramitando (ofícios, autógrafos, retificações) e o último despacho fala de outra
 *   coisa. É preciso varrer TODAS as tramitações atrás do despacho certo.
 *
 * Regra dura: **o número da norma é OMITIDO quando não casa, nunca estimado.** A
 * ficha cai para a identificação da proposição, que sempre existe. Mesmo princípio
 * da frase de evidência dos títulos vermelhos.
 */

/** tipos de norma que o Congresso gera a partir de PL/PLP/PEC/PDL. Ordem importa
 *  no regex: "lei complementar" precisa ser testado antes de "lei". */
const TIPOS = [
  'lei complementar',
  'lei ordinária',
  'lei delegada',
  'emenda constitucional',
  'decreto legislativo',
  'lei',
];

/** "Lei Ordinária" é o nome interno do tipo; a norma publicada se chama só "Lei". */
const ROTULO_TIPO = {
  'lei ordinária': 'Lei',
  'lei': 'Lei',
  'lei complementar': 'Lei Complementar',
  'lei delegada': 'Lei Delegada',
  'emenda constitucional': 'Emenda Constitucional',
  'decreto legislativo': 'Decreto Legislativo',
};

const RE_DESPACHO = new RegExp(
  // "Transformado na Lei Ordinária 15172/2025." · "Transformada no Decreto Legislativo nº 12/2024"
  String.raw`transformad[oa]\s+n[oa]\s+(${TIPOS.join('|')})\s*` +
  String.raw`n?[º°o.]*\s*([\d.]+)\s*(?:\/|\s+de\s+)\s*(?:\d{2}\/\d{2}\/)?(\d{4})`,
  'i',
);

const RE_SENADO = new RegExp(
  // "Lei nº 15.042 de 11/12/2024"
  String.raw`^\s*(${TIPOS.join('|')})\s*n?[º°o.]*\s*([\d.]+)\s+de\s+(\d{2})\/(\d{2})\/(\d{4})`,
  'i',
);

/** número com separador de milhar pt-BR, a partir do que veio na fonte ("15172"
 *  ou "15.042" — as duas grafias circulam) */
function formataNumero(bruto) {
  const n = Number(String(bruto).replace(/\./g, ''));
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : String(bruto);
}

const rotulo = (tipo, numero, ano) =>
  `${ROTULO_TIPO[tipo.toLowerCase()] ?? tipo} ${formataNumero(numero)}/${ano}`;

/**
 * Despacho de tramitação da Câmara → rótulo da norma, ou `null`.
 * @param {string|null|undefined} despacho
 * @returns {string|null} ex.: "Lei 15.172/2025"
 */
export function normaDoDespacho(despacho) {
  const m = RE_DESPACHO.exec(despacho ?? '');
  return m ? rotulo(m[1], m[2], m[3]) : null;
}

/**
 * `normaGerada` do /processo do Senado → rótulo + data da norma.
 * @param {string|null|undefined} normaGerada ex.: "Lei nº 15.042 de 11/12/2024"
 * @returns {{ norma: string, data: string }|null} data em ISO (AAAA-MM-DD)
 */
export function normaDoSenado(normaGerada) {
  const m = RE_SENADO.exec(normaGerada ?? '');
  if (!m) return null;
  const [, tipo, numero, dia, mes, ano] = m;
  return { norma: rotulo(tipo, numero, ano), data: `${ano}-${mes}-${dia}` };
}

/**
 * Ementa cortada em limite de PALAVRA, com reticências.
 *
 * As ementas do Congresso passam de 400 caracteres (a de uma PEC lista todos os
 * artigos que altera). Cortar no meio da palavra parece dado corrompido; cortar
 * na palavra parece resumo — e o link para o texto oficial fica ao lado.
 * @param {string} ementa
 * @param {number} max
 */
export function resumoEmenta(ementa, max = 260) {
  const s = String(ementa ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const corte = s.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[,;.\s]+$/, '')}…`;
}

/** página oficial da proposição — a prova auditável ao lado de cada linha */
export const urlProposicaoCamara = (id) => `https://www.camara.leg.br/propostas-legislativas/${id}`;
export const urlMateriaSenado = (codigo) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}`;

/**
 * Ordena leis da mais recente para a mais antiga. Sem data conhecida vai para o
 * FIM (nunca para o topo): a lista se lê como cronologia, e a ausência de data não
 * pode se disfarçar de "acabou de sair".
 */
export function ordenaLeis(leis) {
  return [...leis].sort((a, b) => {
    if (a.data && b.data) return b.data.localeCompare(a.data);
    if (a.data) return -1;
    if (b.data) return 1;
    return a.ref.localeCompare(b.ref, 'pt-BR');
  });
}
