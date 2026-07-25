import { fetchApi } from '@/lib/api';
import { ClientForm } from './client-form';

type Client = { id: number; nome: string; idWhatsapp: string; escalation: string; ativo: boolean; responsavelInterno: { nome: string; email: string; telefone: string; equipe: { nome: string } }; equipes: Array<{ id: number; nome: string }> };
type Collaborator = { id: number; nome: string };

export default async function Page() {
  const [clients, collaborators] = await Promise.all([
    fetchApi<Client[]>('/api/clientes'),
    fetchApi<Collaborator[]>('/api/colaboradores'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ClientForm collaborators={collaborators} />

      <div className="grid gap-4 lg:grid-cols-2">
        {clients.map((client) => (
          <section key={client.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{client.nome}</h2>
              <span className={`rounded-full px-3 py-1 text-xs ${client.ativo ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>{client.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300">
              <div><dt className="text-slate-500">WhatsApp ID</dt><dd>{client.idWhatsapp}</dd></div>
              <div><dt className="text-slate-500">Escalation</dt><dd>{client.escalation}</dd></div>
              <div><dt className="text-slate-500">Responsável interno</dt><dd>{client.responsavelInterno.nome} · {client.responsavelInterno.equipe.nome}</dd></div>
              <div><dt className="text-slate-500">Contato</dt><dd>{client.responsavelInterno.email} · {client.responsavelInterno.telefone}</dd></div>
              <div><dt className="text-slate-500">Equipes vinculadas</dt><dd>{client.equipes.map((team) => team.nome).join(', ')}</dd></div>
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
