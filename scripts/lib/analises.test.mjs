import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fonteHash, analiseDe, contarObsoletas, alvoGuilda, alvoParlamentar } from './analises.mjs';

const agregado = (temas, nComTema) => ({ temas: temas.map(([tema, n]) => ({ tema, n })), nComTema });

const BASE = agregado([['Saúde', 41], ['Educação', 17]], 120);
const analise = (extra = {}) => ({
  alvo: 'guilda:PT', texto: 'A bancada concentra…', modelo: 'claude-opus-5',
  geradoEm: '2026-08-07', promptVersao: 'v1', fonteHash: fonteHash(BASE), ...extra,
});

test('hash é determinístico e independe da ordem dos temas', () => {
  const a = agregado([['Saúde', 41], ['Educação', 17]], 120);
  const b = agregado([['Educação', 17], ['Saúde', 41]], 120);
  assert.equal(fonteHash(a), fonteHash(b));
  assert.match(fonteHash(a), /^[0-9a-f]{8}$/);
});

test('hash muda quando QUALQUER número muda', () => {
  const base = fonteHash(BASE);
  assert.notEqual(base, fonteHash(agregado([['Saúde', 42], ['Educação', 17]], 120)), 'contagem do tema');
  assert.notEqual(base, fonteHash(agregado([['Saúde', 41], ['Educação', 17]], 121)), 'denominador');
  assert.notEqual(base, fonteHash(agregado([['Saúde', 41]], 120)), 'tema removido');
  assert.notEqual(base, fonteHash(agregado([['Saúde', 41], ['Educação', 17], ['Turismo', 1]], 120)), 'tema novo');
});

test('hash de agregado vazio não explode', () => {
  assert.match(fonteHash({}), /^[0-9a-f]{8}$/);
  assert.match(fonteHash(undefined), /^[0-9a-f]{8}$/);
});

test('análise com hash batendo é entregue', () => {
  const a = analiseDe([analise()], 'guilda:PT', BASE);
  assert.equal(a.texto, 'A bancada concentra…');
  assert.equal(a.modelo, 'claude-opus-5');
});

test('análise OBSOLETA some — nunca é exibida ao lado de números que mudaram', () => {
  const numerosNovos = agregado([['Saúde', 60], ['Educação', 17]], 130);
  assert.equal(analiseDe([analise()], 'guilda:PT', numerosNovos), null);
});

test('alvo sem análise devolve null, e arquivo ausente também', () => {
  assert.equal(analiseDe([analise()], 'guilda:PL', BASE), null);
  assert.equal(analiseDe([], 'guilda:PT', BASE), null);
  assert.equal(analiseDe(undefined, 'guilda:PT', BASE), null);
  assert.equal(analiseDe(null, 'nacional', BASE), null);
});

test('análise sem texto não é exibida mesmo com hash correto', () => {
  assert.equal(analiseDe([analise({ texto: '' })], 'guilda:PT', BASE), null);
});

test('as chaves de alvo têm o formato do contrato', () => {
  assert.equal(alvoGuilda('PT'), 'guilda:PT');
  assert.equal(alvoParlamentar('joao-da-silva'), 'parlamentar:joao-da-silva');
});

test('obsoletas e órfãs são contadas para o gerador logar', () => {
  const atual = new Map([['guilda:PT', fonteHash(BASE)], ['nacional', 'aaaaaaaa']]);
  const r = contarObsoletas([
    analise(),                                        // bate
    analise({ alvo: 'nacional', fonteHash: 'zzzzzzzz' }), // obsoleta
    analise({ alvo: 'guilda:PARTIDO-EXTINTO' }),      // órfã: alvo sumiu
  ], atual);
  assert.deepEqual(r, { obsoletas: 1, orfas: 1 });
});
