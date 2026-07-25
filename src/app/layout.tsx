import type { Metadata, Viewport } from 'next';
import { Cinzel, Sometype_Mono } from 'next/font/google';
import Link from 'next/link';
import Script from 'next/script';
import SiteNav from '@/components/SiteNav';
import { meta } from '@/lib/data';
import { REPO_URL } from '@/lib/site';
import './globals.css';
import './tiers.css';
import './carta.css';

// Cloudflare Web Analytics: cookieless, sem consentimento. O token é PÚBLICO
// (um beacon que já vai no navegador de todo visitante), então pode viver no
// bundle/repo aberto sem risco. Vem de env pública: sem ela (dev/preview), a
// tag simplesmente não é emitida — o analytics só liga onde o token existe.
const cfBeaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

// Fontes self-hosted no build (next/font): zero request externo em runtime.
const display = Cinzel({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-display' });
const mono = Sometype_Mono({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-mono' });

const SITE_DESC =
  'Cards de personagem, tiers, guildas e batalhas 1v1 gerados a partir dos Dados Abertos da Câmara e do Senado. Fórmula pública e auditável.';

export const metadata: Metadata = {
  // Domínio canônico do site. Serve de base para o canonical de cada rota (o
  // `alternates.canonical` de cada página é relativo e resolvido contra isto).
  metadataBase: new URL('https://plenariarpg.com'),
  title: { default: 'PLENÁRIA — O RPG da Política Brasileira', template: '%s · PLENÁRIA' },
  description: SITE_DESC,
  openGraph: {
    type: 'website',
    siteName: 'PLENÁRIA',
    title: 'PLENÁRIA — O RPG da Política Brasileira',
    description: SITE_DESC,
    locale: 'pt_BR',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'PLENÁRIA — O RPG da Política Brasileira' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PLENÁRIA — O RPG da Política Brasileira',
    description: SITE_DESC,
    images: ['/og.jpg'],
  },
};

// viewportFit=cover é o que habilita os env(safe-area-inset-*) usados pela tab bar.
export const viewport: Viewport = { themeColor: '#0a0d14', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${mono.variable}`}>
      <body>
        <div className="wrap">
          <header className="site-header">
            <div className="brand">
              <h1><Link href="/">PLENÁRIA</Link></h1>
              <small>O RPG da Política Brasileira</small>
            </div>
            <SiteNav />
          </header>
          {children}
          <footer className="site-footer">
            {/* três blocos em vez de uma frase corrida: numa linha só, o navegador
                quebrava no meio de um link ("código aberto / no GitHub"). */}
            <nav className="foot-links">
              <Link href="/como-calculamos/">Como calculamos</Link>
              <Link href="/sobre/">Sobre, privacidade e correções</Link>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Código aberto no GitHub</a>
            </nav>
            <p className="foot-meta">
              <span>{meta.fonte}</span>
              <span>atualizado em {meta.updatedAt}</span>
              <span>fórmula pública e auditável</span>
            </p>
            <p className="foot-mark">PLENÁRIA</p>
          </footer>
        </div>
        {cfBeaconToken && (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${cfBeaconToken}"}`}
          />
        )}
      </body>
    </html>
  );
}
