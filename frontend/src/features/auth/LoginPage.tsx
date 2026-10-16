import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Mail, ShieldCheck, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, mockLogin, googleConfigured, isLoading } = useAuth();
  const [emailInput, setEmailInput] = useState('demo@reachinbox.test');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await mockLogin(emailInput);
      window.location.href = '/dashboard';
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/25 mb-4">
          <Mail className="w-7 h-7" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">ReachInbox</h2>
        <p className="mt-2 text-sm text-indigo-200">
          Full-Stack Distributed Email Job Scheduler
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Sign in to your dashboard</h3>
              <p className="text-xs text-slate-500 mt-1">
                Persistent scheduling, rate limiting, and real-time email delivery.
              </p>
            </div>

            {/* Google OAuth Button */}
            <div>
              <Button
                type="button"
                variant="outline"
                className="w-full py-2.5 flex items-center justify-center gap-3 text-slate-700 hover:bg-slate-50 border-slate-300"
                onClick={loginWithGoogle}
                disabled={isLoading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </Button>
              {!googleConfigured && (
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
                  Note: Google credentials can be configured in <code>.env</code> (GOOGLE_CLIENT_ID). You can also use instant local login below.
                </p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium">Or instant access</span>
              </div>
            </div>

            {/* Instant Demo Login */}
            <form onSubmit={handleDemoLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Account
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 gap-2"
                isLoading={isLoggingIn}
              >
                <Zap className="w-4 h-4" />
                Sign in with Developer Account
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </form>

            <div className="pt-2 border-t border-slate-100">
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  BullMQ delayed job queue with Redis persistence
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  Distributed atomic hourly rate limiting & Slack alerts
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  Elasticsearch indexing with PostgreSQL source of truth
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-indigo-300 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> Enterprise-grade tenant isolation & session cookies
        </p>
      </div>
    </div>
  );
};
