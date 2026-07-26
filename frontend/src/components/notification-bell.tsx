'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X } from 'lucide-react';
import { Badge, Button, cx, type BadgeTone } from './ui';

type Notificacao = {
  id: number;
  tipo: string;
  severidade: 'info' | 'aviso' | 'critico';
  titulo: string;
  mensagem: string;
  link: string | null;
  lidaEm: string | null;
  createdAt: string;
};

const TOM: Record<string, BadgeTone> = { critico: 'danger', aviso: 'warn', info: 'info' };

/// Distância em palavras, que é como as pessoas leem "quando isso chegou".
function quando(iso: string) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

/**
 * Sino de notificações.
 *
 * Busca ao abrir e a cada 2 minutos enquanto a aba está visível — parar
 * quando ela está em segundo plano evita manter uma requisição de fundo em
 * dezenas de abas esquecidas de um NOC.
 */
export function NotificationBell() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const painel = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const response = await fetch('/api/notificacoes');
      if (!response.ok) return;
      const dados = await response.json();
      setItens(dados.notificacoes ?? []);
      setNaoLidas(dados.naoLidas ?? 0);
    } catch {
      // Sino é acessório: falha de rede aqui não merece alarde na tela.
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') carregar();
    }, 120_000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // Fecha ao clicar fora — sem isso o painel ficaria preso sobre o conteúdo.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(evento: MouseEvent) {
      if (painel.current && !painel.current.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  async function marcarLida(id: number) {
    setItens((atuais) => atuais.map((item) => (item.id === id ? { ...item, lidaEm: new Date().toISOString() } : item)));
    setNaoLidas((valor) => Math.max(0, valor - 1));
    await fetch(`/api/notificacoes/${id}/lida`, { method: 'POST' }).catch(() => undefined);
  }

  async function marcarTodas() {
    setItens((atuais) => atuais.map((item) => ({ ...item, lidaEm: item.lidaEm ?? new Date().toISOString() })));
    setNaoLidas(0);
    await fetch('/api/notificacoes/lidas', { method: 'POST' }).catch(() => undefined);
  }

  function abrir(item: Notificacao) {
    if (!item.lidaEm) marcarLida(item.id);
    if (item.link) {
      setAberto(false);
      router.push(item.link);
    }
  }

  return (
    <div className="relative" ref={painel}>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
        aria-expanded={aberto}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
      >
        <Bell size={18} />
        {naoLidas > 0 ? (
          <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div className="card absolute right-0 z-40 mt-2 max-h-[28rem] w-[22rem] overflow-y-auto shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-xs font-semibold text-ink">Notificações</p>
            <div className="flex items-center gap-1">
              {naoLidas > 0 ? (
                <Button variant="ghost" size="sm" onClick={marcarTodas} className="px-1.5 py-0.5 text-2xs">
                  <Check size={12} /> Marcar todas
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="rounded p-1 text-ink-subtle hover:bg-surface-hover hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {itens.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-ink-subtle">Nada por aqui.</p>
          ) : (
            <div className="divide-y divide-line">
              {itens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => abrir(item)}
                  className={cx(
                    'block w-full px-3 py-2.5 text-left transition-colors hover:bg-surface-hover',
                    !item.lidaEm && 'bg-accent-soft/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-ink">{item.titulo}</p>
                    {!item.lidaEm ? <Badge tone={TOM[item.severidade]}>novo</Badge> : null}
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-2xs text-ink-muted">{item.mensagem}</p>
                  <p className="mt-1 text-2xs text-ink-subtle">{quando(item.createdAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
