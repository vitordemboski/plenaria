import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_PRINCIPAIS, TIPOS_EMENDA, ehFiscalizacao, alinhamento, senadoAvancou, senadoVirouNorma } from './classificacao.mjs';

test('tipos principais (Ataque) seguem inalterados', () => {
  assert.deepEqual([...TIPOS_PRINCIPAIS].sort(), ['PDL', 'PEC', 'PL', 'PLP']);
});

test('emendas (Técnica) são EMC, EMP e EMR', () => {
  assert.deepEqual([...TIPOS_EMENDA].sort(), ['EMC', 'EMP', 'EMR']);
});

test('RIC e PFC são fiscalização', () => {
  assert.equal(ehFiscalizacao('RIC', 'Requerimento de Informação'), true);
  assert.equal(ehFiscalizacao('PFC', 'Proposta de Fiscalização e Controle'), true);
});

test('REQ de convocação de ministro é fiscalização', () => {
  assert.equal(ehFiscalizacao('REQ', 'Requerimento de Convocação de Ministro de Estado no Plenário'), true);
  assert.equal(ehFiscalizacao('REQ', 'Requerimento de Convocação de Ministro de Estado na Comissão (art. 50, caput, da CF)'), true);
  assert.equal(ehFiscalizacao('REQ', 'Requerimento para envio de Requerimento de Informação pela Comissão'), true);
});

// O REQ é um saco de gatos: 2.553 "votos de regozijo" em 2025. Nada disso é fiscalizar.
test('REQ cerimonial ou processual NÃO é fiscalização', () => {
  for (const d of [
    'Requerimento de Voto de regozijo ou louvor',
    'Requerimento de Moção',
    'Requerimento de Sessão Solene',
    'Requerimento de Apensação',
    'Requerimento de Urgência (Art. 155 do RICD)',
    'Requerimento de Retirada de Proposição de Iniciativa Individual',
    'Requerimento de Inclusão de Matéria na Ordem do Dia',
    'Requerimento (Outros)',
  ]) {
    assert.equal(ehFiscalizacao('REQ', d), false, `deveria excluir: ${d}`);
  }
});

// Decisão explícita do produto: audiência pública pode ser sobre qualquer
// projeto, não é necessariamente controle do Executivo.
test('Requerimento de Audiência Pública fica FORA da fiscalização', () => {
  assert.equal(ehFiscalizacao('REQ', 'Requerimento de Audiência Pública'), false);
});

test('PL não é fiscalização', () => {
  assert.equal(ehFiscalizacao('PL', 'Projeto de Lei'), false);
});

test('alinhamento = votos iguais à orientação ÷ votos comparáveis', () => {
  const orientacaoGov = new Map([['v1', 'Sim'], ['v2', 'Não'], ['v3', 'Sim'], ['v4', 'Sim']]);
  const votosDep = new Map([['v1', 'Sim'], ['v2', 'Não'], ['v3', 'Não'], ['v4', 'Sim']]);
  assert.deepEqual(alinhamento(votosDep, orientacaoGov), { iguais: 3, comparaveis: 4, taxa: 0.75 });
});

// Obstrução/Liberado não são posição: o Governo liberou a bancada, não há o que seguir.
test('ignora votação em que o Governo não orientou Sim ou Não', () => {
  const orientacaoGov = new Map([['v1', 'Sim'], ['v2', 'Liberado'], ['v3', 'Obstrução'], ['v4', '']]);
  const votosDep = new Map([['v1', 'Sim'], ['v2', 'Sim'], ['v3', 'Sim'], ['v4', 'Sim']]);
  assert.deepEqual(alinhamento(votosDep, orientacaoGov), { iguais: 1, comparaveis: 1, taxa: 1 });
});

// Abstenção, obstrução e "Artigo 17" não são Sim nem Não — não dá para dizer se
// concordou. Ausência idem: já é penalizada na Stamina, não pode contar duas vezes.
test('ignora voto do deputado que não seja Sim ou Não', () => {
  const orientacaoGov = new Map([['v1', 'Sim'], ['v2', 'Sim'], ['v3', 'Sim']]);
  const votosDep = new Map([['v1', 'Sim'], ['v2', 'Abstenção'], ['v3', 'Artigo 17']]);
  assert.deepEqual(alinhamento(votosDep, orientacaoGov), { iguais: 1, comparaveis: 1, taxa: 1 });
});

test('sem votação comparável, taxa é null (não é zero!)', () => {
  assert.deepEqual(alinhamento(new Map(), new Map()), { iguais: 0, comparaveis: 0, taxa: null });
});

// ---------- Eficiência do Senado ----------

test('avançou: a matéria saiu do limbo e caminhou para virar lei', () => {
  for (const s of ['TRANSFORMADA EM NORMA JURÍDICA', 'REMETIDA À CÂMARA DOS DEPUTADOS',
    'REMETIDA À SANÇÃO', 'PRONTA PARA A PAUTA NA COMISSÃO', 'PRONTO PARA DELIBERAÇÃO DO PLENÁRIO',
    'APROVADA', 'INCLUÍDA EM ORDEM DO DIA']) {
    assert.equal(senadoAvancou(s), true, s);
  }
});

// O limbo é a maioria absoluta do acervo (3.211 das 4.839 matérias da legislatura):
// se qualquer um destes contasse como avanço, a Eficiência viraria ruído.
test('NÃO avançou: o limbo inicial de comissão e os desfechos negativos', () => {
  for (const s of ['AGUARDANDO DESPACHO', 'AGUARDANDO DESIGNAÇÃO DO RELATOR',
    'MATÉRIA COM A RELATORIA', 'AGUARDANDO RECEBIMENTO DE EMENDAS', 'PEDIDO DE VISTA CONCEDIDO',
    'RETIRADA PELO AUTOR', 'ARQUIVADA', 'PREJUDICADA', 'REJEITADA']) {
    assert.equal(senadoAvancou(s), false, s);
  }
});

// Status desconhecido cai no default seguro. O contrário — casar por acidente —
// inflaria a Eficiência de quem não entregou nada, em silêncio.
test('status novo/vazio não avança (allowlist, nunca regex)', () => {
  assert.equal(senadoAvancou('SITUAÇÃO QUE O SENADO INVENTOU AMANHÃ'), false);
  assert.equal(senadoAvancou(''), false);
  assert.equal(senadoAvancou(null), false);
  assert.equal(senadoAvancou(undefined), false);
});

test('normaliza caixa e espaços (o /processo devolve em caixa variável)', () => {
  assert.equal(senadoAvancou('  Transformada em Norma Jurídica  '), true);
  assert.equal(senadoVirouNorma('transformada em norma jurídica'), true);
});

test('virou norma é subconjunto ESTRITO de avançou', () => {
  for (const s of ['TRANSFORMADA EM NORMA JURÍDICA', 'TRANSFORMADA EM NORMA JURÍDICA COM VETO PARCIAL']) {
    assert.equal(senadoVirouNorma(s), true, s);
    assert.equal(senadoAvancou(s), true, s);
  }
  // avançar não é virar lei: remetida à Câmara ainda pode morrer lá
  assert.equal(senadoVirouNorma('REMETIDA À CÂMARA DOS DEPUTADOS'), false);
  assert.equal(senadoVirouNorma('PRONTA PARA A PAUTA NA COMISSÃO'), false);
});

// O veto é ato do Executivo: a matéria foi aprovada pelas DUAS casas. Contar como
// "não avançou" seria falso; contar como norma seria falso do outro lado.
test('vetada avançou, mas não virou norma', () => {
  assert.equal(senadoAvancou('VETADA'), true);
  assert.equal(senadoVirouNorma('VETADA'), false);
});
