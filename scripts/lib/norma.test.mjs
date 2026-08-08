import test from 'node:test';
import assert from 'node:assert/strict';
import { normaDoDespacho, normaDoSenado, resumoEmenta, ordenaLeis } from './norma.mjs';

test('despacho da Câmara: o formato que a casa realmente publica', () => {
  assert.equal(
    normaDoDespacho('Transformado na Lei Ordinária 15172/2025. DOU 23/07/2025 PÁG 01 COL 01.'),
    'Lei 15.172/2025',
  );
  assert.equal(
    normaDoDespacho('Transformado na Lei Ordinária 14786/2023. DOU 29/12/23 PÁG 01 COL 02.RETIFICAÇÃO'),
    'Lei 14.786/2023',
  );
});

test('despacho: os outros tipos de norma que PL/PLP/PEC/PDL geram', () => {
  assert.equal(normaDoDespacho('Transformada na Lei Complementar nº 214/2025'), 'Lei Complementar 214/2025');
  assert.equal(normaDoDespacho('Transformado no Decreto Legislativo nº 12/2024.'), 'Decreto Legislativo 12/2024');
  assert.equal(normaDoDespacho('Transformada na Emenda Constitucional 132/2023'), 'Emenda Constitucional 132/2023');
});

test('"Lei Complementar" não pode ser lida como "Lei" — a alternância é ordenada', () => {
  assert.equal(normaDoDespacho('Transformado na Lei Complementar 214/2025'), 'Lei Complementar 214/2025');
});

test('despacho que NÃO anuncia norma devolve null — o número é omitido, nunca estimado', () => {
  // 90% dos últimos despachos das proposições transformadas são assim: a matéria
  // segue tramitando depois de virar lei e o despacho fala de outra coisa.
  assert.equal(normaDoDespacho('Recebido Ofício nº 16/2024-SF que comunica restituição de autógrafo do PL 7/2023, sancionado.'), null);
  assert.equal(normaDoDespacho('Apresentação da RDF n. 1 PLEN (Redação Final), pelo Deputado Fulano.'), null);
  assert.equal(normaDoDespacho(''), null);
  assert.equal(normaDoDespacho(null), null);
  assert.equal(normaDoDespacho(undefined), null);
});

test('"Lei nº 7/2023" citada dentro de outro texto não vira norma gerada', () => {
  // sem o "transformado no(a)" na frente, é citação — a proposição ALTERA a lei
  assert.equal(normaDoDespacho('Altera a Lei nº 9.051, de 18 de maio de 1995.'), null);
});

test('normaGerada do Senado: vocabulário fechado, com data', () => {
  assert.deepEqual(normaDoSenado('Lei nº 15.042 de 11/12/2024'),
    { norma: 'Lei 15.042/2024', data: '2024-12-11' });
  assert.deepEqual(normaDoSenado('Decreto Legislativo nº 139 de 28/02/2025'),
    { norma: 'Decreto Legislativo 139/2025', data: '2025-02-28' });
  assert.deepEqual(normaDoSenado('Lei Complementar nº 214 de 16/01/2025'),
    { norma: 'Lei Complementar 214/2025', data: '2025-01-16' });
  assert.deepEqual(normaDoSenado('Emenda Constitucional nº 132 de 20/12/2023'),
    { norma: 'Emenda Constitucional 132/2023', data: '2023-12-20' });
});

test('normaGerada ausente ou fora do formato devolve null', () => {
  assert.equal(normaDoSenado(''), null);
  assert.equal(normaDoSenado(null), null);
  assert.equal(normaDoSenado('Aguardando sanção'), null);
});

test('o ano da norma vem da NORMA, não da proposição', () => {
  // PL de 2023 sancionado em 2025 — a linha tem que dizer 2025
  assert.equal(normaDoDespacho('Transformado na Lei Ordinária 15156/2025.'), 'Lei 15.156/2025');
});

test('resumoEmenta corta em limite de palavra e nunca no meio dela', () => {
  const longa = 'Altera a Lei nº 12.345, de 2011, para dispor sobre a política nacional de proteção dos direitos da pessoa com deficiência auditiva em todo o território nacional brasileiro.';
  const r = resumoEmenta(longa, 60);
  assert.ok(r.length <= 61, r);
  assert.ok(r.endsWith('…'));
  assert.ok(!/\s…$/.test(r), 'não deixa espaço antes das reticências');
  assert.ok(longa.startsWith(r.slice(0, -1)), 'o trecho exibido é literal da fonte');
});

test('ementa curta passa inteira, sem reticências', () => {
  assert.equal(resumoEmenta('Reconhece o cooperativismo como manifestação da cultura nacional.', 260),
    'Reconhece o cooperativismo como manifestação da cultura nacional.');
});

test('ementa com quebras de linha vira uma linha só', () => {
  assert.equal(resumoEmenta('Dispõe sobre\n  o registro\tcivil.'), 'Dispõe sobre o registro civil.');
});

test('ordenaLeis: mais recente primeiro, sem data no FIM', () => {
  const leis = [
    { ref: 'PL 2/2024', data: '2024-03-01' },
    { ref: 'PL 9/2023' },
    { ref: 'PL 1/2025', data: '2025-07-22' },
    { ref: 'PL 3/2023', data: '2023-12-28' },
  ];
  assert.deepEqual(ordenaLeis(leis).map((l) => l.ref), ['PL 1/2025', 'PL 2/2024', 'PL 3/2023', 'PL 9/2023']);
});

test('ordenaLeis não muta a entrada', () => {
  const leis = [{ ref: 'B', data: '2023-01-01' }, { ref: 'A', data: '2025-01-01' }];
  ordenaLeis(leis);
  assert.equal(leis[0].ref, 'B');
});
