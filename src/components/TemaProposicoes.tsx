'use client';

import { useState } from 'react';

/**
 * A linha de tema do painel "No que trabalha", clicável: abre as proposições
 * DAQUELE parlamentar naquele tema, cada uma com link para a página oficial.
 *
 * Por que ilha client e não link para fora: **a busca da Câmara não cruza autor
 * com tema** (o formulário avançado tem partido, UF, situação e órgão, nenhum
 * campo de tema ou de nome). O único cruzamento é a API de Dados Abertos, que
 * devolve JSON cru e conta diferente da gente — ela inclui coautoria, nós só
 * contamos autoria principal (medido: 42 contra 39). Mandar o leitor para uma
 * lista que contradiz o número da tela seria pior que não ter link. E o Senado
 * usa outro vocabulário e outro portal, então nenhuma URL da Câmara serviria
 * para metade das fichas.
 *
 * Aqui a lista sai do MESMO dado que produziu o número — conferido: 303 no
 * arquivo, 303 no painel — e cada linha continua levando à fonte oficial.
 *
 * Segue o padrão do projeto: JSON estático (`/data/props/<slug>.json`, ~19 KB)
 * buscado no primeiro clique, nunca no carregamento da página. O painel do
 * parlamentar não pode pagar 19 KB por um conteúdo que a maioria não abre.
 */

interface Prop { r: string; e: string; u: string; t: string[] }

/** cache por slug no módulo: reabrir outro tema não rebaixa o mesmo arquivo */
const cache = new Map<string, Prop[]>();

export function TemaProposicoes({ slug, tema, n, casaLabel, children }: {
  slug: string;
  tema: string;
  /** o número exibido na linha — a lista tem que bater com ele */
  n: number;
  /** "na Câmara dos Deputados" / "no Senado Federal", já com o artigo certo */
  casaLabel: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [props, setProps] = useState<Prop[] | null>(cache.get(slug) ?? null);
  const [erro, setErro] = useState(false);

  async function alternar() {
    const proximo = !aberto;
    setAberto(proximo);
    if (!proximo || props) return;
    try {
      const r = await fetch(`/data/props/${slug}.json`);
      if (!r.ok) throw new Error(String(r.status));
      const dados = (await r.json()) as Prop[];
      cache.set(slug, dados);
      setProps(dados);
      setErro(false);
    } catch {
      // falha de rede não pode virar "este parlamentar não tem proposições":
      // a linha diz que falhou e oferece tentar de novo
      setErro(true);
    }
  }

  const doTema = props?.filter((p) => p.t.includes(tema)) ?? null;

  return (
    <li className="prio-item">
      <button
        type="button"
        className={`prio-row prio-btn${aberto ? ' aberto' : ''}`}
        onClick={alternar}
        aria-expanded={aberto}
        title={`Ver as ${n} proposições de ${tema}`}
      >
        {children}
        <i className="prio-caret" aria-hidden>{aberto ? '▴' : '▾'}</i>
      </button>

      {aberto && (
        <div className="prio-props">
          {erro ? (
            <p className="prio-props-vazio">
              Não foi possível carregar a lista.{' '}
              <button type="button" className="prio-retry" onClick={() => { setErro(false); alternar(); }}>
                tentar de novo
              </button>
            </p>
          ) : !doTema ? (
            <p className="prio-props-vazio">carregando…</p>
          ) : (
            <>
              <ul className="lei-list">
                {doTema.map((p) => (
                  <li key={p.u} className="lei-row">
                    <div className="lei-head">
                      <span className="lei-norma sem">{p.r}</span>
                    </div>
                    <p className="lei-ementa">{p.e}</p>
                    <div className="lei-foot">
                      <a className="lei-fonte" href={p.u} target="_blank" rel="noopener">
                        texto e tramitação {casaLabel} ↗
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="prio-nota">
                As {doTema.length} proposições de autoria principal classificadas como <b>{tema}</b> pela
                própria casa — o mesmo dado que produziu o número acima. Uma proposição pode ter mais de
                um tema, então ela aparece em cada um deles.
              </p>
            </>
          )}
        </div>
      )}
    </li>
  );
}
