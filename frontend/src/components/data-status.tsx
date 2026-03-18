export function DataStatus({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <strong className="font-semibold">Modo de contingência:</strong> {error}
    </div>
  );
}
