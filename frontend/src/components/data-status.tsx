import { AlertTriangle } from 'lucide-react';
import { Alert } from './ui';

export function DataStatus({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div className="mb-4">
      <Alert tone="warn">
        <span className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">Não foi possível carregar tudo:</strong> {error}
          </span>
        </span>
      </Alert>
    </div>
  );
}
