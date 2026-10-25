import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/fields";
import { InlineError } from "@/components/ui/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { normalizeApiError } from "@/services/client";
import { isEmail, passwordIssues, required } from "@/utils/validate";
import { cn } from "@/utils/cn";

function PasswordRules({ password }: { password: string }) {
  if (!password) return null;
  const rules: Array<[string, boolean]> = [
    ["At least 8 characters", password.length >= 8],
    ["Contains a letter", /[a-zA-Z]/.test(password)],
    ["Contains a number", /[0-9]/.test(password)],
  ];
  return (
    <ul className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-3">
      {rules.map(([label, ok]) => (
        <li key={label} className={cn("flex items-center gap-1.5 text-[11px] font-medium", ok ? "text-emerald-600" : "text-slate-400")}>
          {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {label}
        </li>
      ))}
    </ul>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (required(email)) next.email = "Email is required.";
    else if (!isEmail(email)) next.email = "Enter a valid email address.";
    const pwIssue = passwordIssues(password);
    if (required(password)) next.password = "Password is required.";
    else if (pwIssue) next.password = pwIssue;
    if (confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setApiError(null);
    setLoading(true);
    try {
      const name = fullName.trim();
      await signup({
        email: email.trim().toLowerCase(),
        password,
        ...(name ? { full_name: name, name } : {}),
      });
      toast.success("Account created", "Welcome to Meridian.");
      navigate("/app", { replace: true });
    } catch (err) {
      setApiError(normalizeApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-500">Start with private, AI-powered portfolio intelligence.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {apiError && <InlineError message={apiError} />}
        <Field label="Full name" hint="Optional — shown across your workspace." error={errors.fullName}>
          {(id) => (
            <Input
              id={id}
              type="text"
              autoComplete="name"
              placeholder="Aarav Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Email address" required error={errors.email}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              invalid={!!errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password" required error={errors.password}>
          {(id) => (
            <>
              <PasswordInput
                id={id}
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                invalid={!!errors.password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordRules password={password} />
            </>
          )}
        </Field>
        <Field label="Confirm password" required error={errors.confirm}>
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirm}
              invalid={!!errors.confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? "Creating your account…" : "Create account"} {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
          Sign in
        </Link>
      </p>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <Lock className="h-3.5 w-3.5" /> Passwords are never stored by this application.
      </p>
    </div>
  );
}
