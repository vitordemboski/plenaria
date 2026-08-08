import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparLeis, apresentadoVersusAprovado, simbolicas } from './leis-temas.mjs';

const lei = (url, temas) => ({ url, temas });

test('a MESMA lei repetida por autoria coletiva conta UMA vez', () => {
  // é o bug que a feature inteira arriscava: 445 contagens para 191 normas
  const leis = [lei('u1', ['Saúde']), lei('u1', ['Saúde']), lei('u1', ['Saúde'])];
  const r = agruparLeis(leis);
  assert.equal(r.nLeis, 1);
  assert.equal(r.nComTema, 1);
  assert.deepEqual(r.temas, [{ tema: 'Saúde', n: 1 }]);
});

test('contagem CHEIA: uma lei com 3 temas conta inteira nos 3', () => {
  const r = agruparLeis([lei('u1', ['Saúde', 'Educação', 'Trabalho'])]);
  assert.equal(r.nComTema, 1);
  assert.equal(r.temas.length, 3);
  assert.ok(r.temas.every((t) => t.n === 1));
  // os percentuais somariam 300% — é o ponto: cada linha é conta própria
});

test('lei sem tema é CONTADA como sem tema, nunca escondida', () => {
  const r = agruparLeis([lei('u1', ['Saúde']), lei('u2', []), lei('u3', undefined)]);
  assert.equal(r.nLeis, 3);
  assert.equal(r.nComTema, 1);
  assert.equal(r.nSemTema, 2);
});

test('lei sem url é ignorada (não há como deduplicá-la)', () => {
  const r = agruparLeis([{ temas: ['Saúde'] }, lei('u1', ['Saúde'])]);
  assert.equal(r.nLeis, 1);
});

test('entrada vazia não quebra', () => {
  assert.deepEqual(agruparLeis([]), { temas: [], nComTema: 0, nSemTema: 0, nLeis: 0 });
  assert.equal(agruparLeis(undefined).nLeis, 0);
});

test('taxa = leis ÷ apresentadas no MESMO tema', () => {
  const aprovadas = { temas: [{ tema: 'Saúde', n: 10 }], nComTema: 40 };
  const apresentadas = { temas: [{ tema: 'Saúde', n: 200 }], nComTema: 1000 };
  const [l] = apresentadoVersusAprovado(aprovadas, apresentadas);
  assert.equal(l.taxa, 5);
  assert.equal(l.pctAprovadas, 25);
  assert.equal(l.pctApresentadas, 20);
  assert.equal(l.nApresentadas, 200);
});

test('abaixo do piso a taxa é NULL, não zero — a contagem sobrevive', () => {
  const aprovadas = { temas: [{ tema: 'Turismo', n: 2 }], nComTema: 40 };
  const apresentadas = { temas: [{ tema: 'Turismo', n: 30 }], nComTema: 1000 };
  const [l] = apresentadoVersusAprovado(aprovadas, apresentadas, 4);
  assert.equal(l.taxa, null, '"6,7% de aproveitamento" a partir de 2 leis é ruído');
  assert.equal(l.n, 2, 'mas a contagem é factual e continua exibida');
  assert.ok(l.pctAprovadas > 0);
});

test('tema aprovado sem nenhuma apresentada não inventa taxa', () => {
  // não deveria acontecer (toda lei foi apresentada), mas dividir por zero aqui
  // produziria Infinity e a UI renderizaria "Infinity%"
  const [l] = apresentadoVersusAprovado(
    { temas: [{ tema: 'Saúde', n: 9 }], nComTema: 9 },
    { temas: [], nComTema: 0 },
  );
  assert.equal(l.taxa, null);
  assert.equal(l.nApresentadas, 0);
  assert.equal(l.pctApresentadas, 0);
});

test('o piso é sobre as LEIS, não sobre as apresentadas', () => {
  // 5 leis de um tema com poucas apresentadas: a taxa é alta e é REAL
  const [l] = apresentadoVersusAprovado(
    { temas: [{ tema: 'Defesa', n: 5 }], nComTema: 50 },
    { temas: [{ tema: 'Defesa', n: 10 }], nComTema: 500 },
    4,
  );
  assert.equal(l.taxa, 50);
});

test('a ordem dos temas vem do agregado e é preservada', () => {
  const aprovadas = { temas: [{ tema: 'B', n: 9 }, { tema: 'A', n: 4 }], nComTema: 13 };
  const apresentadas = { temas: [{ tema: 'A', n: 10 }, { tema: 'B', n: 90 }], nComTema: 100 };
  assert.deepEqual(apresentadoVersusAprovado(aprovadas, apresentadas).map((l) => l.tema), ['B', 'A']);
});

test('simbólicas: conta a norma que TEM o tema e a que só tem ele', () => {
  const r = simbolicas([
    lei('u1', ['Homenagens e Datas']),                    // exclusiva
    lei('u2', ['Homenagens e Datas', 'Segurança e Defesa']), // mista
    lei('u3', ['Saúde']),
    lei('u2', ['Homenagens e Datas', 'Segurança e Defesa']), // repetida por coautoria
  ]);
  assert.deepEqual(r, { n: 2, exclusivas: 1, total: 3, pct: (2 / 3) * 100 });
});

test('simbólicas: sem nenhuma, o painel não inventa percentual', () => {
  assert.deepEqual(simbolicas([lei('u1', ['Saúde'])]), { n: 0, exclusivas: 0, total: 1, pct: 0 });
  assert.deepEqual(simbolicas([]), { n: 0, exclusivas: 0, total: 0, pct: 0 });
});
