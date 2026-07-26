import { PrefetchLink } from '@/components/PrefetchLink';
import { getGuildStats } from '@/lib/guild-stats';
import { GuildCrest } from '@/components/GuildCrest';
import { TIER_ORDER, TIER_LABEL, meta } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { guildSlug } from '@/lib/slug';

export const metadata = pageMeta({
  title: 'Guildas',
  description: `As facções (partidos) do reino ranqueadas por Poder médio, com a distribuição de tiers e o gasto de cota de cada bancada.`,
  path: '/guildas/',
});

const ARCHETYPE: Record<string, string> = {
  esquerda: 'Facção da Vanguarda',
  centro: 'Facção do Equilíbrio',
  direita: 'Facção da Tradição',
};

/**
 * Listagem de Guildas — ranking das 9 facções por Poder médio,
 * 100% estática, cada card linka para /guilda/[sigla]/.
 */
export default function GuildsPage() {
  // Guilda sem NENHUM membro ranqueável (ex.: a DC, com um único deputado empossado
  // há menos de um mês) sai do ranking: seu Poder médio é 0 por ausência de gente
  // medida, e ranqueá-la a colocaria em último lugar afirmando desempenho ruim onde
  // não há desempenho medido — o mesmo erro do Tier F em parlamentar de mandato parcial.
  const todas = getGuildStats();
  const stats = todas.filter((g) => g.ranqueavel).sort(
    (a, b) => b.opsMedio - a.opsMedio || b.tierCounts.S - a.tierCounts.S,
  );
  const semRoster = todas.filter((g) => !g.ranqueavel);

  return (
    <main>
      <div className="page-title">
        <h1>GUILDAS</h1>
        <p>As {stats.length} facções do reino, ranqueadas pelo Poder médio</p>
      </div>

      <div className="guild-list">
        {stats.map((g, i) => (
          <PrefetchLink key={g.sigla} href={`/guilda/${guildSlug(g.sigla)}/`} className={`gcard tier-${g.tier}`}>
            <div className="gcard-rank display">{i + 1}</div>
            <GuildCrest sigla={g.sigla} cor={g.cor} size={52} />
            <div className="gcard-id">
              <b className="display">{g.nome}</b>
              <small>{g.sigla}{g.espectro ? ` · ${ARCHETYPE[g.espectro]}` : ''} · {g.membros} membros</small>
              <div className="gcard-tiers">
                {TIER_ORDER.map((t) =>
                  g.tierCounts[t] ? (
                    <span key={t} className={`tier-mini tier-${t}`}>
                      <i className="display">{t}</i>{g.tierCounts[t]}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
            <div className="gcard-ops">
              <span className={`tier-chip big display tier-${g.tier}`} title={TIER_LABEL[g.tier]}>{g.tier}</span>
              <b>{g.opsMedio}</b>
              <small>PODER MÉDIO</small>
            </div>
          </PrefetchLink>
        ))}
      </div>

      {semRoster.length > 0 && (
        <div className="panel fora-panel" style={{ marginTop: 18 }}>
          <h3>🕓 Fora do ranking de guildas</h3>
          <p className="fora-por">
            {semRoster.length === 1 ? 'Esta guilda não tem' : 'Estas guildas não têm'} nenhum parlamentar
            ranqueável — todos os seus membros estão fora do ranking (mandato parcial ou presidência da
            Casa). Sem ninguém medido, não há Poder médio nem Tier a atribuir.
          </p>
          <div className="gcard-fora">
            {semRoster.map((g) => (
              <PrefetchLink key={g.sigla} href={`/guilda/${guildSlug(g.sigla)}/`} className="gcard-fora-item">
                <GuildCrest sigla={g.sigla} cor={g.cor} size={34} />
                <span>
                  <b>{g.nome}</b>
                  <small>{g.sigla} · {g.fora} {g.fora === 1 ? 'parlamentar, fora do ranking' : 'parlamentares, todos fora do ranking'}</small>
                </span>
              </PrefetchLink>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
