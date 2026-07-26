'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Recarrega os dados do servidor de tempos em tempos.
 * Usa `router.refresh()` em vez de recarregar a página: o React troca só o
 * conteúdo, sem o piscar branco que uma TV ligada o dia inteiro deixa evidente.
 */
export function AutoRefresh({ segundos }: { segundos: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalo = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(intervalo);
  }, [router, segundos]);

  return null;
}
