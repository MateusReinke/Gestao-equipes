'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from '@/components/ui';

type Colaborador = { id: number; nome: string };

type CnpjLookup = {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  fonte: string;
};

type CepLookup = {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  fonte: string;
};

/// Os mesmos campos do formulário, no formato que a API devolve.
export type ClienteExistente = {
  id: number;
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  idWhatsapp: string;
  escalation: string;
  telefone: string | null;
  site: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  slaMinutos: number | null;
  observacoes: string | null;
  responsavelInterno?: { id: number } | null;
};

const CAMPOS_VAZIOS = {
  nome: '', razaoSocial: '', cnpj: '', idWhatsapp: '', escalation: '', telefone: '', site: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  slaMinutos: '', observacoes: '', responsavelInternoId: '',
};

/// Converte o cliente vindo da API para o estado do formulário (tudo string).
function camposDoCliente(cliente: ClienteExistente): typeof CAMPOS_VAZIOS {
  return {
    nome: cliente.nome ?? '',
    razaoSocial: cliente.razaoSocial ?? '',
    cnpj: cliente.cnpj ?? '',
    idWhatsapp: cliente.idWhatsapp ?? '',
    escalation: cliente.escalation ?? '',
    telefone: cliente.telefone ?? '',
    site: cliente.site ?? '',
    cep: cliente.cep ?? '',
    logradouro: cliente.logradouro ?? '',
    numero: cliente.numero ?? '',
    complemento: cliente.complemento ?? '',
    bairro: cliente.bairro ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
    slaMinutos: cliente.slaMinutos != null ? String(cliente.slaMinutos) : '',
    observacoes: cliente.observacoes ?? '',
    responsavelInternoId: cliente.responsavelInterno?.id != null ? String(cliente.responsavelInterno.id) : '',
  };
}

/**
 * Serve para cadastrar e para editar.
 * Sem `cliente`, é um botão que abre o formulário em branco e faz POST.
 * Com `cliente`, já nasce aberto e preenchido, e faz PATCH — assim os dois
 * fluxos compartilham a busca de CNPJ/CEP e a validação, sem duplicar tela.
 */
export function ClientForm({
  colaboradores,
  cliente,
  onFechar,
}: {
  colaboradores: Colaborador[];
  cliente?: ClienteExistente;
  onFechar?: () => void;
}) {
  const edicao = cliente != null;
  const router = useRouter();
  const [aberto, setAberto] = useState(edicao);
  const [campos, setCampos] = useState(edicao ? camposDoCliente(cliente) : CAMPOS_VAZIOS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined> | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [buscando, setBuscando] = useState<'cnpj' | 'cep' | null>(null);
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null);

  const set = (campo: keyof typeof CAMPOS_VAZIOS, valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));

  /// Preenche razão social, telefone e endereço a partir do CNPJ (BrasilAPI / Receita Federal).
  async function buscarCnpj() {
    const digits = campos.cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      setAvisoBusca('Informe os 14 dígitos do CNPJ para buscar.');
      return;
    }

    setBuscando('cnpj');
    setAvisoBusca(null);
    try {
      const response = await fetch(`/api/lookup/cnpj/${digits}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAvisoBusca(data.error || 'Não foi possível consultar o CNPJ.');
        return;
      }

      const info = data as CnpjLookup;
      setAvisoBusca(`Dados preenchidos a partir da ${info.fonte}. Confira antes de salvar.`);
      setCampos((atual) => ({
        ...atual,
        // Só preenche o que ainda está vazio, para não sobrescrever o que a pessoa digitou.
        nome: atual.nome || info.nomeFantasia || info.razaoSocial || '',
        razaoSocial: atual.razaoSocial || info.razaoSocial || '',
        telefone: atual.telefone || info.telefone || '',
        cep: atual.cep || info.cep || '',
        logradouro: atual.logradouro || info.logradouro || '',
        numero: atual.numero || info.numero || '',
        complemento: atual.complemento || info.complemento || '',
        bairro: atual.bairro || info.bairro || '',
        cidade: atual.cidade || info.cidade || '',
        uf: atual.uf || info.uf || '',
      }));
    } catch {
      setAvisoBusca('Falha de comunicação ao consultar o CNPJ.');
    } finally {
      setBuscando(null);
    }
  }

  /// Preenche o endereço a partir do CEP (BrasilAPI com fallback para ViaCEP).
  async function buscarCep() {
    const digits = campos.cep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setAvisoBusca('Informe os 8 dígitos do CEP para buscar.');
      return;
    }

    setBuscando('cep');
    setAvisoBusca(null);
    try {
      const response = await fetch(`/api/lookup/cep/${digits}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAvisoBusca(data.error || 'Não foi possível consultar o CEP.');
        return;
      }

      const info = data as CepLookup;
      setAvisoBusca(`Endereço preenchido a partir do ${info.fonte}.`);
      setCampos((atual) => ({
        ...atual,
        logradouro: info.logradouro || atual.logradouro,
        bairro: info.bairro || atual.bairro,
        cidade: info.cidade || atual.cidade,
        uf: info.uf || atual.uf,
      }));
    } catch {
      setAvisoBusca('Falha de comunicação ao consultar o CEP.');
    } finally {
      setBuscando(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setIssues(null);
    setSucesso(false);

    const payload = {
      nome: campos.nome,
      razaoSocial: campos.razaoSocial || null,
      cnpj: campos.cnpj || null,
      idWhatsapp: campos.idWhatsapp,
      escalation: campos.escalation,
      telefone: campos.telefone || null,
      site: campos.site || null,
      cep: campos.cep || null,
      logradouro: campos.logradouro || null,
      numero: campos.numero || null,
      complemento: campos.complemento || null,
      bairro: campos.bairro || null,
      cidade: campos.cidade || null,
      uf: campos.uf || null,
      slaMinutos: campos.slaMinutos ? Number(campos.slaMinutos) : null,
      observacoes: campos.observacoes || null,
      responsavelInternoId: campos.responsavelInternoId ? Number(campos.responsavelInternoId) : null,
      ativo: true,
    };

    try {
      const response = await fetch(edicao ? `/api/clientes/${cliente.id}` : '/api/clientes', {
        method: edicao ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || (edicao ? 'Erro ao salvar o cliente' : 'Erro ao cadastrar cliente'));
        setIssues(data.issues || null);
        return;
      }

      setSucesso(true);
      // Na edição os campos continuam como estão: a pessoa acabou de digitá-los
      // e limpar a tela pareceria que a alteração se perdeu.
      if (!edicao) setCampos(CAMPOS_VAZIOS);
      router.refresh();
      if (edicao) onFechar?.();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a alteração já aparece abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function fechar() {
    setAberto(false);
    onFechar?.();
  }

  if (!aberto) {
    return (
      <Button variant="primary" onClick={() => setAberto(true)}>
        <Building2 size={15} /> Cadastrar cliente
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title={edicao ? `Editar ${cliente.nome}` : 'Novo cliente'}
        description="Informe o CNPJ ou o CEP para preencher os dados automaticamente."
        action={
          <Button variant="ghost" size="sm" onClick={fechar}>
            Fechar
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="eyebrow mb-3">Identificação</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="CNPJ" htmlFor="cnpj" hint="Busca razão social, telefone e endereço na Receita Federal">
                <div className="flex gap-2">
                  <Input
                    id="cnpj"
                    value={campos.cnpj}
                    onChange={(e) => set('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                  />
                  <Button type="button" variant="secondary" onClick={buscarCnpj} disabled={buscando !== null} aria-label="Buscar CNPJ">
                    {buscando === 'cnpj' ? '...' : <Search size={15} />}
                  </Button>
                </div>
              </Field>

              <Field label="Nome do cliente" htmlFor="nome">
                <Input id="nome" required minLength={2} value={campos.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Banco Atlas" />
              </Field>

              <Field label="Razão social" htmlFor="razaoSocial">
                <Input id="razaoSocial" value={campos.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} />
              </Field>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-3">Contato e operação</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="ID do grupo de WhatsApp" htmlFor="idWhatsapp">
                <Input id="idWhatsapp" required minLength={3} value={campos.idWhatsapp} onChange={(e) => set('idWhatsapp', e.target.value)} placeholder="5511999990001" />
              </Field>

              <Field label="E-mail de escalation" htmlFor="escalation">
                <Input id="escalation" type="email" required value={campos.escalation} onChange={(e) => set('escalation', e.target.value)} placeholder="sev1@cliente.com" />
              </Field>

              <Field label="Telefone" htmlFor="telefone">
                <Input id="telefone" value={campos.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="1130001000" />
              </Field>

              <Field label="Site" htmlFor="site">
                <Input id="site" value={campos.site} onChange={(e) => set('site', e.target.value)} placeholder="cliente.com.br" />
              </Field>

              <Field label="SLA de resposta (minutos)" htmlFor="slaMinutos">
                <Input id="slaMinutos" type="number" min={1} value={campos.slaMinutos} onChange={(e) => set('slaMinutos', e.target.value)} placeholder="30" />
              </Field>

              <Field label="Responsável interno" htmlFor="responsavelInternoId" hint="Pode ser definido depois">
                <Select id="responsavelInternoId" value={campos.responsavelInternoId} onChange={(e) => set('responsavelInternoId', e.target.value)}>
                  <option value="">Definir depois</option>
                  {colaboradores.map((colaborador) => (
                    <option key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-3">Endereço</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="CEP" htmlFor="cep">
                <div className="flex gap-2">
                  <Input id="cep" value={campos.cep} onChange={(e) => set('cep', e.target.value)} placeholder="01310-100" inputMode="numeric" />
                  <Button type="button" variant="secondary" onClick={buscarCep} disabled={buscando !== null} aria-label="Buscar CEP">
                    {buscando === 'cep' ? '...' : <Search size={15} />}
                  </Button>
                </div>
              </Field>

              <Field label="Logradouro" htmlFor="logradouro" className="sm:col-span-2">
                <Input id="logradouro" value={campos.logradouro} onChange={(e) => set('logradouro', e.target.value)} />
              </Field>

              <Field label="Número" htmlFor="numero">
                <Input id="numero" value={campos.numero} onChange={(e) => set('numero', e.target.value)} />
              </Field>

              <Field label="Complemento" htmlFor="complemento">
                <Input id="complemento" value={campos.complemento} onChange={(e) => set('complemento', e.target.value)} />
              </Field>

              <Field label="Bairro" htmlFor="bairro">
                <Input id="bairro" value={campos.bairro} onChange={(e) => set('bairro', e.target.value)} />
              </Field>

              <Field label="Cidade" htmlFor="cidade">
                <Input id="cidade" value={campos.cidade} onChange={(e) => set('cidade', e.target.value)} />
              </Field>

              <Field label="UF" htmlFor="uf">
                <Input id="uf" maxLength={2} value={campos.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} placeholder="SP" />
              </Field>
            </div>
          </div>

          <Field label="Observações" htmlFor="observacoes">
            <Textarea id="observacoes" rows={2} value={campos.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Particularidades do atendimento, janelas de manutenção, contatos extras..." />
          </Field>

          {avisoBusca ? <Alert tone="warn">{avisoBusca}</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {issues ? (
            <Alert tone="danger">
              <ul className="list-inside list-disc">
                {Object.entries(issues).map(([campo, mensagens]) =>
                  mensagens?.map((mensagem) => <li key={`${campo}-${mensagem}`}>{mensagem}</li>)
                )}
              </ul>
            </Alert>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Salvando...' : edicao ? 'Salvar alterações' : 'Cadastrar cliente'}
            </Button>
            {sucesso ? (
              <span className="text-xs text-ok">{edicao ? 'Alterações salvas.' : 'Cliente cadastrado com sucesso.'}</span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
