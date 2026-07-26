import { ClipboardList, Plane } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { HrForms } from './hr-forms';
import { AbsenceRow, VacationRow, type Ausencia, type Ferias } from './hr-rows';

type Colaborador = { id: number; nome: string; equipe: { nome: string } };

export default async function RhPage() {
  const session = await requirePermissionSession(PERMISSIONS.HR_VACATION_VIEW, PERMISSIONS.HR_ABSENCE_VIEW);

  const podeVerFerias = can(session.permissoes, PERMISSIONS.HR_VACATION_VIEW);
  const podeVerAusencias = can(session.permissoes, PERMISSIONS.HR_ABSENCE_VIEW);
  const podeAprovarFerias = can(session.permissoes, PERMISSIONS.HR_VACATION_APPROVE);
  const podeGerirAusencias = can(session.permissoes, PERMISSIONS.HR_ABSENCE_MANAGE);
  const podeSolicitar = can(session.permissoes, PERMISSIONS.HR_VACATION_REQUEST);

  const [feriasResult, ausenciasResult, colaboradoresResult] = await Promise.all([
    podeVerFerias ? fetchApiSafe<Ferias[]>('/api/ferias', []) : Promise.resolve({ data: [] as Ferias[], error: null }),
    podeVerAusencias ? fetchApiSafe<Ausencia[]>('/api/ausencias', []) : Promise.resolve({ data: [] as Ausencia[], error: null }),
    fetchApiSafe<Colaborador[]>('/api/colaboradores', []),
  ]);

  const feriasPendentes = feriasResult.data.filter((item) => item.status === 'pendente');
  const feriasResto = feriasResult.data.filter((item) => item.status !== 'pendente');

  return (
    <>
      <PageHeader
        title="Férias e ausências"
        description="Quem está indisponível e quando. Períodos aprovados aparecem como conflito na hora de gerar turnos."
      />

      <DataStatus error={feriasResult.error ?? ausenciasResult.error} />

      {podeSolicitar || podeGerirAusencias ? (
        <HrForms
          colaboradores={colaboradoresResult.data}
          podeSolicitarFerias={podeSolicitar}
          podeRegistrarAusencia={podeGerirAusencias}
        />
      ) : null}

      {podeVerFerias ? (
        <>
          {feriasPendentes.length > 0 ? (
            <Card className="mt-4">
              <CardHeader title="Férias aguardando aprovação" description={`${feriasPendentes.length} solicitação(ões)`} />
              <div className="divide-y divide-line">
                {feriasPendentes.map((ferias) => (
                  <VacationRow key={ferias.id} ferias={ferias} podeAprovar={podeAprovarFerias} />
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="mt-4">
            <CardHeader title="Histórico de férias" description={`${feriasResto.length} registro(s)`} />
            {feriasResto.length === 0 ? (
              <EmptyState icon={<Plane size={24} />} title="Nenhum registro de férias" />
            ) : (
              <div className="divide-y divide-line">
                {feriasResto.map((ferias) => (
                  <VacationRow key={ferias.id} ferias={ferias} podeAprovar={false} />
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}

      {podeVerAusencias ? (
        <Card className="mt-4">
          <CardHeader title="Ausências" description="Faltas, atestados, licenças, folgas e banco de horas" />
          {ausenciasResult.data.length === 0 ? (
            <EmptyState icon={<ClipboardList size={24} />} title="Nenhuma ausência registrada" />
          ) : (
            <div className="divide-y divide-line">
              {ausenciasResult.data.map((ausencia) => (
                <AbsenceRow key={ausencia.id} ausencia={ausencia} podeGerir={podeGerirAusencias} />
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}
