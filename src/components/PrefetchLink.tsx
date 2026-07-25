'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

// <Link> que adia o prefetch do RSC pro pointerdown. Sem isso, cada link de uma
// lista baixa seu RSC (~24KB, must-revalidate → não cacheável no edge) ao entrar
// na viewport, e a rolagem vira uma rajada de requests. Drop-in do next/link para
// listas; ficha usa PoliticianLink (mesma ideia + aquece a foto).
export function PrefetchLink({ href, onPointerDown, ...rest }: ComponentProps<typeof Link>) {
  const router = useRouter();
  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onPointerDown={(e) => {
        if (typeof href === 'string') router.prefetch(href);
        onPointerDown?.(e);
      }}
    />
  );
}
