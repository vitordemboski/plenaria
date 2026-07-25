import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoCurtoStats, seguidoresCurto } from './resumo-stat.mjs';

test('cada linha cabe na largura da imagem (≤ 44 caracteres)', () => {
  const r = resumoCurtoStats({
    props: 1234, votos: 1587, votacoes: 1587, eficTocou: 120, eficAndou: 99,
    relatorias: 22, emendas: 111, gastoMes: 48000, seguidores: 2739689,
    fiscal: 192, alinhamentoPct: 82, comissoes: 12,
  });
  for (const [k, v] of Object.entries(r)) {
    assert.ok(v.length <= 44, `${k} tem ${v.length} caracteres: "${v}"`);
  }
});

test('Stamina cita presenças, total e taxa — os mesmos números da ficha', () => {
  const r = resumoCurtoStats({ votos: 849, votacoes: 1587 });
  assert.equal(r.stamina, '849 de 1.587 votações · 53%');
});

test('Técnica do Senado é só relatoria; a da Câmara soma emendas', () => {
  assert.equal(resumoCurtoStats({ relatorias: 5 }).tecnica, '5 relatorias');
  assert.equal(resumoCurtoStats({ relatorias: 5, emendas: 11 }).tecnica, '5 relatorias + 11 emendas');
  assert.equal(resumoCurtoStats({ relatorias: 1, emendas: 1 }).tecnica, '1 relatoria + 1 emenda');
});

test('divisão por zero não vira NaN nem “Infinity%”', () => {
  assert.equal(resumoCurtoStats({ eficTocou: 0, eficAndou: 0 }).eficiencia, 'nenhuma matéria de autoria ou relatoria');
  assert.equal(resumoCurtoStats({ votos: 0, votacoes: 0 }).stamina, undefined);
});

test('atributo sem dado não gera linha — nunca inventar', () => {
  assert.deepEqual(resumoCurtoStats({}), {});
  const senado = resumoCurtoStats({ props: 10, relatorias: 3, gastoMes: 36000 });
  assert.equal(senado.fiscalizacao, undefined);
  assert.equal(senado.alinhamento, undefined);
});

test('seguidores encurtam sem virar número falso', () => {
  assert.equal(seguidoresCurto(2739689), '2,7 mi');
  assert.equal(seguidoresCurto(43955), '44 mil');
  assert.equal(seguidoresCurto(870), '870');
});

test('singular/plural nas contagens de 1', () => {
  const r = resumoCurtoStats({ props: 1, fiscal: 1, comissoes: 1 });
  assert.equal(r.ataque, '1 proposição apresentada');
  assert.equal(r.fiscalizacao, '1 ato de cobrança ao Executivo');
  assert.equal(r.comando, '1 comissão ativa');
});
