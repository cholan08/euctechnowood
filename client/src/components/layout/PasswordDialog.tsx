import { useState, type FormEvent } from 'react';
import { auth } from '../../api/workspace';
import { Dialog } from '../ui/Dialog';

export function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await auth.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Change password" onClose={onClose}>
      {done ? (
        <>
          <p>Your password has been changed.</p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-accent" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="form">
          <label className="form-field">
            <span>Current password</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>New password</span>
            <input type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required />
            <small>At least 10 characters.</small>
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={busy}>
              Change password
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
