import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediana, referenciasDaCasa, evidenciaDeTitulos } from './evidencia.mjs';

const casa = (over = {}) => ({
  casa: 'camara', titles: [], bruto: {}, relatoriasN: 0, relatoriasAvancadasN: 0, ...over,
});

test('mediana: par, ímpar e lista sem número', () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
  assert.equal(mediana([undefined, null, NaN]), null);
});

test('referenciasDaCasa ignora quem não tem o bruto e agrega a taxa de relatoria', () => {
  const ref = referenciasDaCasa([
    casa({ bruto: { comparecimento: 0.9, gastoMes: 30000, proposicoes: 10 }, relatoriasN: 10, relatoriasAvancadasN: 3 }),
    casa({ bruto: { comparecimento: 0.5, gastoMes: 50000, proposicoes: 20 }, relatoriasN: 10, relatoriasAvancadasN: 1 }),
    casa({ bruto: {} }), // sem dado: não entra na mediana
  ]);
  assert.equal(ref.comparecimento, 0.7);
  assert.equal(ref.gastoMes, 40000);
  assert.equal(ref.proposicoes, 15);
  assert.equal(ref.relatoriaAvanco, 0.2);
});

test('Fantasma: frase traz o bruto do parlamentar E a mediana da casa', () => {
  const ev = evidenciaDeTitulos(
    casa({ titles: ['fantasma-do-plenario'], bruto: { comparecimento: 0.41, votos: 653, votacoes: 1587 } }),
    { comparecimento: 0.92 },
  );
  assert.match(ev['fantasma-do-plenario'], /41%/);
  assert.match(ev['fantasma-do-plenario'], /653 de 1\.587/);
  assert.match(ev['fantasma-do-plenario'], /mediana da Câmara: 92%/);
});

test('a mediana citada é a da casa DELE (senador não é comparado com a Câmara)', () => {
  const ev = evidenciaDeTitulos(
    casa({ casa: 'senado', titles: ['fantasma-do-plenario'], bruto: { comparecimento: 0.6 } }),
    { comparecimento: 0.93 },
  );
  assert.match(ev['fantasma-do-plenario'], /mediana do Senado: 93%/);
});

test('Nobre Gastador: gasto mensal contra a mediana + o que entregou', () => {
  const ev = evidenciaDeTitulos(
    casa({ titles: ['nobre-gastador'], bruto: { gastoMes: 48000, eficTocou: 12, eficAndou: 1 } }),
    { gastoMes: 34000 },
  );
  assert.match(ev['nobre-gastador'], /R\$ 48 mil\/mês/);
  assert.match(ev['nobre-gastador'], /mediana da Câmara: R\$ 34 mil\/mês/);
  assert.match(ev['nobre-gastador'], /Das 12 matérias que tocou \(autoria ou relatoria\), 1 avançou/);
});

test('Blogueiro mostra os DOIS eixos de entrega, inclusive o que não disparou o gate', () => {
  const ev = evidenciaDeTitulos(
    casa({ titles: ['blogueiro-de-plenario'], bruto: { seguidores: 2739689, proposicoes: 16, comparecimento: 0.72 } }),
    { proposicoes: 24, comparecimento: 0.92 },
  );
  assert.match(ev['blogueiro-de-plenario'], /2\.739\.689 seguidores/);
  assert.match(ev['blogueiro-de-plenario'], /16 proposições relevantes apresentadas \(mediana da Câmara: 24\)/);
  assert.match(ev['blogueiro-de-plenario'], /72% de comparecimento/);
});

test('Relator de Gaveta cita a taxa de avanço da casa, não um percentil', () => {
  const ev = evidenciaDeTitulos(
    casa({ titles: ['relator-de-gaveta'], relatoriasN: 18, relatoriasAvancadasN: 0 }),
    { relatoriaAvanco: 0.266 },
  );
  assert.match(ev['relator-de-gaveta'], /18 matérias relevantes; nenhuma avançou/);
  assert.match(ev['relator-de-gaveta'], /na Câmara, 27% das relatorias avançam/);
});

test('só títulos VERMELHOS ganham evidência — os verdes/roxos não acusam ninguém', () => {
  const ev = evidenciaDeTitulos(
    casa({ titles: ['artilheiro', 'veterano', 'base-do-governo'], bruto: { comparecimento: 0.99, proposicoes: 90 } }),
    { comparecimento: 0.92 },
  );
  assert.deepEqual(ev, {});
});

test('sem o bruto, a frase é OMITIDA — nunca inventada', () => {
  const ev = evidenciaDeTitulos(casa({ titles: ['fantasma-do-plenario', 'nobre-gastador'], bruto: {} }), {});
  assert.deepEqual(ev, {});
});

test('referência da casa ausente não quebra a frase: sai só o bruto', () => {
  const ev = evidenciaDeTitulos(
    casa({ titles: ['fantasma-do-plenario'], bruto: { comparecimento: 0.41, votos: 653, votacoes: 1587 } }),
    {},
  );
  assert.match(ev['fantasma-do-plenario'], /41%/);
  assert.doesNotMatch(ev['fantasma-do-plenario'], /mediana/);
});
