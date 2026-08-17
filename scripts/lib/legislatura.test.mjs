import test from 'node:test';
import assert from 'node:assert/strict';
import { moveuNestaLegislatura, INICIO_LEGISLATURA } from './legislatura.mjs';

test('a situação alcançada dentro da legislatura conta', () => {
  assert.equal(moveuNestaLegislatura('2024-05-03'), true);
  assert.equal(moveuNestaLegislatura('2026-08-13'), true);
  assert.equal(moveuNestaLegislatura(INICIO_LEGISLATURA), true, 'o próprio dia de início conta');
});

test('a situação anterior à legislatura NÃO conta', () => {
  assert.equal(moveuNestaLegislatura('2022-12-28'), false);
  assert.equal(moveuNestaLegislatura('2019-12-12'), false);
  assert.equal(moveuNestaLegislatura('2023-01-31'), false, 'janeiro ainda é a legislatura passada');
});

test('aceita o formato com hora do bulk da Câmara', () => {
  assert.equal(moveuNestaLegislatura('2024-05-03T00:00:00'), true);
  assert.equal(moveuNestaLegislatura('2022-11-08T00:00:00'), false);
});

test('sem data a resposta é NÃO — não se afirma o que a fonte não disse', () => {
  for (const v of [null, undefined, '', '   ', 'sem data']) {
    assert.equal(moveuNestaLegislatura(v), false, `${JSON.stringify(v)} não pode virar "sim"`);
  }
});

test('data incompleta não é comparada como string', () => {
  // "2024" >= "2023-02-01" é true em comparação de string, e diria "sim" sem saber o dia;
  // "2023" >= "2023-02-01" é false, e diria "não" pelo mesmo motivo arbitrário
  assert.equal(moveuNestaLegislatura('2024'), false);
  assert.equal(moveuNestaLegislatura('2023'), false);
  assert.equal(moveuNestaLegislatura('2024-05'), false);
});

test('o início da legislatura é parametrizável (a próxima virá)', () => {
  assert.equal(moveuNestaLegislatura('2024-05-03', '2027-02-01'), false);
  assert.equal(moveuNestaLegislatura('2027-03-01', '2027-02-01'), true);
});
