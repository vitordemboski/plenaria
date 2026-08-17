import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { lerZip } from './zip.mjs';

/** Monta um .zip de verdade (sem depender de fixture em disco nem do binário `zip`). */
function montaZip(arquivos) {
  const locais = [];
  const centrais = [];
  let off = 0;

  for (const [nome, conteudo, { comprimir = true, extraLocal = 0 } = {}] of arquivos) {
    const cru = Buffer.from(conteudo, 'latin1');
    const dados = comprimir ? deflateRawSync(cru) : cru;
    const nomeBuf = Buffer.from(nome, 'utf8');

    const lh = Buffer.alloc(30 + nomeBuf.length + extraLocal);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(comprimir ? 8 : 0, 8);
    lh.writeUInt32LE(dados.length, 18);
    lh.writeUInt32LE(cru.length, 22);
    lh.writeUInt16LE(nomeBuf.length, 26);
    lh.writeUInt16LE(extraLocal, 28);
    nomeBuf.copy(lh, 30);
    locais.push(lh, dados);

    const ch = Buffer.alloc(46 + nomeBuf.length);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(comprimir ? 8 : 0, 10);
    ch.writeUInt32LE(dados.length, 20);
    ch.writeUInt32LE(cru.length, 24);
    ch.writeUInt16LE(nomeBuf.length, 28);
    ch.writeUInt32LE(off, 42);
    nomeBuf.copy(ch, 46);
    centrais.push(ch);

    off += lh.length + dados.length;
  }

  const corpo = Buffer.concat(locais);
  const dir = Buffer.concat(centrais);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(arquivos.length, 8);
  eocd.writeUInt16LE(arquivos.length, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(corpo.length, 16);
  return Buffer.concat([corpo, dir, eocd]);
}

test('lê entrada deflated e devolve o conteúdo original', () => {
  const csv = 'A;B\n"1";"dois"\n';
  const z = lerZip(montaZip([['dados.csv', csv]]));
  assert.equal(z.get('dados.csv').toString('latin1'), csv);
});

test('acha o arquivo certo entre vários — o bulk do TSE traz 28 CSVs', () => {
  const z = lerZip(montaZip([
    ['consulta_cand_2026_AC.csv', 'acre'],
    ['consulta_cand_2026_BRASIL.csv', 'brasil inteiro'],
    ['consulta_cand_2026_SP.csv', 'sao paulo'],
  ]));
  assert.equal(z.size, 3);
  assert.equal(z.get('consulta_cand_2026_BRASIL.csv').toString('latin1'), 'brasil inteiro');
});

// O cabeçalho local tem campo extra PRÓPRIO (o zip do TSE usa): calcular o início
// dos dados com o tamanho vindo do diretório central desalinha a leitura e o
// inflate falha — ou pior, devolve lixo.
test('respeita o campo extra do cabeçalho LOCAL, não o do diretório central', () => {
  const z = lerZip(montaZip([['x.csv', 'conteudo intacto', { extraLocal: 9 }]]));
  assert.equal(z.get('x.csv').toString('latin1'), 'conteudo intacto');
});

test('entrada armazenada sem compressão também é lida', () => {
  const z = lerZip(montaZip([['x.txt', 'sem deflate', { comprimir: false }]]));
  assert.equal(z.get('x.txt').toString('latin1'), 'sem deflate');
});

test('latin1 preservado — o CSV do TSE não é UTF-8', () => {
  const z = lerZip(montaZip([['x.csv', 'JOSÉ DA CONCEIÇÃO']]));
  assert.equal(z.get('x.csv').toString('latin1'), 'JOSÉ DA CONCEIÇÃO');
});

test('arquivo que não é zip explode em vez de devolver vazio', () => {
  assert.throws(() => lerZip(Buffer.from('<html>Not Found</html>')), /diretório central/);
});
