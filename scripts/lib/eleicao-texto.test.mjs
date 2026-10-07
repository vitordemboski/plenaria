import test from 'node:test';
import assert from 'node:assert/strict';
import { chipCurto, explica, linhaShare, resumo } from './eleicao-texto.mjs';

const E = (over) => ({ resultadoEm: '2026-10-05', ...over });

test('fim de mandato nunca vira "não se candidatou"', () => {
  const t = explica(E({ destino: 'sai', motivo: 'fim-de-mandato' }), 'camara', 'M');
  assert.doesNotMatch(t, /não se candidat/i);
  assert.match(t, /não está entre os 513 deputados/);
});

test('suplente é "ficou como suplente", não derrota', () => {
  const e = E({ destino: 'sai', motivo: 'nao-reeleito', situacao: 'suplente', cargo: 'Câmara dos Deputados' });
  assert.match(explica(e, 'camara', 'F'), /ficou como suplente — pode assumir/);
  assert.doesNotMatch(resumo(e, 'camara', 'F'), /não reeleit/);
});

test('gênero vem do sexo declarado; sem ele, forma neutra', () => {
  const e = E({ destino: 'fica' });
  assert.equal(resumo(e, 'camara', 'F'), 'Reeleita para a Câmara');
  assert.equal(resumo(e, 'senado', 'M'), 'Reeleito para o Senado');
  assert.equal(resumo(e, 'senado', null), 'Reeleito(a) para o Senado');
});

test('artigo acompanha o cargo do vocabulário fechado', () => {
  const gov = E({ destino: 'sai', motivo: 'outro-cargo', situacao: 'eleito', cargo: 'Governo de MG', curto: 'Gov. MG' });
  assert.match(resumo(gov, 'camara', 'M'), /eleito para o Governo de MG/);
  const ass = E({ destino: 'sai', motivo: 'outro-cargo', situacao: 'nao-eleito', cargo: 'Assembleia de SP' });
  assert.match(explica(ass, 'camara', 'M'), /Disputou a Assembleia de SP e não foi eleito/);
});

test('eleito suplente de senador não vira "eleito para o Suplente"', () => {
  const e = E({ destino: 'sai', motivo: 'outro-cargo', situacao: 'eleito', cargo: 'Suplente de senador', curto: 'Suplente' });
  assert.match(resumo(e, 'camara', 'M'), /eleito suplente de senador/);
});

test('chip de lista só para quem muda de lugar', () => {
  assert.equal(chipCurto(E({ destino: 'fica' }), 'camara'), null);
  assert.equal(chipCurto(E({ destino: 'segue' }), 'senado'), null);
  assert.equal(chipCurto(E({ destino: 'sai' }), 'camara'), '🚪 Sai em 2027');
  assert.equal(chipCurto(E({ destino: 'muda' }), 'camara'), '↪ Vai ao Senado');
  assert.equal(chipCurto(undefined, 'camara'), null);
});

test('a linha da imagem leva a data do arquivo do TSE', () => {
  assert.match(linhaShare(E({ destino: 'fica' }), 'camara', 'M'), /TSE, 05\/10\/2026$/);
});
