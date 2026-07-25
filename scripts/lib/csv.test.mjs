import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvBR } from './csv.mjs';

test('parseia linhas simples separadas por ponto-e-vírgula', () => {
  const { header, rows } = parseCsvBR('"id";"nome"\n"1";"Ana"\n"2";"Bruno"\n');
  assert.deepEqual(header, ['id', 'nome']);
  assert.deepEqual(rows, [['1', 'Ana'], ['2', 'Bruno']]);
});

test('remove o BOM do início do arquivo', () => {
  const { header } = parseCsvBR('﻿"id";"nome"\n"1";"Ana"\n');
  assert.deepEqual(header, ['id', 'nome']);
});

// O BUG: a ementa de uma proposição contém quebra de linha dentro das aspas.
// O parser antigo cortava a linha ao meio e o registro virava lixo.
test('campo com quebra de linha dentro das aspas não parte a linha', () => {
  const { rows } = parseCsvBR('"id";"ementa";"tipo"\n"1";"Altera a lei\npara incluir o art. 2º";"PL"\n');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], ['1', 'Altera a lei\npara incluir o art. 2º', 'PL']);
});

test('campo com ponto-e-vírgula dentro das aspas não vira coluna nova', () => {
  const { rows } = parseCsvBR('"id";"ementa"\n"1";"Dispõe sobre A; e sobre B"\n');
  assert.deepEqual(rows[0], ['1', 'Dispõe sobre A; e sobre B']);
});

test('aspas escapadas viram uma aspa só', () => {
  const { rows } = parseCsvBR('"id";"desc"\n"1";"44 votos ""Sim"", 14 ""Não"""\n');
  assert.deepEqual(rows[0], ['1', '44 votos "Sim", 14 "Não"']);
});

test('ignora linhas em branco e trata CRLF', () => {
  const { rows } = parseCsvBR('"id"\r\n"1"\r\n\r\n"2"\r\n');
  assert.deepEqual(rows, [['1'], ['2']]);
});
