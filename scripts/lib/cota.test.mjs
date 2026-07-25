import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotuloCategoria, resumoCota, dobrarCategorias } from './cota.mjs';

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
      ['POSTO XYZ LTDA', 700],
      ['GRÁFICA ABC', 300],
    ],
  );
  assert.deepEqual(r.fornecedor, { nome: 'POSTO XYZ LTDA', valor: 700, pct: 70 });

  const vazio = resumoCota([['TELEFONIA', 100]], []);
  assert.equal(vazio.fornecedor, null);
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
      ['POSTO XYZ', 400], // já net (o gerador soma por fornecedor antes de chamar)
      ['GRÁFICA ABC', 0],  // fornecedor só-estorno some
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
