import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/auth';
import { Mark } from '../../components/ui/Icon';

/** Staff sign-in. There is no public sign-up: admins add staff on the Team page. */
export default function LoginPage() {
  const { me, login } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next');
  // Only ever return to a page of this app.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (me) return <Navigate to={target} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-art" aria-hidden="true">
        <img src="/brand/manufactured.jpg" alt="" />
        <div className="login-art-text">
          <p className="eyebrow">AI interior studio</p>
          <p>Generate, edit and present real room designs, with the customer's own room kept exactly as it is.</p>
        </div>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Mark size={36} />
          <div>
            <strong>Dream Studios</strong>
            <span>
              for <img src="/brand/logo.png" alt="EUC Technowood" width={70} height={21} />
            </span>
          </div>
        </div>
        <h1>Sign in</h1>
        <label className="form-field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-accent btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Sign in'}
        </button>
        <p className="login-help">EUC staff only. Forgot your password? Ask an admin to reset it.</p>
      </form>
    </main>
  );
}
