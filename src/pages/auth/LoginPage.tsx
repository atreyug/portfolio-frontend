import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/fields";
import { InlineError } from "@/components/ui/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { normalizeApiError } from "@/services/client";
import { isEmail, required } from "@/utils/validate";

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiDetails, setApiDetails] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (required(email)) next.email = "Email is required.";
    else if (!isEmail(email)) next.email = "Enter a valid email address.";
    if (required(password)) next.password = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setApiError(null);
    setApiDetails(undefined);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back", "You are signed in.");
      navigate(from ?? "/app", { replace: true });
    } catch (err) {
      const apiErr = normalizeApiError(err);
      setApiError(apiErr.message);
      setApiDetails(apiErr.details);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to Meridian</h1>
      <p className="mt-1.5 text-sm text-slate-500">Access your portfolio intelligence workspace.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {apiError && (
          <div className="space-y-2">
            <InlineError message={apiError} />
            {apiDetails && (
              <ul className="list-inside list-disc rounded-lg bg-rose-50/60 px-4 py-2 text-xs text-rose-600">
                {apiDetails.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
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
            <PasswordInput
              id={id}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              invalid={!!errors.password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? "Signing you in…" : "Sign in"} {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        New to Meridian?{" "}
        <Link to="/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">
          Create an account
        </Link>
      </p>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <Lock className="h-3.5 w-3.5" /> Credentials are sent only to your configured API.
      </p>
    </div>
  );
}
