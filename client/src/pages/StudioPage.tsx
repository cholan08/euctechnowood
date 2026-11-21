import { useEffect, useRef, useState } from 'react';
import { elementsFor, type Point } from '../../../shared/catalog';
import type { Variation } from '../../../shared/types';
import { getHealth, redesign } from '../api/studio';
import { AppBar } from '../components/layout/AppBar';
import { DesignPanel } from '../components/studio/DesignPanel';
import { SourceCard } from '../components/studio/SourceCard';
import { StartScreen } from '../components/studio/StartScreen';
import { Viewer } from '../components/studio/Viewer';
import { Icon } from '../components/ui/Icon';
import { downloadDesign, revokeBlobUrls, toBlobUrls } from '../lib/download';
import { countVariant, emptyVariant, type DesignState } from '../lib/design';
import { fileFromUrl, prepareImage, type PreparedImage } from '../lib/image';

const INITIAL_DESIGN: DesignState = {
  source: 'photo',
  roomType: 'kitchen',
  variants: [emptyVariant(0)],
};

interface Result {
  before: string;
  ratio: number;
  variations: Variation[];
}

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
// Open the page with ?debug to see the AI prompt and timing for each design.
const DEBUG = new URLSearchParams(window.location.search).has('debug');
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export default function StudioPage() {
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [design, setDesign] = useState<DesignState>(INITIAL_DESIGN);
  // Which option (A–D) the panel is editing.
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState(0);
  const [downloaded, setDownloaded] = useState<ReadonlySet<string>>(new Set());
  const [provider, setProvider] = useState('');
  // A part whose position staff are clicking on the image ("only this wall").
  const [picking, setPicking] = useState<string | null>(null);
  // The result whose blob URLs are alive, so they can be freed when it is replaced.
  const liveResult = useRef<Result | null>(null);

  const ready = result?.variations.filter((v) => v.image) ?? [];
  const unsaved = ready.filter((v) => !downloaded.has(v.id)).length;

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

  // Picking belongs to one part of one option in one image: stop it when any of those change.
  useEffect(() => setPicking(null), [active, design.roomType, photo]);

  // Designs exist only in this tab, so warn before closing or reloading it.
  useEffect(() => {
    if (unsaved === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  function replaceResult(next: Result | null) {
    if (liveResult.current) revokeBlobUrls(liveResult.current.variations);
    liveResult.current = next;
    setResult(next);
    setDownloaded(new Set());
  }

  /** True when nothing undownloaded would be lost, or the user agrees to lose it. */
  function confirmDiscard() {
    if (unsaved === 0) return true;
    return window.confirm(`${plural(unsaved, 'design')} not downloaded will be lost. Continue?`);
  }

  const count = design.variants.length;
  const counts = design.variants.map((v) => countVariant(v, design.roomType));
  const current = counts[active] ?? counts[0];
  // A render with no changes is still a job: "make it photoreal". A photo needs at least one change per option.
  const emptyOption = design.source === 'photo' ? design.variants.find((_, i) => counts[i].total === 0) : undefined;
  const generateLabel =
    design.source === 'render' && counts.every((c) => c.total === 0)
      ? 'Make it photoreal'
      : count > 1
        ? `Generate ${count} options`
        : 'Generate design';
  const canGenerate = Boolean(photo) && !busy && !emptyOption;

  async function handleFile(file: File, source?: DesignState['source']) {
    if (photo && !confirmDiscard()) return;
    setError('');
    try {
      setPhoto(await prepareImage(file));
      replaceResult(null);
      if (source) setDesign((d) => ({ ...d, source }));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(message(err));
    }
  }

  function startPicking(elementId: string) {
    setPicking(elementId);
    // On phones the image is above the options.
    if (window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function placeArea(area: Point) {
    const id = picking;
    setPicking(null);
    if (!id) return;
    setDesign((d) => ({
      ...d,
      variants: d.variants.map((v, i) => (i === active && v.elements[id] ? { ...v, elements: { ...v.elements, [id]: { ...v.elements[id], area } } } : v)),
    }));
  }

  async function generate() {
    if (!photo || !canGenerate || !confirmDiscard()) return;
    setPicking(null);
    setBusy(true);
    setError('');
    replaceResult(null);
    // On phones the image is above the options, so bring it into view.
    if (window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const response = await redesign({ image: photo.dataUrl, width: photo.width, height: photo.height, ...design });
      const variations = await toBlobUrls(response.variations);
      replaceResult({ before: photo.dataUrl, ratio: photo.width / photo.height, variations });
      // Show the first design that worked.
      setSelected(Math.max(0, variations.findIndex((v) => v.image)));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  // Use a generated design as the new starting image, for step-by-step edits.
  async function refine(v: Variation) {
    if (!v.image || !confirmDiscard()) return;
    try {
      const file = await fileFromUrl(v.image, `${v.label}-design.jpg`);
      setPhoto(await prepareImage(file));
      // The design is now the starting image: start a clean spec on top of it.
      setDesign((d) => ({ ...d, source: 'photo', variants: [emptyVariant(0)] }));
      setActive(0);
      replaceResult(null);
    } catch (err) {
      setError(message(err));
    }
  }

  function download(v: Variation) {
    downloadDesign(v);
    setDownloaded((prev) => new Set(prev).add(v.id));
  }

  async function downloadAll() {
    for (const v of ready) {
      download(v);
      // Browsers block a burst of downloads; a short gap lets each one through.
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  function newSession() {
    if (!confirmDiscard()) return;
    setPhoto(null);
    setDesign(INITIAL_DESIGN);
    setActive(0);
    replaceResult(null);
    setError('');
  }

  // Keyboard and clipboard shortcuts. Re-bound each render so they always see the latest state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && picking) {
        setPicking(null);
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void generate();
        return;
      }
      if (isTyping(e.target) || !result || busy) return;
      const last = result.variations.length - 1;
      if (e.key === 'ArrowRight') setSelected((i) => Math.min(last, i + 1));
      if (e.key === 'ArrowLeft') setSelected((i) => Math.max(0, i - 1));
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files[0];
      if (!file || !file.type.startsWith('image/') || busy) return;
      e.preventDefault();
      void handleFile(file, photo ? undefined : 'photo');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  });

  // Parts of the option being edited that are pinned to one place in the image.
  const roomElements = elementsFor(design.roomType);
  const editing = design.variants[active] ?? design.variants[0];
  const markers = roomElements.flatMap((e) => {
    const area = editing.elements[e.id]?.area;
    return area ? [{ id: e.id, label: e.label, ...area }] : [];
  });

  if (!photo) {
    return (
      <div className="app">
        <AppBar provider={provider} />
        <StartScreen onFile={handleFile} error={error} />
      </div>
    );
  }


  return (
    <div className="app app-studio">
      <AppBar provider={provider}>
        <button type="button" className="btn btn-sm" onClick={newSession}>
          <Icon name="plus" size={16} /> New session
        </button>
      </AppBar>

      <div className="studio">
        <aside className="panel" aria-label="Design options">
          <SourceCard photo={photo} design={design} onDesign={(patch) => setDesign((d) => ({ ...d, ...patch }))} onFile={(f) => handleFile(f)} />
          <DesignPanel value={design} onChange={setDesign} active={active} onActive={setActive} picking={picking} onPickArea={startPicking} />
          <div className="panel-foot">
            {error && (
              <p className="alert alert-error" role="alert">
                <Icon name="alert" size={16} />
                {error}
              </p>
            )}
            <p className="summary">
              <span>
                <b>{design.variants[active]?.name}</b> · {current.total ? plural(current.total, 'change') : 'no changes'} ·{' '}
                <span className="summary-locked">
                  <Icon name="lock" size={11} /> {current.locked} kept
                </span>
              </span>
              <span className="summary-out">
                → {plural(count, 'image')}
              </span>
            </p>
            <button type="button" className="btn btn-accent btn-lg btn-block" disabled={!canGenerate} onClick={generate}>
              {busy ? (
                <>
                  <span className="spinner" /> Designing… {elapsed}s
                </>
              ) : (
                <>
                  <Icon name="sparkle" size={18} /> {generateLabel}
                </>
              )}
            </button>
            {emptyOption && <p className="foot-hint">{emptyOption.name} has no changes yet. Change at least one part of the room.</p>}
          </div>
        </aside>

        <Viewer
          before={result?.before ?? photo.dataUrl}
          ratio={result?.ratio ?? photo.width / photo.height}
          busy={busy}
          elapsed={elapsed}
          pending={count}
          variations={result?.variations ?? null}
          selected={selected}
          onSelect={setSelected}
          debug={DEBUG}
          onRefine={refine}
          downloaded={downloaded}
          onDownload={download}
          onDownloadAll={downloadAll}
          picking={picking ? (roomElements.find((e) => e.id === picking)?.label ?? null) : null}
          markers={markers}
          onPick={placeArea}
          onCancelPick={() => setPicking(null)}
        />
      </div>
    </div>
  );
}
