import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brutoDaGuilda } from './guilda-bruto.mjs';

const dep = (o = {}) => ({
  casa: 'camara', relatoriasN: 8, statRaw: { tecnica: 19 },
  bruto: { proposicoes: 35, votos: 850, votacoes: 1589, eficTocou: 43, eficAndou: 8, gastoMes: 46000 },
  ...o,
});
const sen = (o = {}) => ({
  casa: 'senado', relatoriasN: 39, statRaw: { tecnica: 39 },
  bruto: { proposicoes: 32, votos: 406, votacoes: 418, eficTocou: 71, eficAndou: 29, gastoMes: 36000 },
  ...o,
});

test('cada linha cabe na largura do card (≤ 44 caracteres)', () => {
  // bancada grande e cara: os números mais longos que a realidade produz
  const membros = Array.from({ length: 110 }, () =>
    dep({ relatoriasN: 300, statRaw: { tecnica: 900 }, bruto: { ...dep().bruto, proposicoes: 999, gastoMes: 99000 } }));
  for (const [k, v] of Object.entries(brutoDaGuilda(membros))) {
    assert.ok(v.length <= 44, `${k} tem ${v.length} caracteres: "${v}"`);
  }
});

test('contagem vira média POR PARLAMENTAR', () => {
  const r = brutoDaGuilda([dep({ bruto: { ...dep().bruto, proposicoes: 30 } }), dep({ bruto: { ...dep().bruto, proposicoes: 50 } })]);
  assert.equal(r.ataque, '40 proposições por parlamentar');
});

test('média pequena ganha uma casa decimal (0 seria lido como "nenhuma")', () => {
  const membros = [dep({ bruto: { ...dep().bruto, proposicoes: 1 } }), dep({ bruto: { ...dep().bruto, proposicoes: 2 } })];
  assert.equal(brutoDaGuilda(membros).ataque, '1,5 proposições por parlamentar');
});

test('singular concorda com o número formatado', () => {
  const r = brutoDaGuilda([dep({ relatoriasN: 1, statRaw: { tecnica: 1 }, bruto: { ...dep().bruto, proposicoes: 1 } })]);
  assert.equal(r.ataque, '1 proposição por parlamentar');
  assert.equal(r.tecnica, '1 relatoria por parlamentar');
});

test('taxa é soma/soma da bancada, não média de porcentagens', () => {
  // 850/1589 = 53% e 406/418 = 97%; a média das taxas daria 75%, a da bancada é 63%
  const r = brutoDaGuilda([dep(), sen()]);
  assert.equal(r.stamina, '1.256 de 2.007 votações da bancada · 63%');
  assert.equal(r.eficiencia, '37 de 114 matérias avançaram · 32%');
});

test('emenda só entra quando TODA a bancada é da Câmara (o senador não tem)', () => {
  assert.equal(brutoDaGuilda([dep(), dep()]).tecnica, '8 relatorias + 11 emendas por parlamentar');
  // bancada mista: dividir emenda de deputado pela bancada inteira inventaria
  // uma média que nenhum senador podia ter
  assert.equal(brutoDaGuilda([dep(), sen()]).tecnica, '24 relatorias por parlamentar');
});

test('cota é a média do gasto MENSAL, em R$ mil', () => {
  assert.equal(brutoDaGuilda([dep(), sen()]).economia, 'R$ 41 mil/mês de cota por parlamentar');
});

test('bancada vazia ou sem brutos não inventa frase', () => {
  assert.deepEqual(brutoDaGuilda([]), {});
  assert.deepEqual(brutoDaGuilda(undefined), {});
  assert.deepEqual(brutoDaGuilda([{ casa: 'camara' }]), {});
});

test('denominador zerado não vira NaN%', () => {
  const zerado = dep({ bruto: { ...dep().bruto, votos: 0, votacoes: 0, eficTocou: 0, eficAndou: 0 } });
  const r = brutoDaGuilda([zerado]);
  assert.equal(r.stamina, undefined);
  assert.equal(r.eficiencia, undefined);
  assert.ok(r.ataque);
});
