import { useEffect, useState } from 'react';
import type { Variation } from '../shared/types';
import { getHealth, redesign } from './api';
import { DesignPanel, type DesignState } from './components/DesignPanel';
import { Results } from './components/Results';
import { Uploader } from './components/Uploader';
import { measureImage, prepareImage, type PreparedImage } from './image';

const INITIAL_DESIGN: DesignState = {
  source: 'photo',
  roomType: 'kitchen',
  styleIds: ['modern', 'indian-contemporary'],
  changes: {},
  extras: [],
  notes: '',
};

interface Result {
  before: string;
  ratio: number;
  variations: Variation[];
}

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

export default function App() {
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [design, setDesign] = useState<DesignState>(INITIAL_DESIGN);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [provider, setProvider] = useState('');

  useEffect(() => {
    getHealth()
      .then((h) => setProvider(h.provider))
      .catch(() => setProvider('offline'));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const count = Math.max(1, design.styleIds.length);
  const hasRequest =
    design.source === 'render' ||
    design.styleIds.length > 0 ||
    Object.keys(design.changes).length > 0 ||
    design.extras.length > 0 ||
    design.notes.trim() !== '';

  async function handleFile(file: File) {
    setError('');
    try {
      setPhoto(await prepareImage(file));
      setResult(null);
    } catch (err) {
      setError(message(err));
    }
  }

  async function generate() {
    if (!photo) return;
    setBusy(true);
    setError('');
    try {
      const response = await redesign({ image: photo.dataUrl, width: photo.width, height: photo.height, ...design });
      setResult({ before: photo.dataUrl, ratio: photo.width / photo.height, variations: response.variations });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  // Use a generated design as the new starting photo, for step-by-step edits.
  async function continueFrom(v: Variation) {
    if (!v.image) return;
    try {
      const size = await measureImage(v.image);
      setPhoto({ dataUrl: v.image, ...size, name: `${v.label} design` });
      setDesign((d) => ({ ...d, source: 'photo', styleIds: [], changes: {}, extras: [], notes: '' }));
      setResult(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <>
      <header className="top">
        <div>
          <h1>Room Studio</h1>
          <p>Upload a photo of a room and see it redesigned in different styles.</p>
        </div>
        <ProviderBadge provider={provider} />
      </header>

      <main className="layout">
        <aside className="panel">
          <Uploader photo={photo} onFile={handleFile} />
          <DesignPanel value={design} onChange={setDesign} />
          <div className="actions">
            <button type="button" className="primary" disabled={!photo || busy || !hasRequest} onClick={generate}>
              {busy ? `Designing… ${elapsed}s` : `Generate ${count} design${count > 1 ? 's' : ''}`}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </aside>

        <section className="stage" aria-live="polite" aria-busy={busy}>
          {busy && photo ? (
            <div className="results">
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: photo.width / photo.height }} />
              ))}
            </div>
          ) : result ? (
            <Results before={result.before} ratio={result.ratio} variations={result.variations} onContinue={continueFrom} />
          ) : photo ? (
            <figure className="preview">
              <img src={photo.dataUrl} alt="Your uploaded room" />
              <figcaption className="muted">Choose styles and changes on the left, then generate.</figcaption>
            </figure>
          ) : (
            <div className="empty">
              <h2>Start with a photo</h2>
              <p>For the best results:</p>
              <ul className="tips">
                <li>Shoot in daylight with the lights on</li>
                <li>Stand in a corner at chest height and hold the phone level</li>
                <li>Use the normal 1× lens, not the 0.5× wide lens</li>
                <li>Show the whole room, with no people in the photo</li>
              </ul>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  if (!provider) return null;
  if (provider === 'mock') {
    return (
      <span className="pill warn">Mock mode: designs show your photo unchanged. Add GEMINI_API_KEY to .env for real results.</span>
    );
  }
  if (provider === 'offline') return <span className="pill warn">API server is not running.</span>;
  return <span className="pill">AI: {provider}</span>;
}
