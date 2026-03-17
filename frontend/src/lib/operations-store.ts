'use client';

import { useEffect, useState } from 'react';

export type WorkModel = 'Remoto' | 'Híbrido' | 'Presencial';
export type ShiftType = 'Manhã' | 'Tarde' | 'Noite' | 'Plantão';
export type AttendanceMode = 'Remoto' | 'Presencial' | 'Híbrido';

export type Team = {
  id: string;
  nome: string;
  descricao: string;
};

export type Client = {
  id: string;
  nome: string;
  contato: string;
  responsavel: string;
  modeloAtendimento: AttendanceMode;
  observacoes: string;
};

export type Collaborator = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  equipeId: string;
  gestor: string;
  dataNascimento: string;
  dataContratacao: string;
  modeloTrabalho: WorkModel;
  cargaHorariaSemanal: number;
  fazPlantao: boolean;
  sobreAviso: boolean;
  recebeVr: boolean;
  ativo: boolean;
  clientesIds: string[];
};

export type ScheduleEntry = {
  id: string;
  colaboradorId: string;
  data: string;
  turno: ShiftType;
};

export type OperationalData = {
  teams: Team[];
  clients: Client[];
  collaborators: Collaborator[];
  schedules: ScheduleEntry[];
};

export const defaultOperationalData: OperationalData = {
  teams: [
    { id: 'team-1', nome: 'NOC', descricao: 'Monitoramento e resposta a incidentes.' },
    { id: 'team-2', nome: 'Service Desk', descricao: 'Atendimento de chamados e suporte N1.' },
    { id: 'team-3', nome: 'Infraestrutura', descricao: 'Gestão de servidores, rede e cloud.' }
  ],
  clients: [
    {
      id: 'client-1',
      nome: 'Banco Atlas',
      contato: '(11) 3000-1000',
      responsavel: 'Marina Costa',
      modeloAtendimento: 'Híbrido',
      observacoes: 'Operação 24x7 com janela presencial semanal.'
    },
    {
      id: 'client-2',
      nome: 'Varejo Leste',
      contato: 'suporte@varejoleste.com',
      responsavel: 'Carlos Dias',
      modeloAtendimento: 'Remoto',
      observacoes: 'Atendimento N1 e gestão de incidentes críticos.'
    }
  ],
  collaborators: [
    {
      id: 'col-1',
      nome: 'Ana Lima',
      email: 'ana.lima@empresa.com',
      telefone: '(11) 98888-1111',
      cargo: 'Analista NOC',
      equipeId: 'team-1',
      gestor: 'Roberto Alves',
      dataNascimento: '1992-05-11',
      dataContratacao: '2022-03-01',
      modeloTrabalho: 'Híbrido',
      cargaHorariaSemanal: 40,
      fazPlantao: true,
      sobreAviso: true,
      recebeVr: true,
      ativo: true,
      clientesIds: ['client-1', 'client-2']
    }
  ],
  schedules: []
};

const storageKey = 'gestao-operacional-data-v1';

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useOperationalData() {
  const [data, setData] = useState<OperationalData>(defaultOperationalData);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<OperationalData>;
      setData((prev) => ({
        teams: parsed.teams ?? prev.teams,
        clients: parsed.clients ?? prev.clients,
        collaborators: parsed.collaborators ?? prev.collaborators,
        schedules: parsed.schedules ?? prev.schedules
      }));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data]);

  return { data, setData };
}
