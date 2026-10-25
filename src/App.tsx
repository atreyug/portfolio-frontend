import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { SessionDataProvider } from "@/context/SessionDataContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AuthLayout } from "@/layouts/AuthLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { StockAnalysisPage } from "@/pages/analysis/StockAnalysisPage";
import { MutualFundPage } from "@/pages/analysis/MutualFundPage";
import { MonitoringPage } from "@/pages/MonitoringPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

/**
 * HashRouter is used deliberately: portfolio data must never appear in URLs
 * sent to a server, and hash-based routing keeps every route client-side —
 * including for statically hosted single-file builds.
 */
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SessionDataProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="analysis/stocks" element={<StockAnalysisPage />} />
                <Route path="analysis/mutual-funds" element={<MutualFundPage />} />
                <Route path="monitoring" element={<MonitoringPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </HashRouter>
        </SessionDataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
