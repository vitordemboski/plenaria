import test from 'node:test';
import assert from 'node:assert/strict';
import { licencaCamara, licencaSenado, causaDesconhecida, CAUSAS_LICENCA } from './licenciados.mjs';

// ---------- Câmara: a situação do último status já é vocabulário controlado ----------

test('Câmara: situação "Licença" devolve a data do afastamento', () => {
  assert.deepEqual(
    licencaCamara({ situacao: 'Licença', condicaoEleitoral: 'Titular', data: '2025-10-29' }),
    { desde: '2025-10-29' });
});

test('Câmara: quem está em exercício não é licenciado', () => {
  assert.equal(licencaCamara({ situacao: 'Exercício', data: '2023-02-01' }), null);
});

// Vacância é a cadeira VAGA — morte, cassação, renúncia. Chamar isso de "licença"
// publicaria que um parlamentar morto está afastado temporariamente.
test('Câmara: vacância e suplência NÃO são licença', () => {
  assert.equal(licencaCamara({ situacao: 'Vacância', data: '2024-05-01' }), null);
  assert.equal(licencaCamara({ situacao: 'Suplência', data: '2024-05-01' }), null);
  assert.equal(licencaCamara({ situacao: 'Convocado', data: '2026-07-09' }), null);
});

test('Câmara: status ausente ou vazio não vira licença', () => {
  assert.equal(licencaCamara(null), null);
  assert.equal(licencaCamara({}), null);
});

test('Câmara: licença sem data não é publicável — precisa do "desde"', () => {
  assert.equal(licencaCamara({ situacao: 'Licença', data: null }), null);
});

// ---------- Senado: SiglaCausaAfastamento, código a código ----------

const mandato = (leg, exercicios) => ({
  DescricaoParticipacao: 'Titular',
  UfParlamentar: 'SC',
  PrimeiraLegislaturaDoMandato: { NumeroLegislatura: String(leg) },
  SegundaLegislaturaDoMandato: { NumeroLegislatura: String(leg + 1) },
  Exercicios: { Exercicio: exercicios },
});

test('Senado: LCS (licença com convocação de suplente) é licença', () => {
  const m = [mandato(57, [{ DataInicio: '2023-02-01', DataFim: '2026-05-05', SiglaCausaAfastamento: 'LCS' }])];
  assert.deepEqual(licencaSenado(m, 57), { desde: '2026-05-05' });
});

test('Senado: AFO (afastamento do exercício) é licença', () => {
  const m = [mandato(57, [{ DataInicio: '2023-02-01', DataFim: '2026-05-06', SiglaCausaAfastamento: 'AFO' }])];
  assert.deepEqual(licencaSenado(m, 57), { desde: '2026-05-06' });
});

// O erro que essa allowlist existe para impedir: dois senadores da legislatura 57
// constam fora do exercício por FALECIMENTO, e um por CASSAÇÃO.
test('Senado: falecimento, cassação e renúncia NUNCA são licença', () => {
  for (const sigla of ['FAL', 'CAS', 'REN']) {
    const m = [mandato(57, [{ DataInicio: '2019-02-01', DataFim: '2021-03-19', SiglaCausaAfastamento: sigla }])];
    assert.equal(licencaSenado(m, 57), null, `${sigla} não pode virar licença`);
  }
});

// TER encerra o mandato no fim da legislatura; RET encerra o exercício do SUPLENTE
// quando o titular volta — nenhum dos dois é alguém afastado da cadeira.
test('Senado: término de mandato e retorno do titular não são licença', () => {
  for (const sigla of ['TER', 'RET']) {
    const m = [mandato(57, [{ DataInicio: '2023-02-01', DataFim: '2027-01-31', SiglaCausaAfastamento: sigla }])];
    assert.equal(licencaSenado(m, 57), null);
  }
});

// A API grava 'LP ' e 'LS ' com espaço à direita — sem trim a allowlist erra o alvo.
test('Senado: sigla com espaço à direita ainda casa', () => {
  const m = [mandato(57, [{ DataInicio: '2023-02-01', DataFim: '2025-08-10', SiglaCausaAfastamento: 'LP ' }])];
  assert.deepEqual(licencaSenado(m, 57), { desde: '2025-08-10' });
});

test('Senado: exercício aberto (sem DataFim) é presença, não licença', () => {
  const m = [mandato(57, [{ DataInicio: '2023-02-01' }])];
  assert.equal(licencaSenado(m, 57), null);
});

// Vale a MESMA regra do resto da ingestão do Senado: a API devolve a carreira toda.
test('Senado: mandato de outra legislatura é ignorado', () => {
  const m = [mandato(54, [{ DataInicio: '2011-02-01', DataFim: '2015-01-01', SiglaCausaAfastamento: 'REN' }])];
  assert.equal(licencaSenado(m, 57), null);
});

test('Senado: vale o ÚLTIMO exercício, não o primeiro', () => {
  // afastou-se em 2023, voltou, e só depois se licenciou
  const m = [mandato(57, [
    { DataInicio: '2023-02-01', DataFim: '2023-02-02', SiglaCausaAfastamento: 'AFO' },
    { DataInicio: '2023-03-01' },
  ])];
  assert.equal(licencaSenado(m, 57), null);
});

test('Senado: mandatos ausentes/vazios não quebram', () => {
  assert.equal(licencaSenado(undefined, 57), null);
  assert.equal(licencaSenado([], 57), null);
  assert.equal(licencaSenado([mandato(57, [])], 57), null);
});

// Código novo é LOGADO pela ingestão e tratado como NÃO-licença: omitir alguém é o
// status quo, afirmar "licenciado" sobre uma cassação é publicar coisa errada.
test('causaDesconhecida aponta sigla fora do vocabulário conhecido', () => {
  assert.equal(causaDesconhecida('XYZ'), true);
  assert.equal(causaDesconhecida('LCS'), false);
  assert.equal(causaDesconhecida('FAL'), false);
  assert.equal(causaDesconhecida('LP '), false);
  assert.equal(causaDesconhecida(''), false);
  assert.equal(causaDesconhecida(undefined), false);
});

test('sigla desconhecida não vira licença', () => {
  const m = [mandato(57, [{ DataInicio: '2023-02-01', DataFim: '2026-01-01', SiglaCausaAfastamento: 'XYZ' }])];
  assert.equal(licencaSenado(m, 57), null);
});

test('a allowlist de licença não contém nenhuma causa definitiva', () => {
  for (const definitiva of ['FAL', 'CAS', 'REN', 'TER', 'RET']) {
    assert.equal(CAUSAS_LICENCA.has(definitiva), false, `${definitiva} não pode estar na allowlist`);
  }
});
