import { useState, useEffect } from 'react';
import { apiClient } from '../../shared/api/client';

interface Corroboration {
  id: string;
  corroboratorEmail: string;
  corroboratorName: string;
  corroboratorRole: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED';
  confirmedAt: string | null;
  comment: string | null;
  createdAt: string;
}

interface CorroborationSectionProps {
  postId: string;
}

interface NewCorroborator {
  name: string;
  email: string;
  role: string;
}

const ROLE_OPTIONS = [
  'Direct Manager',
  'Skip-level Manager',
  'Teammate',
  'Direct Report',
  'Client',
  'Mentor',
  'Other',
];

const STATUS_BADGE: Record<Corroboration['status'], { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'badge-warning' },
  CONFIRMED: { label: 'Confirmed ✓', cls: 'badge-success' },
  DECLINED: { label: 'Declined', cls: 'badge-error' },
  EXPIRED: { label: 'Expired', cls: 'badge-ghost' },
};

const EMPTY_ROW: NewCorroborator = { name: '', email: '', role: '' };

export function CorroborationSection({ postId }: CorroborationSectionProps) {
  const [corroborations, setCorroborations] = useState<Corroboration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<NewCorroborator[]>([{ ...EMPTY_ROW }]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [postId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getCorroborations(postId);
      setCorroborations(data);
    } catch {
      // silently ignore — section just stays empty
    } finally {
      setIsLoading(false);
    }
  };

  const updateRow = (i: number, field: keyof NewCorroborator, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleSend = async () => {
    setSendError('');
    setSendSuccess('');

    const valid = rows.filter((r) => r.name.trim() && r.email.trim());
    if (valid.length === 0) {
      setSendError('Add at least one name and email.');
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of valid) {
      if (!emailRe.test(r.email)) {
        setSendError(`Invalid email: ${r.email}`);
        return;
      }
    }

    setIsSending(true);
    try {
      await apiClient.addCorroborators(
        postId,
        valid.map((r) => ({ name: r.name.trim(), email: r.email.trim(), role: r.role.trim() || undefined })),
      );
      setSendSuccess(`Sent ${valid.length} invitation${valid.length > 1 ? 's' : ''} successfully.`);
      setRows([{ ...EMPTY_ROW }]);
      setIsOpen(false);
      await load();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send invitations.');
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (c: Corroboration) => {
    setResendingId(c.id);
    try {
      await apiClient.resendCorroboration(postId, c.id);
    } catch {
      // ignore
    } finally {
      setResendingId(null);
    }
  };

  const handleCancel = async (c: Corroboration) => {
    if (!confirm(`Cancel invitation for ${c.corroboratorName}?`)) return;
    setCancelingId(c.id);
    try {
      await apiClient.cancelCorroboration(postId, c.id);
      await load();
    } catch {
      // ignore
    } finally {
      setCancelingId(null);
    }
  };

  const confirmedCount = corroborations.filter((c) => c.status === 'CONFIRMED').length;
  const pendingCount = corroborations.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="mt-3">
      {/* Summary badge shown inline */}
      <div className="flex items-center gap-2 flex-wrap">
        {confirmedCount > 0 && (
          <div className="badge badge-success gap-1 text-xs">
            ✓ {confirmedCount} corroborated
          </div>
        )}
        {pendingCount > 0 && (
          <div className="badge badge-warning gap-1 text-xs">
            ⏳ {pendingCount} pending
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-xs gap-1"
          onClick={() => { setIsOpen((v) => !v); setSendError(''); setSendSuccess(''); }}
        >
          🤝 {corroborations.length > 0 ? 'Manage corroborations' : 'Request corroboration'}
        </button>
      </div>

      {sendSuccess && (
        <div className="alert alert-success py-2 text-sm mt-2">
          <span>✓ {sendSuccess}</span>
        </div>
      )}

      {isOpen && (
        <div className="mt-3 p-4 bg-base-200 rounded-lg space-y-4">
          <h4 className="font-semibold text-sm">Request Corroboration</h4>
          <p className="text-xs text-base-content/60">
            Invite managers, teammates, or colleagues to verify this achievement.
            They'll receive an email with a link to confirm it.
          </p>

          {/* Add rows */}
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 flex-wrap items-end">
                <div className="form-control flex-1 min-w-28">
                  <label className="label py-0"><span className="label-text text-xs">Name *</span></label>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full"
                    placeholder="Jane Smith"
                    value={row.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                  />
                </div>
                <div className="form-control flex-1 min-w-36">
                  <label className="label py-0"><span className="label-text text-xs">Email *</span></label>
                  <input
                    type="email"
                    className="input input-bordered input-sm w-full"
                    placeholder="jane@company.com"
                    value={row.email}
                    onChange={(e) => updateRow(i, 'email', e.target.value)}
                  />
                </div>
                <div className="form-control flex-1 min-w-32">
                  <label className="label py-0"><span className="label-text text-xs">Role</span></label>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={row.role}
                    onChange={(e) => updateRow(i, 'role', e.target.value)}
                  >
                    <option value="">— optional —</option>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle text-error mt-4"
                    onClick={() => removeRow(i)}
                    title="Remove row"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button type="button" className="btn btn-ghost btn-sm" onClick={addRow}>
              + Add another
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? <span className="loading loading-spinner loading-xs" /> : 'Send invitations'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
          </div>

          {sendError && (
            <div className="alert alert-error py-2 text-sm">
              <span>{sendError}</span>
            </div>
          )}

          {/* Existing corroborations list */}
          {!isLoading && corroborations.length > 0 && (
            <div className="divider text-xs my-2">Existing requests</div>
          )}
          {!isLoading && corroborations.map((c) => {
            const badge = STATUS_BADGE[c.status];
            return (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm flex-wrap bg-base-100 rounded p-2">
                <div className="flex-1">
                  <span className="font-medium">{c.corroboratorName}</span>
                  {c.corroboratorRole && (
                    <span className="text-base-content/60 text-xs ml-1">({c.corroboratorRole})</span>
                  )}
                  <span className="text-base-content/50 text-xs ml-1 hidden sm:inline">
                    · {c.corroboratorEmail}
                  </span>
                  {c.comment && (
                    <p className="text-xs text-base-content/60 mt-0.5 italic">"{c.comment}"</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <div className={`badge ${badge.cls} text-xs`}>{badge.label}</div>
                  {c.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleResend(c)}
                        disabled={resendingId === c.id}
                        title="Resend invitation"
                      >
                        {resendingId === c.id ? <span className="loading loading-spinner loading-xs" /> : '↩ Resend'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleCancel(c)}
                        disabled={cancelingId === c.id}
                        title="Cancel invitation"
                      >
                        {cancelingId === c.id ? <span className="loading loading-spinner loading-xs" /> : '✕'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
