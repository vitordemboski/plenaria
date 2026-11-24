import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnostico } from './sanidade.mjs';

const meta = { pesos: { economia: 0.12 }, updatedAt: '2026-11-24', geradoEm: '2026-11-24',
  eleicao2026: { posseEm: '2027-02-01' } };
// casa sadia: gasto positivo, economia percentílica (~40% abaixo de 40)
const casa = (c, n, over = () => ({})) => Array.from({ length: n }, (_, i) => ({
  nome: `${c}${i}`, casa: c, uf: ['SP', 'RJ', 'MG', 'BA'][i % 4], gastoMensalMedioMil: 30 + (i % 10),
  statRaw: { ataque: 5 }, prioridades: {}, stats: { economia: (i * 100) / n },
  eleicao2026: { destino: 'fica' }, ...over(i),
}));
const sadio = () => [...casa('camara', 50), ...casa('senado', 20)];

test('dado sadio não falha nem avisa', () => {
  const r = diagnostico(sadio(), meta, [], { hoje: '2026-11-24' });
  assert.deepEqual(r.falhas, []);
  assert.deepEqual(r.avisos, []);
});

// 2026-11-24: o /despesas devolveu valorLiquido com sinal trocado; a mediana da casa foi a −27
test('cota com sinal invertido falha', () => {
  const ps = [...casa('camara', 50, () => ({ gastoMensalMedioMil: -27 })), ...casa('senado', 20)];
  const r = diagnostico(ps, meta, [], { hoje: '2026-11-24' });
  assert.ok(r.falhas.some((f) => /NEGATIVO/.test(f)));
  assert.ok(r.falhas.some((f) => /mediana da cota/.test(f)));
});

test('dezenas sem prioridades é a fonte, unidades não', () => {
  const muitos = [...casa('camara', 50, (i) => (i < 30 ? { prioridades: null } : {})), ...casa('senado', 20)];
  assert.ok(diagnostico(muitos, meta).falhas.some((f) => /sem prioridades/.test(f)));
  const poucos = [...casa('camara', 50, (i) => (i < 3 ? { prioridades: null } : {})), ...casa('senado', 20)];
  assert.deepEqual(diagnostico(poucos, meta).falhas, []);
});

test('escala que joga a casa no vermelho falha', () => {
  const ps = [...casa('camara', 50, (i) => ({ stats: { economia: i < 40 ? 10 : 90 } })), ...casa('senado', 20)];
  assert.ok(diagnostico(ps, meta).falhas.some((f) => /abaixo de 40 em economia/.test(f)));
});

test('bulk de cache antigo avisa, não falha', () => {
  const r = diagnostico(sadio(), meta, [{ nome: 'proposicoes-2025.csv', dias: 14.6 }, { nome: 'x.csv', dias: 0.1 }]);
  assert.deepEqual(r.falhas, []);
  assert.match(r.avisos.join(), /proposicoes-2025\.csv \(15d\)/);
});

// 2026-11-24: o Amapá veio inteiro #NULO no TSE — os deputados de lá sem afirmação
test('sem afirmação concentrada numa UF avisa', () => {
  const ps = [...casa('camara', 50, (i) => (i < 7 ? { uf: 'AP', eleicao2026: undefined } : {})), ...casa('senado', 20)];
  assert.match(diagnostico(ps, meta, [], { hoje: '2026-11-24' }).avisos.join(), /AP \(7\)/);
});

test('portão eleitoral abortado avisa até a posse, e cala depois', () => {
  const m = { ...meta, eleicao2026: null };
  assert.match(diagnostico(sadio(), m, [], { hoje: '2026-11-24' }).avisos.join(), /portão abortou/);
  assert.deepEqual(diagnostico(sadio(), m, [], { hoje: '2027-03-01' }).avisos, []);
});
