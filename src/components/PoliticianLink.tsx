'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

// Link da ficha que aquece foto + RSC no pointerdown e, no click, espera a foto
// decodificar antes de navegar (com teto, pra nunca prender). `prefetch={false}`
// é o ponto sensível: sem ele o <Link> baixaria o RSC de cada card ao entrar na
// viewport — ~13MB numa Tier List de ~545 cards não-virtualizados.
const pedidas = new Set<string>();
const prontas = new Set<string>();
const TIMEOUT_MS = 600;

export function PoliticianLink({ slug, className, children }: {
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const href = `/politico/${slug}/`;
  const fotoUrl = `/fotos/${slug}.webp`;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [esperando, setEsperando] = useState(false);

  const aquecer = () => {
    router.prefetch(href);
    if (pedidas.has(slug)) return;
    pedidas.add(slug);
    const img = new Image();
    img.src = fotoUrl;
    imgRef.current = img;
    (img.decode ? img.decode() : Promise.resolve()).then(() => prontas.add(slug)).catch(() => {});
  };

  const navegar = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // nova aba etc.
    e.preventDefault();
    if (prontas.has(slug)) { router.push(href); return; }

    const img = imgRef.current ?? Object.assign(new Image(), { src: fotoUrl });
    const foto = img.decode
      ? img.decode()
      : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); });
    setEsperando(true);
    const ir = () => { prontas.add(slug); router.push(href); };
    Promise.race([foto, new Promise<void>((r) => setTimeout(r, TIMEOUT_MS))]).then(ir, ir); // teto: nunca prende
  };

  return (
    <Link
      href={href}
      className={className}
      prefetch={false}
      onPointerDown={aquecer}
      onClick={navegar}
      style={esperando ? { cursor: 'progress' } : undefined}
    >
      {children}
    </Link>
  );
}
