/**
 * Tema das proposições — o "no que o parlamentar trabalha".
 *
 * As DUAS casas publicam classificação temática oficial, e são vocabulários
 * diferentes:
 *   - Câmara: `proposicoesTemas-{ano}.csv`, lista PLANA de 32 temas.
 *   - Senado: `/processo/{id}.classificacoes`, HIERARQUIA de 10 macro-classes e
 *     63 classes de nível 2 ("Política Social / Saúde").
 *
 * Aqui os dois viram um vocabulário comum de 20 rótulos, para que a guilda —
 * que tem bancada mista — some uma coisa só e o leitor não veja dois nomes para
 * a mesma barra. É o mesmo movimento do `rotuloCategoria` (cota.mjs), que já
 * normaliza CEAP × CEAPS.
 *
 * GUARDRAIL 1: rótulo desconhecido NUNCA é dropado. Cai em `OUTROS` e a ingestão
 * loga — se a fonte inventar um tema novo, ele aparece na barra em vez de sumir
 * em silêncio (a armadilha que o projeto já pagou no parser de CSV).
 *
 * GUARDRAIL 2: o mapa abaixo é decisão EDITORIAL, não dado da fonte — juntar
 * "Turismo" com "Esporte e Lazer" é escolha nossa. Por isso ele é publicado
 * inteiro em /como-calculamos. Mexeu aqui, mexa lá.
 *
 * O que este módulo NÃO faz: pontuar. Tema não entra no Poder, não gera Tier e
 * não gera título — um selo "Deputado da Saúde" seria rótulo sobre pauta
 * política, o mesmo erro que tirou a Fiscalização do Poder.
 */

/** rótulo de escape — some da barra seria pior que aparecer sem nome bonito */
export const OUTROS = 'Outros temas';

/**
 * O vocabulário comum, em ordem alfabética (a ordem de exibição é sempre por
 * contagem; esta aqui é só para o meta.json e para a tabela da /como-calculamos).
 */
export const TEMAS = [
  'Administração Pública',
  'Agropecuária e Terra',
  'Ciência, Tecnologia e Comunicações',
  'Cidades e Habitação',
  'Cultura, Esporte e Turismo',
  'Direito Penal e Processo',
  'Direito, Justiça e Consumidor',
  'Direitos Humanos e Minorias',
  'Economia, Indústria e Comércio',
  'Educação',
  'Estado, Política e Eleições',
  'Finanças, Orçamento e Tributos',
  'Homenagens e Datas',
  'Infraestrutura, Energia e Transporte',
  'Meio Ambiente e Clima',
  'Previdência e Assistência',
  'Relações Internacionais',
  'Saúde',
  'Segurança e Defesa',
  'Trabalho e Emprego',
];

/** casa acentuação/caixa/espaços: os dois vocabulários vêm com grafias instáveis */
function normKey(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** os 32 temas oficiais da Câmara → vocabulário comum */
const DE_CAMARA = new Map(Object.entries({
  'Administração Pública': 'Administração Pública',
  'Agricultura, Pecuária, Pesca e Extrativismo': 'Agropecuária e Terra',
  'Estrutura Fundiária': 'Agropecuária e Terra',
  'Ciência, Tecnologia e Inovação': 'Ciência, Tecnologia e Comunicações',
  'Comunicações': 'Ciência, Tecnologia e Comunicações',
  'Ciências Exatas e da Terra': 'Ciência, Tecnologia e Comunicações',
  'Ciências Sociais e Humanas': 'Ciência, Tecnologia e Comunicações',
  'Cidades e Desenvolvimento Urbano': 'Cidades e Habitação',
  'Arte, Cultura e Religião': 'Cultura, Esporte e Turismo',
  'Esporte e Lazer': 'Cultura, Esporte e Turismo',
  'Turismo': 'Cultura, Esporte e Turismo',
  'Direito Penal e Processual Penal': 'Direito Penal e Processo',
  'Direito Civil e Processual Civil': 'Direito, Justiça e Consumidor',
  'Direito e Defesa do Consumidor': 'Direito, Justiça e Consumidor',
  'Direito e Justiça': 'Direito, Justiça e Consumidor',
  'Direitos Humanos e Minorias': 'Direitos Humanos e Minorias',
  'Economia': 'Economia, Indústria e Comércio',
  'Indústria, Comércio e Serviços': 'Economia, Indústria e Comércio',
  'Educação': 'Educação',
  'Direito Constitucional': 'Estado, Política e Eleições',
  'Política, Partidos e Eleições': 'Estado, Política e Eleições',
  'Processo Legislativo e Atuação Parlamentar': 'Estado, Política e Eleições',
  'Finanças Públicas e Orçamento': 'Finanças, Orçamento e Tributos',
  'Homenagens e Datas Comemorativas': 'Homenagens e Datas',
  'Energia, Recursos Hídricos e Minerais': 'Infraestrutura, Energia e Transporte',
  'Viação, Transporte e Mobilidade': 'Infraestrutura, Energia e Transporte',
  'Meio Ambiente e Desenvolvimento Sustentável': 'Meio Ambiente e Clima',
  'Previdência e Assistência Social': 'Previdência e Assistência',
  'Relações Internacionais e Comércio Exterior': 'Relações Internacionais',
  'Saúde': 'Saúde',
  'Defesa e Segurança': 'Segurança e Defesa',
  'Trabalho e Emprego': 'Trabalho e Emprego',
}).map(([k, v]) => [normKey(k), v]));

/**
 * As 63 classes de NÍVEL 2 do Senado → vocabulário comum. Chaveadas só pelo
 * nível 2 porque ele é o que tem granularidade comparável à Câmara: o nível 1
 * ("Política Social") junta Saúde, Educação e Trabalho num rótulo só.
 */
const DE_SENADO_N2 = new Map(Object.entries({
  // Administração Pública
  'Agentes Públicos': 'Administração Pública',
  'Domínio e Bens Públicos': 'Administração Pública',
  'Intervenção na Propriedade Privada': 'Administração Pública',
  'Licitação e Contratos': 'Administração Pública',
  'Organização Administrativa': 'Administração Pública',
  'Serviços Públicos': 'Administração Pública',
  'Terceiro Setor': 'Administração Pública',
  'Parcerias Público-Privadas e Desestatização': 'Administração Pública',
  'Transparência e Governança Públicas': 'Administração Pública',
  // Economia e Desenvolvimento
  'Agropecuária e Abastecimento': 'Agropecuária e Terra',
  'Política Fundiária e Reforma Agrária': 'Agropecuária e Terra',
  'Ciência, Tecnologia e Informática': 'Ciência, Tecnologia e Comunicações',
  'Desenvolvimento Regional': 'Economia, Indústria e Comércio',
  'Fiscalização e Controle da Atividade Econômica': 'Economia, Indústria e Comércio',
  'Indústria, Comércio e Serviços': 'Economia, Indústria e Comércio',
  'Finanças Públicas': 'Finanças, Orçamento e Tributos',
  'Linha de Crédito': 'Finanças, Orçamento e Tributos',
  'Sistema Financeiro Nacional': 'Finanças, Orçamento e Tributos',
  'Tributos': 'Finanças, Orçamento e Tributos',
  // Honorífico
  'Data Comemorativa': 'Homenagens e Datas',
  'Homenagem': 'Homenagens e Datas',
  // Infraestrutura
  'Comunicações': 'Ciência, Tecnologia e Comunicações',
  'Minas e Energia': 'Infraestrutura, Energia e Transporte',
  'Viação e Transportes': 'Infraestrutura, Energia e Transporte',
  // Jurídico
  'Direito Civil': 'Direito, Justiça e Consumidor',
  'Direito do Consumidor': 'Direito, Justiça e Consumidor',
  'Direito Empresarial e Econômico': 'Direito, Justiça e Consumidor',
  'Direito Notarial e Registral': 'Direito, Justiça e Consumidor',
  'Processo': 'Direito, Justiça e Consumidor',
  'Direito de Trânsito': 'Infraestrutura, Energia e Transporte',
  'Direito Penal e Penitenciário': 'Direito Penal e Processo',
  'Direito Eleitoral': 'Estado, Política e Eleições',
  // "Direitos e Garantias" é o capítulo dos direitos fundamentais — casa com o
  // "Direitos Humanos e Minorias" da Câmara, não com o direito civil comum.
  'Direitos e Garantias': 'Direitos Humanos e Minorias',
  // Meio Ambiente (as 11 classes descem para um rótulo só)
  'Crimes e Infrações Ambientais': 'Meio Ambiente e Clima',
  'Desenvolvimento Sustentável': 'Meio Ambiente e Clima',
  'Espaços Especialmente Protegidos': 'Meio Ambiente e Clima',
  'Licenciamento Ambiental': 'Meio Ambiente e Clima',
  'Mudanças Climáticas': 'Meio Ambiente e Clima',
  'Patrimônio Genético': 'Meio Ambiente e Clima',
  'Poluição': 'Meio Ambiente e Clima',
  'Proteção aos Animais': 'Meio Ambiente e Clima',
  'Recursos Hídricos': 'Meio Ambiente e Clima',
  'Resíduos Sólidos': 'Meio Ambiente e Clima',
  'Vegetação Nativa': 'Meio Ambiente e Clima',
  // Orçamento Público
  'Crédito Adicional': 'Finanças, Orçamento e Tributos',
  'Diretrizes Orçamentárias': 'Finanças, Orçamento e Tributos',
  'Orçamento Anual': 'Finanças, Orçamento e Tributos',
  'Plano Plurianual (PPA)': 'Finanças, Orçamento e Tributos',
  // Organização do Estado
  'Fiscalização e Controle': 'Estado, Política e Eleições',
  'Organização Federativa': 'Estado, Política e Eleições',
  'Poder Legislativo': 'Estado, Política e Eleições',
  'Funções Essenciais à Justiça': 'Direito, Justiça e Consumidor',
  'Poder Judiciário': 'Direito, Justiça e Consumidor',
  // Política Social
  'Cultura': 'Cultura, Esporte e Turismo',
  'Desporto e Lazer': 'Cultura, Esporte e Turismo',
  'Desenvolvimento Urbano': 'Cidades e Habitação',
  'Habitação': 'Cidades e Habitação',
  'Educação': 'Educação',
  'Previdência Social': 'Previdência e Assistência',
  // "Proteção Social" são idosos, crianças, pessoas com deficiência — o mesmo
  // universo do "Direitos Humanos e Minorias" da Câmara; a previdência tem
  // classe própria acima, então não há sobreposição.
  'Proteção Social': 'Direitos Humanos e Minorias',
  'Saúde': 'Saúde',
  'Trabalho e Emprego': 'Trabalho e Emprego',
  // Soberania, Defesa Nacional e Ordem Pública
  'Defesa do Estado e das Instituições Democráticas': 'Segurança e Defesa',
  'Direito dos Estrangeiros': 'Relações Internacionais',
  'Relações Internacionais': 'Relações Internacionais',
  'Direito Marítimo, Aeronáutico e Espacial': 'Infraestrutura, Energia e Transporte',
}).map(([k, v]) => [normKey(k), v]));

/**
 * Rede de segurança para classe de nível 2 NOVA: cai no rótulo da macro-classe.
 * "Política Social" fica de fora de propósito — ela junta Saúde, Educação,
 * Previdência e Trabalho, então adivinhar por ela erraria mais do que acertaria.
 * Sem palpite, o caso vira OUTROS e a ingestão loga para alguém declarar.
 */
const DE_SENADO_N1 = new Map(Object.entries({
  'Administração Pública': 'Administração Pública',
  'Economia e Desenvolvimento': 'Economia, Indústria e Comércio',
  'Honorífico': 'Homenagens e Datas',
  'Infraestrutura': 'Infraestrutura, Energia e Transporte',
  'Jurídico': 'Direito, Justiça e Consumidor',
  'Meio Ambiente': 'Meio Ambiente e Clima',
  'Orçamento Público': 'Finanças, Orçamento e Tributos',
  'Organização do Estado': 'Estado, Política e Eleições',
  'Soberania, Defesa Nacional e Ordem Pública': 'Segurança e Defesa',
}).map(([k, v]) => [normKey(k), v]));

/**
 * Tema oficial da Câmara → rótulo comum.
 * @param {string} tema coluna `tema` de proposicoesTemas-{ano}.csv
 * @returns {string} rótulo do vocabulário comum, ou OUTROS
 */
export function deTemaCamara(tema) {
  return DE_CAMARA.get(normKey(tema)) ?? OUTROS;
}

/**
 * Classificação do Senado → rótulo comum. Aceita a hierarquia inteira
 * ("Política Social / Proteção Social / Idosos"): lê o nível 2, e se ele for
 * desconhecido tenta a macro-classe do nível 1.
 * @param {string} hierarquia campo `descricaoHierarquia` de /processo/{id}
 * @returns {string} rótulo do vocabulário comum, ou OUTROS
 */
export function deClasseSenado(hierarquia) {
  const partes = String(hierarquia ?? '').split('/').map((s) => s.trim()).filter(Boolean);
  if (!partes.length) return OUTROS;
  const n2 = partes[1] ? DE_SENADO_N2.get(normKey(partes[1])) : undefined;
  if (n2) return n2;
  // hierarquia de um nível só ("Jurídico / Direito Penal…" tem 2; algumas têm 1)
  const comoN2 = DE_SENADO_N2.get(normKey(partes[0]));
  if (!partes[1] && comoN2) return comoN2;
  return DE_SENADO_N1.get(normKey(partes[0])) ?? OUTROS;
}

/**
 * Conta temas sobre uma coleção de proposições — CONTAGEM CHEIA: uma proposição
 * com 3 temas conta INTEIRA nos 3. Os percentuais por isso NÃO somam 100%
 * (uma proposição toca ~2,1 temas em média), e cada linha é uma afirmação
 * independente e literal: "41 das 120 proposições dele tocam Saúde".
 *
 * A alternativa fracionária (1/n por tema) somaria 100%, mas embutiria a
 * suposição de que os 3 temas de uma PEC pesam igual — ponderação nossa, não
 * dado da fonte — e produziria brutos como "13,7 proposições", que não existem.
 *
 * @param {Iterable<string[]>} porProposicao rótulos comuns de cada proposição
 * @returns {{ temas: {tema: string, n: number}[], nComTema: number, nSemTema: number, pares: number }}
 */
export function contarTemas(porProposicao) {
  const contagem = new Map();
  let nComTema = 0, nSemTema = 0, pares = 0;
  for (const rotulos of porProposicao) {
    const unicos = [...new Set(rotulos ?? [])];
    if (!unicos.length) { nSemTema++; continue; }
    nComTema++;
    for (const r of unicos) {
      contagem.set(r, (contagem.get(r) ?? 0) + 1);
      pares++;
    }
  }
  const temas = [...contagem.entries()]
    .map(([tema, n]) => ({ tema, n }))
    // desempate alfabético: sem ele a ordem viria da inserção e duas execuções
    // sobre o mesmo dado emitiriam JSONs diferentes
    .sort((a, b) => b.n - a.n || a.tema.localeCompare(b.tema, 'pt-BR'));
  return { temas, nComTema, nSemTema, pares };
}

/**
 * Soma as prioridades de um conjunto de parlamentares (bancada, casa ou o
 * Congresso inteiro).
 *
 * SOMA ÷ SOMA, não média de percentuais: é a regra que o `guilda-bruto.mjs` já
 * fixou — contagem vira média por parlamentar, TAXA vira soma÷soma. Média das
 * porcentagens individuais daria o mesmo peso a quem apresentou 300 proposições
 * e a quem apresentou 3.
 *
 * @param {{prioridades?: {temas: {tema: string, n: number}[], nComTema: number, nSemTema: number}}[]} parlamentares
 */
export function agregarPrioridades(parlamentares) {
  const contagem = new Map();
  let nComTema = 0, nSemTema = 0, pares = 0, nParlamentares = 0;
  for (const p of parlamentares) {
    const pr = p?.prioridades;
    if (!pr) continue;
    nParlamentares++;
    nComTema += pr.nComTema;
    nSemTema += pr.nSemTema;
    for (const { tema, n } of pr.temas) {
      contagem.set(tema, (contagem.get(tema) ?? 0) + n);
      pares += n;
    }
  }
  const temas = [...contagem.entries()]
    .map(([tema, n]) => ({ tema, n, pct: nComTema ? (n / nComTema) * 100 : 0 }))
    .sort((a, b) => b.n - a.n || a.tema.localeCompare(b.tema, 'pt-BR'));
  return {
    temas, nComTema, nSemTema, nParlamentares,
    temasPorProposicao: nComTema ? Number((pares / nComTema).toFixed(2)) : 0,
  };
}

/** agregado → Map tema → %, o formato que `assinatura` espera como referência */
export function percentuaisPorTema(agregado) {
  return new Map((agregado?.temas ?? []).map((t) => [t.tema, t.pct]));
}

/**
 * "Assinatura" de uma bancada: onde ela desvia da média nacional, em pontos
 * percentuais. Sem isso a página da guilda seria inócua — medido na legislatura,
 * o top-3 ABSOLUTO de 7 dos 8 maiores partidos contém "Administração Pública"
 * e/ou "Direitos Humanos e Minorias", que dominam o Congresso inteiro.
 *
 * É comparação, não juízo: nenhuma cor de bom/ruim acompanha o número, pela
 * mesma razão que o Alinhamento tem `higherIsBetter: null`.
 *
 * @param {{tema: string, n: number}[]} temas contagem da bancada
 * @param {number} nComTema denominador da bancada
 * @param {Map<string, number>} pctNacional tema → % nacional
 * @param {number} piso nº mínimo de proposições no tema p/ entrar na assinatura
 */
export function assinatura(temas, nComTema, pctNacional, piso = 3) {
  if (!nComTema) return [];
  return temas
    .filter((t) => t.n >= piso)
    .map((t) => {
      const pct = (t.n / nComTema) * 100;
      const nac = pctNacional.get(t.tema) ?? 0;
      return { tema: t.tema, n: t.n, pct, pctNacional: nac, desvio: pct - nac };
    })
    .sort((a, b) => b.desvio - a.desvio || a.tema.localeCompare(b.tema, 'pt-BR'));
}

/**
 * Tema de destaque para a FAIXA do card — ou null.
 *
 * O piso existe porque a faixa afirma em termos absolutos ("prioriza Saúde") a
 * partir de uma fração: com 2 proposições, "1 de 2 = 50% Saúde" viraria
 * prioridade a partir de ruído. É o mesmo raciocínio do quartil nos títulos
 * vermelhos — traduzir o relativo de volta para o bruto antes de acusar.
 */
export function destaqueDoCard(temas, nComTema, minProps = 5, minNoTopo = 3) {
  if (!temas?.length || nComTema < minProps) return null;
  const topo = temas[0];
  if (topo.n < minNoTopo || topo.tema === OUTROS) return null;
  return { tema: topo.tema, n: topo.n, de: nComTema, pct: Math.round((topo.n / nComTema) * 100) };
}
