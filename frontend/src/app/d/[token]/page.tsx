import { notFound } from 'next/navigation';
import { WidgetCard } from '@/components/widgets/widget-card';
import { WIDTH_CLASSES, type WidgetResult } from '@/lib/widgets';
import { AutoRefresh } from './auto-refresh';

type Wallboard = {
  nome: string;
  descricao: string | null;
  empresa: string | null;
  atualizadoEm: string;
  widgets: WidgetResult[];
};

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

/// Wallboard é para TV do NOC: nunca cacheado, sempre com o estado do momento.
export const dynamic = 'force-dynamic';

export default async function WallboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let wallboard: Wallboard;
  try {
    // Sem Authorization: o token do link é a credencial, e a rota do backend é pública.
    const response = await fetch(`${API_URL}/public/dashboards/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!response.ok) notFound();
    wallboard = (await response.json()) as Wallboard;
  } catch {
    notFound();
  }

  const atualizado = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(wallboard.atualizadoEm));

  return (
    <div className="min-h-screen bg-bg">
      <AutoRefresh segundos={60} />

      <header className="border-b border-line px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{wallboard.empresa ?? 'Painel compartilhado'}</p>
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">{wallboard.nome}</h1>
            {wallboard.descricao ? <p className="mt-0.5 text-sm text-ink-muted">{wallboard.descricao}</p> : null}
          </div>
          <p className="tabular flex items-center gap-1.5 text-xs text-ink-subtle">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ok" aria-hidden="true" />
            atualizado às {atualizado}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[110rem] px-4 py-6 sm:px-6">
        {wallboard.widgets.length === 0 ? (
          <p className="py-20 text-center text-sm text-ink-subtle">Este painel ainda não tem widgets.</p>
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {wallboard.widgets.map((widget) => (
              <WidgetCard key={widget.id} widget={widget} className={WIDTH_CLASSES[widget.largura] ?? WIDTH_CLASSES[2]} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
