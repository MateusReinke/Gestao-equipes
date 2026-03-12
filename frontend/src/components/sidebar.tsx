import Link from 'next/link';

const menu = [
  'Dashboard',
  'Equipes',
  'Clientes',
  'Colaboradores',
  'Turnos',
  'Escalas',
  'Plantões',
  'Férias',
  'Feriados',
  'Relatórios',
  'Configurações',
];

export function Sidebar() {
  return (
    <aside className="h-screen w-64 border-r border-slate-800 bg-slate-900 p-5">
      <h1 className="mb-8 text-xl font-bold">Gestão Operacional</h1>
      <nav className="space-y-2">
        {menu.map((item) => (
          <Link
            key={item}
            href={item === 'Dashboard' ? '/' : `/${item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}
            className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {item}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
