import { useHydrated } from "../../lib/use-hydrated";
import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import { LoaderCircle } from "lucide-react";

export function Button({
  variant = "primary",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}) {
  const hydrated = useHydrated();
  return (
    <button
      type="button"
      className={`button button--${variant} ${className}`}
      disabled={disabled || loading || !hydrated}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <LoaderCircle className="spinner" size={16} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      {...props}
      className={`icon-button ${props.className || ""}`}
      aria-label={label}
    >
      {children}
    </Button>
  );
}
type FieldProps = { label: string; error?: string; hint?: string };
export function Input({
  label,
  error,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const generated = useId();
  const fieldId = id || generated;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${fieldId}-help` : undefined}
      />
      <FieldHelp id={`${fieldId}-help`} error={error} hint={hint} />
    </div>
  );
}
export function Textarea({
  label,
  error,
  hint,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const generated = useId();
  const fieldId = id || generated;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        rows={3}
        {...props}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${fieldId}-help` : undefined}
      />
      <FieldHelp id={`${fieldId}-help`} error={error} hint={hint} />
    </div>
  );
}
export function Select({
  label,
  error,
  hint,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const generated = useId();
  const fieldId = id || generated;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <select
        {...props}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${fieldId}-help` : undefined}
      >
        {children}
      </select>
      <FieldHelp id={`${fieldId}-help`} error={error} hint={hint} />
    </div>
  );
}
function FieldHelp({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: string;
}) {
  return error || hint ? (
    <p id={id} className={error ? "field-error" : "field-hint"}>
      {error || hint}
    </p>
  ) : null;
}
export function Checkbox({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className="check-control">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Toggle({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  label: string;
}) {
  return (
    <label className="check-control toggle">
      <input type="checkbox" role="switch" {...props} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "rose" | "dark";
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-heading">
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
export function Divider() {
  return <hr className="divider" />;
}
export function Progress({ label, value }: { label: string; value?: number }) {
  return (
    <label className="progress-label">
      {label}
      <progress
        max={100}
        value={
          value === undefined ? undefined : Math.min(100, Math.max(0, value))
        }
      />
    </label>
  );
}
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span className="avatar" aria-hidden="true">
      {src && failedSrc !== src ? (
        <img src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        name
          .trim()
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
