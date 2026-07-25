/**
 * Parser de CSV dos Dados Abertos (delimitador ";", campos entre aspas).
 *
 * Existe porque o parser ingênuo anterior fazia split('\n') + split('";"') e
 * quebrava em campo com quebra de linha dentro das aspas — o que acontece em
 * 6,69% das linhas de proposicoes-{ano}.csv (ementas multi-linha). Essas linhas
 * entravam com as colunas deslocadas e eram descartadas em silêncio.
 */
export function parseCsvBR(text, sep = ';') {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM
  const linhas = [];
  let campos = [], campo = '', dentroDeAspas = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (dentroDeAspas) {
      if (c === '"' && src[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentroDeAspas = false;
      else campo += c;
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === sep) { campos.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      campos.push(campo); campo = '';
      if (campos.some((f) => f !== '')) linhas.push(campos);
      campos = [];
    } else campo += c;
  }
  if (campo !== '' || campos.length) {
    campos.push(campo);
    if (campos.some((f) => f !== '')) linhas.push(campos);
  }

  const header = linhas.shift() ?? [];
  return { header, rows: linhas };
}
