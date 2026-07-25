import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escalaAncorada, escalaFrugalidade, escalaComparecimento, escalaLog, quantil } from './escala.mjs';

const med = (xs) => quantil([...xs].sort((a, b) => a - b), 0.5);

// forma real do gasto da Câmara: apertada no meio, cauda longa embaixo
const GASTO = [
  0, 4, 8, 12, 13, 17, 20, 24, 28, 29, 31, 33, 34, 35, 36, 37, 38, 39, 40, 40,
  40, 41, 41, 42, 42, 43, 43, 44, 44, 45, 45, 46, 46, 47, 48, 49, 50, 51, 52, 53,
];
// forma real do comparecimento do Senado: comprimida e encostada no teto de 100%
const PRESENCA_SENADO = [
  58, 66, 71, 73, 78, 82, 84, 85, 86, 86, 87, 88, 89, 90, 90, 91, 91, 92, 92, 92,
  93, 93, 94, 94, 95, 95, 96, 96, 97, 97, 97, 98, 98, 99, 99, 99, 100, 100, 100, 100,
];

test('a mediana da casa vale exatamente 50, nos dois sentidos', () => {
  assert.equal(escalaFrugalidade(GASTO)(med(GASTO)), 50);
  assert.equal(escalaComparecimento(PRESENCA_SENADO)(med(PRESENCA_SENADO)), 50);
});

test('o sentido de cada métrica é respeitado', () => {
  const eco = escalaFrugalidade(GASTO), sta = escalaComparecimento(PRESENCA_SENADO);
  assert.ok(eco(10) > eco(45), 'gastar menos tem de valer mais');
  assert.ok(sta(99) > sta(70), 'comparecer mais tem de valer mais');
  assert.equal(eco(0), 100, 'não gastar nada é o topo da Economia');
});

test('é monotônica em toda a faixa', () => {
  const eco = escalaFrugalidade(GASTO), sta = escalaComparecimento(PRESENCA_SENADO);
  for (let v = 0; v < 60; v += 1) assert.ok(eco(v) >= eco(v + 1), `Economia quebrou em ${v}`);
  for (let v = 0; v < 100; v += 1) assert.ok(sta(v) <= sta(v + 1), `Stamina quebrou em ${v}`);
});

// a regressão da Economia: no percentil, 2,2x o gasto do colega custava 9 pontos
// enquanto R$3 mil a mais na mediana custava 24 — sensibilidade invertida
test('magnitude manda: dobrar o gasto na cauda frugal pesa mais que R$3 mil na mediana', () => {
  const f = escalaFrugalidade(GASTO);
  assert.ok(f(13) - f(29) > f(40) - f(43));
});

// a regressão da Stamina: no percentil a inclinação seguia a densidade local de
// colegas, e 1 p.p. de presença valia de 0 a 7,5 pontos conforme onde você caísse
test('a inclinação é constante dentro de cada metade — não segue aglomerado', () => {
  const f = escalaComparecimento(PRESENCA_SENADO);
  const m = Math.round(med(PRESENCA_SENADO));
  const passos = [];
  for (let v = m + 1; v < 99; v += 1) passos.push(f(v + 1) - f(v));
  assert.ok(Math.max(...passos) - Math.min(...passos) <= 1, `inclinação variou: ${passos}`);
});

// o vermelho (< 40) é convenção compartilhada com atributos que SÃO percentis e
// portanto têm ~40% da casa abaixo dele; a escala não pode acusar a mediana
test('o limiar de vermelho não dispara na mediana da casa', () => {
  for (const [nome, f, xs] of [
    ['Economia', escalaFrugalidade(GASTO), GASTO],
    ['Stamina', escalaComparecimento(PRESENCA_SENADO), PRESENCA_SENADO],
  ]) {
    assert.ok(f(med(xs)) >= 40, `${nome}: a mediana ficou no vermelho`);
    const abaixo = xs.filter((v) => f(v) < 40).length / xs.length;
    assert.ok(abaixo < 0.5, `${nome}: ${Math.round(abaixo * 100)}% da casa no vermelho`);
  }
});

test('o topo não vira ingresso barato: quase ninguém satura em 100', () => {
  assert.ok(GASTO.filter((g) => escalaFrugalidade(GASTO)(g) === 100).length <= 2);
});

test('calibra por casa — a mesma despesa vale diferente onde se gasta menos', () => {
  const senado = GASTO.map((g) => g / 2);
  assert.ok(escalaFrugalidade(senado)(20) < escalaFrugalidade(GASTO)(20));
});

test('degenerados não explodem: casa vazia ou sem dispersão devolve 50', () => {
  assert.equal(escalaAncorada([])(10), 50);
  assert.equal(escalaAncorada([7, 7, 7])(7), 50);
  assert.equal(escalaFrugalidade([7, 7, 7])(7), 50);
  assert.equal(escalaFrugalidade(GASTO)(NaN), 50);
  assert.equal(escalaComparecimento(PRESENCA_SENADO)(NaN), 50);
});

// contagem de trabalho: cauda longa à direita, onde o percentil satura
const TECNICA = [
  0, 1, 2, 4, 5, 7, 9, 11, 13, 16, 16, 18, 21, 24, 28, 31, 33, 36, 36, 39,
  44, 48, 53, 60, 69, 78, 90, 104, 122, 131, 150, 184, 220, 268, 333, 400, 470, 540, 600, 639,
];

test('escala log: a mediana vale 50 e o zero não explode', () => {
  const f = escalaLog(TECNICA);
  assert.equal(f(med(TECNICA)), 50);
  assert.equal(f(0), 0);
  assert.ok(Number.isFinite(f(0)));
});

test('escala log: cada DOBRO de trabalho vale o mesmo incremento em qualquer altura', () => {
  const f = escalaLog(TECNICA);
  const passo = (a) => f(2 * a) - f(a);
  // 20→40 tem de valer o mesmo que 300→600, a menos de arredondamento
  assert.ok(Math.abs(passo(20) - passo(300)) <= 1, `${passo(20)} vs ${passo(300)}`);
});

test('escala log: resolve a cauda que o percentil achatava', () => {
  const f = escalaLog(TECNICA);
  // no percentil, 334 e 639 ficavam a 1 ponto; aqui a distância tem de ser real
  assert.ok(f(639) - f(334) >= 5, `${f(334)} → ${f(639)}`);
});

// o topo é o máximo da casa, então a escala responde a um outlier — mas de forma
// LOGARÍTMICA: um valor 156x maior estica a escala ~1,8x, não 156x
test('escala log: outlier no topo desloca o miolo de forma contida', () => {
  const f = escalaLog(TECNICA);
  const g = escalaLog([...TECNICA, 100000]);
  const desloc = Math.abs(f(69) - g(69));
  assert.ok(desloc > 0, 'o topo é o máximo: algum deslocamento é esperado');
  assert.ok(desloc <= 10, `deslocou ${desloc} pontos — passou a ser refém do outlier`);
  assert.equal(g(med(TECNICA)), 50, 'a mediana tem de continuar valendo 50');
});
