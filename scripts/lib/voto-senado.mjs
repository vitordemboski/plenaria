/**
 * Classificação de comparecimento nas votações nominais do Senado.
 *
 * A API põe o MOTIVO DA AUSÊNCIA no mesmo campo do voto: `SiglaDescricaoVoto` traz
 * `Sim`/`Não`/`Abstenção`/`Votou` quando o senador votou, e `AP`/`MIS`/`LS`/`LP`/
 * `LAP`/`NCom` quando ele não estava lá. Conferido na votação inteira (endpoint
 * `plenario/lista/votacao/{data}`, que devolve os 81 senadores): na votação 6927 do
 * PLP 48/2023 são 52 `Sim` + 1 `Presidente` contra 18 `AP` + 8 `MIS` + 2 `LS` —
 * ausência e voto convivem na mesma coluna.
 *
 * Por que por CÓDIGO e não por regex na descrição: a descrição é prosa e o código é
 * vocabulário controlado. Um regex `/atividade parlamentar|licen|ausen|.../` deixou
 * passar "Missão da Casa no País/exterior" por 593 votações — ausência contada como
 * presença em 45 dos 81 senadores, de forma desigual (Mara Gabrilli 57, Nelsinho
 * Trad 56), enquanto "Atividade parlamentar", que é a MESMA natureza (ausência a
 * serviço da Casa), já era descontada. Não era um limiar discutível: era a mesma
 * coisa medida de dois jeitos.
 *
 * `codigoDesconhecido` existe porque a falha é silenciosa nas duas direções: código
 * de ausência novo viraria presença (infla a Stamina de quem faltou) e código de voto
 * novo viraria falta. A ingestão LOGA o que não reconhece — não adivinhe, confira na
 * votação inteira e classifique aqui.
 */

/** Ausência: o senador não estava na votação. O motivo não muda o fato. */
const AUSENTE = new Set([
  'AP',    // Atividade parlamentar
  'MIS',   // Missão da Casa no País/exterior
  'LS',    // Licença saúde
  'LP',    // Licença Particular
  'LAP',   // Licença paternidade ou ao adotante
  'NCom',  // Não Compareceu
]);

/**
 * Presença. `P-NRV` ("Presente – Não registrou voto") conta porque a Stamina mede
 * comparecimento, não o conteúdo do voto — o rótulo afirma a presença. `Votou` é o
 * que aparece nas SECRETAS: o sigilo é do voto, não da presença. `Presidente
 * (art. 51 RISF)` é quem presidia a sessão — estava lá, e por regimento não vota.
 * `NA` ("Dispositivo não citado") é marcação técnica de destaque, 31 casos em 4 anos.
 */
const PRESENTE = new Set([
  'Sim', 'Não', 'Abstenção', 'Votou', 'P-NRV', 'Presidente (art. 51 RISF)', 'NA',
]);

/** Só para o log da ingestão: código fora das duas listas. */
export const codigoDesconhecido = (sigla) => {
  const s = (sigla ?? '').trim();
  return s !== '' && !AUSENTE.has(s) && !PRESENTE.has(s);
};

/**
 * O senador compareceu a esta votação?
 * @param {{SiglaDescricaoVoto?: string, DescricaoVoto?: string}} v registro de votação
 */
export function compareceu(v) {
  const sigla = (v?.SiglaDescricaoVoto ?? '').trim();
  if (AUSENTE.has(sigla)) return false;
  if (PRESENTE.has(sigla)) return true;
  // Código desconhecido (ou ausente do registro): cai na descrição em prosa. Não é
  // o caminho normal — a ingestão loga para que o código entre nas listas acima.
  return !/não compareceu|ausen|licen|não votou|atividade parlamentar|miss[ãa]o/i.test(v?.DescricaoVoto ?? '');
}
