import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fatorExercicio, mesesDivisor, exercicioParcial, fraseRitmo, sufixoMeses, PISO_MESES_RITMO } from './exercicio.mjs';

test('mandato inteiro não é escalado', () => {
  assert.equal(fatorExercicio(44, 44), 1);
});

test('licença longa: a contagem vira o equivalente da legislatura', () => {
  // o caso que motivou: ~14 meses licenciado p/ Secretaria de Estado, 30 de 44 em exercício
  assert.equal(fatorExercicio(30, 44), 44 / 30);
});

test('o piso de 24 meses limita a extrapolação de janela curta', () => {
  assert.equal(PISO_MESES_RITMO, 24);
  assert.equal(fatorExercicio(13, 44), 44 / 24); // e não 44/13 = 3,4x
  assert.equal(fatorExercicio(20, 44), fatorExercicio(13, 44));
  assert.equal(mesesDivisor(13, 44), 24);
});

test('arredondamento de dias nunca dá fator < 1', () => {
  assert.equal(fatorExercicio(44.2, 44), 1);
});

test('início de legislatura (menos meses decorridos que o piso): ninguém é extrapolado', () => {
  assert.equal(fatorExercicio(3, 6), 1);
  assert.equal(fatorExercicio(6, 6), 1);
});

test('sem meses conhecidos cai no piso, não em divisão por zero', () => {
  assert.equal(fatorExercicio(undefined, 44), 44 / 24);
  assert.equal(fatorExercicio(0, 44), 44 / 24);
  assert.equal(fatorExercicio(10, 0), 1);
});

test('frase só aparece para quem esteve fora parte da legislatura', () => {
  assert.equal(fraseRitmo(43.9, 44), '');
  assert.equal(exercicioParcial(43.9, 44), false);
  assert.match(fraseRitmo(29.9, 44), /em 30 dos 44 meses da legislatura em exercício; a nota compara o ritmo por mês, não o total/);
  assert.doesNotMatch(fraseRitmo(29.9, 44), /no mínimo/);
});

test('abaixo do piso a frase declara o piso — a conta não é o ritmo puro', () => {
  assert.match(fraseRitmo(15, 44), /contado sobre no mínimo 24 meses/);
});

test('na Eficiência a frase fala do VOLUME — a taxa não depende do tempo', () => {
  assert.match(fraseRitmo(29.9, 44, { volume: true }), /o volume que avançou é comparado por mês/);
  assert.doesNotMatch(fraseRitmo(29.9, 44, { volume: true }), /a nota compara/);
});

test('linha curta da imagem: meses só para quem esteve fora', () => {
  assert.equal(sufixoMeses(29.9, 44), ' em 30 meses');
  assert.equal(sufixoMeses(43.9, 44), '');
});
