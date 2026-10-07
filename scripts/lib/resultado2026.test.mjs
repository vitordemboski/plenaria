import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agregaEleicao, aindaVale, destinoNaLegislatura, indiceEleitos, motivoParaAbortar,
  situacaoDesconhecida, situacaoTse,
} from './resultado2026.mjs';

/** linha do TSE como o CSV a entrega (todos os campos são texto) */
const linha = (over = {}) => ({
  CD_CARGO: '6', SG_UF: 'SP', NM_CANDIDATO: 'JOSE DA SILVA', NM_URNA_CANDIDATO: 'ZE DA SILVA',
  NR_CPF_CANDIDATO: '12345678901', CD_SIT_TOT_TURNO: '2', ...over,
});
const dep = (over = {}) => ({ casa: 'camara', uf: 'SP', cpf: '12345678901', ...over });
const sen = (over = {}) => ({
  casa: 'senado', uf: 'PR', nomeCivil: 'Maria Souza Lima', nomeParlamentar: 'Maria Lima',
  fimMandato: '2027-01-31', titular: true, ...over,
});
const idx = (...ls) => indiceEleitos(ls);

// ---------- vocabulário ----------

test('as três formas de eleito do TSE viram "eleito"; #NULO não é derrota', () => {
  for (const c of ['1', '2', '3']) assert.equal(situacaoTse({ CD_SIT_TOT_TURNO: c }), 'eleito');
  assert.equal(situacaoTse({ CD_SIT_TOT_TURNO: '4' }), 'nao-eleito');
  assert.equal(situacaoTse({ CD_SIT_TOT_TURNO: '5' }), 'suplente');
  assert.equal(situacaoTse({ CD_SIT_TOT_TURNO: '6' }), 'segundo-turno');
  assert.equal(situacaoTse({ CD_SIT_TOT_TURNO: '-1' }), null);
  assert.equal(situacaoDesconhecida({ CD_SIT_TOT_TURNO: '-1' }), false);
  assert.equal(situacaoDesconhecida({ CD_SIT_TOT_TURNO: '9' }), true);
});

test('lista de eleitos incompleta aborta em vez de virar "não volta"', () => {
  assert.match(motivoParaAbortar({ 6: 0, 5: 54 }), /Câmara/);
  assert.match(motivoParaAbortar({ 6: 513, 5: 40 }), /Senado/);
  assert.equal(motivoParaAbortar({ 6: 513, 5: 54 }), null);
});

test('a previsão morre na posse', () => {
  assert.equal(aindaVale('2026-10-06'), true);
  assert.equal(aindaVale('2027-01-31'), true);
  assert.equal(aindaVale('2027-02-01'), false);
});

// ---------- Câmara ----------

test('deputado reeleito fica; eleito ao Senado muda de casa', () => {
  assert.deepEqual(destinoNaLegislatura(dep(), linha(), idx(linha())), { destino: 'fica' });
  const s = linha({ CD_CARGO: '5', CD_SIT_TOT_TURNO: '1' });
  assert.deepEqual(destinoNaLegislatura(dep(), s, idx(s)), { destino: 'muda' });
});

test('CPF do TSE sem zero à esquerda ainda acha o eleito', () => {
  const l = linha({ NR_CPF_CANDIDATO: '1234567890' });
  assert.equal(destinoNaLegislatura(dep({ cpf: '01234567890' }), l, idx(l)).destino, 'fica');
});

test('suplente e não eleito na própria cadeira saem como "não reeleito"', () => {
  for (const c of ['4', '5']) {
    const l = linha({ CD_SIT_TOT_TURNO: c });
    assert.deepEqual(destinoNaLegislatura(dep(), l, idx(l)), { destino: 'sai', motivo: 'nao-reeleito' });
  }
});

test('deputado no 2º turno para governo sai da Câmara em qualquer resultado', () => {
  const l = linha({ CD_CARGO: '3', CD_SIT_TOT_TURNO: '6' });
  assert.deepEqual(destinoNaLegislatura(dep(), l, idx(l)), { destino: 'sai', motivo: 'outro-cargo' });
});

test('sem candidatura casada e fora da lista de eleitos: fim de mandato', () => {
  assert.deepEqual(destinoNaLegislatura(dep(), undefined, idx(linha({ NR_CPF_CANDIDATO: '999' }))),
    { destino: 'sai', motivo: 'fim-de-mandato' });
});

test('#NULO na própria cadeira não afirma nada — o voto pode ser validado depois', () => {
  const l = linha({ CD_SIT_TOT_TURNO: '-1' });
  assert.equal(destinoNaLegislatura(dep(), l, idx(l)), null);
});

test('deputado sem CPF na fonte fica sem afirmação', () => {
  assert.equal(destinoNaLegislatura(dep({ cpf: '' }), undefined, idx()), null);
});

// ---------- Senado ----------

const senLinha = (over = {}) => linha({
  CD_CARGO: '5', SG_UF: 'PR', NM_CANDIDATO: 'MARIA SOUZA LIMA', NM_URNA_CANDIDATO: 'MARIA LIMA',
  NR_CPF_CANDIDATO: '', CD_SIT_TOT_TURNO: '1', ...over,
});

test('senador da turma de 2018 reeleito fica; derrotado sai', () => {
  const ok = senLinha();
  assert.equal(destinoNaLegislatura(sen(), ok, idx(ok)).destino, 'fica');
  const perdeu = senLinha({ CD_SIT_TOT_TURNO: '4' });
  assert.deepEqual(destinoNaLegislatura(sen(), perdeu, idx()), { destino: 'sai', motivo: 'nao-reeleito' });
});

test('nome civil grafado diferente: eleito parecido na UF impede o "sai"', () => {
  // o TSE tem o sobrenome a mais — o nome exato não casa, mas é a mesma pessoa
  const e = senLinha({ NM_CANDIDATO: 'MARIA DE SOUZA LIMA FILHA' });
  assert.equal(destinoNaLegislatura(sen(), undefined, idx(e)), null);
  // nome de urna idêntico ao parlamentar também basta para a dúvida
  const u = senLinha({ NM_CANDIDATO: 'OUTRA PESSOA', NM_URNA_CANDIDATO: 'MARIA LIMA' });
  assert.equal(destinoNaLegislatura(sen(), undefined, idx(u)), null);
  // eleito de OUTRA UF parecido não gera dúvida
  const fora = senLinha({ NM_CANDIDATO: 'MARIA DE SOUZA LIMA FILHA', SG_UF: 'SC' });
  assert.deepEqual(destinoNaLegislatura(sen(), undefined, idx(fora)), { destino: 'sai', motivo: 'fim-de-mandato' });
});

test('candidatura casada pelo nome exato: eleito parecido na UF é parente, não dúvida', () => {
  const propria = senLinha({ CD_CARGO: '9', CD_SIT_TOT_TURNO: '1' });
  const filho = senLinha({ CD_CARGO: '6', NM_CANDIDATO: 'MARIA SOUZA LIMA FILHA', NM_URNA_CANDIDATO: 'MARIA FILHA' });
  assert.deepEqual(destinoNaLegislatura(sen(), propria, idx(filho)), { destino: 'sai', motivo: 'outro-cargo' });
});

test('senador com mandato até 2031 segue — salvo eleito para outro cargo', () => {
  const s = sen({ fimMandato: '2031-01-31' });
  assert.deepEqual(destinoNaLegislatura(s, undefined, idx()), { destino: 'segue' });
  const perdeuGov = senLinha({ CD_CARGO: '3', CD_SIT_TOT_TURNO: '4' });
  assert.deepEqual(destinoNaLegislatura(s, perdeuGov, idx()), { destino: 'segue' });
  const ganhouGov = senLinha({ CD_CARGO: '3', CD_SIT_TOT_TURNO: '1' });
  assert.deepEqual(destinoNaLegislatura(s, ganhouGov, idx()), { destino: 'sai', motivo: 'outro-cargo' });
  const segundo = senLinha({ CD_CARGO: '3', CD_SIT_TOT_TURNO: '6' });
  assert.deepEqual(destinoNaLegislatura(s, segundo, idx()), { destino: 'pendente', motivo: 'outro-cargo' });
  // eleito suplente de senador não assume nada em fevereiro
  const supl = senLinha({ CD_CARGO: '9', CD_SIT_TOT_TURNO: '1' });
  assert.deepEqual(destinoNaLegislatura(s, supl, idx()), { destino: 'segue' });
});

test('suplente em exercício numa cadeira até 2031 fica sem afirmação', () => {
  assert.equal(destinoNaLegislatura(sen({ fimMandato: '2031-01-31', titular: false }), undefined, idx()), null);
});

test('suplente em exercício numa cadeira que acaba em 2027 sai com ela', () => {
  assert.deepEqual(destinoNaLegislatura(sen({ titular: false }), undefined, idx()),
    { destino: 'sai', motivo: 'fim-de-mandato' });
});

test('senador sem fim de mandato conhecido fica sem afirmação', () => {
  assert.equal(destinoNaLegislatura(sen({ fimMandato: undefined }), undefined, idx()), null);
});

// ---------- agregação ----------

const p = (over) => ({ slug: 'x', nome: 'X', casa: 'camara', uf: 'SP', partido: 'AA', tier: 'B', ops: 50, fora: false, ...over });

test('taxa de reeleição só conta quem disputou a própria cadeira', () => {
  const a = agregaEleicao([
    p({ slug: 'a', eleicao2026: { destino: 'fica' } }),
    p({ slug: 'b', eleicao2026: { destino: 'sai', motivo: 'nao-reeleito', situacao: 'suplente' } }),
    // foi para o governo: não "perdeu a reeleição"
    p({ slug: 'c', eleicao2026: { destino: 'sai', motivo: 'outro-cargo', situacao: 'eleito' } }),
    p({ slug: 'd', eleicao2026: { destino: 'sai', motivo: 'fim-de-mandato' } }),
  ]);
  assert.deepEqual(a.reeleicaoPorTier, [{ tier: 'B', disputaram: 2, reeleitos: 1 }]);
  assert.deepEqual(a.motivos, { naoReeleito: 1, outroCargoEleito: 1, outroCargoSegundoTurno: 0, outroCargoNaoEleito: 0, fimDeMandato: 1 });
  assert.equal(a.paraOutroCargo.length, 1);
});

test('sem afirmação vai para "indefinido", nunca para quem fica', () => {
  const a = agregaEleicao([p({ slug: 'a' }), p({ slug: 'b', eleicao2026: { destino: 'fica' } })]);
  assert.equal(a.casas.camara.indefinido, 1);
  assert.equal(a.casas.camara.fica, 1);
  assert.equal(a.casas.camara.total, 2);
});

test('fora do ranking tem balde próprio e não entra no "topo"', () => {
  const a = agregaEleicao([
    p({ slug: 'a', tier: 'S', fora: true, eleicao2026: { destino: 'sai', motivo: 'fim-de-mandato' } }),
    p({ slug: 'b', tier: 'A', eleicao2026: { destino: 'sai', motivo: 'nao-reeleito' } }),
  ]);
  assert.deepEqual(a.porTier.map((t) => t.tier), ['A', 'fora']);
  assert.deepEqual(a.saemDoTopo.map((x) => x.slug), ['b']);
});
