#!/usr/bin/env node
/**
 * Guarda do `dev`/`build`: os dados são REAIS e vêm de `npm run data:real`.
 *
 * Não há fallback que gere dados: se `data/` sumir, é para falhar ALTO. Um
 * gerador sintético de emergência subiria o site com parlamentares inventados
 * no lugar de gente real, e ninguém perceberia.
 */
import { existsSync, readFileSync } from 'node:fs';

if (!existsSync('data/meta.json') || !existsSync('data/politicians.json')) {
  console.error(`
  ✗ Faltam os dados em data/.

    Rode:  npm run data:real

    (do zero leva ~1h — a API da Câmara devolve 504 em rajada;
     o cache em data/raw/ é incremental, então re-rodar retoma.)
`);
  process.exit(1);
}

// Fotos precisam ser LOCAIS (/fotos/…): a foto remota renderiza normal na página,
// mas não manda CORS — no canvas do ShareButton ela falha e o card compartilhado
// sai SEM o rosto, silenciosamente. Acontece quando a ingestão re-emite os JSONs
// e a etapa de reescrita (fetch-fotos) não completa. Poucas remotas são normais
// (download que falhou é mantido remoto de propósito); a MAIORIA remota significa
// que a reescrita não rodou — aí é para falhar alto.
const politicians = JSON.parse(readFileSync('data/politicians.json', 'utf8'));
const remotas = politicians.filter((p) => /^https?:/.test(p.fotoUrl ?? '')).length;
if (remotas > politicians.length * 0.1) {
  console.error(`
  ✗ ${remotas}/${politicians.length} fotoUrl ainda apontam para os portais (remoto).

    A etapa de reescrita das fotos não rodou após a ingestão — o site renderiza,
    mas TODO card de compartilhamento sai sem o rosto (canvas contaminado/CORS).

    Rode:  npm run fotos
`);
  process.exit(1);
}
