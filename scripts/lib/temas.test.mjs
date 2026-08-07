import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMAS, OUTROS, deTemaCamara, deClasseSenado, contarTemas, assinatura, destaqueDoCard,
  agregarPrioridades, percentuaisPorTema,
} from './temas.mjs';

/** parlamentar de mentira com prioridades já contadas */
const parl = (temas, nComTema, nSemTema = 0) => ({
  prioridades: { temas: temas.map(([tema, n]) => ({ tema, n })), nComTema, nSemTema },
});

/**
 * Os 32 temas OFICIAIS da Câmara, copiados de
 * /api/v2/referencias/proposicoes/codTema. A lista está aqui de propósito: se a
 * casa acrescentar um tema, o teste continua passando (é o `deTemaCamara` que
 * cai em OUTROS e a ingestão que loga) — mas se alguém mexer no mapa e quebrar
 * um dos 32 que existem HOJE, isto pega.
 */
const TEMAS_CAMARA = [
  'Administração Pública', 'Arte, Cultura e Religião', 'Comunicações', 'Esporte e Lazer',
  'Economia', 'Cidades e Desenvolvimento Urbano', 'Direito Civil e Processual Civil',
  'Direito Penal e Processual Penal', 'Direitos Humanos e Minorias', 'Educação',
  'Meio Ambiente e Desenvolvimento Sustentável', 'Estrutura Fundiária',
  'Previdência e Assistência Social', 'Processo Legislativo e Atuação Parlamentar',
  'Energia, Recursos Hídricos e Minerais', 'Relações Internacionais e Comércio Exterior',
  'Saúde', 'Defesa e Segurança', 'Trabalho e Emprego', 'Turismo',
  'Viação, Transporte e Mobilidade', 'Ciência, Tecnologia e Inovação',
  'Agricultura, Pecuária, Pesca e Extrativismo', 'Indústria, Comércio e Serviços',
  'Direito e Defesa do Consumidor', 'Direito Constitucional',
  'Finanças Públicas e Orçamento', 'Homenagens e Datas Comemorativas',
  'Política, Partidos e Eleições', 'Direito e Justiça', 'Ciências Exatas e da Terra',
  'Ciências Sociais e Humanas',
];

/** as 63 classes de nível 2 do Senado, de /dadosabertos/processo/classes */
const CLASSES_SENADO = {
  'Administração Pública': ['Agentes Públicos', 'Domínio e Bens Públicos', 'Intervenção na Propriedade Privada',
    'Licitação e Contratos', 'Organização Administrativa', 'Serviços Públicos', 'Terceiro Setor',
    'Parcerias Público-Privadas e Desestatização', 'Transparência e Governança Públicas'],
  'Economia e Desenvolvimento': ['Agropecuária e Abastecimento', 'Ciência, Tecnologia e Informática',
    'Desenvolvimento Regional', 'Finanças Públicas', 'Fiscalização e Controle da Atividade Econômica',
    'Indústria, Comércio e Serviços', 'Linha de Crédito', 'Política Fundiária e Reforma Agrária',
    'Sistema Financeiro Nacional', 'Tributos'],
  'Honorífico': ['Data Comemorativa', 'Homenagem'],
  'Infraestrutura': ['Comunicações', 'Minas e Energia', 'Viação e Transportes'],
  'Jurídico': ['Direito Civil', 'Direito de Trânsito', 'Direito do Consumidor', 'Direito Eleitoral',
    'Direito Empresarial e Econômico', 'Direito Notarial e Registral', 'Direito Penal e Penitenciário',
    'Direitos e Garantias', 'Processo'],
  'Meio Ambiente': ['Crimes e Infrações Ambientais', 'Desenvolvimento Sustentável',
    'Espaços Especialmente Protegidos', 'Licenciamento Ambiental', 'Mudanças Climáticas',
    'Patrimônio Genético', 'Poluição', 'Proteção aos Animais', 'Recursos Hídricos',
    'Resíduos Sólidos', 'Vegetação Nativa'],
  'Orçamento Público': ['Crédito Adicional', 'Diretrizes Orçamentárias', 'Orçamento Anual', 'Plano Plurianual (PPA)'],
  'Organização do Estado': ['Fiscalização e Controle', 'Funções Essenciais à Justiça',
    'Organização Federativa', 'Poder Judiciário', 'Poder Legislativo'],
  'Política Social': ['Cultura', 'Desenvolvimento Urbano', 'Desporto e Lazer', 'Educação', 'Habitação',
    'Previdência Social', 'Proteção Social', 'Saúde', 'Trabalho e Emprego'],
  'Soberania, Defesa Nacional e Ordem Pública': ['Defesa do Estado e das Instituições Democráticas',
    'Direito dos Estrangeiros', 'Direito Marítimo, Aeronáutico e Espacial', 'Relações Internacionais'],
};

// ---------------------------------------------------------------- vocabulário

test('todo tema oficial da Câmara mapeia — nenhum cai em OUTROS', () => {
  const orfaos = TEMAS_CAMARA.filter((t) => deTemaCamara(t) === OUTROS);
  assert.deepEqual(orfaos, [], `temas da Câmara sem rótulo: ${orfaos.join(', ')}`);
});

test('toda classe nível 2 do Senado mapeia — nenhuma cai em OUTROS', () => {
  const orfaos = [];
  for (const [n1, filhos] of Object.entries(CLASSES_SENADO)) {
    for (const n2 of filhos) if (deClasseSenado(`${n1} / ${n2}`) === OUTROS) orfaos.push(`${n1} / ${n2}`);
  }
  assert.deepEqual(orfaos, [], `classes do Senado sem rótulo: ${orfaos.join(', ')}`);
});

test('todo rótulo emitido pertence ao vocabulário declarado', () => {
  const vocab = new Set(TEMAS);
  for (const t of TEMAS_CAMARA) assert.ok(vocab.has(deTemaCamara(t)), `${t} → rótulo fora do vocabulário`);
  for (const [n1, filhos] of Object.entries(CLASSES_SENADO)) {
    for (const n2 of filhos) assert.ok(vocab.has(deClasseSenado(`${n1} / ${n2}`)), `${n1}/${n2} → fora do vocabulário`);
  }
});

test('as duas casas convergem no mesmo rótulo para o mesmo assunto', () => {
  assert.equal(deTemaCamara('Saúde'), deClasseSenado('Política Social / Saúde'));
  assert.equal(deTemaCamara('Educação'), deClasseSenado('Política Social / Educação'));
  assert.equal(deTemaCamara('Trabalho e Emprego'), deClasseSenado('Política Social / Trabalho e Emprego'));
  assert.equal(deTemaCamara('Homenagens e Datas Comemorativas'), deClasseSenado('Honorífico / Data Comemorativa'));
  assert.equal(deTemaCamara('Direito Penal e Processual Penal'), deClasseSenado('Jurídico / Direito Penal e Penitenciário'));
  assert.equal(deTemaCamara('Viação, Transporte e Mobilidade'), deClasseSenado('Infraestrutura / Viação e Transportes'));
});

test('hierarquia de 3 níveis é lida pelo nível 2, não pelo folha', () => {
  assert.equal(deClasseSenado('Política Social / Proteção Social / Idosos'), 'Direitos Humanos e Minorias');
  assert.equal(deClasseSenado('Economia e Desenvolvimento / Tributos / Desoneração Fiscal'), 'Finanças, Orçamento e Tributos');
  assert.equal(deClasseSenado('Organização do Estado / Fiscalização e Controle / Controle Externo'), 'Estado, Política e Eleições');
});

test('classe nível 2 DESCONHECIDA cai na macro-classe, não em OUTROS', () => {
  assert.equal(deClasseSenado('Meio Ambiente / Classe Que Ainda Não Existe'), 'Meio Ambiente e Clima');
  assert.equal(deClasseSenado('Jurídico / Direito Interplanetário'), 'Direito, Justiça e Consumidor');
});

test('"Política Social" desconhecida NÃO adivinha — junta Saúde, Educação e Trabalho', () => {
  assert.equal(deClasseSenado('Política Social / Classe Nova'), OUTROS);
});

test('nada é dropado em silêncio: desconhecido e vazio viram OUTROS', () => {
  assert.equal(deTemaCamara('Tema Inventado Pela Fonte'), OUTROS);
  assert.equal(deTemaCamara(''), OUTROS);
  assert.equal(deTemaCamara(undefined), OUTROS);
  assert.equal(deClasseSenado(''), OUTROS);
  assert.equal(deClasseSenado(null), OUTROS);
});

test('grafia instável (caixa, espaço extra) não quebra o mapa', () => {
  assert.equal(deTemaCamara('  saúde  '), 'Saúde');
  assert.equal(deTemaCamara('DEFESA E SEGURANÇA'), 'Segurança e Defesa');
  assert.equal(deClasseSenado('política social /  saúde'), 'Saúde');
});

test('hierarquia de um nível só é lida como classe', () => {
  assert.equal(deClasseSenado('Saúde'), 'Saúde');
  assert.equal(deClasseSenado('Meio Ambiente'), 'Meio Ambiente e Clima');
});

// ------------------------------------------------------------------ contagem

test('contagem é CHEIA: proposição com 3 temas conta inteira nos 3', () => {
  const r = contarTemas([['Saúde', 'Educação', 'Trabalho e Emprego']]);
  assert.equal(r.nComTema, 1);
  assert.equal(r.pares, 3);
  assert.deepEqual(r.temas.map((t) => t.n), [1, 1, 1]);
  // é justamente o que faz a coluna NÃO somar 100%
  assert.ok(r.pares > r.nComTema);
});

test('tema repetido na mesma proposição conta uma vez só', () => {
  // dois temas oficiais distintos podem colapsar no mesmo rótulo comum
  const r = contarTemas([['Saúde', 'Saúde']]);
  assert.equal(r.temas.length, 1);
  assert.equal(r.temas[0].n, 1);
});

test('proposição sem tema é CONTADA como sem tema, nunca some', () => {
  const r = contarTemas([['Saúde'], [], null]);
  assert.equal(r.nComTema, 1);
  assert.equal(r.nSemTema, 2);
});

test('ordem é por contagem, com desempate alfabético estável', () => {
  const r = contarTemas([['Educação'], ['Saúde'], ['Saúde'], ['Administração Pública']]);
  assert.deepEqual(r.temas.map((t) => t.tema), ['Saúde', 'Administração Pública', 'Educação']);
});

// ------------------------------------------------------------------ agregação

test('agregação é SOMA÷SOMA, não média das porcentagens individuais', () => {
  // um prolífico com pouca Saúde e um discreto que só faz Saúde. A média das
  // porcentagens diria 50% de Saúde; a taxa da bancada é 13 de 103 ≈ 12,6%.
  const a = agregarPrioridades([
    parl([['Saúde', 10], ['Educação', 90]], 100),
    parl([['Saúde', 3]], 3),
  ]);
  assert.equal(a.nComTema, 103);
  assert.equal(a.temas.find((t) => t.tema === 'Saúde').n, 13);
  assert.ok(Math.abs(a.temas.find((t) => t.tema === 'Saúde').pct - 12.62) < 0.01);
});

test('agregação ignora quem não tem prioridades sem quebrar', () => {
  const a = agregarPrioridades([parl([['Saúde', 4]], 4), {}, { prioridades: undefined }, null]);
  assert.equal(a.nParlamentares, 1);
  assert.equal(a.nComTema, 4);
});

test('agregação de bancada vazia não divide por zero', () => {
  const a = agregarPrioridades([]);
  assert.deepEqual(a.temas, []);
  assert.equal(a.nComTema, 0);
  assert.equal(a.temasPorProposicao, 0);
});

test('proposições sem tema somam no agregado — não desaparecem', () => {
  const a = agregarPrioridades([parl([['Saúde', 4]], 4, 6), parl([['Educação', 1]], 1, 2)]);
  assert.equal(a.nSemTema, 8);
});

test('percentuaisPorTema devolve a referência que a assinatura consome', () => {
  const nac = percentuaisPorTema(agregarPrioridades([parl([['Saúde', 25], ['Educação', 75]], 100)]));
  assert.equal(nac.get('Saúde'), 25);
  assert.equal(nac.get('Educação'), 75);
});

// ----------------------------------------------------------------- assinatura

test('assinatura ordena por desvio do nacional, não pelo valor absoluto', () => {
  const temas = [{ tema: 'Administração Pública', n: 40 }, { tema: 'Segurança e Defesa', n: 20 }];
  const nac = new Map([['Administração Pública', 38], ['Segurança e Defesa', 14]]);
  const a = assinatura(temas, 100, nac);
  // Administração Pública é o maior em absoluto (40% × 20%) e ainda assim perde:
  // +6 p.p. de desvio contra +2 — é o que distingue a bancada do Congresso
  assert.equal(a[0].tema, 'Segurança e Defesa');
  assert.equal(a[0].desvio, 6);
  assert.equal(a[1].desvio, 2);
});

test('assinatura descarta tema abaixo do piso de proposições', () => {
  const temas = [{ tema: 'Saúde', n: 2 }, { tema: 'Educação', n: 10 }];
  const a = assinatura(temas, 50, new Map(), 3);
  assert.deepEqual(a.map((t) => t.tema), ['Educação']);
});

test('assinatura de bancada sem proposição é vazia, não divide por zero', () => {
  assert.deepEqual(assinatura([{ tema: 'Saúde', n: 3 }], 0, new Map()), []);
});

// -------------------------------------------------------------- faixa do card

test('faixa do card exige piso: 1 de 2 proposições não é prioridade', () => {
  assert.equal(destaqueDoCard([{ tema: 'Saúde', n: 1 }], 2), null);
  assert.equal(destaqueDoCard([{ tema: 'Saúde', n: 2 }], 6), null, 'topo abaixo do mínimo');
});

test('faixa do card sai com bruto e denominador quando passa do piso', () => {
  const d = destaqueDoCard([{ tema: 'Saúde', n: 41 }, { tema: 'Educação', n: 9 }], 120);
  assert.deepEqual(d, { tema: 'Saúde', n: 41, de: 120, pct: 34 });
});

test('faixa do card não anuncia "Outros temas" como prioridade', () => {
  assert.equal(destaqueDoCard([{ tema: OUTROS, n: 30 }], 40), null);
});

test('faixa do card é nula sem tema nenhum', () => {
  assert.equal(destaqueDoCard([], 100), null);
  assert.equal(destaqueDoCard(undefined, 100), null);
});
