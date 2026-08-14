/**
 * Liderança de bancada — o cargo mais pesado da Casa depois da Presidência, e o
 * único que `/deputados/{id}/orgaos` NÃO publica: os 43 títulos que aquele endpoint
 * devolve vão de "Titular" a "Ouvidor-Geral" e não incluem um único "Líder". Sem
 * esta fonte, o Comando pintava de vermelho (< 40) 10 dos 21 líderes da Câmara —
 * o atributo que se chama "peso institucional" ignorava justamente o maior deles.
 *
 * A fonte é `composicao/lideranca` do Senado (UMA chamada), que cobre as DUAS casas
 * (`casa`: CD/SF/CN) e traz a composição VIGENTE — líder e vice de partido, bloco,
 * Governo, Maioria, Minoria, Oposição e Bancada Feminina.
 *
 * Três decisões que este módulo carrega:
 *
 * 1. **Vice-liderança é NOMEADA, não pontuada.** Medido: 163 dos 512 deputados (32%)
 *    e 19 dos 81 senadores são só-vice, e 104 dos 246 vices são de BLOCO na Câmara.
 *    Peso institucional que um terço da casa tem não distingue ninguém — daria a
 *    metade do Senado um bônus de "comando" por cargo distribuído aos montes.
 *
 * 2. **Representante NÃO é líder.** Bancada pequena demais para ter liderança indica
 *    um Representante (`siglaTipoLideranca: 'R'`), e a fonte usa a palavra diferente
 *    de propósito: ele não tem tempo de liderança nem assento no Colégio de Líderes.
 *    Cuidado: `/partidos/{id}` da Câmara devolve essa mesma pessoa dentro de
 *    `status.lider` — duas fontes oficiais, dois rótulos para o mesmo fato. Publicar
 *    "Líder" porque uma delas foi mais generosa seria escolher o rótulo, não lê-lo.
 *
 * 3. **O bônus é 3 UMA VEZ**, não 3 por liderança. Quem lidera o partido e o bloco
 *    que contém o partido (é o caso de 4 parlamentares hoje) exerce um poder, não
 *    dois — contar duas vezes seria somar a mesma cadeira consigo mesma.
 */

/** Bônus no Comando de quem exerce liderança — igual ao da presidência de comissão. */
export const PESO_LIDER = 3;

/** `siglaTipoLideranca` → papel. Vocabulário fechado; sigla nova é LOGADA, não adivinhada. */
const PAPEL = new Map([
  ['L', { papel: 'lider', rotulo: 'Líder' }],
  ['V', { papel: 'vice', rotulo: 'Vice-líder' }],
  ['1', { papel: 'vice', rotulo: '1º vice-líder' }],
  ['R', { papel: 'representante', rotulo: 'Representante' }],
]);

/**
 * `idTipoUnidadeLideranca` → o que se lidera + onde. É a chave estável: a sigla
 * (`siglaTipoUnidadeLideranca`) repete letra entre casas com sentidos diferentes
 * (`I` e `M` são ambos Minoria, em casas distintas) e o id não.
 *
 * `alvo: null` = a bancada é nomeada pelo partido/bloco do próprio registro, e `generico`
 * é o que se diz quando ela vem sem nome. Isso NÃO é ornamento: a liderança de bloco no
 * SENADO (id 2) chega sempre sem `siglaBloco` — a da Câmara (id 10) vem com. Sem esse
 * fallback, 6 senadores perdiam a liderança em silêncio, entre eles quatro líderes de
 * bloco. "Líder de Bloco no Senado" é o rótulo da própria fonte
 * (`descricaoTipoUnidadeLideranca`); o que falta é QUAL bloco, não se há liderança.
 */
const UNIDADE = new Map([
  [1, { alvo: null, generico: 'de Partido', onde: 'no Senado' }],
  [2, { alvo: null, generico: 'de Bloco', onde: 'no Senado' }],
  [3, { alvo: 'do Governo', onde: 'no Senado' }],
  [4, { alvo: 'da Maioria', onde: 'no Senado' }],
  [5, { alvo: 'da Minoria', onde: 'no Senado' }],
  [6, { alvo: 'do Governo', onde: 'no Congresso' }],
  [7, { alvo: 'da Maioria', onde: 'no Congresso' }],
  [8, { alvo: 'da Minoria', onde: 'no Congresso' }],
  [9, { alvo: null, generico: 'de Partido', onde: 'na Câmara' }],
  [10, { alvo: null, generico: 'de Bloco', onde: 'na Câmara' }],
  [11, { alvo: 'do Governo', onde: 'na Câmara' }],
  [12, { alvo: 'da Maioria', onde: 'na Câmara' }],
  [13, { alvo: 'da Minoria', onde: 'na Câmara' }],
  [14, { alvo: 'da Maioria', onde: 'no Congresso' }],
  [15, { alvo: 'da Minoria', onde: 'no Congresso' }],
  [17, { alvo: 'da Oposição', onde: 'no Senado' }],
  [18, { alvo: 'da Bancada Feminina', onde: 'no Senado' }],
  [24, { alvo: 'da Oposição', onde: 'no Congresso' }],
]);

const txt = (s) => (s ?? '').trim();

/**
 * Como se chama a bancada liderada. Sai do registro, mas não cru: a fonte grava em
 * `siglaBloco` a LISTA INTEIRA de partidos do bloco, e o maior da Câmara vira
 * "UNIÃO, PP, PSD, REPUBLICANOS, MDB, Federação PSDB CIDADANIA, PODE" — 60 caracteres
 * que não cabem na ficha nem informam. Acima de um partido, o que se publica é a
 * contagem, que é o dado que o leitor usa ("é o bloco grande").
 */
function nomeiaBancada(r, u) {
  const partido = txt(r?.siglaPartido);
  if (partido) return `do ${partido}`;

  const bloco = txt(r?.siglaBloco);
  if (!bloco) return u.generico;
  const partidos = bloco.split(',').map((s) => s.trim()).filter(Boolean);
  if (partidos.length > 1) return `de Bloco (${partidos.length} partidos)`;
  // "Federação PSDB CIDADANIA" já se autodescreve — "do Federação" seria agramatical
  return /^(bloco|federação)/i.test(bloco) ? `d${/^federação/i.test(bloco) ? 'a' : 'o'} ${bloco}` : `do Bloco ${bloco}`;
}

/** Código fora do vocabulário conhecido — a ingestão loga em vez de adivinhar. */
export const codigoDesconhecido = (r) =>
  !PAPEL.has(txt(r?.siglaTipoLideranca)) || !UNIDADE.has(Number(r?.idTipoUnidadeLideranca));

/**
 * Um registro de liderança → o que dá para publicar sobre ele.
 * @returns {{papel:'lider'|'vice'|'representante', rotulo:string, desde:string}|null}
 */
export function classificaLideranca(r) {
  const p = PAPEL.get(txt(r?.siglaTipoLideranca));
  const u = UNIDADE.get(Number(r?.idTipoUnidadeLideranca));
  if (!p || !u) return null;

  const nomeada = u.alvo ?? nomeiaBancada(r, u);
  if (!nomeada) return null;

  const desde = txt(r?.dataDesignacao);
  if (!desde) return null; // sem data não é publicável (mesma regra dos licenciados)

  return { papel: p.papel, rotulo: `${p.rotulo} ${nomeada} ${u.onde}`, desde };
}

/** Liderança já encerrada não é cargo atual. A fonte traz a composição vigente, mas
 *  publica o `dataTermino` do dia em que o cargo cai — sem isso o site afirma que
 *  alguém lidera uma bancada que já trocou de líder. */
export const vigente = (r, hoje) => !txt(r?.dataTermino) || txt(r.dataTermino) > hoje;

/**
 * Casa cada registro com um parlamentar da base.
 *
 * `codigoParlamentar` é sempre código do SISTEMA DO SENADO — inclusive nos registros
 * de deputado (Antonio Brito vem como 5221, que não é o id dele na Câmara). Por isso
 * o senador casa por id e o deputado casa por NOME. E o casamento por id exige que o
 * nome CONFIRA: o espaço de códigos é compartilhado entre as casas, então um código
 * de deputado pode cair em cima de um senador nosso sem que nada denuncie.
 *
 * @param {object[]} registros  payload de `composicao/lideranca`
 * @param {{casa:string,id:number,nome:string,slug:string}[]} parlamentares
 * @param {string} hoje  'YYYY-MM-DD'
 * Três motivos de descarte, LOGADOS SEPARADAMENTE — juntá-los num balde só fez o aviso
 * apontar a causa errada: 6 senadores caíram por falta do nome do bloco e o log dizia
 * "sem parlamentar na base", mandando investigar um match nominal que estava intacto.
 *
 * @returns {{porSlug: Map<string, {papel:string,rotulo:string,desde:string}[]>,
 *            semMatch: object[], semRotulo: object[], desconhecidos: object[]}}
 */
export function indexaLiderancas(registros, parlamentares, hoje) {
  const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();

  const senadorPorId = new Map();
  const deputadoPorNome = new Map();
  for (const p of parlamentares) {
    if (p.casa === 'senado') senadorPorId.set(p.id, p);
    else deputadoPorNome.set(norm(p.nome), p);
  }

  const porSlug = new Map();
  const semMatch = [];
  const semRotulo = [];
  const desconhecidos = [];

  for (const r of registros ?? []) {
    if (!vigente(r, hoje)) continue;
    if (codigoDesconhecido(r)) { desconhecidos.push(r); continue; }

    const nome = norm(r?.nomeParlamentar);
    const porId = senadorPorId.get(Number(r?.codigoParlamentar));
    // registro do SENADO: o código é a chave própria da casa, basta ele. Nos demais o
    // código é do sistema do Senado e pode cair sobre um senador nosso por acidente —
    // ali o nome tem de confirmar antes de a liderança ir para a ficha de outra pessoa.
    const alvo = r?.casa === 'SF'
      ? porId
      : (porId && norm(porId.nome) === nome ? porId : deputadoPorNome.get(nome));
    if (!alvo) { semMatch.push(r); continue; }

    const c = classificaLideranca(r);
    if (!c) { semRotulo.push(r); continue; }

    const lista = porSlug.get(alvo.slug) ?? [];
    // a fonte repete o mesmo cargo em registros distintos quando ele é redesignado
    if (!lista.some((x) => x.rotulo === c.rotulo)) lista.push(c);
    porSlug.set(alvo.slug, lista);
  }

  // líder primeiro: é o cargo que pontua e o que a ficha mostra em destaque
  const ordem = { lider: 0, representante: 1, vice: 2 };
  for (const lista of porSlug.values()) lista.sort((a, b) => ordem[a.papel] - ordem[b.papel]);

  return { porSlug, semMatch, semRotulo, desconhecidos };
}

/** Bônus no Comando: 3 para quem lidera, UMA vez. Vice e representante somam 0. */
export const pesoLideranca = (lids) =>
  (lids ?? []).some((l) => l.papel === 'lider') ? PESO_LIDER : 0;

/** Trecho do `rawNumbers.comando`. Vice aparece aqui mesmo sem pontuar — o cargo é
 *  fato público; o que ele não é é peso. */
export const textoLideranca = (lids) => (lids ?? []).map((l) => l.rotulo).join(' · ');
