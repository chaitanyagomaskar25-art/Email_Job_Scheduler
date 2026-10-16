import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { ScheduledEmail } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { ExternalLink, Calendar, User, Mail, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

interface EmailDetailModalProps {
  email: ScheduledEmail;
  isOpen: boolean;
  onClose: () => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  email,
  isOpen,
  onClose,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Email Delivery Inspection" maxWidth="xl">
      <div className="space-y-4">
        {/* Header summary */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block">Status</span>
            <div className="mt-1">
              <Badge status={email.status} />
            </div>
          </div>
          {email.etherealPreviewUrl && (
            <a
              href={email.etherealPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Open Ethereal Preview <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Email Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-100">
          <div>
            <span className="text-slate-400 block flex items-center gap-1">
              <Mail className="w-3 h-3" /> Recipient
            </span>
            <span className="font-semibold text-slate-800 break-all">{email.recipientEmail}</span>
          </div>
          <div>
            <span className="text-slate-400 block flex items-center gap-1">
              <User className="w-3 h-3" /> Sender Account
            </span>
            <span className="font-semibold text-slate-800">
              {email.sender?.email || 'Default Outreach Account'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Scheduled Time
            </span>
            <span className="text-slate-700">
              {format(new Date(email.scheduledAt), 'MMM d, yyyy h:mm:ss a')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Delivery Timestamp</span>
            <span className="text-slate-700">
              {email.sentAt
                ? format(new Date(email.sentAt), 'MMM d, yyyy h:mm:ss a')
                : email.failedAt
                ? format(new Date(email.failedAt), 'Failed at MMM d, h:mm a')
                : 'Pending Execution'}
            </span>
          </div>
        </div>

        {/* Subject & Body */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Subject
          </label>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900">
            {email.subject}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Email Content
          </label>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {email.body}
          </div>
        </div>

        {/* Failure / Technical Diagnostics */}
        {email.errorDetails && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            <span className="font-bold flex items-center gap-1.5 mb-1">
              <ShieldAlert className="w-4 h-4 text-rose-600" /> Transmission Failure Details
            </span>
            <p className="font-mono text-[11px]">{email.errorDetails}</p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Attempts: {email.attemptCount} / {email.maxAttempts}</span>
          <span>Job ID: {email.bullJobId || 'Pending'}</span>
        </div>
      </div>
    </Modal>
  );
};

