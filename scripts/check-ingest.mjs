// Sanidade pós-ingestão (`npm run data:check`, e no fim do data:real/data:fresh).
// A lógica está em lib/sanidade.mjs; aqui só se lê o disco e se decide o exit code.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { diagnostico } from './lib/sanidade.mjs';

const DATA = join(process.cwd(), 'data');
const RAW = join(DATA, 'raw');
const ps = JSON.parse(readFileSync(join(DATA, 'politicians.json'), 'utf8'));
const meta = JSON.parse(readFileSync(join(DATA, 'meta.json'), 'utf8'));

const BULK = /^(proposicoes|proposicoesTemas|proposicoesAutores|votacoesVotos|votacoesOrientacoes)-\d{4}\.csv$/;
const agora = Date.now();
const bulks = existsSync(RAW)
  ? readdirSync(RAW).filter((f) => BULK.test(f))
    .map((nome) => ({ nome, dias: (agora - statSync(join(RAW, nome)).mtimeMs) / 86400e3 }))
  : [];

const { falhas, avisos, resumo } = diagnostico(ps, meta, bulks, { hoje: new Date().toISOString().slice(0, 10) });

console.log('\n[sanidade] ' + resumo.join('\n[sanidade] '));
for (const a of avisos) console.log(`⚠️  [sanidade] ${a}`);
for (const f of falhas) console.log(`❌ [sanidade] ${f}`);
if (falhas.length) {
  console.log(`\n❌ [sanidade] ${falhas.length} falha(s): o dado em data/ NÃO deve ser publicado. Investigue a fonte antes de reingerir.`);
  process.exit(1);
}
console.log(avisos.length ? '[sanidade] ok, com avisos acima' : '[sanidade] ok');
