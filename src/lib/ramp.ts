/**
 * Rampa dourada sequencial validada p/ dark surface (#3a2f18 → #f6e39b) — a régua
 * de cor dos charts do projeto (mapa, quebra da cota). `t` vai de 0 (escuro) a 1 (claro).
 * Degraus escuros exigem "relief" (borda 1px + rótulo/tooltip) — ver globals/carta.css.
 */
export function rampColor(t: number): string {
  const c1 = [58, 47, 24], c2 = [246, 227, 155];
  return `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(',')})`;
}
