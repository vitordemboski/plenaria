import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aindaVale, cargoDesconhecido, casaCandidaturas, chipDaCandidatura, coberturaPorCasa,
  dataIso, motivoParaAbortar, normCpf, normNomeCivil, PLEITO_2026,
} from './candidatura.mjs';

/** linha do TSE como o CSV a entrega (todos os campos são texto) */
const linha = (over = {}) => ({
  CD_CARGO: '6',
  DS_CARGO: 'DEPUTADO FEDERAL',
  SG_UF: 'SP',
  NM_CANDIDATO: 'JOSE DA SILVA',
  NM_URNA_CANDIDATO: 'ZE DA SILVA',
  NR_CPF_CANDIDATO: '12345678901',
  DT_NASCIMENTO: '01/02/1970',
  ...over,
});

const dep = (over = {}) => ({
  casa: 'camara', slug: 'jose-da-silva', uf: 'SP',
  cpf: '12345678901', nomeCivil: 'José da Silva', nascimento: '1970-02-01',
  ...over,
});

const REG = '2026-08-16';

// ---------- normalização ----------

test('CPF do TSE vem sem o zero à esquerda e casa mesmo assim', () => {
  assert.equal(normCpf('1234567890'), '01234567890');
  assert.equal(normCpf('012.345.678-90'), '01234567890');
  assert.equal(normCpf(''), '');
  // lixo maior que um CPF não vira chave truncada
  assert.equal(normCpf('123456789012'), '');
});

test('nome civil normaliza acento, cedilha e espaço duplo para a mesma chave', () => {
  assert.equal(normNomeCivil('José  da Conceição-Júnior'), 'JOSE DA CONCEICAO JUNIOR');
  assert.equal(normNomeCivil('JOSE DA CONCEICAO JUNIOR'), 'JOSE DA CONCEICAO JUNIOR');
});

test('data do TSE (dd/mm/aaaa) vira ISO', () => {
  assert.equal(dataIso('27/10/1945'), '1945-10-27');
  assert.equal(dataIso('1945-10-27'), '1945-10-27');
});

// ---------- rótulo do cargo: vocabulário fechado ----------

test('deputado que concorre à Câmara é reeleição; ao Senado, não', () => {
  assert.deepEqual(chipDaCandidatura(linha(), 'camara', REG),
    { cargo: 'Câmara dos Deputados', curto: 'Câmara', reeleicao: true, suplente: false, uf: 'SP', registroEm: REG });
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '5' }), 'camara', REG).reeleicao, false);
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '5' }), 'senado', REG).reeleicao, true);
});

test('cargo do Executivo entra com a UF no rótulo', () => {
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '3', SG_UF: 'MG' }), 'camara', REG).cargo, 'Governo de MG');
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '1', SG_UF: 'BR' }), 'senado', REG).cargo,
    'Presidência da República');
});

// O card da lista tem ~390px: a forma curta sai do mesmo vocabulário fechado, e não
// de recortar a string longa na UI — recorte quebra calado quando entra rótulo novo.
test('a forma curta do card vem do gerador, não de recorte de string', () => {
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '3', SG_UF: 'MG' }), 'camara', REG).curto, 'Gov. MG');
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '9' }), 'senado', REG).curto, 'Suplente');
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '8', SG_UF: 'DF' }), 'camara', REG).curto, 'CLDF');
});

// Jader Barbalho registrou como 1º suplente de senador: dizer "concorre ao Senado"
// afirmaria coisa diferente da fonte — são cargos diferentes.
test('suplente é rótulo próprio, não "Senado", e não é reeleição de senador', () => {
  const c = chipDaCandidatura(linha({ CD_CARGO: '9' }), 'senado', REG);
  assert.equal(c.cargo, 'Suplente de senador');
  assert.equal(c.suplente, true);
  assert.equal(c.reeleicao, false);
});

test('código de cargo desconhecido fica sem chip e é sinalizado — nunca rótulo cru', () => {
  assert.equal(chipDaCandidatura(linha({ CD_CARGO: '99', DS_CARGO: 'CARGO NOVO' }), 'camara', REG), null);
  assert.equal(cargoDesconhecido(linha({ CD_CARGO: '99' })), true);
  assert.equal(cargoDesconhecido(linha()), false);
});

// ---------- correspondência ----------

test('Câmara casa por CPF mesmo quando o nome de urna é distante do civil', () => {
  const { porSlug } = casaCandidaturas(
    [linha({ NM_CANDIDATO: 'LUIZ ANTONIO TEIXEIRA JUNIOR', NM_URNA_CANDIDATO: 'DR LUIZINHO' })],
    [dep({ nomeCivil: 'Nome Que Não Bate' })], REG);
  assert.equal(porSlug.get('jose-da-silva').cargo, 'Câmara dos Deputados');
});

test('Senado casa por nome civil completo — não há CPF na fonte', () => {
  const sen = { casa: 'senado', slug: 'ze', uf: 'PA', nomeCivil: 'José da Silva', nascimento: '1970-02-01' };
  const { porSlug } = casaCandidaturas(
    [linha({ CD_CARGO: '5', SG_UF: 'PA', NR_CPF_CANDIDATO: '' })], [sen], REG);
  assert.equal(porSlug.get('ze').cargo, 'Senado');
});

// Carlos Viana (22 × 23/03/1963) e Jader Barbalho (1944 × 1945) são candidatos reais
// que o filtro estrito por nascimento descartava.
test('nascimento divergente NÃO reprova match de nome único — só é auditado', () => {
  const sen = { casa: 'senado', slug: 'jader', uf: 'PA', nomeCivil: 'Jader Fontenelle Barbalho', nascimento: '1944-10-27' };
  const { porSlug, nascimentoDivergente } = casaCandidaturas(
    [linha({ CD_CARGO: '9', SG_UF: 'PA', NR_CPF_CANDIDATO: '',
      NM_CANDIDATO: 'JADER FONTENELLE BARBALHO', DT_NASCIMENTO: '27/10/1945' })], [sen], REG);
  assert.equal(porSlug.get('jader').cargo, 'Suplente de senador');
  assert.deepEqual(nascimentoDivergente, [{ slug: 'jader', base: '1944-10-27', tse: '1945-10-27' }]);
});

test('homônimo desempata por UF e depois por nascimento', () => {
  const sen = { casa: 'senado', slug: 'ze', uf: 'BA', nomeCivil: 'José da Silva', nascimento: '1970-02-01' };
  const dois = [
    linha({ CD_CARGO: '5', SG_UF: 'SP', NR_CPF_CANDIDATO: '', DT_NASCIMENTO: '09/09/1980' }),
    linha({ CD_CARGO: '3', SG_UF: 'BA', NR_CPF_CANDIDATO: '' }),
  ];
  assert.equal(casaCandidaturas(dois, [sen], REG).porSlug.get('ze').cargo, 'Governo de BA');

  const mesmaUf = [
    linha({ CD_CARGO: '5', SG_UF: 'BA', NR_CPF_CANDIDATO: '', DT_NASCIMENTO: '09/09/1980' }),
    linha({ CD_CARGO: '3', SG_UF: 'BA', NR_CPF_CANDIDATO: '' }),
  ];
  assert.equal(casaCandidaturas(mesmaUf, [sen], REG).porSlug.get('ze').cargo, 'Governo de BA');
});

test('homônimo que a cascata não resolve fica SEM chip e é sinalizado', () => {
  const sen = { casa: 'senado', slug: 'ze', uf: 'BA', nomeCivil: 'José da Silva', nascimento: '1970-02-01' };
  const iguais = [
    linha({ CD_CARGO: '5', SG_UF: 'BA', NR_CPF_CANDIDATO: '' }),
    linha({ CD_CARGO: '3', SG_UF: 'BA', NR_CPF_CANDIDATO: '' }),
  ];
  const { porSlug, ambiguos } = casaCandidaturas(iguais, [sen], REG);
  assert.equal(porSlug.has('ze'), false);
  assert.deepEqual(ambiguos, [{ slug: 'ze', n: 2 }]);
});

test('parlamentar ausente do arquivo não recebe chip nem afirmação de ausência', () => {
  const { porSlug } = casaCandidaturas([], [dep()], REG);
  assert.equal(porSlug.size, 0);
});

// ---------- sucesso vazio ----------

test('arquivo sem uma das casas aborta em vez de virar "ninguém se candidatou"', () => {
  const { porCargoTse } = casaCandidaturas([linha()], [dep()], REG);
  assert.match(motivoParaAbortar(porCargoTse), /SENADOR/);

  const ok = casaCandidaturas([linha(), linha({ CD_CARGO: '5', NR_CPF_CANDIDATO: '99999999999' })], [dep()], REG);
  assert.equal(motivoParaAbortar(ok.porCargoTse), null);
  assert.match(motivoParaAbortar(new Map()), /DEPUTADO FEDERAL/);
});

test('cobertura por casa denuncia colapso de match sem reclamar de flutuação', () => {
  const parls = [dep({ slug: 'a' }), dep({ slug: 'b' }), dep({ slug: 'c' }),
    { casa: 'senado', slug: 's1', uf: 'PA' }, { casa: 'senado', slug: 's2', uf: 'PA' }];
  const cob = coberturaPorCasa(new Map([['a', {}], ['b', {}], ['c', {}], ['s1', {}]]), parls);
  assert.deepEqual(cob.find((c) => c.casa === 'camara'), { casa: 'camara', com: 3, total: 3, taxa: 1, baixa: false });
  assert.equal(cob.find((c) => c.casa === 'senado').baixa, false); // 50% > piso de 40%
  assert.equal(coberturaPorCasa(new Map(), parls).find((c) => c.casa === 'camara').baixa, true);
});

// ---------- validade ----------

test('o chip morre no pleito — "concorre" fica falso sozinho em 04/10', () => {
  assert.equal(aindaVale('2026-08-16'), true);
  assert.equal(aindaVale(PLEITO_2026), true);
  assert.equal(aindaVale('2026-10-05'), false);
  assert.equal(aindaVale('2027-01-01'), false);
});
