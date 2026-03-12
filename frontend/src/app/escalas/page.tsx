import { DashboardLayout } from '@/components/layout';

const dias = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const colaboradores = ['Ana Lima', 'Bruno Souza', 'Carlos Mendes'];

export default function EscalasPage() {
  return (
    <DashboardLayout>
      <h2 className="mb-4 text-2xl font-semibold">Escalas (Calendário Mensal)</h2>
      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Colaborador</th>
              {dias.slice(0, 10).map((d) => <th key={d} className="p-2">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c) => (
              <tr key={c} className="border-t border-slate-800">
                <td className="p-2">{c}</td>
                {dias.slice(0, 10).map((d) => (
                  <td key={d} className="p-2">
                    <button className="rounded bg-slate-800 px-2 py-1 hover:bg-sky-700">+</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
