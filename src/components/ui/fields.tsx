import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/utils/cn";

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline gap-1 text-[13px] font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(inputBase, "h-10", invalid ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/25" : "border-slate-300", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { invalid, className, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(
          inputBase,
          "h-10 pr-10",
          invalid ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/25" : "border-slate-300",
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-600"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          inputBase,
          "h-10 appearance-none pr-9",
          invalid ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/25" : "border-slate-300",
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
});
