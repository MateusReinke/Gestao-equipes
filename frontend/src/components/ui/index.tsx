import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Card */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('card', className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('p-4 sm:p-5', className)}>{children}</div>;
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-white hover:bg-accent disabled:hover:bg-accent-strong',
  secondary: 'border border-line-strong bg-surface-raised text-ink hover:bg-surface-hover',
  ghost: 'text-ink-muted hover:bg-surface-hover hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:bg-danger-soft',
  success: 'bg-ok/90 text-[#04241a] hover:bg-ok',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Badge */

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'info';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-hover text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-2xs font-medium',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Field */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-2xs text-ink-subtle">{hint}</p> : null}
      {error ? <p className="mt-1 text-2xs text-danger">{error}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('input-base', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx('input-base', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('input-base resize-y', className)} {...props} />;
}

/* ------------------------------------------------------------- Feedback */

export function Alert({ tone = 'danger', children }: { tone?: BadgeTone; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'border-line bg-surface-raised text-ink-muted',
    accent: 'border-accent/30 bg-accent-soft text-accent',
    ok: 'border-ok/30 bg-ok-soft text-ok',
    warn: 'border-warn/30 bg-warn-soft text-warn',
    danger: 'border-danger/30 bg-danger-soft text-danger',
    info: 'border-info/30 bg-info-soft text-info',
  };
  return <div className={cx('rounded-lg border px-3.5 py-2.5 text-sm', tones[tone])}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="mb-1 text-ink-subtle">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Layout */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  const accentBar: Record<BadgeTone, string> = {
    neutral: 'bg-line-strong',
    accent: 'bg-accent',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    info: 'bg-info',
  };

  return (
    <div className="card relative overflow-hidden p-4">
      <span className={cx('absolute inset-y-0 left-0 w-0.5', accentBar[tone])} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-2xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Table */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="scroll-x">
      <table className={cx('w-full min-w-[36rem] text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cx('whitespace-nowrap px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wider text-ink-subtle', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-4 py-3 align-top text-ink-muted', className)}>{children}</td>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cx('border-t border-line transition-colors hover:bg-surface-hover/50', className)}>{children}</tr>;
}
