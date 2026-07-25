'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SVGProps } from 'react';
import { IconCrown, IconShield, IconSwords, IconSearch } from './NavIcons';

// Ilha client mínima (sem dados): só precisa do pathname para marcar a aba ativa.
// Renderiza a MESMA lista duas vezes — barra no topo (desktop) e tab bar
// fixa no rodapé (mobile, <=640px). A visibilidade é decidida por CSS.
// Ícones são SVG inline (ver NavIcons) — não emoji: cor via currentColor e
// desenho idêntico em toda plataforma.

type Item = {
  href: string;
  Icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement;
  label: string;
  match: (p: string) => boolean;
};

const ITENS: Item[] = [
  { href: '/', Icon: IconCrown, label: 'Tier List', match: (p) => p === '/' || p.startsWith('/politico') },
  { href: '/guildas/', Icon: IconShield, label: 'Guildas', match: (p) => p.startsWith('/guilda') },
  { href: '/batalha/', Icon: IconSwords, label: 'Batalha', match: (p) => p.startsWith('/batalha') },
  {
    href: '/insights/',
    Icon: IconSearch,
    label: 'Insights',
    match: (p) => p.startsWith('/insights') || p.startsWith('/estado') || p.startsWith('/titulo'),
  },
];

export default function SiteNav() {
  const pathname = usePathname() ?? '/';

  return (
    <>
      <nav className="nav" aria-label="Navegação principal">
        {ITENS.map((it) => (
          <Link key={it.href} href={it.href} className={it.match(pathname) ? 'active' : undefined}>
            <it.Icon className="nav-ico" />
            {it.label}
          </Link>
        ))}
      </nav>

      <nav className="bottom-nav" aria-label="Navegação principal (mobile)">
        {ITENS.map((it) => {
          const ativo = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={ativo ? 'active' : undefined}
              aria-current={ativo ? 'page' : undefined}
            >
              <span className="bn-icon"><it.Icon /></span>
              <span className="bn-label">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
