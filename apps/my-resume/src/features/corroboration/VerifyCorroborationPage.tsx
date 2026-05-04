import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../../shared/api/client';

type Status = 'loading' | 'ready' | 'already_actioned' | 'expired' | 'error' | 'confirmed' | 'declined';

interface CorroborationData {
  record: {
    id: string;
    corroboratorName: string;
    corroboratorRole: string | null;
    status: string;
    post: {
      id: string;
      text: string;
      publishedAt: string;
      user: { firstName: string | null; lastName: string | null };
    };
  };
  alreadyActioned: boolean;
}

export function VerifyCorroborationPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<CorroborationData | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const signupUrl = '/register';

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    fetch(`${API_BASE_URL}/ai-context/corroborations/verify/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 403) setStatus('expired');
          else setError(body.message || 'Request not found');
          if (res.status !== 403) setStatus('error');
          return;
        }
        const json: CorroborationData = await res.json();
        setData(json);
        if (json.alreadyActioned) {
          setStatus('already_actioned');
        } else {
          setStatus('ready');
        }
      })
      .catch(() => {
        setError('Network error. Please try again.');
        setStatus('error');
      });
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/ai-context/corroborations/verify/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to confirm');
      }
      setStatus('confirmed');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    if (!confirm('Are you sure you want to decline this corroboration request?')) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/ai-context/corroborations/verify/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to decline');
      }
      setStatus('declined');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const authorName = data
    ? [data.record.post.user.firstName, data.record.post.user.lastName].filter(Boolean).join(' ') || 'Someone'
    : '';

  const postExcerpt = data
    ? data.record.post.text.length > 400
      ? data.record.post.text.slice(0, 397) + '…'
      : data.record.post.text
    : '';

  const publishedDate = data
    ? new Date(data.record.post.publishedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : '';

  // ── Render states ────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div className="card bg-base-100 max-w-md w-full shadow-xl">
          <div className="card-body items-center text-center gap-4">
            <div className="text-5xl">⏰</div>
            <h1 className="card-title text-xl">Link Expired</h1>
            <p className="text-base-content/70">
              This corroboration link has expired. Please ask the person to send you a new invitation.
            </p>
            <Link to={signupUrl} className="btn btn-primary btn-sm mt-2">
              Create your free profile →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div className="card bg-base-100 max-w-md w-full shadow-xl">
          <div className="card-body items-center text-center gap-4">
            <div className="text-5xl">🔍</div>
            <h1 className="card-title text-xl">Request Not Found</h1>
            <p className="text-base-content/70">
              {error || 'This corroboration request could not be found. It may have been cancelled.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'already_actioned') {
    const actionedStatus = data?.record.status;
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div className="card bg-base-100 max-w-md w-full shadow-xl">
          <div className="card-body items-center text-center gap-4">
            <div className="text-5xl">{actionedStatus === 'CONFIRMED' ? '✅' : '👍'}</div>
            <h1 className="card-title text-xl">
              {actionedStatus === 'CONFIRMED' ? 'Already Corroborated' : 'Already Responded'}
            </h1>
            <p className="text-base-content/70">
              {actionedStatus === 'CONFIRMED'
                ? `You have already corroborated ${authorName}'s achievement. Thank you!`
                : 'You have already responded to this corroboration request.'}
            </p>
            <Link to={signupUrl} className="btn btn-primary btn-sm mt-2">
              Create your free profile →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'confirmed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div className="card bg-base-100 max-w-md w-full shadow-xl">
          <div className="card-body items-center text-center gap-4">
            <div className="text-5xl">🎉</div>
            <h1 className="card-title text-xl text-success">Thank you!</h1>
            <p className="text-base-content/70">
              You've successfully corroborated {authorName}'s achievement. Your endorsement is now visible on their profile.
            </p>
            <div className="divider" />
            <p className="text-sm text-base-content/60">
              Want to showcase your own achievements?
            </p>
            <Link to={signupUrl} className="btn btn-primary">
              Create your free ResumeCast profile →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div className="card bg-base-100 max-w-md w-full shadow-xl">
          <div className="card-body items-center text-center gap-4">
            <div className="text-5xl">👋</div>
            <h1 className="card-title text-xl">Response Recorded</h1>
            <p className="text-base-content/70">
              You've declined this corroboration request. {authorName} has been notified.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main verify page ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* Header */}
      <header className="bg-base-100 border-b border-base-300 px-4 py-3">
        <div className="max-w-xl mx-auto">
          <span className="font-bold text-lg text-primary">ResumeCast</span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 pt-10">
        <div className="card bg-base-100 max-w-xl w-full shadow-xl">
          <div className="card-body gap-5">
            <div>
              <h1 className="text-xl font-bold">Achievement Corroboration Request</h1>
              <p className="text-base-content/70 mt-1">
                <strong>{authorName}</strong> is asking you to corroborate an achievement on their professional profile.
              </p>
            </div>

            {/* Post excerpt */}
            <div className="bg-base-200 border-l-4 border-primary rounded p-4">
              <p className="text-sm text-base-content/50 mb-1">Published {publishedDate}</p>
              <p className="whitespace-pre-wrap text-base-content leading-relaxed">{postExcerpt}</p>
            </div>

            {/* Corroborator info */}
            {data?.record.corroboratorRole && (
              <p className="text-sm text-base-content/60">
                You are listed as: <strong>{data.record.corroboratorRole}</strong>
              </p>
            )}

            {/* Optional comment */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Add an optional note <span className="text-base-content/50">(visible on their profile)</span></span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                maxLength={400}
                placeholder="e.g. I worked directly with them on this project and can confirm the results."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <label className="label">
                <span className="label-text-alt text-base-content/40">{comment.length}/400</span>
              </label>
            </div>

            {error && (
              <div className="alert alert-error py-2 text-sm">
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                className="btn btn-success flex-1"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  '✓ Yes, I corroborate this'
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost text-error"
                onClick={handleDecline}
                disabled={isSubmitting}
              >
                ✗ Decline
              </button>
            </div>

            {/* Sign-up nudge */}
            <div className="divider text-xs">Not on ResumeCast yet?</div>
            <div className="text-center">
              <Link to={signupUrl} className="btn btn-outline btn-sm">
                Create your free profile →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
