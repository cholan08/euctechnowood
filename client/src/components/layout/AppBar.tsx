import type { ReactNode } from 'react';
import { Mark } from '../ui/Icon';

const PROVIDER_NAMES: Record<string, string> = { xai: 'xAI', gemini: 'Gemini' };

/** Shows which AI service is answering, so staff know at a glance whether results are real. */
function StatusPill({ provider }: { provider: string }) {
  if (!provider) {
    return <span className="status">Connecting…</span>;
  }
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

interface Props {
  provider: string;
  /** Buttons for the right side, e.g. "New session". */
  children?: ReactNode;
}

/** The app's top bar: product name, the client it is made for, AI status and page actions. */
export function AppBar({ provider, children }: Props) {
  return (
    <header className="appbar">
      <div className="appbar-brand">
        <Mark />
        <span className="appbar-name">Room Studio</span>
        <span className="appbar-sep" aria-hidden="true" />
        <span className="client-chip">
          <span>for</span>
          <img src="/brand/logo.png" alt="EUC Technowood" width={76} height={23} />
        </span>
      </div>
      <div className="appbar-actions">
        <StatusPill provider={provider} />
        {children}
      </div>
    </header>
  );
}
