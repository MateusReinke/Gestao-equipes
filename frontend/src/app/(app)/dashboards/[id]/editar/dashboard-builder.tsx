'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea, cx } from '@/components/ui';
import {
  METRIC_LABELS,
  WIDGET_SPECS,
  widgetSpec,
  type MetricKey,
  type Widget,
  type WidgetType,
} from '@/lib/widgets';

type Equipe = { id: number; nome: string };

/// Ids de widget são locais ao layout — só precisam ser únicos dentro do painel.
function novoId() {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function widgetPadrao(tipo: WidgetType): Widget {
  const spec = widgetSpec(tipo);
  return {
    id: novoId(),
    tipo,
    titulo: spec.nome,
    largura: spec.larguraPadrao,
    opcoes: tipo === 'metrica' ? { metrica: 'colaboradores' } : {},
  };
}

function WidgetEditor({
  widget,
  equipes,
  primeiro,
  ultimo,
  onChange,
  onMove,
  onRemove,
}: {
  widget: Widget;
  equipes: Equipe[];
  primeiro: boolean;
  ultimo: boolean;
  onChange: (widget: Widget) => void;
  onMove: (direcao: -1 | 1) => void;
  onRemove: () => void;
}) {
  const spec = widgetSpec(widget.tipo);

  function setOpcao(chave: keyof Widget['opcoes'], valor: unknown) {
    onChange({ ...widget, opcoes: { ...widget.opcoes, [chave]: valor } });
  }

  return (
    <div className="border-t border-line px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical size={14} className="shrink-0 text-ink-subtle" aria-hidden="true" />
          <Badge tone="accent">{spec.nome}</Badge>
          <span className="truncate text-xs text-ink-subtle">{spec.descricao}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={primeiro} title="Mover para cima">
            <ArrowUp size={13} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onMove(1)} disabled={ultimo} title="Mover para baixo">
            <ArrowDown size={13} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} title="Remover widget">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Título" htmlFor={`titulo-${widget.id}`}>
          <Input
            id={`titulo-${widget.id}`}
            value={widget.titulo}
            maxLength={80}
            onChange={(event) => onChange({ ...widget, titulo: event.target.value })}
          />
        </Field>

        <Field label="Largura" htmlFor={`largura-${widget.id}`} hint="Em colunas de uma grade de 4">
          <Select
            id={`largura-${widget.id}`}
            value={widget.largura}
            onChange={(event) => onChange({ ...widget, largura: Number(event.target.value) })}
          >
            <option value={1}>1 coluna</option>
            <option value={2}>2 colunas</option>
            <option value={3}>3 colunas</option>
            <option value={4}>Largura total</option>
          </Select>
        </Field>

        {spec.campos.includes('metrica') ? (
          <Field label="Métrica" htmlFor={`metrica-${widget.id}`}>
            <Select
              id={`metrica-${widget.id}`}
              value={widget.opcoes.metrica ?? 'colaboradores'}
              onChange={(event) => setOpcao('metrica', event.target.value as MetricKey)}
            >
              {(Object.keys(METRIC_LABELS) as MetricKey[]).map((chave) => (
                <option key={chave} value={chave}>
                  {METRIC_LABELS[chave]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {spec.campos.includes('dias') ? (
          <Field label="Período (dias)" htmlFor={`dias-${widget.id}`}>
            <Input
              id={`dias-${widget.id}`}
              type="number"
              min={1}
              max={90}
              value={widget.opcoes.dias ?? ''}
              placeholder="7"
              onChange={(event) => setOpcao('dias', event.target.value ? Number(event.target.value) : undefined)}
            />
          </Field>
        ) : null}

        {spec.campos.includes('limite') ? (
          <Field label="Itens exibidos" htmlFor={`limite-${widget.id}`}>
            <Input
              id={`limite-${widget.id}`}
              type="number"
              min={1}
              max={50}
              value={widget.opcoes.limite ?? ''}
              placeholder="8"
              onChange={(event) => setOpcao('limite', event.target.value ? Number(event.target.value) : undefined)}
            />
          </Field>
        ) : null}

        {spec.campos.includes('equipe') ? (
          <Field label="Equipe" htmlFor={`equipe-${widget.id}`} hint="Vazio = todas que você enxerga">
            <Select
              id={`equipe-${widget.id}`}
              value={widget.opcoes.equipeId ?? ''}
              onChange={(event) => setOpcao('equipeId', event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Todas as equipes</option>
              {equipes.map((equipe) => (
                <option key={equipe.id} value={equipe.id}>
                  {equipe.nome}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {spec.campos.includes('texto') ? (
          <Field label="Texto" htmlFor={`texto-${widget.id}`} className="sm:col-span-2 xl:col-span-4">
            <Textarea
              id={`texto-${widget.id}`}
              rows={3}
              maxLength={2000}
              value={widget.opcoes.texto ?? ''}
              placeholder="Procedimento de escalation, link do runbook, aviso do turno..."
              onChange={(event) => setOpcao('texto', event.target.value)}
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardBuilder({
  dashboardId,
  nomeInicial,
  descricaoInicial,
  layoutInicial,
  equipes,
}: {
  dashboardId: number;
  nomeInicial: string;
  descricaoInicial: string | null;
  layoutInicial: Widget[];
  equipes: Equipe[];
}) {
  const router = useRouter();
  const [widgets, setWidgets] = useState<Widget[]>(layoutInicial);
  const [nome, setNome] = useState(nomeInicial);
  const [descricao, setDescricao] = useState(descricaoInicial ?? '');
  const [nota, setNota] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function adicionar(tipo: WidgetType) {
    setWidgets((atuais) => [...atuais, widgetPadrao(tipo)]);
  }

  function atualizar(index: number, widget: Widget) {
    setWidgets((atuais) => atuais.map((item, i) => (i === index ? widget : item)));
  }

  function mover(index: number, direcao: -1 | 1) {
    setWidgets((atuais) => {
      const destino = index + direcao;
      if (destino < 0 || destino >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[index], copia[destino]] = [copia[destino], copia[index]];
      return copia;
    });
  }

  function remover(index: number) {
    setWidgets((atuais) => atuais.filter((_, i) => i !== index));
  }

  async function salvar() {
    setPending(true);
    setError(null);

    try {
      // Nome/descrição e layout são recursos distintos na API: o layout gera
      // uma versão nova, os metadados não.
      if (nome !== nomeInicial || descricao !== (descricaoInicial ?? '')) {
        const meta = await fetch(`/api/dashboards/${dashboardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, descricao: descricao || null }),
        });
        if (!meta.ok) {
          const data = await meta.json().catch(() => ({}));
          setError(data.error || 'Não foi possível salvar o nome do painel');
          return;
        }
      }

      const response = await fetch(`/api/dashboards/${dashboardId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: { widgets }, nota: nota || null }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Não foi possível publicar esta versão');
        return;
      }

      router.push(`/dashboards/${dashboardId}`);
      router.refresh();
    } catch {
      setError('Falha de comunicação com o servidor. Abra o painel para conferir se a versão foi publicada.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Identificação" description="Como o painel aparece na lista" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="nome-dashboard">
              <Input id="nome-dashboard" value={nome} maxLength={80} onChange={(event) => setNome(event.target.value)} />
            </Field>
            <Field label="Descrição" htmlFor="descricao-dashboard" hint="Opcional">
              <Input
                id="descricao-dashboard"
                value={descricao}
                maxLength={300}
                onChange={(event) => setDescricao(event.target.value)}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Widgets"
          description={
            widgets.length === 0
              ? 'Escolha abaixo o que deve aparecer no painel'
              : `${widgets.length} widget(s) — a ordem aqui é a ordem na tela`
          }
        />

        <CardBody>
          <div className="flex flex-wrap gap-2">
            {WIDGET_SPECS.map((spec) => (
              <Button key={spec.tipo} variant="secondary" size="sm" onClick={() => adicionar(spec.tipo)} title={spec.descricao}>
                <Plus size={13} /> {spec.nome}
              </Button>
            ))}
          </div>
        </CardBody>

        {widgets.map((widget, index) => (
          <WidgetEditor
            key={widget.id}
            widget={widget}
            equipes={equipes}
            primeiro={index === 0}
            ultimo={index === widgets.length - 1}
            onChange={(atualizado) => atualizar(index, atualizado)}
            onMove={(direcao) => mover(index, direcao)}
            onRemove={() => remover(index)}
          />
        ))}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Publicar"
          description="Salvar cria uma versão nova — a anterior continua no histórico e pode ser restaurada."
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nota da versão" htmlFor="nota" hint="Opcional — ajuda a lembrar o que mudou" className="sm:col-span-2">
              <Input
                id="nota"
                value={nota}
                maxLength={200}
                placeholder="Adiciona carga por colaborador"
                onChange={(event) => setNota(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button variant="primary" onClick={salvar} disabled={pending} className="w-full">
                <Save size={15} /> {pending ? 'Publicando...' : 'Publicar versão'}
              </Button>
            </div>
          </div>

          {error ? (
            <div className={cx('mt-4')}>
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
