import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { requireTenantSession } from '@/lib/session';
import { roleLabel } from '@/components/app-shell';

export default async function SemPermissaoPage() {
  const session = await requireTenantSession();

  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title="Você não tem permissão para acessar esta área"
        description={`Seu papel nesta empresa é "${roleLabel(session.roleCodigo)}". Se precisar de acesso, peça a quem administra a empresa para ajustar seu papel ou conceder a permissão específica.`}
        action={
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            Voltar ao dashboard
          </Link>
        }
      />
    </Card>
  );
}
