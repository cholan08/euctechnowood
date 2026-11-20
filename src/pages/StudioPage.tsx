import { useEffect, useState } from 'react';
import type { Variation } from '../../shared/types';
import { getHealth, redesign } from '../api/studio';
import { DesignPanel, type DesignState } from '../components/studio/DesignPanel';
import { Hero } from '../components/studio/Hero';
import { QuoteModal } from '../components/studio/QuoteModal';
import { StudioBar } from '../components/studio/StudioBar';
import { Viewer } from '../components/studio/Viewer';
import { fileFromUrl, prepareImage, type PreparedImage } from '../lib/image';

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
// Open the page with ?debug to see the AI prompt and timing for each design.
const DEBUG = new URLSearchParams(window.location.search).has('debug');

export default function StudioPage() {
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [design, setDesign] = useState<DesignState>(INITIAL_DESIGN);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState(0);
  const [provider, setProvider] = useState('');
  const [quoteFor, setQuoteFor] = useState<Variation | null>(null);

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
  const generateLabel =
    design.source === 'render' && design.styleIds.length === 0 ? 'Make it photoreal' : `Generate ${count} design${count > 1 ? 's' : ''}`;
  const hasRequest =
    design.source === 'render' ||
    design.styleIds.length > 0 ||
    Object.keys(design.changes).length > 0 ||
    design.extras.length > 0 ||
    design.notes.trim() !== '';

  async function handleFile(file: File, source?: DesignState['source']) {
    setError('');
    try {
      setPhoto(await prepareImage(file));
      setResult(null);
      // A render usually only needs to become photoreal, so start it with no styles picked.
      if (source === 'render') setDesign((d) => ({ ...d, source, styleIds: [] }));
      if (source === 'photo') setDesign((d) => ({ ...d, source, styleIds: d.styleIds.length ? d.styleIds : INITIAL_DESIGN.styleIds }));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(message(err));
    }
  }

  async function generate() {
    if (!photo) return;
    setBusy(true);
    setError('');
    setResult(null);
    // On phones the image is above the options, so bring it into view.
    if (window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const response = await redesign({ image: photo.dataUrl, width: photo.width, height: photo.height, ...design });
      setResult({ before: photo.dataUrl, ratio: photo.width / photo.height, variations: response.variations });
      // Show the first design that worked.
      setSelected(Math.max(0, response.variations.findIndex((v) => v.image)));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  // Use a generated design as the new starting image, for step-by-step edits.
  async function refine(v: Variation) {
    if (!v.image) return;
    try {
      const file = await fileFromUrl(v.image, `${v.label}-design.jpg`);
      setPhoto(await prepareImage(file));
      setDesign((d) => ({ ...d, source: 'photo', styleIds: [], changes: {}, extras: [], notes: '' }));
      setResult(null);
    } catch (err) {
      setError(message(err));
    }
  }

  if (!photo) {
    return (
      <>
        <Hero onFile={handleFile} />
        {error && (
          <p className="alert alert-error hero-error" role="alert">
            {error}
          </p>
        )}
        <Banner provider={provider} />
      </>
    );
  }

  return (
    <div className="studio-app">
      <StudioBar
        photo={photo}
        design={design}
        onDesign={(patch) => setDesign((d) => ({ ...d, ...patch }))}
        onFile={(f) => handleFile(f)}
        onStartOver={() => {
          setPhoto(null);
          setResult(null);
          setError('');
        }}
      />
      <Banner provider={provider} />

      <div className="studio-body">
        <aside className="panel" aria-label="Design options">
          <DesignPanel value={design} onChange={setDesign} />
          <div className="panel-actions">
            {error && (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-block" disabled={busy || !hasRequest} onClick={generate}>
              {busy ? (
                <>
                  <span className="spinner" /> Designing… {elapsed}s
                </>
              ) : (
                generateLabel
              )}
            </button>
            {!hasRequest && <p className="hint">Pick a style or a finish to continue.</p>}
          </div>
        </aside>

        <Viewer
          before={result?.before ?? photo.dataUrl}
          ratio={result?.ratio ?? photo.width / photo.height}
          busy={busy}
          elapsed={elapsed}
          pending={count}
          generateLabel={generateLabel}
          variations={result?.variations ?? null}
          selected={selected}
          onSelect={setSelected}
          debug={DEBUG}
          onRefine={refine}
          onQuote={setQuoteFor}
        />
      </div>

      <QuoteModal variation={quoteFor} onClose={() => setQuoteFor(null)} />
    </div>
  );
}

function Banner({ provider }: { provider: string }) {
  if (provider === 'mock') {
    return (
      <p className="alert alert-warn notice">
        <strong>Demo mode:</strong> no AI key is set, so designs show your image unchanged. Add XAI_API_KEY to .env for real results.
      </p>
    );
  }
  if (provider === 'offline') {
    return <p className="alert alert-error notice">The server is not reachable. Please try again in a moment.</p>;
  }
  return null;
}
