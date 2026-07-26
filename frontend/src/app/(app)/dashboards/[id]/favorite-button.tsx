'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui';

export function FavoriteButton({ dashboardId, favorito }: { dashboardId: number; favorito: boolean }) {
  const router = useRouter();
  const [marcado, setMarcado] = useState(favorito);
  const [pending, setPending] = useState(false);

  async function alternar() {
    const proximo = !marcado;
    setPending(true);
    // Marca já na interface: é uma ação trivial e reversível, e esperar o
    // servidor para pintar a estrela deixaria o clique com cara de travado.
    setMarcado(proximo);

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/favorito`, {
        method: proximo ? 'POST' : 'DELETE',
      });
      if (!response.ok) setMarcado(!proximo);
      else router.refresh();
    } catch {
      setMarcado(!proximo);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={alternar}
      disabled={pending}
      aria-pressed={marcado}
      title={marcado ? 'Remover dos favoritos' : 'Marcar como favorito'}
    >
      <Star size={14} className={marcado ? 'fill-warn text-warn' : undefined} />
      {marcado ? 'Favorito' : 'Favoritar'}
    </Button>
  );
}
