'use client';

import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/': 'Dashboard executivo',
  '/clientes': 'Gestão de clientes',
  '/equipes': 'Gestão de equipes',
  '/colaboradores': 'Gestão de colaboradores',
  '/gestores': 'Gestão de gestores',
  '/escalas': 'Escalas operacionais',
  '/plantoes': 'Plantões e cobertura',
  '/ferias': 'Férias e indisponibilidades',
};

export function HeaderTitle() {
  const pathname = usePathname();
  return <h1 className="mt-2 text-3xl font-semibold text-white">{titles[pathname] ?? 'Painel operacional'}</h1>;
}
