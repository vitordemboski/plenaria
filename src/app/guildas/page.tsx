import { PrefetchLink } from '@/components/PrefetchLink';
import { getGuildStats } from '@/lib/guild-stats';
import { GuildCrest } from '@/components/GuildCrest';
import { TIER_ORDER, TIER_LABEL, guilds, meta } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { guildSlug } from '@/lib/slug';

export const metadata = pageMeta({
  title: 'Guildas',
  description: `As ${guilds.length} facções (partidos) do reino ranqueadas por Poder médio, com a distribuição de tiers e o gasto de cota de cada bancada.`,
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
  const stats = getGuildStats().sort(
    (a, b) => b.opsMedio - a.opsMedio || b.tierCounts.S - a.tierCounts.S,
  );

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
    </main>
  );
}
