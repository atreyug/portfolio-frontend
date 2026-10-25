import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/Logo";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-100 p-6 text-center">
      <LogoMark className="h-12 w-12" />
      <div>
        <p className="font-mono text-sm font-semibold text-emerald-600">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">This page took a different turn</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          The page you're looking for doesn't exist or may have moved.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <Compass className="h-4 w-4" /> Go back
        </Button>
        <Button onClick={() => navigate("/app")}>Open dashboard</Button>
      </div>
    </div>
  );
}
