import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rotuloCategoria, resumoCota, dobrarCategorias,
  chaveFornecedor, destrincharFornecedores, formataCnpj, rankFornecedores,
} from './cota.mjs';

const CNPJ_A = '11.111.111/1111-11';
const CNPJ_B = '22.222.222/2222-22';
const CPF = '123.456.789-00';
const DIVULG = 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.';

test('rótulo cru da CEAP vira rótulo curto conhecido', () => {
  assert.equal(rotuloCategoria('COMBUSTÍVEIS E LUBRIFICANTES.'), 'Combustível');
  assert.equal(rotuloCategoria('DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.'), 'Divulgação');
  assert.equal(rotuloCategoria('MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR'), 'Escritório');
});

test('as várias passagens (SIGEPA/RPA/terrestre) colapsam num só rótulo', () => {
  assert.equal(rotuloCategoria('PASSAGEM AÉREA - SIGEPA'), 'Passagens');
  assert.equal(rotuloCategoria('PASSAGEM AÉREA - RPA'), 'Passagens');
  assert.equal(rotuloCategoria('PASSAGENS TERRESTRES, MARÍTIMAS OU FLUVIAIS'), 'Passagens');
});

test('rótulo cru do CEAPS (Senado) também mapeia', () => {
  assert.equal(rotuloCategoria('Aluguel de imóveis para escritório político, compreendendo despesas concernentes a eles.'), 'Escritório');
  assert.equal(rotuloCategoria('Passagens aéreas, aquáticas e terrestres nacionais'), 'Passagens');
  assert.equal(rotuloCategoria('Contratação de consultorias, assessorias, pesquisas, trabalhos técnicos e outros serviços de apoio ao exercício do mandato parlamentar'), 'Consultoria');
});

test('GUARDRAIL: rótulo desconhecido NÃO é dropado — vira versão limpa (Title Case, sem ponto)', () => {
  // se a fonte inventar uma categoria nova, ela ainda aparece (só sem rótulo curto)
  assert.equal(rotuloCategoria('CATEGORIA NOVA E ESTRANHA.'), 'Categoria nova e estranha');
  assert.equal(rotuloCategoria('  aquisição de TOKENS  '), 'Aquisição de tokens');
});

test('resumoCota agrega, ordena e calcula pct (soma exata = 100)', () => {
  const r = resumoCota(
    [
      ['COMBUSTÍVEIS E LUBRIFICANTES.', 300],
      ['PASSAGEM AÉREA - SIGEPA', 200],
      ['PASSAGEM AÉREA - RPA', 100], // colapsa com a de cima → Passagens 300
      ['TELEFONIA', 100],
    ],
    [],
  );
  assert.equal(r.total, 700);
  assert.deepEqual(
    r.categorias.map((c) => [c.categoria, c.valor, c.pct]),
    [
      ['Combustível', 300, 43],
      ['Passagens', 300, 43],
      ['Telefonia', 100, 14],
    ],
  );
  assert.equal(r.categorias.reduce((t, c) => t + c.pct, 0), 100);
});

test('resumoCota devolve a lista COMPLETA (sem truncar) com pcts somando 100', () => {
  const cats = [
    ['COMBUSTÍVEIS E LUBRIFICANTES.', 600],
    ['PASSAGEM AÉREA - SIGEPA', 500],
    ['MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR', 400],
    ['DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.', 300],
    ['TELEFONIA', 200],
    ['SERVIÇOS POSTAIS', 60],
    ['ASSINATURA DE PUBLICAÇÕES', 40],
  ];
  const r = resumoCota(cats, []);
  assert.equal(r.categorias.length, 7); // nada é dobrado aqui
  assert.equal(r.categorias.reduce((t, c) => t + c.pct, 0), 100);
});

test('dobrarCategorias faz top-5 + "Outros" (por último), pcts ainda somam 100', () => {
  const r = resumoCota(
    [
      ['COMBUSTÍVEIS E LUBRIFICANTES.', 600],
      ['PASSAGEM AÉREA - SIGEPA', 500],
      ['MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR', 400],
      ['DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.', 300],
      ['TELEFONIA', 200],
      ['SERVIÇOS POSTAIS', 60],
      ['ASSINATURA DE PUBLICAÇÕES', 40],
    ],
    [],
  );
  const d = dobrarCategorias(r.categorias, 5);
  const rotulos = d.map((c) => c.categoria);
  assert.equal(rotulos.length, 6); // 5 + Outros
  assert.equal(rotulos[5], 'Outros');
  assert.equal(d[5].valor, 100); // 60 + 40
  assert.equal(d.reduce((t, c) => t + c.pct, 0), 100);
});

test('dobrarCategorias com ≤ top não cria "Outros"', () => {
  const r = resumoCota([['TELEFONIA', 100], ['COMBUSTÍVEIS E LUBRIFICANTES.', 50]], []);
  const d = dobrarCategorias(r.categorias, 5);
  assert.deepEqual(d.map((c) => c.categoria), ['Telefonia', 'Combustível']);
});

test('maior fornecedor único vem em fornecedor; vazio → null', () => {
  const r = resumoCota(
    [['TELEFONIA', 100]],
    [
      [CNPJ_A, 'POSTO XYZ LTDA', 'COMBUSTÍVEIS E LUBRIFICANTES.', 700],
      [CNPJ_B, 'GRÁFICA ABC', 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.', 300],
    ],
  );
  assert.deepEqual(r.fornecedor, { nome: 'POSTO XYZ LTDA', valor: 700, pct: 70 });

  const vazio = resumoCota([['TELEFONIA', 100]], []);
  assert.equal(vazio.fornecedor, null);
});

test('grafias diferentes do MESMO CNPJ somam (era o bug: agrupava por nome)', () => {
  const r = resumoCota(
    [['DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.', 1000]],
    [
      [CNPJ_A, 'Facebook Serviços Online do Brasil Ltda.', DIVULG, 300],
      [CNPJ_A, 'FACEBOOK SERVICOS ONLINE DO BRASIL LTDA', DIVULG, 250],
      [CNPJ_A, 'facebook servicos online', DIVULG, 80],
      [CNPJ_B, 'GRÁFICA ABC', DIVULG, 370],
    ],
  );
  // por nome, o líder seria a GRÁFICA com 37%; por CNPJ é a soma das 3 grafias
  assert.equal(r.fornecedor.valor, 630);
  assert.equal(r.fornecedor.pct, 63);
  // exibe a grafia com mais R$ dentro do documento
  assert.equal(r.fornecedor.nome, 'Facebook Serviços Online do Brasil Ltda.');
});

test('lançamento sem documento (SIGEPA) agrupa pelo nome — nunca é dropado', () => {
  const r = resumoCota(
    [['PASSAGEM AÉREA - SIGEPA', 500]],
    [
      ['', 'TAM', 'PASSAGEM AÉREA - SIGEPA', 300],
      ['', 'GOL', 'PASSAGEM AÉREA - SIGEPA', 200],
    ],
  );
  assert.deepEqual(r.fornecedor, { nome: 'TAM', valor: 300, pct: 60 });
});

test('chaveFornecedor/destrinchar sobrevive a nome com espaço e a doc torto', () => {
  const m = new Map();
  m.set(chaveFornecedor('085.324.290/0013-1', 'AMORETTO CAFES EXPRESSO LTDA', 'TELEFONIA'), 1467);
  m.set(chaveFornecedor('', 'TAM'), 900);
  assert.deepEqual(destrincharFornecedores(m), [
    ['08532429000131', 'AMORETTO CAFES EXPRESSO LTDA', 'TELEFONIA', 1467],
    ['', 'TAM', '', 900],
  ]);
  assert.deepEqual(destrincharFornecedores(undefined), []);
});

test('fornecedor PESSOA FÍSICA não leva nome — vai o que foi contratado', () => {
  const r = resumoCota(
    [['MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR', 1_418_225]],
    [
      [CPF, 'NOME DE PESSOA FÍSICA', 'MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR', 494_000],
      [CNPJ_A, 'GRÁFICA ABC', DIVULG, 300_000],
    ],
  );
  assert.equal(r.fornecedor.pessoaFisica, true);
  assert.equal(r.fornecedor.nome, 'Escritório'); // rótulo do gasto, não a pessoa
  assert.equal(r.fornecedor.valor, 494_000);
  // o nome não pode sobreviver em NENHUM campo do objeto emitido
  assert.ok(!JSON.stringify(r).includes('NOME DE PESSOA'));
});

test('CNPJ vencedor mantém a razão social (a minimização é só p/ pessoa física)', () => {
  const r = resumoCota(
    [['TELEFONIA', 100]],
    [
      [CNPJ_A, 'POSTO XYZ LTDA', 'COMBUSTÍVEIS E LUBRIFICANTES.', 700],
      [CPF, 'NOME DE PESSOA FÍSICA', 'MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR', 300],
    ],
  );
  assert.equal(r.fornecedor.nome, 'POSTO XYZ LTDA');
  assert.equal(r.fornecedor.pessoaFisica, undefined);
});

test('formataCnpj reformata a partir do dígito (a fonte pontua errado)', () => {
  assert.equal(formataCnpj('085.324.290/0013-1'), '08.532.429/0001-31');
  assert.equal(formataCnpj('12345678901'), '12345678901'); // CPF não é reformatado
});

test('rankFornecedores: só CNPJ, agrupado por documento, com o que ficou fora', () => {
  const r = rankFornecedores([
    ['dep-a', CNPJ_A, 'LOCADORA X LTDA', 600_000],
    ['dep-b', CNPJ_A, 'Locadora X', 400_000],   // outra grafia, outro parlamentar
    ['dep-a', CNPJ_B, 'GRÁFICA ABC', 300_000],
    ['dep-a', CPF, 'JOÃO DA SILVA', 250_000],   // pessoa física: fora do ranking
    ['dep-a', '', 'TAM', 150_000],              // sem documento: fora do ranking
  ], 2_000_000, 5);

  assert.equal(r.nEmpresas, 2);
  assert.equal(r.totalMi, 1.3);            // 1,0 mi + 0,3 mi (só CNPJ)
  assert.equal(r.semCnpjMi, 0.7);          // 2,0 mi de cota − 1,3 mi identificado
  assert.deepEqual(r.empresas[0], {
    nome: 'LOCADORA X LTDA', cnpj: '11.111.111/1111-11',
    valorMil: 1000, pct: 76.92, nParl: 2,
  });
  assert.equal(r.empresas[1].nParl, 1);
  assert.deepEqual(r.concentracao, [{ top: 1, pct: 76.9 }]); // degraus > nEmpresas não aparecem
});

test('rankFornecedores sem nada não divide por zero', () => {
  const r = rankFornecedores([], 0);
  assert.deepEqual(r, { totalMi: 0, semCnpjMi: 0, nEmpresas: 0, empresas: [], concentracao: [] });
});

test('estorno é abatido (net) e categoria só-estorno some da barra', () => {
  const r = resumoCota(
    [
      ['COMBUSTÍVEIS E LUBRIFICANTES.', 500],
      ['COMBUSTÍVEIS E LUBRIFICANTES.', -100], // estorno → Combustível net 400
      ['TELEFONIA', 100],
      ['TELEFONIA', -100], // zerou → não entra
    ],
    [
      [CNPJ_A, 'POSTO XYZ', 'COMBUSTÍVEIS E LUBRIFICANTES.', 400], // já net (o gerador soma antes)
      [CNPJ_B, 'GRÁFICA ABC', 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.', 0], // só-estorno some
    ],
  );
  assert.equal(r.total, 400);
  assert.deepEqual(r.categorias.map((c) => [c.categoria, c.valor, c.pct]), [['Combustível', 400, 100]]);
  assert.deepEqual(r.fornecedor, { nome: 'POSTO XYZ', valor: 400, pct: 100 });
});

test('sem lançamentos → total 0, categorias vazias, fornecedor null', () => {
  const r = resumoCota([], []);
  assert.deepEqual(r, { total: 0, categorias: [], fornecedor: null });
});
