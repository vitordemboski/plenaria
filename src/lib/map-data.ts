/**
 * Agregados por UF para o explorador de mapa — computados no build a partir de
 * politicians.json. Devolve as "famílias" de camadas e os datasets numéricos;
 * a ilha client `MapExplorer` só escolhe a camada ativa e pinta o mapa.
 */
import { politicians as allPoliticians, titleDefs, meta, foraDoRanking } from './data';

// mandato parcial (posse recente) fica fora de todas as camadas de ranking do mapa
const politicians = allPoliticians.filter((p) => !foraDoRanking(p));

export interface MapDataset {
  kind: 'ops' | 'money' | 'age' | 'pct' | 'count';
  values: Record<string, number | null>;
}
export interface MapOption { id: string; label: string; datasetKey: string }
export interface MapFamily {
  id: string;
  label: string;
  hint: string;
  /** true = maior é melhor · false = maior é pior · null = neutro (só densidade) */
  higherIsBetter: boolean | null;
  options: MapOption[];
}

const UFS = [...new Set(politicians.map((p) => p.uf))].sort();
const round = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null);

export function buildMapView(): { families: MapFamily[]; datasets: Record<string, MapDataset> } {
  const byUf = Object.fromEntries(UFS.map((uf) => [uf, politicians.filter((p) => p.uf === uf)]));
  const has = (fn: (p: (typeof politicians)[number]) => boolean) => politicians.some(fn);

  const datasets: Record<string, MapDataset> = {};
  const put = (key: string, kind: MapDataset['kind'], values: Record<string, number | null>) => {
    datasets[key] = { kind, values };
  };

  // Poder médio: nacional + por casa
  put('ops:nacional', 'ops', Object.fromEntries(UFS.map((uf) => [uf, round(byUf[uf].map((p) => p.ops))])));
  put('ops:camara', 'ops', Object.fromEntries(UFS.map((uf) => [uf, round(byUf[uf].filter((p) => p.casa === 'camara').map((p) => p.ops))])));
  put('ops:senado', 'ops', Object.fromEntries(UFS.map((uf) => [uf, round(byUf[uf].filter((p) => p.casa === 'senado').map((p) => p.ops))])));

  // Gasto médio (CEAP) R$ mil/mês
  put('gasto', 'money', Object.fromEntries(UFS.map((uf) => [uf, round(byUf[uf].map((p) => p.gastoMensalMedioMil))])));

  // Alinhamento médio com o Governo — só na Câmara
  // (só ela publica orientação de bancada; o Senado não entra nesta camada)
  const temAlinhamento = has((p) => p.rawNumbers?.alinhamento !== undefined);
  if (temAlinhamento) {
    put('alinhamento', 'pct', Object.fromEntries(UFS.map((uf) => {
      const com = byUf[uf].filter((p) => p.rawNumbers?.alinhamento !== undefined);
      return [uf, com.length ? round(com.map((p) => p.stats.alinhamento)) : null];
    })));
  }

  // Perfil da bancada
  put('perfil:bancada', 'count', Object.fromEntries(UFS.map((uf) => [uf, byUf[uf].length])));
  const temIdade = has((p) => !!p.ficha?.idade);
  if (temIdade) {
    put('perfil:idade', 'age', Object.fromEntries(UFS.map((uf) => [uf, round(byUf[uf].filter((p) => p.ficha?.idade).map((p) => p.ficha!.idade!))])));
  }
  const temGenero = has((p) => p.sexo === 'F' || p.sexo === 'M');
  if (temGenero) {
    put('perfil:genero', 'pct', Object.fromEntries(UFS.map((uf) => {
      const com = byUf[uf].filter((p) => p.sexo === 'F' || p.sexo === 'M');
      return [uf, com.length ? Math.round((com.filter((p) => p.sexo === 'F').length / com.length) * 100) : null];
    })));
  }

  // Densidade de títulos: um dataset por título com portadores
  const titulosComPortador = meta.titulosDisponiveis
    ? titleDefs.filter((t) => politicians.some((p) => p.titles.includes(t.slug)))
    : [];
  for (const t of titulosComPortador) {
    put(`titulo:${t.slug}`, 'count', Object.fromEntries(UFS.map((uf) => [uf, byUf[uf].filter((p) => p.titles.includes(t.slug)).length])));
  }

  const perfilOpts: MapOption[] = [
    { id: 'bancada', label: 'Tamanho da bancada', datasetKey: 'perfil:bancada' },
    ...(temIdade ? [{ id: 'idade', label: 'Idade média', datasetKey: 'perfil:idade' }] : []),
    ...(temGenero ? [{ id: 'genero', label: '% de mulheres', datasetKey: 'perfil:genero' }] : []),
  ];

  const families: MapFamily[] = [
    {
      id: 'ops', label: '🏅 Poder médio', higherIsBetter: true,
      hint: 'Desempenho médio da bancada. Nacional mistura as duas casas; use os filtros por casa para uma comparação justa (o Poder é percentil dentro de cada casa).',
      options: [
        { id: 'nacional', label: 'Nacional', datasetKey: 'ops:nacional' },
        { id: 'camara', label: 'Câmara', datasetKey: 'ops:camara' },
        { id: 'senado', label: 'Senado', datasetKey: 'ops:senado' },
      ],
    },
    ...(titulosComPortador.length
      ? [{
          id: 'titulo', label: '🎖️ Densidade de títulos', higherIsBetter: null,
          hint: 'Quantos parlamentares de cada UF carregam o título escolhido.',
          options: titulosComPortador.map((t) => ({ id: t.slug, label: t.label, datasetKey: `titulo:${t.slug}` })),
        } as MapFamily]
      : []),
    {
      id: 'gasto', label: '💸 Gasto (CEAP)', higherIsBetter: false,
      hint: 'Cota parlamentar média por UF, R$ mil/mês. Tom mais claro (dourado) = gasta menos, mais frugal.',
      options: [{ id: 'gasto', label: 'Gasto médio', datasetKey: 'gasto' }],
    },
    ...(temAlinhamento
      ? [{
          id: 'alinhamento', label: '🏛️ Alinhamento com o Governo', higherIsBetter: null,
          hint: 'Alinhamento médio da bancada de cada UF com a orientação do Governo (só Câmara). Ser governista não é bom nem ruim — é só posição política, por isso a camada é neutra.',
          options: [{ id: 'alinhamento', label: 'Alinhamento médio', datasetKey: 'alinhamento' }],
        } as MapFamily]
      : []),
    {
      id: 'perfil', label: '⚥ Perfil da bancada', higherIsBetter: null,
      hint: 'Composição da bancada de cada estado.',
      options: perfilOpts,
    },
  ];

  return { families, datasets };
}
