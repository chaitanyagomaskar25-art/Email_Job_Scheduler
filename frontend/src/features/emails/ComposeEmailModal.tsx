import React, { useState, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { EmailSender } from '../../types';
import { Upload, CheckCircle2, AlertCircle, FileText, Send, Calendar } from 'lucide-react';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [senderId, setSenderId] = useState<string>('');
  const [singleRecipient, setSingleRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Default scheduled time: now + 5 minutes
  const getInitialScheduledAt = () => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [scheduledAtLocal, setScheduledAtLocal] = useState<string>(getInitialScheduledAt());
  const [minDelayMs, setMinDelayMs] = useState<number>(2000);

  // Batch CSV parsed state
  const [batchRecipients, setBatchRecipients] = useState<string[]>([]);
  const [csvStats, setCsvStats] = useState<{
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    filename?: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Fetch senders for dropdown
  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: async () => {
      const res = await api.get('/emails/senders');
      return res.data.data.senders as EmailSender[];
    },
    enabled: isOpen,
  });

  // Schedule Single Email Mutation
  const singleMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/emails/schedule', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setSuccessMessage('Email successfully scheduled!');
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1200);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to schedule email');
    },
  });

  // Schedule Batch Email Mutation
  const batchMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/emails/batch', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setSuccessMessage(`Successfully scheduled batch of ${res.data.data.totalScheduled} emails!`);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1200);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to schedule batch emails');
    },
  });

  const handleReset = () => {
    setSingleRecipient('');
    setSubject('');
    setBody('');
    setBatchRecipients([]);
    setCsvStats(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setScheduledAtLocal(getInitialScheduledAt());
  };

  // CSV parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r\n|\n/);

        const rawEmails: string[] = [];
        for (const line of lines) {
          // Extract email-like tokens or comma-separated columns
          const tokens = line.split(/[,\t;]/).map((t) => t.trim().replace(/^["']|["']$/g, ''));
          for (const token of tokens) {
            if (token && token.includes('@')) {
              rawEmails.push(token.toLowerCase());
            }
          }
        }

        const validEmails: string[] = [];
        let invalidCount = 0;
        let duplicateCount = 0;
        const seen = new Set<string>();

        for (const email of rawEmails) {
          if (!EMAIL_REGEX.test(email)) {
            invalidCount++;
          } else if (seen.has(email)) {
            duplicateCount++;
          } else {
            seen.add(email);
            validEmails.push(email);
          }
        }

        if (validEmails.length === 0) {
          setErrorMessage('No valid email addresses found in file.');
          return;
        }

        setBatchRecipients(validEmails);
        setCsvStats({
          validCount: validEmails.length,
          invalidCount,
          duplicateCount,
          filename: file.name,
        });
        setErrorMessage(null);
      } catch {
        setErrorMessage('Failed to parse CSV file. Ensure valid text or CSV format.');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Convert local datetime-local input to UTC ISO string
    const scheduledDate = new Date(scheduledAtLocal);
    if (isNaN(scheduledDate.getTime())) {
      setErrorMessage('Invalid scheduled date/time selected.');
      return;
    }

    const payloadBase = {
      senderId: senderId || undefined,
      subject: subject.trim(),
      body: body.trim(),
      scheduledAt: scheduledDate.toISOString(),
    };

    if (mode === 'single') {
      if (!singleRecipient || !EMAIL_REGEX.test(singleRecipient.trim())) {
        setErrorMessage('Please enter a valid recipient email address.');
        return;
      }
      singleMutation.mutate({
        ...payloadBase,
        recipientEmail: singleRecipient.trim(),
        idempotencyKey: `single_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });
    } else {
      if (batchRecipients.length === 0) {
        setErrorMessage('Please upload a CSV or list with at least one valid recipient.');
        return;
      }
      batchMutation.mutate({
        ...payloadBase,
        recipients: batchRecipients,
        minDelayBetweenSendsMs: minDelayMs,
      });
    }
  };

  const isSubmitting = singleMutation.isPending || batchMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Compose & Schedule Outreach"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-50 text-xs">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              mode === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Single Recipient
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              mode === 'batch' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Batch Campaign (CSV Upload)
          </button>
        </div>

        {/* Sender selection */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Sender Identity
          </label>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Default Outreach Account (Ethereal SMTP)</option>
            {sendersData?.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.name} ({sender.email}) {sender.isDefault ? '[Default]' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Recipient Input (Single vs CSV) */}
        {mode === 'single' ? (
          <div>
            <Input
              label="Recipient Email"
              type="email"
              placeholder="prospect@company.com"
              value={singleRecipient}
              onChange={(e) => setSingleRecipient(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-700">
              Upload Recipients List (CSV or Text)
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-indigo-500 hover:bg-indigo-50/20 cursor-pointer transition-colors"
            >
              <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700">Click to select CSV or TXT file</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Columns containing email addresses will be parsed automatically</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* CSV Stats preview */}
            {csvStats && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
                  <FileText className="w-3.5 h-3.5" />
                  {csvStats.filename}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="text-emerald-700">
                    <span className="font-bold">{csvStats.validCount}</span> Valid addresses
                  </div>
                  <div className="text-amber-700">
                    <span className="font-bold">{csvStats.duplicateCount}</span> Duplicates removed
                  </div>
                  <div className="text-rose-700">
                    <span className="font-bold">{csvStats.invalidCount}</span> Invalid discarded
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subject */}
        <div>
          <Input
            label="Subject"
            placeholder="Introduction to our platform..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Email Message Content
          </label>
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi there,&#10;&#10;I wanted to connect regarding..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Schedule Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Schedule Execution Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Timezone: {userTimezone}
            </span>
          </div>

          {mode === 'batch' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Delay Between Sends (ms)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={minDelayMs}
                onChange={(e) => setMinDelayMs(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Spaces out batch sends to protect sender reputation
              </span>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            className="gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            {mode === 'single' ? 'Schedule Email' : `Schedule ${batchRecipients.length || 0} Emails`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

