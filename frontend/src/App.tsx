import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './features/auth/LoginPage';
import { OverviewPage } from './features/dashboard/OverviewPage';
import { ScheduledEmailsPage } from './features/emails/ScheduledEmailsPage';
import { SentEmailsPage } from './features/emails/SentEmailsPage';
import { FailedEmailsPage } from './features/emails/FailedEmailsPage';
import { IntegrationsPage } from './features/integrations/IntegrationsPage';
import { Spinner } from './components/ui/Spinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Authenticating session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<OverviewPage />} />
              <Route path="emails/scheduled" element={<ScheduledEmailsPage />} />
              <Route path="emails/sent" element={<SentEmailsPage />} />
              <Route path="emails/failed" element={<FailedEmailsPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
