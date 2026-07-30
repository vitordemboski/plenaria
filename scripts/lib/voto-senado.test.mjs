import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareceu, registrouVoto, codigoDesconhecido } from './voto-senado.mjs';

const reg = (SiglaDescricaoVoto, DescricaoVoto = '') => ({ SiglaDescricaoVoto, DescricaoVoto });

test('voto registrado é presença', () => {
  for (const s of ['Sim', 'Não', 'Abstenção', 'Votou']) {
    assert.equal(compareceu(reg(s)), true, s);
  }
});

test('"Presente – Não registrou voto" é presença — a Stamina mede comparecimento', () => {
  assert.equal(compareceu(reg('P-NRV', 'Presente – Não registrou voto')), true);
});

test('quem presidia a sessão estava lá (por regimento não vota)', () => {
  assert.equal(compareceu(reg('Presidente (art. 51 RISF)')), true);
});

test('licenças e não-comparecimento são ausência', () => {
  assert.equal(compareceu(reg('NCom', 'Não Compareceu')), false);
  assert.equal(compareceu(reg('LS', 'Licença saúde')), false);
  assert.equal(compareceu(reg('LP', 'Licença Particular')), false);
  assert.equal(compareceu(reg('LAP', 'Licença paternidade ou ao adotante')), false);
});

// A regressão que motivou o módulo: MIS e AP são a MESMA natureza — ausência a
// serviço da Casa. O regex antigo descontava AP e deixava MIS passar como presença,
// em 593 votações e 45 dos 81 senadores.
test('missão da Casa é ausência, igual a atividade parlamentar', () => {
  assert.equal(compareceu(reg('AP', 'Atividade parlamentar')), false);
  assert.equal(compareceu(reg('MIS', 'Missão da Casa no País/exterior')), false);
});

test('o regex de fallback também pega missão — nenhuma das duas grafias escapa', () => {
  assert.equal(compareceu({ DescricaoVoto: 'Missão da Casa no País/exterior' }), false);
  assert.equal(compareceu({ DescricaoVoto: 'Missao no exterior' }), false);
});

test('"Abstenção" não é confundida com ausência pelo fallback', () => {
  assert.equal(compareceu({ DescricaoVoto: 'Abstenção' }), true);
});

// As duas taxas da ficha do senador: a Câmara só registra voto efetivo, então
// comparecer e votar são a mesma coisa lá. No Senado não são, e exibir só a presença
// ao lado da taxa do deputado sugeriria uma comparação que não existe.
test('"Presente – Não registrou voto" é presença mas NÃO é voto registrado', () => {
  const pnrv = reg('P-NRV', 'Presente – Não registrou voto');
  assert.equal(compareceu(pnrv), true);
  assert.equal(registrouVoto(pnrv), false);
});

test('voto efetivo conta nas duas taxas', () => {
  for (const s of ['Sim', 'Não', 'Abstenção', 'Votou']) {
    assert.equal(compareceu(reg(s)), true, s);
    assert.equal(registrouVoto(reg(s)), true, s);
  }
});

test('ausência não conta em nenhuma das duas taxas', () => {
  for (const [s, d] of [['AP', 'Atividade parlamentar'], ['MIS', 'Missão da Casa no País/exterior'], ['NCom', 'Não Compareceu']]) {
    assert.equal(compareceu(reg(s, d)), false, s);
    assert.equal(registrouVoto(reg(s, d)), false, s);
  }
});

test('código novo é sinalizado em vez de virar presença em silêncio', () => {
  assert.equal(codigoDesconhecido('XYZ'), true);
  assert.equal(codigoDesconhecido('MIS'), false);
  assert.equal(codigoDesconhecido('Sim'), false);
  assert.equal(codigoDesconhecido(''), false);
  assert.equal(codigoDesconhecido(undefined), false);
});
