import { politicians, guilds, SCORING_STAT_META, foraDoRanking } from './data';
import type { Guild, StatKey, Tier } from './types';

export interface GuildStats extends Guild {
  membros: number;
  opsMedio: number;
  tier: Tier;
  avgStats: Record<StatKey, number>;
  tierCounts: Record<Tier, number>;
  /** quantos parlamentares da guilda estão fora do ranking (mandato parcial/presidência) */
  fora: number;
  /** false quando NENHUM membro é ranqueável — aí opsMedio/tier são zeros sem
   *  significado e a guilda não pode ser ranqueada nem comparada. Ex.: a DC tem
   *  um único deputado, empossado há menos de um mês. */
  ranqueavel: boolean;
}

export function guildTierOf(ops: number): Tier {
  if (ops >= 88) return 'S';
  if (ops >= 75) return 'A';
  if (ops >= 60) return 'B';
  if (ops >= 45) return 'C';
  if (ops >= 30) return 'D';
  return 'F';
}

/** Agregados por guilda, computados em build-time (Server Components). */
export function getGuildStats(): GuildStats[] {
  return guilds.map((g) => {
    // mandato parcial (posse recente/licença prolongada) fica fora do ranking da guilda
    const members = politicians.filter((p) => p.partido === g.sigla && !foraDoRanking(p));
    const n = members.length || 1;
    const avgStats = Object.fromEntries(
      SCORING_STAT_META.map((s) => {
        // média apenas sobre membros que TÊM o atributo (o Senado não tem Fiscalização)
        const have = members.filter((p) => !p.rawNumbers || p.rawNumbers[s.key]);
        const base = have.length ? have : members;
        return [s.key, Math.round(base.reduce((sum, p) => sum + p.stats[s.key], 0) / (base.length || 1))];
      }),
    ) as Record<StatKey, number>;
    const opsMedio = Math.round(members.reduce((s, p) => s + p.ops, 0) / n);
    const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 } as Record<Tier, number>;
    for (const p of members) tierCounts[p.tier]++;
    const fora = politicians.filter((p) => p.partido === g.sigla && foraDoRanking(p)).length;
    return {
      ...g, membros: members.length, opsMedio, tier: guildTierOf(opsMedio), avgStats, tierCounts,
      fora, ranqueavel: members.length > 0,
    };
  });
}
