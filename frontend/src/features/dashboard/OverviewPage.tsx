import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { DashboardStatsData, ScheduledEmail } from '../../types';
import {
  Clock,
  Send,
  AlertOctagon,
  Layers,
  Activity,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmailDetailModal } from '../emails/EmailDetailModal';
import { format } from 'date-fns';

export const OverviewPage: React.FC = () => {
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardStatsData>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    },
    refetchInterval: 10000, // Poll every 10s for live queue updates
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Loading system metrics and queue stats...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="text-center py-12">
        <AlertOctagon className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900">Failed to load overview data</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Could not communicate with the scheduling API. Please verify backend status.
        </p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  const { metrics, queue, rateLimit, recentEmails } = data;

  const statCards = [
    {
      label: 'Scheduled Emails',
      value: metrics.scheduled,
      subtext: 'Pending delayed delivery in queue',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '/emails/scheduled',
    },
    {
      label: 'Sent Successfully',
      value: metrics.sent,
      subtext: 'Delivered via Ethereal SMTP',
      icon: Send,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      href: '/emails/sent',
    },
    {
      label: 'Failed Deliveries',
      value: metrics.failed,
      subtext: 'Safe retry available on failure',
      icon: AlertOctagon,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      href: '/emails/failed',
    },
    {
      label: 'BullMQ Active / Delayed',
      value: (queue.active || 0) + (queue.delayed || 0),
      subtext: `${queue.delayed || 0} delayed, ${queue.waiting || 0} waiting in Redis`,
      icon: Layers,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      external: '/admin/queues',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          isOpen={Boolean(selectedEmail)}
          onClose={() => setSelectedEmail(null)}
        />
      )}

      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Outreach Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time pipeline monitoring, BullMQ delayed job processing, and rate limits
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            isLoading={isRefetching}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bgColor} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {card.value.toLocaleString()}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">{card.subtext}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Rate Limit & Concurrency Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          className="lg:col-span-1"
          title="Hourly Rate Limit Tracker"
          subtitle="Distributed hourly counter coordinated via Redis"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Used this UTC Hour:</span>
              <span className="font-bold text-slate-900">
                {rateLimit.currentHourUsage} / {rateLimit.maxPerHour}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  rateLimit.currentHourUsage >= rateLimit.maxPerHour
                    ? 'bg-rose-500'
                    : rateLimit.currentHourUsage > rateLimit.maxPerHour * 0.8
                    ? 'bg-amber-500'
                    : 'bg-indigo-600'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (rateLimit.currentHourUsage / rateLimit.maxPerHour) * 100
                  )}%`,
                }}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Remaining Quota:</span>
                <span className="font-semibold text-emerald-700">
                  {rateLimit.remainingQuota} emails
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Overflow Policy:</span>
                <span className="font-medium text-slate-700">Defer to Next Window</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slack Alerts:</span>
                <span className="font-medium text-slate-700">Deduplicated (1/hr)</span>
              </div>
            </div>
          </div>
        </Card>

        {/* BullMQ Live Status */}
        <Card
          className="lg:col-span-2"
          title="BullMQ Queue Execution State"
          subtitle="Persistent job queues backed by Redis storage"
          action={
            <a
              href="/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Open Dashboard <ExternalLink className="w-3 h-3" />
            </a>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 block">Waiting</span>
              <span className="text-xl font-bold text-slate-800">{queue.waiting || 0}</span>
            </div>
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
              <span className="text-xs text-amber-700 block">Active</span>
              <span className="text-xl font-bold text-amber-700">{queue.active || 0}</span>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <span className="text-xs text-blue-700 block">Delayed</span>
              <span className="text-xl font-bold text-blue-700">{queue.delayed || 0}</span>
            </div>
            <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
              <span className="text-xs text-emerald-700 block">Completed</span>
              <span className="text-xl font-bold text-emerald-700">{queue.completed || 0}</span>
            </div>
            <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100">
              <span className="text-xs text-rose-700 block">Failed</span>
              <span className="text-xl font-bold text-rose-700">{queue.failed || 0}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              Concurrency: 5 workers | Send Delay: 2,000ms
            </span>
            <span className="text-slate-400">Auto-refreshing every 10s</span>
          </div>
        </Card>
      </div>

      {/* Recent Emails Section */}
      <Card
        title="Recently Scheduled & Processed Emails"
        subtitle="Latest email jobs processed through the scheduler"
      >
        {recentEmails.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No emails recorded yet. Click &quot;Compose Email&quot; to schedule your first outreach message.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-6 font-semibold">Recipient</th>
                  <th className="py-2.5 px-6 font-semibold">Subject</th>
                  <th className="py-2.5 px-6 font-semibold">Sender</th>
                  <th className="py-2.5 px-6 font-semibold">Scheduled / Next</th>
                  <th className="py-2.5 px-6 font-semibold">Status</th>
                  <th className="py-2.5 px-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-900">{email.recipientEmail}</td>
                    <td className="py-3 px-6 text-slate-600 max-w-[240px] truncate">
                      {email.subject}
                    </td>
                    <td className="py-3 px-6 text-slate-500">
                      {email.sender?.email || 'Default Sender'}
                    </td>
                    <td className="py-3 px-6 text-slate-500">
                      {format(new Date(email.scheduledAt), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-3 px-6">
                      <Badge status={email.status} size="sm" />
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => setSelectedEmail(email)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
