'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PoliticianLink } from '@/components/PoliticianLink';
import { EleicaoMini } from '@/components/EleicaoMini';
import type { PoliticianIndex, Tier, Casa } from '@/lib/types';

/** Versão da entrada sem `stats` — a home não precisa deles (payload menor). */
export type TierListEntry = Omit<PoliticianIndex, 'stats'>;

const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D', 'F'];
const TIER_LABEL: Record<Tier, string> = {
  S: 'Lendário', A: 'Excelente', B: 'Consistente', C: 'Mediano', D: 'Fraco', F: 'Figurante',
};

/** Remove acentos e baixa a caixa — busca tolerante a "Vasconcelos"/"vasconcelos"/"vásconcelos". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type CasaFilter = 'todos' | Casa;

const CASAS: CasaFilter[] = ['todos', 'camara', 'senado'];

/** Recorte pelo resultado de 2026. "Fica" junta o reeleito e o senador com mandato até
 *  2031; quem está sem afirmação (campo ausente) não entra em NENHUM recorte — nunca é
 *  presumido como "fica" (ver scripts/lib/resultado2026.mjs). */
type LegFilter = 'todos' | 'sai' | 'fica' | 'muda';

const LEGS: LegFilter[] = ['todos', 'sai', 'fica', 'muda'];

const LEG_LABEL: Record<LegFilter, string> = {
  todos: '🗳️ Próxima legislatura: todos',
  sai: '🚪 Saem em 2027',
  fica: '🔁 Ficam (reeleitos ou mandato até 2031)',
  muda: '↪ Mudam de casa',
};

function passaNoFiltroLeg(p: TierListEntry, f: LegFilter) {
  if (f === 'todos') return true;
  const d = p.eleicao2026?.destino;
  if (f === 'fica') return d === 'fica' || d === 'segue';
  return d === f;
}

type Filtros = { query: string; casa: CasaFilter; uf: string; leg: LegFilter };

const SEM_FILTRO: Filtros = { query: '', casa: 'todos', uf: 'todos', leg: 'todos' };

/**
 * Os filtros vivem na URL (?q=&casa=&uf=), não só no estado do componente — assim o
 * usuário que abre a ficha de um parlamentar e volta reencontra a lista como deixou
 * (e o recorte vira link compartilhável).
 *
 * ⚠️ A URL é escrita SÓ nos handlers, nunca num useEffect que observe o estado.
 * A primeira versão fazia isso e se autodestruía: o efeito de escrita roda com os
 * valores capturados no render ANTERIOR, então ele reescrevia a URL com o estado velho
 * logo depois de a leitura restaurá-la — a barra de endereço piscava o valor certo e
 * voltava para o errado, levando o filtro junto. Escrever no handler elimina a corrida:
 * lá o valor novo é conhecido, não inferido.
 *
 * `replaceState` (não `push`): queremos reescrever a barra de endereço sem navegar nem
 * empilhar uma entrada de histórico a cada tecla digitada na busca — senão o "voltar"
 * andaria letra por letra.
 */
function lerUrl(): Filtros {
  const p = new URLSearchParams(window.location.search);
  const casa = p.get('casa') as CasaFilter | null;
  const leg = p.get('legislatura') as LegFilter | null;
  return {
    query: p.get('q') ?? '',
    casa: casa && CASAS.includes(casa) ? casa : 'todos',
    uf: p.get('uf') ?? 'todos',
    leg: leg && LEGS.includes(leg) ? leg : 'todos',
  };
}

function escreverUrl({ query, casa, uf, leg }: Filtros) {
  const p = new URLSearchParams();
  if (query.trim()) p.set('q', query.trim());
  if (casa !== 'todos') p.set('casa', casa);
  if (uf !== 'todos') p.set('uf', uf);
  if (leg !== 'todos') p.set('legislatura', leg);
  const qs = p.toString();
  window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname);
}

// A página é pré-renderizada: no server o estado inicial é sempre "sem filtro", então ler
// a URL no useState quebraria a hidratação. Lemos APÓS montar — mas em layout effect, que
// roda antes da pintura, para a lista não piscar sem filtro por um frame.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Tier List interativa. Recebe a lista slim já embutida no HTML do build
 * (sem fetch em runtime); busca e filtro rodam 100% no client.
 */
export function TierListClient({ list }: { list: TierListEntry[] }) {
  const [{ query, casa, uf, leg }, setFiltros] = useState<Filtros>(SEM_FILTRO);
  /** sem resultado emitido (TSE fora do ar, lista incompleta, posse passada) o filtro
   *  filtraria o vazio — some junto com o campo */
  const resultadoEm = useMemo(() => list.find((p) => p.eleicao2026)?.eleicao2026?.resultadoEm, [list]);
  const semAfirmacao = useMemo(() => list.filter((p) => !p.eleicao2026 || p.eleicao2026.destino === 'pendente').length, [list]);

  // Sincroniza estado ← URL na montagem E a cada popstate. O popstate é indispensável:
  // no "voltar" o Next NÃO remonta necessariamente este componente (ele reaproveita a
  // árvore em cache), então um efeito de montagem sozinho não rodaria de novo e a lista
  // ficaria com o filtro da navegação anterior.
  useIsoLayoutEffect(() => {
    const sincronizar = () => setFiltros(lerUrl());
    sincronizar();
    window.addEventListener('popstate', sincronizar);
    return () => window.removeEventListener('popstate', sincronizar);
  }, []);

  /** única porta de escrita: aplica o filtro no estado E na URL, com o valor novo em mãos.
   *  (fora do updater do setState — ele precisa ser puro; o StrictMode o roda duas vezes.) */
  const aplicar = (mudanca: Partial<Filtros>) => {
    const proximo = { query, casa, uf, leg, ...mudanca };
    setFiltros(proximo);
    escreverUrl(proximo);
  };

  // UFs disponíveis + quantos parlamentares cada uma tem NA CASA selecionada,
  // para o select já dizer o tamanho da bancada antes do clique.
  const ufs = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of list) {
      if (casa !== 'todos' && p.casa !== casa) continue;
      m.set(p.uf, (m.get(p.uf) ?? 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [list, casa]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return list.filter((p) => {
      if (casa !== 'todos' && p.casa !== casa) return false;
      if (uf !== 'todos' && p.uf !== uf) return false;
      if (!passaNoFiltroLeg(p, leg)) return false;
      if (!q) return true;
      return norm(p.nome).includes(q) || norm(p.uf).includes(q) || norm(p.partido).includes(q);
    });
  }, [list, query, casa, uf, leg]);

  const byTier = useMemo(() => {
    const m = new Map<Tier, TierListEntry[]>(TIER_ORDER.map((t) => [t, []]));
    for (const p of filtered) m.get(p.tier)!.push(p);
    for (const l of m.values()) l.sort((a, b) => b.ops - a.ops);
    return m;
  }, [filtered]);

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="🔍 Buscar por nome, UF ou guilda…"
          value={query}
          onChange={(e) => aplicar({ query: e.target.value })}
          aria-label="Buscar parlamentar"
        />
        <div className="casa-filter" role="group" aria-label="Filtrar por casa">
          {([
            ['todos', 'Todos'],
            ['camara', '🏛️ Deputados'],
            ['senado', '🎖️ Senadores'],
          ] as [CasaFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              className={`fbtn${casa === value ? ' active' : ''}`}
              onClick={() => aplicar({ casa: value })}
              aria-pressed={casa === value}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="uf-filter"
          data-ativo={uf !== 'todos' ? 'sim' : undefined}
          value={uf}
          onChange={(e) => aplicar({ uf: e.target.value })}
          aria-label="Filtrar por estado"
        >
          <option value="todos">📍 Todos os estados</option>
          {ufs.map(([sigla, n]) => (
            <option key={sigla} value={sigla}>{sigla} ({n})</option>
          ))}
        </select>
        {resultadoEm && (
          <select
            className="uf-filter"
            data-ativo={leg !== 'todos' ? 'sim' : undefined}
            value={leg}
            onChange={(e) => aplicar({ leg: e.target.value as LegFilter })}
            aria-label="Filtrar pelo resultado das eleições de 2026"
          >
            {LEGS.map((v) => <option key={v} value={v}>{LEG_LABEL[v]}</option>)}
          </select>
        )}
        <span className="count">{filtered.length} de {list.length}</span>
      </div>

      {/* Sem esta nota, quem ficou sem afirmação sumiria dos dois lados calado e a
          soma dos recortes pareceria errada. */}
      {leg !== 'todos' && resultadoEm && (
        <p className="cand-nota">
          Recorte pelo resultado do TSE (arquivo de {resultadoEm.split('-').reverse().join('/')}), para a
          legislatura que toma posse em 01/02/2027.
          {semAfirmacao > 0 && <> {semAfirmacao} {semAfirmacao === 1 ? 'parlamentar fica' : 'parlamentares ficam'} fora
            de <b>todos</b> os recortes: resultado pendente na fonte, suplente em exercício ou 2º turno.</>}
          {' '}<Link href="/insights/eleicoes/">Ver o balanço da eleição →</Link>
        </p>
      )}

      {filtered.length === 0 && (
        <p className="empty-state">
          Nenhum parlamentar encontrado
          {query.trim() && <> para “{query.trim()}”</>}
          {uf !== 'todos' && <> em {uf}</>}.
        </p>
      )}

      {TIER_ORDER.map((tier) => {
        const l = byTier.get(tier)!;
        if (!l.length) return null;
        return (
          <section key={tier} className={`tier-section tier-${tier}`}>
            <div className="tier-head">
              <span className="big display">{tier}</span>
              <span className="lbl">
                <b className="display">{TIER_LABEL[tier]}</b>
                <small>{l.length} {l.length === 1 ? 'parlamentar' : 'parlamentares'}</small>
              </span>
            </div>
            <div className="roster">
              {l.map((p) => (
                <PoliticianLink key={p.slug} slug={p.slug} className={`mini-card tier-${p.tier}`}>
                  <span className="tier-chip display">{p.tier}</span>
                  <span className="nm">
                    <b>{p.nome}</b>
                    <small>
                      {p.casa === 'camara' ? 'Dep.' : 'Sen.'} · {p.uf} · {p.partido}
                      <EleicaoMini e={p.eleicao2026} casa={p.casa} />
                    </small>
                  </span>
                  <span className="ops">{p.ops}</span>
                </PoliticianLink>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
