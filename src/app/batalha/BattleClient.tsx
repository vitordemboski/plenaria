'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShareButton } from '@/components/ShareButton';
import { Portrait } from '@/components/Portrait';
import { GuildCrest } from '@/components/GuildCrest';
import type { PoliticianIndex, StatKey, Guild, Stats, Tier, DataMeta } from '@/lib/types';
import { guildSlug } from '@/lib/slug';

const ALL_ROUNDS: { key: StatKey; icon: string; label: string }[] = [
  { key: 'ataque', icon: '⚔️', label: 'Ataque' },
  { key: 'stamina', icon: '🛡️', label: 'Stamina' },
  { key: 'eficiencia', icon: '🎯', label: 'Eficiência' },
  { key: 'tecnica', icon: '📜', label: 'Técnica' },
  { key: 'economia', icon: '🪙', label: 'Economia' },
  { key: 'influencia', icon: '📢', label: 'Influência' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mesma regra do `foraDoRanking` de @/lib/data — repetida aqui de propósito: aquele
 * módulo importa os JSONs inteiros, e esta é uma ilha client (entrariam no bundle).
 *
 * Sem este filtro a Batalha duelava quem tomou posse há 5 meses contra quem tem 41
 * de mandato, exibindo o Tier F e o Poder que a ficha da própria pessoa se recusa a
 * mostrar — e o resultado ainda virava imagem compartilhável.
 */
const foraDoRanking = (p: PoliticianIndex) => !!p.mandatoParcial || !!p.presidenteCasa;

// durações da sequência de batalha — precisam casar com os keyframes
// clash-a/clash-b, round-in e board-slam definidos em globals.css
const CLASH_MS = 900;
const ROUND_STAGGER_MS = 380;
const REVEAL_TAIL_MS = 750;

/** Fases da encenação: colisão dos cards → rounds golpe a golpe → placar. */
type Phase = 'idle' | 'clash' | 'rounds' | 'done';

/** Agregado de uma guilda: média dos stats dos membros + composição de tiers. */
interface GuildAgg extends Guild {
  membros: number;
  opsMedio: number;
  stats: Stats;
  tierS: number;
  tierA: number;
}

function aggregateGuilds(guilds: Guild[], list: PoliticianIndex[]): GuildAgg[] {
  return guilds.map((g) => {
    const members = list.filter((p) => p.partido === g.sigla);
    const n = members.length || 1;
    const stats = Object.fromEntries(
      ALL_ROUNDS.map((r) => {
        const have = members.filter((p) => !p.avail || p.avail.includes(r.key));
        const base = have.length ? have : members;
        return [r.key, Math.round(base.reduce((s, p) => s + p.stats[r.key], 0) / (base.length || 1))];
      }),
    ) as Stats;
    return {
      ...g,
      membros: members.length,
      opsMedio: Math.round(members.reduce((s, p) => s + p.ops, 0) / n),
      stats,
      tierS: members.filter((p) => p.tier === 'S').length,
      tierA: members.filter((p) => p.tier === 'A').length,
    };
  });
}

/* ---------------- 1v1 (político) ---------------- */

function FighterPicker({ side, list, exclude, onPick }: {
  side: 'a' | 'b';
  list: PoliticianIndex[];
  exclude?: string;
  onPick: (p: PoliticianIndex) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = useMemo(() => {
    const nq = norm(q.trim());
    const pool = list.filter((p) => p.slug !== exclude);
    if (!nq) return pool.slice(0, 8);
    return pool
      .filter((p) => norm(p.nome).includes(nq) || norm(p.uf) === nq || norm(p.partido).includes(nq))
      .slice(0, 8);
  }, [list, q, exclude]);

  const sortear = () => {
    const pool = list.filter((p) => p.slug !== exclude);
    if (pool.length) onPick(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <div className={`fighter side-${side} picker-empty`}>
      <div className="picker" ref={boxRef}>
        <input
          type="search"
          placeholder={`🔍 Buscar ${side === 'a' ? 'desafiante' : 'oponente'}…`}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          aria-label={`Buscar lutador ${side.toUpperCase()}`}
        />
        {open && results.length > 0 && (
          <div className="results" role="listbox">
            {results.map((p) => (
              <button key={p.slug} className="ritem" role="option" aria-selected="false"
                onClick={() => { onPick(p); setQ(''); setOpen(false); }}>
                <span className={`tier-chip display tier-${p.tier}`}>{p.tier}</span>
                <span className="ritem-nm">
                  <b>{p.nome}</b>
                  <small>{p.casa === 'camara' ? 'Dep.' : 'Sen.'} · {p.uf} · {p.partido} · Poder {p.ops}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="btn ghost sortear" onClick={sortear}>🎲 Sortear</button>
    </div>
  );
}

function FighterCard({ side, p, opponent, onClear, rounds }: {
  side: 'a' | 'b';
  p: PoliticianIndex;
  opponent?: PoliticianIndex;
  onClear: () => void;
  rounds: Round[];
}) {
  return (
    <div className={`fighter side-${side} fcard tier-${p.tier}`}>
      <div className="fcard-top">
        <span className={`tier-chip big display tier-${p.tier}`}>{p.tier}</span>
        <button className="swap" onClick={onClear} aria-label="Trocar lutador">↺ trocar</button>
      </div>
      <div className="fportrait">
        <Portrait slug={p.slug} fotoUrl={p.fotoUrl} height={120} />
      </div>
      <h4><Link href={`/politico/${p.slug}/`}>{p.nome}</Link></h4>
      <div className="g">
        {p.casa === 'camara' ? 'Dep.' : 'Sen.'} · {p.uf} · 🛡️ {p.partido} · Poder <b>{p.ops}</b>
      </div>
      <StatRows stats={p.stats} opponent={opponent?.stats} rounds={rounds} />
    </div>
  );
}

/* ---------------- Guild vs Guild ---------------- */

function GuildPicker({ side, guilds, exclude, onPick }: {
  side: 'a' | 'b';
  guilds: GuildAgg[];
  exclude?: string;
  onPick: (g: GuildAgg) => void;
}) {
  return (
    <div className={`fighter side-${side} picker-empty`}>
      <div className="guild-grid">
        {guilds.map((g) => (
          <button
            key={g.sigla}
            className="gpick"
            disabled={g.sigla === exclude}
            onClick={() => onPick(g)}
            title={g.nome}
          >
            <GuildCrest sigla={g.sigla} cor={g.cor} size={34} />
            <small>{g.sigla}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function GuildFighterCard({ side, g, opponent, onClear, rounds }: {
  side: 'a' | 'b';
  g: GuildAgg;
  opponent?: GuildAgg;
  onClear: () => void;
  rounds: Round[];
}) {
  return (
    <div className={`fighter fcard side-${side}`} style={{ borderColor: g.cor }}>
      <div className="fcard-top">
        <GuildCrest sigla={g.sigla} cor={g.cor} size={44} />
        <button className="swap" onClick={onClear} aria-label="Trocar guilda">↺ trocar</button>
      </div>
      <h4><Link href={`/guilda/${guildSlug(g.sigla)}/`}>{g.nome}</Link></h4>
      <div className="g">
        {g.membros} membros · Poder médio <b>{g.opsMedio}</b> · {g.tierS}× Tier S · {g.tierA}× Tier A
      </div>
      <StatRows stats={g.stats} opponent={opponent?.stats} rounds={rounds} />
    </div>
  );
}

/* ---------------- compartilhado ---------------- */

type Round = { key: StatKey; icon: string; label: string };

function StatRows({ stats, opponent, rounds }: { stats: Stats; opponent?: Stats; rounds: Round[] }) {
  return (
    <div className="stats fstats">
      {rounds.map((r) => {
        const v = stats[r.key];
        const winning = opponent ? v >= opponent[r.key] : false;
        return (
          <div className="stat" key={r.key}>
            <span className="ic">{r.icon}</span>
            <span className="lbl">{r.label}</span>
            <span className="track">
              <i className={`fill${v < 40 ? ' low' : ''}`} style={{ width: `${v}%` }} />
            </span>
            <span className={`val${opponent && winning ? ' winning' : ''}`}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function Rounds({ a, b, rounds }: { a: Stats; b: Stats; rounds: Round[] }) {
  return (
    <div className="rounds animate">
      {rounds.map((r, i) => {
        const va = a[r.key], vb = b[r.key];
        const total = va + vb || 1;
        const aWins = va >= vb;
        return (
          <div className="round" key={r.key} style={{ '--d': `${i * ROUND_STAGGER_MS / 1000}s` } as CSSProperties}>
            <div className={`side-val ${aWins ? 'win-a' : ''}`} style={{ textAlign: 'right' }}>
              {va}{aWins && <small>◀ vence</small>}
            </div>
            <div className="tug">
              <div className="fa" style={{ width: `${(va / total) * 100}%` }} />
              <div className="fb" style={{ width: `${(vb / total) * 100}%` }} />
              <span className="lbl">{r.icon} {r.label}</span>
            </div>
            <div className={`side-val ${!aWins ? 'win-b' : ''}`}>
              {vb}{!aWins && <small>vence ▶</small>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Scoreboard({ scoreA, scoreB, winnerName, nameA, nameB, opsA, opsB, opsLabel, shareText, tieNote, draw, roundsDetail }: {
  scoreA: number; scoreB: number; winnerName: string; nameA: string; nameB: string;
  opsA: number; opsB: number; opsLabel: string;
  shareText: string; tieNote?: string;
  /** rounds E critério de desempate iguais → ninguém vence */
  draw?: boolean;
  /** detalhe golpe a golpe para o Story compartilhável */
  roundsDetail: { label: string; icon: string; a: number; b: number }[];
}) {
  const byTieBreak = scoreA === scoreB && !draw;
  const tied = draw || byTieBreak; // rounds empatados → o Poder é o desempate
  return (
    <div className="scoreboard reveal">
      <div className="score">
        <span className="sa">{scoreA}</span><span className="x">×</span><span className="sb">{scoreB}</span>
      </div>
      <div className="winner-line">
        {draw ? <span className="draw-flag">🤝 EMPATE</span> : <>🏆 {winnerName}{!byTieBreak && <span className="ko">K.O.!</span>}</>}
      </div>
      {tied && (
        <div className="tiebreak">
          <span className="tb-cap">Desempate · {opsLabel}</span>
          <span className="tb-vals">
            <b className={opsA >= opsB ? 'win' : ''}>{opsA}</b>
            <span className="x">×</span>
            <b className={opsB >= opsA ? 'win' : ''}>{opsB}</b>
          </span>
        </div>
      )}
      {tied && tieNote && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{tieNote}</div>
      )}
      <div style={{ marginTop: 14 }}>
        <ShareButton
          title="PLENÁRIA — Batalha"
          text={shareText}
          card={{
            variant: 'batalha',
            heading: `${scoreA} × ${scoreB}`,
            score: { a: scoreA, b: scoreB, nameA, nameB, result: draw ? '🤝 EMPATE' : `🏆 ${winnerName}`,
              rounds: roundsDetail,
              ...(tied ? { tie: { opsA, opsB, label: opsLabel } } : {}) },
          }}
        />
      </div>
    </div>
  );
}

type Mode = 'solo' | 'guild';

export function BattleClient() {
  const params = useSearchParams();
  const [list, setList] = useState<PoliticianIndex[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [rounds, setRounds] = useState(ALL_ROUNDS);
  const [mode, setMode] = useState<Mode>('solo');
  const [slugA, setSlugA] = useState('');
  const [slugB, setSlugB] = useState('');
  const [guildA, setGuildA] = useState('');
  const [guildB, setGuildB] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    Promise.all([
      fetch('/data/index.json').then((r) => r.json()),
      fetch('/data/guilds.json').then((r) => r.json()),
      fetch('/data/meta.json').then((r) => r.json()),
    ]).then(([data, gs, m]: [PoliticianIndex[], Guild[], DataMeta]) => {
      // rounds só com atributos que PONTUAM: os informativos (Influência) não decidem luta
      const informativos = new Set(m.statsInformativos ?? []);
      setRounds(ALL_ROUNDS.filter((r) => m.availableStats.includes(r.key) && !informativos.has(r.key)));
      // filtra ANTES de guardar: o mesmo array alimenta seletor, sorteio, deep link
      // (?a=slug) e a média das guildas — filtrar em cada ponto de uso deixaria o
      // próximo a ser escrito de fora.
      const ranqueaveis = data.filter((p) => !foraDoRanking(p));
      ranqueaveis.sort((x, y) => x.nome.localeCompare(y.nome));
      setList(ranqueaveis);
      setGuilds(gs);
      const a = params.get('a'), b = params.get('b');
      const ga = params.get('ga'), gb = params.get('gb');
      if (a && ranqueaveis.some((p) => p.slug === a)) setSlugA(a);
      if (b && ranqueaveis.some((p) => p.slug === b)) setSlugB(b);
      if (ga && gs.some((g) => g.sigla === ga)) setGuildA(ga);
      if (gb && gs.some((g) => g.sigla === gb)) setGuildB(gb);
      if ((ga || gb) && !a && !b) setMode('guild');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL compartilhável: ?a=&b= no 1v1, ?ga=&gb= no guild vs guild
  useEffect(() => {
    if (!list.length) return;
    const q = new URLSearchParams();
    if (mode === 'solo') {
      if (slugA) q.set('a', slugA);
      if (slugB) q.set('b', slugB);
    } else {
      if (guildA) q.set('ga', guildA);
      if (guildB) q.set('gb', guildB);
    }
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [mode, slugA, slugB, guildA, guildB, list.length]);

  const guildAggs = useMemo(() => aggregateGuilds(guilds, list), [guilds, list]);

  const a = useMemo(() => list.find((p) => p.slug === slugA), [list, slugA]);
  const b = useMemo(() => list.find((p) => p.slug === slugB), [list, slugB]);
  const ga = useMemo(() => guildAggs.find((g) => g.sigla === guildA), [guildAggs, guildA]);
  const gb = useMemo(() => guildAggs.find((g) => g.sigla === guildB), [guildAggs, guildB]);

  // no 1v1, só comparamos atributos que AMBOS possuem (dep × sen: sem Fiscalização/Alinhamento)
  const effRounds = useMemo(() => (mode === 'solo'
    ? rounds.filter((r) =>
        (!a?.avail || a.avail.includes(r.key)) && (!b?.avail || b.avail.includes(r.key)))
    : rounds), [mode, rounds, a, b]);

  // identifica o confronto atual; muda → reencena a batalha do zero
  const battleKey = mode === 'solo'
    ? (a && b ? `solo:${a.slug}x${b.slug}` : '')
    : (ga && gb ? `guild:${ga.sigla}x${gb.sigla}` : '');
  const nRounds = effRounds.length;

  useEffect(() => {
    if (!battleKey) { setPhase('idle'); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('done'); // sem encenação: resultado direto (o CSS também zera as animações)
      return;
    }
    setPhase('clash');
    const t1 = setTimeout(() => setPhase('rounds'), CLASH_MS);
    const t2 = setTimeout(() => setPhase('done'), CLASH_MS + nRounds * ROUND_STAGGER_MS + REVEAL_TAIL_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [battleKey, nRounds]);

  // acompanha a encenação: rola até os rounds quando começam e até o placar na revelação
  useEffect(() => {
    if (phase !== 'rounds' && phase !== 'done') return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = document.querySelector(phase === 'rounds' ? '.rounds' : '.scoreboard');
    target?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }, [phase]);

  if (!list.length) {
    return <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Preparando arena…</p>;
  }

  const fightA = mode === 'solo' ? a : ga;
  const fightB = mode === 'solo' ? b : gb;
  const staged = phase === 'rounds' || phase === 'done';
  let scoreA = 0, scoreB = 0;
  if (fightA && fightB) for (const r of effRounds) {
    if (fightA.stats[r.key] >= fightB.stats[r.key]) scoreA++; else scoreB++;
  }

  return (
    <>
      <div className="mode-toggle" role="group" aria-label="Modo de batalha">
        <button className={`fbtn${mode === 'solo' ? ' active' : ''}`} onClick={() => setMode('solo')} aria-pressed={mode === 'solo'}>
          🃏 Político 1v1
        </button>
        <button className={`fbtn${mode === 'guild' ? ' active' : ''}`} onClick={() => setMode('guild')} aria-pressed={mode === 'guild'}>
          🛡️ Guilda vs Guilda
        </button>
      </div>

      <div className={`fighters${phase === 'clash' ? ' phase-clash' : ''}`}>
        {mode === 'solo' ? (
          a
            ? <FighterCard side="a" p={a} opponent={b} onClear={() => setSlugA('')} rounds={effRounds} />
            : <FighterPicker side="a" list={list} exclude={slugB} onPick={(p) => setSlugA(p.slug)} />
        ) : (
          ga
            ? <GuildFighterCard side="a" g={ga} opponent={gb} onClear={() => setGuildA('')} rounds={rounds} />
            : <GuildPicker side="a" guilds={guildAggs} exclude={guildB} onPick={(g) => setGuildA(g.sigla)} />
        )}
        <div className="vs-txt">VS</div>
        {mode === 'solo' ? (
          b
            ? <FighterCard side="b" p={b} opponent={a} onClear={() => setSlugB('')} rounds={effRounds} />
            : <FighterPicker side="b" list={list} exclude={slugA} onPick={(p) => setSlugB(p.slug)} />
        ) : (
          gb
            ? <GuildFighterCard side="b" g={gb} opponent={ga} onClear={() => setGuildB('')} rounds={rounds} />
            : <GuildPicker side="b" guilds={guildAggs} exclude={guildA} onPick={(g) => setGuildB(g.sigla)} />
        )}
      </div>

      {mode === 'solo' && a && b && staged && (
        <>
          <Rounds key={battleKey} a={a.stats} b={b.stats} rounds={effRounds} />
          {phase === 'done' && <Scoreboard
            scoreA={scoreA} scoreB={scoreB} nameA={a.nome} nameB={b.nome}
            opsA={a.ops} opsB={b.ops} opsLabel="Poder"
            roundsDetail={effRounds.map((r) => ({ label: r.label, icon: r.icon, a: a.stats[r.key], b: b.stats[r.key] }))}
            draw={scoreA === scoreB && a.ops === b.ops}
            winnerName={(scoreA === scoreB ? (a.ops >= b.ops ? a : b) : scoreA > scoreB ? a : b).nome}
            shareText={scoreA === scoreB && a.ops === b.ops
              ? `⚔️ ${a.nome} ${scoreA} × ${scoreB} ${b.nome} — 🤝 empate total! #PLENARIA`
              : `⚔️ ${a.nome} ${scoreA} × ${scoreB} ${b.nome} — 🏆 ${(scoreA === scoreB ? (a.ops >= b.ops ? a : b) : scoreA > scoreB ? a : b).nome} venceu! #PLENARIA`}
            tieNote={scoreA === scoreB && a.ops === b.ops
              ? 'empate em rounds e no Poder — batalha sem vencedor'
              : 'empate em rounds — vitória no desempate pelo Poder'}
          />}
          {phase === 'done' && a.casa !== b.casa && (
            <div className="disclaimer">
              ⚠︎ Comparação entre casas diferentes (Câmara × Senado): atributos normalizados por percentil dentro de cada casa.
            </div>
          )}
        </>
      )}

      {mode === 'guild' && ga && gb && staged && (
        <>
          <Rounds key={battleKey} a={ga.stats} b={gb.stats} rounds={rounds} />
          {phase === 'done' && <Scoreboard
            scoreA={scoreA} scoreB={scoreB} nameA={`Guilda ${ga.sigla}`} nameB={`Guilda ${gb.sigla}`}
            opsA={ga.opsMedio} opsB={gb.opsMedio} opsLabel="Poder médio"
            roundsDetail={rounds.map((r) => ({ label: r.label, icon: r.icon, a: ga.stats[r.key], b: gb.stats[r.key] }))}
            draw={scoreA === scoreB && ga.opsMedio === gb.opsMedio}
            winnerName={`Guilda ${(scoreA === scoreB ? (ga.opsMedio >= gb.opsMedio ? ga : gb) : scoreA > scoreB ? ga : gb).sigla}`}
            shareText={scoreA === scoreB && ga.opsMedio === gb.opsMedio
              ? `🛡️ Guilda ${ga.sigla} ${scoreA} × ${scoreB} Guilda ${gb.sigla} — 🤝 empate total! #PLENARIA`
              : `🛡️ Guilda ${ga.sigla} ${scoreA} × ${scoreB} Guilda ${gb.sigla} — 🏆 ${(scoreA === scoreB ? (ga.opsMedio >= gb.opsMedio ? ga : gb) : scoreA > scoreB ? ga : gb).nome} venceu! #PLENARIA`}
            tieNote={scoreA === scoreB && ga.opsMedio === gb.opsMedio
              ? 'empate em rounds e no Poder médio — batalha sem vencedor'
              : 'empate em rounds — vitória no desempate pelo Poder médio'}
          />}
          {phase === 'done' && (
            <div className="disclaimer">
              Atributos da guilda = média dos atributos de todos os seus membros ({ga.membros} × {gb.membros}).
            </div>
          )}
        </>
      )}
    </>
  );
}
