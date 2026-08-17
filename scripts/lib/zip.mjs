/**
 * Leitor mínimo de ZIP (o bulk do TSE só é publicado assim; os scripts não têm
 * dependências). Lê pelo DIRETÓRIO CENTRAL, não varrendo assinaturas no corpo:
 * `PK\x03\x04` casa com bytes comprimidos por acidente, e o parser devolveria em
 * silêncio um arquivo que não existe.
 */
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50; // fim do diretório central
const CEN = 0x02014b50;  // entrada do diretório central

/**
 * @param {Buffer} buf conteúdo do .zip
 * @returns {Map<string, Buffer>} nome do arquivo → conteúdo descomprimido
 */
export function lerZip(buf) {
  // o EOCD fica no fim, depois de um comentário de até 64 KB
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip inválido: diretório central não encontrado');

  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const saida = new Map();

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== CEN) throw new Error(`zip inválido: entrada ${n} corrompida`);
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offLocal = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + nomeLen);

    // tamanhos de nome/extra do cabeçalho LOCAL: os do diretório central
    // desalinhariam o início dos dados
    const lNomeLen = buf.readUInt16LE(offLocal + 26);
    const lExtraLen = buf.readUInt16LE(offLocal + 28);
    const ini = offLocal + 30 + lNomeLen + lExtraLen;
    const dados = buf.subarray(ini, ini + tamComp);

    if (!nome.endsWith('/')) {
      if (metodo === 0) saida.set(nome, Buffer.from(dados));
      else if (metodo === 8) saida.set(nome, inflateRawSync(dados));
      else throw new Error(`zip: método de compressão ${metodo} não suportado (${nome})`);
    }
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return saida;
}
