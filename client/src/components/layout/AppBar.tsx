import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getHealth } from '../../api/studio';
import { useAuth } from '../../app/auth';
import { Icon, Mark, type IconName } from '../ui/Icon';
import { PasswordDialog } from './PasswordDialog';

const PROVIDER_NAMES: Record<string, string> = { xai: 'xAI', gemini: 'Gemini' };

/** The AI service the server uses ("offline" if the server can't be reached). Read once per page load. */
let healthCache: Promise<string> | null = null;
export function useProviderName() {
  const [provider, setProvider] = useState('');
  useEffect(() => {
    healthCache ??= getHealth()
      .then((h) => h.provider)
      .catch(() => {
        healthCache = null;
        return 'offline';
      });
    let live = true;
    void healthCache.then((p) => live && setProvider(p));
    return () => {
      live = false;
    };
  }, []);
  return provider;
}

/** Shows which AI service is answering, so staff know at a glance whether results are real. */
function StatusPill({ provider }: { provider: string }) {
  if (!provider) return <span className="status">Connecting…</span>;
  if (provider === 'offline') {
    return (
      <span className="status status-bad" title="The server is not reachable. Try again in a moment.">
        Offline
      </span>
    );
  }
  if (provider === 'mock') {
    return (
      <span className="status status-warn" title="No AI key is set, so designs show your image unchanged. Add XAI_API_KEY to .env.">
        Demo mode
      </span>
    );
  }
  // provider is "xai:grok-imagine-image-2.0": show the service, keep the model in the tooltip.
  const [service] = provider.split(':');
  return (
    <span className="status status-ok" title={`AI model: ${provider}`}>
      Live · {PROVIDER_NAMES[service] ?? service}
    </span>
  );
}

const NAV: { to: string; label: string; icon: IconName; admin?: boolean; end?: boolean }[] = [
  { to: '/', label: 'Projects', icon: 'folder', end: true },
  { to: '/clients', label: 'Clients', icon: 'users' },
  { to: '/studio', label: 'Quick studio', icon: 'sparkle' },
  { to: '/team', label: 'Team', icon: 'user', admin: true },
];

function UserMenu() {
  const { me, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (!me) return null;
  const initials = me.user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-btn" aria-expanded={open} onClick={() => setOpen(!open)} title={me.user.name}>
        <span className="avatar">{initials}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{me.user.name}</strong>
            <span>{me.user.email}</span>
            <span className={`role-chip role-${me.user.role}`}>{me.user.role}</span>
          </div>
          {me.user.role !== 'viewer' && (
            <p className="menu-note">
              <Icon name="sparkle" size={13} /> About <b>{me.imagesLeft}</b> of {me.dailyLimit} images left today
            </p>
          )}
          {isAdmin && (
            <button type="button" role="menuitem" onClick={() => navigate('/team?tab=usage')}>
              <Icon name="chart" size={15} /> Usage
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPassword(true);
            }}
          >
            <Icon name="lock" size={15} /> Change password
          </button>
          <button type="button" role="menuitem" onClick={() => void logout().then(() => navigate('/login'))}>
            <Icon name="logout" size={15} /> Sign out
          </button>
        </div>
      )}
      {password && <PasswordDialog onClose={() => setPassword(false)} />}
    </div>
  );
}

interface Props {
  /** Buttons for the right side, e.g. "New photo". */
  children?: ReactNode;
  /** Context shown after the brand, e.g. "Mr. Raman · Kitchen". */
  crumb?: ReactNode;
}

/** The app's top bar: product name, the client it is made for, navigation, AI status and the account menu. */
export function AppBar({ children, crumb }: Props) {
  const provider = useProviderName();
  const { me, isAdmin } = useAuth();
  return (
    <header className="appbar">
      <div className="appbar-brand">
        <NavLink to="/" className="brand-link" aria-label="Dream Studios: projects">
          <Mark />
          <span className="appbar-name">Dream Studios</span>
        </NavLink>
        <span className="appbar-sep" aria-hidden="true" />
        <span className="client-chip">
          <span>for</span>
          <img src="/brand/logo.png" alt="EUC Technowood" width={76} height={23} />
        </span>
        {me && (
          <nav className="appnav" aria-label="Main">
            {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="appnav-link">
                <Icon name={n.icon} size={15} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
        {crumb && <span className="crumb">{crumb}</span>}
      </div>
      <div className="appbar-actions">
        <StatusPill provider={provider} />
        {children}
        <UserMenu />
      </div>
    </header>
  );
}
