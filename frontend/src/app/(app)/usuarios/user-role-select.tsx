'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui';

type Papel = { id: number; nome: string; codigo: string };

export function UserRoleSelect({ userId, papelAtualId, papeis }: { userId: number; papelAtualId: number; papeis: Papel[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trocar(event: React.ChangeEvent<HTMLSelectElement>) {
    const roleId = Number(event.target.value);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/usuarios/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Não foi possível trocar o papel');
        return;
      }
      router.refresh();
    } catch {
      setError('Falha de comunicação. Atualize a página para conferir.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Select defaultValue={papelAtualId} onChange={trocar} disabled={pending} className="max-w-[14rem] py-1.5 text-xs">
        {papeis.map((papel) => (
          <option key={papel.id} value={papel.id}>
            {papel.nome}
          </option>
        ))}
      </Select>
      {error ? <p className="mt-1 text-2xs text-danger">{error}</p> : null}
    </div>
  );
}
