'use client';

import { useEffect, useRef } from 'react';

/**
 * Barra de abas dos Insights. Cada aba é um <Link> para uma ROTA real, então
 * trocar de seção recria o <nav> e ZERA o scrollLeft do carrossel horizontal
 * (mobile, ≤640px). Faz duas coisas ao montar:
 *
 * 1) Recentraliza a aba ativa — senão, ao rolar as abas até o fim e clicar numa
 *    aba da ponta (ex.: Títulos), a nova página monta com o carrossel no início
 *    e a aba ativa fica fora da tela.
 * 2) Esmaece as bordas que TÊM conteúdo escondido (afford. de "há mais abas pra
 *    rolar") — o corte seco não deixava óbvio que o carrossel continua. O
 *    gradiente aparece só do lado com overflow e some ao chegar na ponta.
 *
 * Só mexe no scrollLeft do PRÓPRIO nav (nunca em ancestrais nem no scroll
 * vertical da página) e as bordas se autodesligam no desktop, onde as abas
 * quebram em linha (flex-wrap) e não há overflow (scrollWidth == clientWidth).
 */
export function InsightsTabs({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const wrap = wrapRef.current;
    if (!nav || !wrap) return;

    // 1) centraliza a aba ativa no carrossel. getBoundingClientRect evita depender
    //    do offsetParent, que não é o nav por ele não ter position.
    const ativa = nav.querySelector<HTMLElement>('.tab.is-active');
    if (ativa) {
      const navRect = nav.getBoundingClientRect();
      const ativaRect = ativa.getBoundingClientRect();
      const alvo = nav.scrollLeft + (ativaRect.left - navRect.left)
        - (nav.clientWidth - ativaRect.width) / 2;
      nav.scrollLeft = Math.max(0, alvo);
    }

    // 2) liga/desliga o esmaecido das bordas conforme o overflow escondido.
    const atualizaBordas = () => {
      const max = nav.scrollWidth - nav.clientWidth;
      const x = nav.scrollLeft;
      wrap.toggleAttribute('data-mais-esq', x > 1);
      wrap.toggleAttribute('data-mais-dir', x < max - 1);
    };
    atualizaBordas();
    nav.addEventListener('scroll', atualizaBordas, { passive: true });
    window.addEventListener('resize', atualizaBordas);
    return () => {
      nav.removeEventListener('scroll', atualizaBordas);
      window.removeEventListener('resize', atualizaBordas);
    };
  }, []);

  return (
    <div ref={wrapRef} className="tabs-wrap">
      <nav ref={navRef} className="tabs" aria-label="Seções de insights">
        {children}
      </nav>
    </div>
  );
}
