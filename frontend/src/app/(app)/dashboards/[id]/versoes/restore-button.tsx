'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';

export function RestoreButton({
  dashboardId,
  versionId,
  versao,
}: {
  dashboardId: number;
  versionId: number;
  versao: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState(false);

  async function restaurar() {
    setPending(true);
    setErro(false);
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/versoes/${versionId}/restaurar`, {
        method: 'POST',
      });
      if (!response.ok) {
        setErro(true);
        return;
      }
      router.push(`/dashboards/${dashboardId}`);
      router.refresh();
    } catch {
      setErro(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {erro ? <span className="text-2xs text-danger">Não foi possível restaurar</span> : null}
      <Button variant="secondary" size="sm" onClick={restaurar} disabled={pending} title={`Restaurar a versão ${versao}`}>
        <RotateCcw size={13} /> {pending ? 'Restaurando...' : 'Restaurar'}
      </Button>
    </div>
  );
}
