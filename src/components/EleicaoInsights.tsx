import Link from 'next/link';
import { PoliticianLink } from '@/components/PoliticianLink';
import { casaLabel } from '@/lib/data';
import { motivoSaida, resumoEleicao } from '@/lib/eleicao';
import { guildSlug } from '@/lib/slug';
import type { ContagemDestino, InsightsEleicao, PessoaEleicao } from '@/lib/types';

/**
 * Aba "Eleições 2026" dos Insights — o resultado do TSE lido contra a legislatura.
 *
 * Três cuidados que a aba carrega (ver scripts/lib/resultado2026.mjs):
 * - **Cor não julga.** Sair do Congresso não é derrota nem mérito: a rampa é a dourada
 *   sequencial, sem verde nem vermelho — mesmo princípio do Alinhamento.
 * - **"Sem afirmação" fica à vista**, num segmento próprio. Somá-lo a quem fica
 *   inflaria a permanência com quem a fonte não decidiu.
 * - **Tier × reeleição é correlação.** O Poder não mede voto, e quem se reelege não
 *   se reelege "por causa" dele. A nota diz isso ao lado do número.
 */

const SEGMENTOS: { k: keyof Omit<ContagemDestino, 'total'>; rotulo: string }[] = [
  { k: 'fica', rotulo: 'Reeleitos' },
  { k: 'segue', rotulo: 'Mandato até 2031' },
  { k: 'muda', rotulo: 'Mudam de casa' },
  { k: 'pendente', rotulo: '2º turno' },
  { k: 'sai', rotulo: 'Saem' },
  { k: 'indefinido', rotulo: 'Sem afirmação' },
];

/** pisos de amostra: abaixo disso a taxa é ruído vendido como fato */
const PISO_TAXA = 5;
const PISO_GUILDA = 5;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
/** 1 em 234 não é "0%" — o leitor leria "ninguém" */
const pctTxt = (n: number, d: number) => (n > 0 && pct(n, d) === 0 ? '<1%' : `${pct(n, d)}%`);
const TIER_ROTULO = (t: string) => (t === 'fora' ? 'Fora do ranking' : `Tier ${t}`);

function BarraDestino({ c }: { c: ContagemDestino }) {
  return (
    <div className="ele-bar" role="img"
      aria-label={SEGMENTOS.filter((s) => c[s.k]).map((s) => `${s.rotulo}: ${c[s.k]}`).join(', ')}>
      {SEGMENTOS.map((s) => c[s.k] > 0 && (
        <i key={s.k} className={`ele-${s.k}`} style={{ width: `${(c[s.k] / c.total) * 100}%` }}
          title={`${s.rotulo}: ${c[s.k]} de ${c.total}`} />
      ))}
    </div>
  );
}

function Legenda({ c }: { c?: ContagemDestino }) {
  return (
    <div className="ele-leg">
      {SEGMENTOS.filter((s) => !c || c[s.k] > 0).map((s) => (
        <span key={s.k}><i className={`ele-${s.k}`} />{s.rotulo}{c ? ` ${c[s.k]}` : ''}</span>
      ))}
    </div>
  );
}

function ListaPessoas({ ps, vazio }: { ps: PessoaEleicao[]; vazio: string }) {
  if (!ps.length) return <p className="sub">{vazio}</p>;
  return (
    <>
      {ps.map((p) => (
        <PoliticianLink key={p.slug} slug={p.slug} className="lrow wide">
          <span className="pos">{p.tier ?? '—'}</span>
          <span className="nm">
            <b>{p.nome}</b>
            <small>{casaLabel(p.casa, true)} · {p.uf} · {p.partido} · {p.eleicao2026.destino === 'sai' ? motivoSaida(p.eleicao2026, p.sexo) : resumoEleicao(p.eleicao2026, p.casa, p.sexo)}</small>
          </span>
          <span className="sc" style={{ color: 'var(--gold-2)' }}>{p.tier ? p.ops : '—'}</span>
        </PoliticianLink>
      ))}
    </>
  );
}

export function EleicaoInsights({ e, resultadoEm }: { e: InsightsEleicao; resultadoEm: string }) {
  const { camara, senado } = e.casas;
  const saem = camara.sai + senado.sai;
  const total = camara.total + senado.total;
  const disputaram = e.reeleicaoPorTier.reduce((s, t) => s + t.disputaram, 0);
  const reeleitos = e.reeleicaoPorTier.reduce((s, t) => s + t.reeleitos, 0);
  const indef = camara.indefinido + senado.indefinido;
  const guildas = e.porGuilda.filter((g) => g.total >= PISO_GUILDA)
    .sort((a, b) => pct(b.sai, b.total) - pct(a.sai, a.total) || b.total - a.total);
  const m = e.motivos;
  const dataBR = resultadoEm.split('-').reverse().join('/');

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="k-lbl">Saem do Congresso</div>
          <div className="k-val">{saem}</div>
          <div className="k-sub">de {total} em exercício ({pct(saem, total)}%) — fora da legislatura que toma posse em 01/02/2027</div>
        </div>
        <div className="kpi">
          <div className="k-lbl">Taxa de reeleição</div>
          <div className="k-val">{pct(reeleitos, disputaram)}%</div>
          <div className="k-sub">{reeleitos} de {disputaram} que disputaram a própria cadeira</div>
        </div>
        <div className="kpi">
          <div className="k-lbl">Mudam de casa</div>
          <div className="k-val">{camara.muda + senado.muda}</div>
          <div className="k-sub">{camara.muda} {camara.muda === 1 ? 'deputado eleito' : 'deputados eleitos'} ao Senado · {senado.muda} {senado.muda === 1 ? 'senador eleito' : 'senadores eleitos'} à Câmara</div>
        </div>
      </div>

      <div className="panel">
        <h3>🗳️ Quem fica e quem sai, por casa</h3>
        <div className="sub">
          Destino de cada parlamentar em exercício na legislatura de 2027, pelo resultado do 1º turno
          (o único que decide cadeira no Congresso). Na Câmara, todo mandato termina em 31/01/2027; no
          Senado, só o de quem foi eleito em 2018 — a turma de 2022 segue até 2031.
        </div>
        <div className="genero-bars">
          {([['Câmara', camara], ['Senado', senado]] as const).map(([nome, c]) => (
            <div key={nome} className="genero-row">
              <div className="genero-head">
                <b>{nome}</b>
                <span>{c.sai} de {c.total} saem ({pct(c.sai, c.total)}%)</span>
              </div>
              <BarraDestino c={c} />
              <Legenda c={c} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid2 even">
        <div className="panel">
          <h3>🎴 Quantos saem de cada Tier</h3>
          <div className="sub">Tier do mandato que termina, contra o destino em 2027 — as duas casas juntas (os cortes de Tier são os mesmos nas duas).</div>
          {e.porTier.map((t) => (
            <div key={t.tier} className="genero-row">
              <div className="genero-head">
                <b>{TIER_ROTULO(t.tier)}</b>
                <span>{t.sai} de {t.total} saem ({pct(t.sai, t.total)}%)</span>
              </div>
              <BarraDestino c={t} />
            </div>
          ))}
          <Legenda />
        </div>

        <div className="panel">
          <h3>🔁 Reeleição por Tier</h3>
          <div className="sub">
            Só quem disputou a <b>própria</b> cadeira — quem foi para o governo não &ldquo;perdeu a reeleição&rdquo;,
            e contá-lo baixaria a taxa por fora.
          </div>
          {e.reeleicaoPorTier.map((t) => (
            <div key={t.tier} className="genero-row">
              <div className="genero-head">
                <b>{TIER_ROTULO(t.tier)}</b>
                <span>{t.reeleitos} de {t.disputaram} reeleitos</span>
              </div>
              <div className="genero-bar">
                <i className="gf" style={{ width: `${pct(t.reeleitos, t.disputaram)}%` }} />
                <i className="gm" style={{ width: `${100 - pct(t.reeleitos, t.disputaram)}%` }} />
              </div>
              <div className="genero-cap">
                {t.disputaram >= PISO_TAXA ? `${pct(t.reeleitos, t.disputaram)}% reeleitos` : `amostra pequena demais para taxa (${t.disputaram})`}
              </div>
            </div>
          ))}
          <p className="prio-nota">
            <b>Correlação, não causa.</b> O Poder mede o exercício do mandato a partir dos dados
            públicos da Câmara e do Senado; o eleitor vota por outras razões, que nenhum dado aqui mede.
            Esta tabela descreve o que aconteceu, não explica por quê.
          </p>
        </div>
      </div>

      <div className="grid2 even">
        <div className="panel">
          <h3>🚪 Por que saem</h3>
          <div className="sub">{saem} parlamentares fora da próxima legislatura, pelo que a fonte permite afirmar.</div>
          {([
            ['Disputaram a reeleição e não voltam', m.naoReeleito, 'inclui quem ficou como suplente — pode assumir se um titular se afastar'],
            ['Eleitos para outro cargo', m.outroCargoEleito, 'governo, assembleia, suplência de senador'],
            ['No 2º turno para governo', m.outroCargoSegundoTurno, 'em qualquer resultado, não disputaram o Congresso'],
            ['Disputaram outro cargo e não foram eleitos', m.outroCargoNaoEleito, 'Senado (deputados), governo, assembleia'],
            ['Mandato termina, fora da lista de eleitos', m.fimDeMandato, 'sem candidatura correspondida no TSE — não afirmamos que não se candidataram'],
          ] as const).filter(([, n]) => n > 0).map(([rotulo, n, nota]) => (
            <div key={rotulo} className="lrow wide">
              <span className="pos">{n}</span>
              <span className="nm"><b>{rotulo}</b><small>{nota}</small></span>
              <span className="sc">{pctTxt(n, saem)}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>⭐ Saem do topo</h3>
          <div className="sub">Tier S e A que não estarão na próxima legislatura, por Poder.</div>
          <ListaPessoas ps={e.saemDoTopo} vazio="Nenhum Tier S ou A sai." />
        </div>
      </div>

      <div className="grid2 even">
        <div className="panel">
          <h3>↪ Mudam de casa</h3>
          <div className="sub">Continuam no Congresso, na outra casa.</div>
          <ListaPessoas ps={e.mudam} vazio="Ninguém muda de casa." />
        </div>
        <div className="panel">
          <h3>🏛️ Para o Executivo e as assembleias</h3>
          <div className="sub">Eleitos para outro cargo, ou ainda no 2º turno (25/10).</div>
          <ListaPessoas ps={e.paraOutroCargo} vazio="Ninguém foi eleito para outro cargo." />
          {e.pendentes.length > 0 && (
            <>
              <div className="sub" style={{ marginTop: 14 }}>
                Senadores com mandato até 2031 no 2º turno: se eleitos, deixam o Senado; senão, ficam.
              </div>
              <ListaPessoas ps={e.pendentes} vazio="" />
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>🛡️ Por guilda</h3>
        <div className="sub">
          Quanto de cada bancada em exercício sai em 2027. Guildas com menos de {PISO_GUILDA} parlamentares
          ficam fora — numa bancada de dois, um que sai vira 50%.
        </div>
        {guildas.map((g) => (
          <Link key={g.sigla} href={`/guilda/${guildSlug(g.sigla)}/`} className="genero-row ele-guilda">
            <div className="genero-head">
              <b>{g.sigla}</b>
              <span>{g.sai} de {g.total} saem ({pct(g.sai, g.total)}%)</span>
            </div>
            <BarraDestino c={g} />
          </Link>
        ))}
        <Legenda />
      </div>

      <p className="prio-nota">
        Fonte: resultado do TSE (<code>consulta_cand_2026</code>, arquivo de {dataBR}), cruzado por CPF na
        Câmara e por nome civil no Senado. &ldquo;Sai&rdquo; só é afirmado com a lista de eleitos inteira
        (513 deputados e 54 senadores): quem não está nela não volta. {indef > 0 && <>{indef} {indef === 1 ? 'parlamentar ficou' : 'parlamentares ficaram'} <b>sem afirmação</b> —
        resultado pendente na fonte, suplente em exercício numa cadeira até 2031 ou nome parecido demais com
        o de um eleito para cravar —, e não {indef === 1 ? 'é contado' : 'são contados'} nem como quem fica nem como quem sai. </>}
        Informativo: o resultado não pontua no Poder nem gera título. <Link href="/como-calculamos/">Como calculamos →</Link>
      </p>
    </>
  );
}
