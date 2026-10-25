import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogoMark } from "@/components/Logo";
import { PageLoader } from "@/components/ui/Skeleton";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-100">
        <LogoMark className="h-12 w-12" />
        <PageLoader label="Restoring your session…" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
