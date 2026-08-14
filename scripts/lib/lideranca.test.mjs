import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classificaLideranca, codigoDesconhecido, indexaLiderancas, pesoLideranca,
  textoLideranca, vigente, PESO_LIDER,
} from './lideranca.mjs';

const reg = (over = {}) => ({
  casa: 'CD',
  codigoParlamentar: 6141,
  nomeParlamentar: 'Sóstenes Cavalcante',
  siglaTipoLideranca: 'L',
  idTipoUnidadeLideranca: 9,
  siglaPartido: 'PL',
  dataDesignacao: '2023-02-01',
  ...over,
});

// ---------- classificação: código, nunca prosa ----------

test('líder de partido na Câmara', () => {
  assert.deepEqual(classificaLideranca(reg()),
    { papel: 'lider', rotulo: 'Líder do PL na Câmara', desde: '2023-02-01' });
});

test('federação é nomeada com o artigo certo — "do Federação" é agramatical', () => {
  const c = classificaLideranca(reg({
    idTipoUnidadeLideranca: 10, siglaPartido: undefined, siglaBloco: 'Federação PSDB CIDADANIA' }));
  assert.equal(c.rotulo, 'Líder da Federação PSDB CIDADANIA na Câmara');
});

test('bloco de nome próprio ganha a palavra "Bloco"', () => {
  assert.equal(classificaLideranca(reg({
    idTipoUnidadeLideranca: 10, siglaPartido: undefined, siglaBloco: 'Vanguarda' })).rotulo,
    'Líder do Bloco Vanguarda na Câmara');
  assert.equal(classificaLideranca(reg({
    idTipoUnidadeLideranca: 10, siglaPartido: undefined, siglaBloco: 'Bloco Vanguarda' })).rotulo,
    'Líder do Bloco Vanguarda na Câmara');
});

// A fonte grava em `siglaBloco` a lista inteira de partidos: o maior bloco da Câmara
// saía como "Vice-líder do UNIÃO, PP, PSD, REPUBLICANOS, MDB, Federação PSDB CIDADANIA,
// PODE na Câmara" — 60 caracteres que não cabem na ficha nem dizem nada ao leitor.
test('bloco com vários partidos vira contagem, não a lista inteira', () => {
  const c = classificaLideranca(reg({
    idTipoUnidadeLideranca: 10, siglaPartido: undefined,
    siglaBloco: 'UNIÃO, PP, PSD, REPUBLICANOS, MDB, Federação PSDB CIDADANIA, PODE' }));
  assert.equal(c.rotulo, 'Líder de Bloco (7 partidos) na Câmara');
});

test('Governo, Maioria, Minoria, Oposição e Bancada Feminina não dependem de partido', () => {
  const casos = [[11, 'Líder do Governo na Câmara'], [12, 'Líder da Maioria na Câmara'],
    [13, 'Líder da Minoria na Câmara'], [17, 'Líder da Oposição no Senado'],
    [18, 'Líder da Bancada Feminina no Senado'], [6, 'Líder do Governo no Congresso']];
  for (const [id, esperado] of casos) {
    const c = classificaLideranca(reg({ idTipoUnidadeLideranca: id, siglaPartido: undefined }));
    assert.equal(c.rotulo, esperado);
  }
});

test('vice-líder e 1º vice-líder são papel "vice"', () => {
  assert.equal(classificaLideranca(reg({ siglaTipoLideranca: 'V' })).papel, 'vice');
  assert.equal(classificaLideranca(reg({ siglaTipoLideranca: 'V' })).rotulo, 'Vice-líder do PL na Câmara');
  assert.equal(classificaLideranca(reg({ siglaTipoLideranca: '1' })).papel, 'vice');
  assert.equal(classificaLideranca(reg({ siglaTipoLideranca: '1' })).rotulo, '1º vice-líder do PL na Câmara');
});

// Bancada pequena demais para ter liderança indica um Representante. `/partidos/{id}`
// da Câmara devolve essa mesma pessoa como `status.lider` — publicar "Líder" seria
// escolher o rótulo mais generoso entre duas fontes oficiais, não lê-lo.
test('Representante é publicado como Representante, nunca como Líder', () => {
  const c = classificaLideranca(reg({ siglaTipoLideranca: 'R', siglaPartido: 'MISSÃO' }));
  assert.equal(c.papel, 'representante');
  assert.equal(c.rotulo, 'Representante do MISSÃO na Câmara');
});

// A liderança de bloco no SENADO (unidade 2) chega sempre sem `siglaBloco` — a da
// Câmara (unidade 10) vem com. Recusar o registro custava a liderança de 6 senadores,
// 4 deles LÍDERES de bloco, em silêncio. "Líder de Bloco no Senado" é o rótulo da
// própria fonte; o que falta é qual bloco.
test('bloco sem nome cai no rótulo genérico da unidade, não é descartado', () => {
  const c = classificaLideranca(reg({
    casa: 'SF', idTipoUnidadeLideranca: 2, siglaPartido: undefined, siglaBloco: undefined }));
  assert.equal(c.papel, 'lider');
  assert.equal(c.rotulo, 'Líder de Bloco no Senado');
});

test('partido sem sigla também tem genérico', () => {
  assert.equal(classificaLideranca(reg({ idTipoUnidadeLideranca: 9, siglaPartido: undefined })).rotulo,
    'Líder de Partido na Câmara');
});

test('o nome do bloco, quando vem, tem precedência sobre o genérico', () => {
  assert.equal(classificaLideranca(reg({
    idTipoUnidadeLideranca: 10, siglaPartido: undefined, siglaBloco: 'Federação PSOL REDE' })).rotulo,
    'Líder da Federação PSOL REDE na Câmara');
});

test('sem data de designação não é publicável', () => {
  assert.equal(classificaLideranca(reg({ dataDesignacao: '' })), null);
});

test('código de papel ou de unidade fora do vocabulário é recusado, não adivinhado', () => {
  assert.equal(classificaLideranca(reg({ siglaTipoLideranca: 'Z' })), null);
  assert.equal(classificaLideranca(reg({ idTipoUnidadeLideranca: 999 })), null);
  assert.equal(codigoDesconhecido(reg({ siglaTipoLideranca: 'Z' })), true);
  assert.equal(codigoDesconhecido(reg({ idTipoUnidadeLideranca: 999 })), true);
  assert.equal(codigoDesconhecido(reg()), false);
});

// ---------- vigência ----------

test('liderança encerrada não é cargo atual', () => {
  assert.equal(vigente(reg(), '2026-08-12'), true);
  assert.equal(vigente(reg({ dataTermino: '2026-08-12' }), '2026-08-12'), false);
  assert.equal(vigente(reg({ dataTermino: '2026-08-01' }), '2026-08-12'), false);
  assert.equal(vigente(reg({ dataTermino: '2026-12-31' }), '2026-08-12'), true);
});

// ---------- casamento com a base ----------

const BASE = [
  { casa: 'camara', id: 204536, nome: 'Kim Kataguiri', slug: 'kim-kataguiri-204536' },
  { casa: 'camara', id: 178947, nome: 'Sóstenes Cavalcante', slug: 'sostenes-cavalcante-178947' },
  { casa: 'senado', id: 5012, nome: 'Randolfe Rodrigues', slug: 'randolfe-rodrigues-5012' },
];
const HOJE = '2026-08-12';

test('senador casa por código; deputado casa por nome', () => {
  const { porSlug, semMatch } = indexaLiderancas([
    reg({ casa: 'SF', codigoParlamentar: 5012, nomeParlamentar: 'Randolfe Rodrigues',
      idTipoUnidadeLideranca: 6, siglaPartido: undefined }),
    reg(),
  ], BASE, HOJE);
  assert.equal(semMatch.length, 0);
  assert.equal(porSlug.get('randolfe-rodrigues-5012')[0].rotulo, 'Líder do Governo no Congresso');
  assert.equal(porSlug.get('sostenes-cavalcante-178947')[0].rotulo, 'Líder do PL na Câmara');
});

// O espaço de códigos do Senado é compartilhado entre as casas: `codigoParlamentar`
// de um DEPUTADO pode cair em cima de um senador nosso. Sem conferir o nome, a
// liderança do deputado seria publicada na ficha do senador — em silêncio.
test('código que bate mas nome que não bate NÃO casa com o senador', () => {
  const { porSlug } = indexaLiderancas(
    [reg({ codigoParlamentar: 5012, nomeParlamentar: 'Sóstenes Cavalcante' })], BASE, HOJE);
  assert.equal(porSlug.has('randolfe-rodrigues-5012'), false);
  assert.equal(porSlug.get('sostenes-cavalcante-178947').length, 1);
});

test('quem não está na base entra em semMatch, não some', () => {
  const { porSlug, semMatch } = indexaLiderancas(
    [reg({ nomeParlamentar: 'Fulano Que Não Existe', codigoParlamentar: 99999 })], BASE, HOJE);
  assert.equal(porSlug.size, 0);
  assert.equal(semMatch.length, 1);
});

// Registro do SENADO casa pelo código e pronto: é a chave da própria casa. Exigir que o
// nome confira ali derrubava senadores cujo `nomeParlamentar` diverge do nosso — é o
// mesmo match nominal que já quebrou no CEAPS ("Weverton" × "WEVERTON ROCHA").
test('senador casa pelo código mesmo com grafia de nome diferente', () => {
  const { porSlug, semMatch } = indexaLiderancas(
    [reg({ casa: 'SF', codigoParlamentar: 5012, nomeParlamentar: 'Randolfe' })], BASE, HOJE);
  assert.equal(semMatch.length, 0);
  assert.equal(porSlug.get('randolfe-rodrigues-5012').length, 1);
});

// Registro que não vira rótulo NÃO é registro sem parlamentar: culpar o match nominal
// por uma falta de dado da fonte manda investigar a coisa errada.
test('falha de rótulo é separada de falha de match', () => {
  const { semMatch, semRotulo } = indexaLiderancas(
    [reg({ dataDesignacao: '' })], BASE, HOJE);
  assert.equal(semMatch.length, 0);
  assert.equal(semRotulo.length, 1);
});

test('código desconhecido é separado para log, não vira liderança', () => {
  const { porSlug, desconhecidos } = indexaLiderancas(
    [reg({ siglaTipoLideranca: 'Z' })], BASE, HOJE);
  assert.equal(porSlug.size, 0);
  assert.equal(desconhecidos.length, 1);
});

test('cargo repetido pela fonte não duplica na ficha', () => {
  const { porSlug } = indexaLiderancas([reg(), reg({ dataDesignacao: '2025-02-01' })], BASE, HOJE);
  assert.equal(porSlug.get('sostenes-cavalcante-178947').length, 1);
});

test('liderança encerrada é filtrada no índice', () => {
  const { porSlug } = indexaLiderancas([reg({ dataTermino: '2026-08-01' })], BASE, HOJE);
  assert.equal(porSlug.size, 0);
});

test('líder aparece antes do vice na lista da ficha', () => {
  const { porSlug } = indexaLiderancas([
    reg({ siglaTipoLideranca: 'V', idTipoUnidadeLideranca: 11, siglaPartido: undefined }),
    reg(),
  ], BASE, HOJE);
  assert.deepEqual(porSlug.get('sostenes-cavalcante-178947').map((l) => l.papel), ['lider', 'vice']);
});

test('entrada vazia ou ausente não quebra', () => {
  for (const entrada of [undefined, null, []]) {
    const { porSlug, semMatch, semRotulo, desconhecidos } = indexaLiderancas(entrada, BASE, HOJE);
    assert.equal(porSlug.size, 0);
    assert.equal(semMatch.length + semRotulo.length + desconhecidos.length, 0);
  }
});

// ---------- peso: a decisão editorial ----------

// Medido: 163 dos 512 deputados (32%) e 19 dos 81 senadores são SÓ vice, e 104 dos
// 246 vices são de bloco na Câmara. Peso que um terço da casa tem não distingue.
test('vice-liderança NÃO pontua', () => {
  assert.equal(pesoLideranca([{ papel: 'vice' }]), 0);
  assert.equal(pesoLideranca([{ papel: 'vice' }, { papel: 'vice' }, { papel: 'vice' }]), 0);
});

test('representante NÃO pontua', () => {
  assert.equal(pesoLideranca([{ papel: 'representante' }]), 0);
});

test('liderança pontua 3, como a presidência de comissão', () => {
  assert.equal(pesoLideranca([{ papel: 'lider' }]), PESO_LIDER);
  assert.equal(PESO_LIDER, 3);
});

// Liderar o partido E o bloco que contém o partido é um poder, não dois.
test('quem lidera duas bancadas soma 3 uma única vez', () => {
  assert.equal(pesoLideranca([{ papel: 'lider' }, { papel: 'lider' }, { papel: 'vice' }]), PESO_LIDER);
});

test('sem liderança, sem bônus', () => {
  assert.equal(pesoLideranca([]), 0);
  assert.equal(pesoLideranca(undefined), 0);
});

// ---------- texto ----------

test('o texto nomeia todos os cargos, inclusive os que não pontuam', () => {
  assert.equal(textoLideranca([
    { papel: 'lider', rotulo: 'Líder do PL na Câmara' },
    { papel: 'vice', rotulo: 'Vice-líder da Minoria no Congresso' },
  ]), 'Líder do PL na Câmara · Vice-líder da Minoria no Congresso');
  assert.equal(textoLideranca([]), '');
});
