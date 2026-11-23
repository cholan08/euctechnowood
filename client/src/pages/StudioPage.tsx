import { useEffect, useMemo, useRef, useState } from 'react';
import { ELEMENTS, ROOM_TYPES, describeSelection, elementsFor, resolveSelection, type Point, type RoomTypeId } from '../../../shared/catalog';
import type { Variation } from '../../../shared/types';
import { editImage, finalImage, getHealth, redesign } from '../api/studio';
import { AppBar } from '../components/layout/AppBar';
import { ChangePanel, type ChangeRequest } from '../components/studio/ChangePanel';
import { DesignPanel } from '../components/studio/DesignPanel';
import type { Tool } from '../components/studio/MaskEditor';
import { SourceCard } from '../components/studio/SourceCard';
import { StartScreen } from '../components/studio/StartScreen';
import { Viewer, type Busy, type View } from '../components/studio/Viewer';
import { Icon } from '../components/ui/Icon';
import { EMPTY_DRAFT, type DesignStep, type Draft, type Final, type MarkStep, type Mode, type Step } from '../lib/change';
import { fitToFrame, pasteBack } from '../lib/composite';
import { countVariant, EMPTY_DESIGN, type DesignState } from '../lib/design';
import { designFileName, downloadImage, finalFileName, revokeImages, toBlobUrls } from '../lib/download';
import { ITEM_MAX_SIDE, prepareImage, toDataUrl, type PreparedImage } from '../lib/image';
import { maskStats, type MaskOp } from '../lib/mask';

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Open the page with ?debug to see the AI prompt and timing for each change.
const DEBUG = new URLSearchParams(window.location.search).has('debug');
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const onPhone = () => window.matchMedia('(max-width: 900px)').matches;

/** A Mark & edit change: the part (if picked), a finish or staff's own words (and an item photo), and the mark. */
interface MarkChange {
  part: string | null;
  finish?: MarkStep['finish'];
  text?: string;
  reference?: string;
  ops: MaskOp[];
}

function revokeStep(s: Step) {
  if (s.kind === 'design') revokeImages(s.variations);
  else URL.revokeObjectURL(s.image);
}

/** How a Standard option reads in the list of changes. */
function describeOption(v: Variation): Pick<Step, 'label' | 'value' | 'hex'> {
  return { label: v.label, value: v.specs.length ? v.specs.map((s) => s.label).join(', ') : 'Photoreal', hex: v.specs.find((s) => s.hex)?.hex };
}

export default function StudioPage() {
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [roomType, setRoomType] = useState<RoomTypeId>('kitchen');
  const [mode, setMode] = useState<Mode>('mark');
  // Applied changes from both modes, oldest first. The last one's image is what the photo looks like now.
  const [steps, setSteps] = useState<Step[]>([]);
  const [final, setFinal] = useState<Final | null>(null);
  // Mark & edit: the next change being set up.
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushPct, setBrushPct] = useState(3);
  // Standard: the spec (options A–D), which option the panel edits, and a part whose position is being picked.
  const [design, setDesign] = useState<DesignState>(EMPTY_DESIGN);
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);

  const [view, setView] = useState<View>('edit');
  const [busy, setBusy] = useState<Busy | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  // Image URLs already downloaded. Nothing is stored anywhere else.
  const [downloaded, setDownloaded] = useState<ReadonlySet<string>>(new Set());
  const [provider, setProvider] = useState('');
  // Bumped when the photo is replaced, so a late answer for the old photo is thrown away.
  const session = useRef(0);

  const last = steps.at(-1);
  const current = last?.image ?? photo?.dataUrl ?? '';
  // The final image only counts while it was made from what is on screen now.
  const freshFinal = final && final.from === current ? final : null;
  const saved = downloaded.has(current);
  const unsaved = Boolean(last || freshFinal) && !saved && !(freshFinal && downloaded.has(freshFinal.image));
  const roomLabel = ROOM_TYPES.find((r) => r.id === roomType)?.label ?? 'room';

  // Mark & edit
  const element = elementsFor(roomType).find((e) => e.id === draft.part) ?? null;
  const marked = useMemo(() => (photo ? maskStats(draft.ops, photo.width, photo.height) : { coverage: 0, box: null }), [draft.ops, photo]);
  const done = useMemo(
    () => new Set(steps.flatMap((s) => (s.kind === 'mark' ? (s.part ? [s.part] : []) : Object.keys(s.design.variants[s.chosen]?.elements ?? {})))),
    [steps],
  );
  const markHint = !marked.box
    ? element
      ? `Mark the ${element.label.toLowerCase()} on the photo.`
      : 'Pick the part to change, then mark it on the photo.'
    : draft.reference
      ? 'Press → to put the item from your photo in the marked area.'
      : element
        ? 'Click a change above to make it.'
        : 'Pick the part, or describe the change in your own words.';

  // Standard
  const counts = design.variants.map((v) => countVariant(v, roomType));
  const activeCount = counts[active] ?? counts[0];
  // A render with no changes is still a job: "make it photoreal". A photo needs at least one change per option.
  const emptyOption = design.source === 'photo' ? design.variants.find((_, i) => counts[i].total === 0) : undefined;
  const optionCount = design.variants.length;
  const generateLabel =
    design.source === 'render' && counts.every((c) => c.total === 0) ? 'Make it photoreal' : optionCount > 1 ? `Generate ${optionCount} options` : 'Generate design';
  // Generating again replaces the last Standard design instead of stacking a second one on it.
  const replacesDesign = last?.kind === 'design';
  const canGenerate = Boolean(photo) && !busy && !emptyOption;

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
  useEffect(() => setPicking(null), [active, roomType, photo, mode]);

  // Results exist only in this tab, so warn before closing or reloading it.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  /** True when nothing undownloaded would be lost, or the user agrees to lose it. */
  function confirmDiscard() {
    return !unsaved || window.confirm('The latest result has not been downloaded and will be lost. Continue?');
  }

  function dropFinal() {
    if (final) URL.revokeObjectURL(final.image);
    setFinal(null);
  }

  function resetSession(next: PreparedImage | null) {
    session.current++;
    steps.forEach(revokeStep);
    setSteps([]);
    dropFinal();
    setDownloaded(new Set());
    setDraft(EMPTY_DRAFT);
    setDesign((d) => ({ ...EMPTY_DESIGN, source: d.source }));
    setActive(0);
    setView('edit');
    setError('');
    setPhoto(next);
  }

  async function handleFile(file: File) {
    if (busy || (photo && !confirmDiscard())) return;
    setError('');
    try {
      resetSession(await prepareImage(file));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(message(err));
    }
  }

  function newSession() {
    if (!busy && confirmDiscard()) resetSession(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setView('edit');
    setError('');
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setView('edit');
  }

  function changeRoom(room: RoomTypeId) {
    setRoomType(room);
    // Parts differ per room: drop a picked part that this room doesn't have.
    if (draft.part && !elementsFor(room).some((e) => e.id === draft.part)) setDraft((d) => ({ ...d, part: null, finish: undefined }));
  }

  /** Adds a change to the stack, or swaps the last one (`replace`: Try again, or a new Standard design). */
  function commit(step: Step, replace: boolean) {
    const before = replace ? steps.slice(0, -1) : steps;
    if (replace && last) revokeStep(last);
    dropFinal();
    setSteps([...before, step]);
    setView('compare');
  }

  /** Starts an AI job; `work` returns false if its answer came too late (the photo was replaced). */
  async function track(job: Busy, work: (stillHere: () => boolean) => Promise<void>) {
    const ticket = session.current;
    setBusy(job);
    setError('');
    // On phones the image is above the panel, so bring it into view.
    if (onPhone()) window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      await work(() => ticket === session.current);
    } catch (err) {
      if (ticket === session.current) setError(message(err));
    } finally {
      setBusy(null);
    }
  }

  /** Mark & edit: sends one change to the AI and pastes back only the marked area. */
  function runMark(change: MarkChange, base: string, replace: boolean) {
    if (!photo || busy) return;
    const el = change.part ? (ELEMENTS.find((e) => e.id === change.part) ?? null) : null;
    const resolved = el && change.finish ? resolveSelection(el, change.finish) : null;
    const text = resolved ? '' : (change.text ?? '').trim();
    const reference = resolved ? undefined : change.reference;
    const box = maskStats(change.ops, photo.width, photo.height).box;
    if (!box || (!resolved && !text && !reference)) return;
    const label = reference ? (el ? `${el.label} from photo` : 'Item from photo') : (el?.label ?? 'Marked area');

    void track({ kind: 'mark', label, title: reference ? 'Putting the item from your photo in place…' : undefined, count: 1, base }, async (stillHere) => {
      const response = await editImage({
        image: await toDataUrl(base),
        width: photo.width,
        height: photo.height,
        roomType,
        part: el?.id,
        finish: resolved ? change.finish : undefined,
        text: text || undefined,
        reference,
        area: box,
      });
      const image = await pasteBack(base, response.image, change.ops, photo.width, photo.height);
      if (!stillHere()) return URL.revokeObjectURL(image);
      const spec = resolved ? describeSelection(resolved) : { value: text ? `“${text}”` : 'Placed from the photo', hex: undefined };
      commit(
        {
          kind: 'mark',
          id: newId(),
          part: el?.id ?? null,
          finish: resolved ? change.finish : undefined,
          text: text || undefined,
          reference,
          ops: change.ops,
          before: base,
          image,
          label,
          value: spec.value,
          hex: spec.hex,
          prompt: response.prompt,
          ms: response.ms,
        },
        replace,
      );
      if (!replace) setDraft(EMPTY_DRAFT);
    });
  }

  /** Mark & edit: a suggestion, the custom finish, typed words or an item photo, on the marked area. */
  function applyChange(req: ChangeRequest) {
    runMark({ part: draft.part, finish: req.finish, text: req.text, reference: req.reference, ops: draft.ops }, current, false);
  }

  /** Standard: options A–D of the spec, each a whole new image. */
  function runDesign(spec: DesignState, base: string, replace: boolean) {
    if (!photo || busy) return;
    void track({ kind: 'design', label: '', count: spec.variants.length, base }, async (stillHere) => {
      const response = await redesign({ image: await toDataUrl(base), width: photo.width, height: photo.height, roomType, ...spec });
      const variations = await toBlobUrls(response.variations);
      if (!stillHere()) return revokeImages(variations);
      const chosen = variations.findIndex((v) => v.image);
      const failed = variations.filter((v) => !v.image);
      if (chosen < 0) {
        revokeImages(variations);
        throw new Error(failed[0]?.error ?? 'No design could be made. Please try again.');
      }
      const v = variations[chosen];
      const step: DesignStep = {
        kind: 'design',
        id: newId(),
        design: structuredClone(spec),
        variations,
        chosen,
        before: base,
        image: v.image!,
        ...describeOption(v),
        prompt: v.prompt,
        ms: v.ms,
      };
      commit(step, replace);
      if (failed.length) setError(`${failed.map((f) => f.label).join(', ')} didn't work: ${failed[0].error ?? 'no image was returned'}`);
    });
  }

  function generate() {
    if (!canGenerate) return;
    setPicking(null);
    const base = replacesDesign ? last!.before : current;
    runDesign(design, base, replacesDesign);
  }

  /** Standard: use another option of the last design. Options share the image they were made from. */
  function choose(index: number) {
    if (last?.kind !== 'design' || busy) return;
    const v = last.variations[index];
    if (!v?.image) return;
    dropFinal();
    setSteps([...steps.slice(0, -1), { ...last, chosen: index, image: v.image, ...describeOption(v), prompt: v.prompt, ms: v.ms }]);
    setActive(Math.min(index, design.variants.length - 1));
  }

  /** The last step: the AI sharpens the whole image to a realistic 2K photo. */
  function runFinal() {
    if (!photo || busy) return;
    const base = current;
    void track({ kind: 'final', label: '', count: 1, base }, async (stillHere) => {
      const response = await finalImage({ image: await toDataUrl(base), width: photo.width, height: photo.height, roomType });
      const fitted = await fitToFrame(base, response.image, photo.width, photo.height);
      if (!stillHere()) return URL.revokeObjectURL(fitted.url);
      if (final) URL.revokeObjectURL(final.image);
      setFinal({ id: newId(), from: base, image: fitted.url, width: fitted.width, height: fitted.height, prompt: response.prompt, ms: response.ms });
      setView('final');
    });
  }

  /** Makes the last change again from the same starting image: the AI gives a different result each time. */
  function retry() {
    if (!last) return;
    if (last.kind === 'mark') runMark({ part: last.part, finish: last.finish, text: last.text, reference: last.reference, ops: last.ops }, last.before, true);
    else runDesign(last.design, last.before, true);
  }

  /** Removes the last change and puts its settings back in the panel, ready to adjust. */
  function undo() {
    if (!last || busy) return;
    setSteps(steps.slice(0, -1));
    dropFinal();
    if (last.kind === 'mark') {
      setDraft({ part: last.part, finish: last.finish, text: last.text ?? '', reference: last.reference ? { dataUrl: last.reference, name: 'item' } : undefined, ops: last.ops });
      setMode('mark');
    } else {
      setDesign(last.design);
      setActive(Math.min(last.chosen, last.design.variants.length - 1));
      setMode('standard');
    }
    setView('edit');
    setError('');
    revokeStep(last);
  }

  function markDownloaded(url: string) {
    setDownloaded((prev) => new Set(prev).add(url));
  }

  function download() {
    if (!last) return;
    downloadImage(current, designFileName(roomLabel, steps.length));
    markDownloaded(current);
  }

  function downloadFinal() {
    if (!freshFinal) return;
    downloadImage(freshFinal.image, finalFileName(roomLabel));
    markDownloaded(freshFinal.image);
  }

  // Standard: "only this one" positions.
  function startPicking(elementId: string) {
    setPicking(elementId);
    setView('edit');
    if (onPhone()) window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Keyboard and clipboard shortcuts. Re-bound each render so they always see the latest state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && picking) {
        setPicking(null);
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (mode === 'standard') generate();
        else if (draft.finish && element && resolveSelection(element, draft.finish)) applyChange({ finish: draft.finish });
        else if (draft.text.trim() || draft.reference) applyChange({ text: draft.text, reference: draft.reference?.dataUrl });
        return;
      }
      // Ctrl+Z takes back the last brush stroke. Applied changes have their own Undo button.
      if (mode === 'mark' && e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isTyping(e.target) && draft.ops.length && !busy) {
        e.preventDefault();
        updateDraft({ ops: draft.ops.slice(0, -1) });
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files[0];
      if (!file || !file.type.startsWith('image/') || busy) return;
      e.preventDefault();
      // With an area marked, a pasted image is the item to put there ("this sofa"), not a new room photo.
      if (photo && mode === 'mark' && marked.box) {
        prepareImage(file, ITEM_MAX_SIDE)
          .then((img) => updateDraft({ reference: { dataUrl: img.dataUrl, name: file.name } }))
          .catch((err: unknown) => setError(message(err)));
        return;
      }
      void handleFile(file);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  });

  if (!photo) {
    return (
      <div className="app">
        <AppBar provider={provider} />
        <StartScreen onFile={handleFile} error={error} />
      </div>
    );
  }

  // Standard: parts of the option being edited that are pinned to one place in the image.
  const editing = design.variants[active] ?? design.variants[0];
  const markers =
    mode === 'standard'
      ? elementsFor(roomType).flatMap((e) => {
          const area = editing.elements[e.id]?.area;
          return area ? [{ id: e.id, label: e.label, ...area }] : [];
        })
      : [];

  const errorAlert = error && (
    <p className="alert alert-error" role="alert">
      <Icon name="alert" size={16} />
      {error}
    </p>
  );

  return (
    <div className="app app-studio">
      <AppBar provider={provider}>
        <button type="button" className="btn btn-sm" onClick={newSession} disabled={Boolean(busy)}>
          <Icon name="plus" size={16} /> New photo
        </button>
      </AppBar>

      <div className="studio">
        <aside className="panel" aria-label={mode === 'mark' ? 'Next change' : 'Design options'}>
          <SourceCard
            photo={photo}
            roomType={roomType}
            onRoomType={changeRoom}
            onFile={handleFile}
            disabled={Boolean(busy)}
            mode={mode}
            onMode={switchMode}
            source={design.source}
            onSource={(source) => setDesign((d) => ({ ...d, source }))}
          />

          {mode === 'mark' ? (
            <>
              <div className="panel-body">
                <ChangePanel roomType={roomType} draft={draft} onDraft={updateDraft} marked={marked} done={done} busy={Boolean(busy)} onApply={applyChange} />
              </div>
              <div className="panel-foot">
                {errorAlert}
                <p className="foot-hint">
                  {busy ? (
                    <>
                      <span className="spinner" /> Working… {elapsed}s
                    </>
                  ) : (
                    markHint
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <DesignPanel roomType={roomType} value={design} onChange={setDesign} active={active} onActive={setActive} picking={picking} onPickArea={startPicking} />
              <div className="panel-foot">
                {errorAlert}
                <p className="summary">
                  <span>
                    <b>{editing.name}</b> · {activeCount.total ? plural(activeCount.total, 'change') : 'no changes'} ·{' '}
                    <span className="summary-locked">
                      <Icon name="lock" size={11} /> {activeCount.locked} kept
                    </span>
                  </span>
                  <span className="summary-out">→ {plural(optionCount, 'image')}</span>
                </p>
                <button type="button" className="btn btn-accent btn-lg btn-block" disabled={!canGenerate} onClick={generate}>
                  {busy ? (
                    <>
                      <span className="spinner" /> Working… {elapsed}s
                    </>
                  ) : (
                    <>
                      <Icon name="sparkle" size={18} /> {generateLabel}
                    </>
                  )}
                </button>
                {emptyOption ? (
                  <p className="foot-hint">{emptyOption.name} has no changes yet. Change at least one part of the room.</p>
                ) : (
                  replacesDesign && !busy && <p className="foot-hint">Replaces the last Standard design ({last!.label}).</p>
                )}
              </div>
            </>
          )}
        </aside>

        <Viewer
          mode={mode}
          original={photo.dataUrl}
          current={current}
          width={photo.width}
          height={photo.height}
          view={view}
          onView={setView}
          busy={busy}
          elapsed={elapsed}
          ops={draft.ops}
          onOps={(ops) => updateDraft({ ops })}
          tool={tool}
          onTool={(t) => {
            setTool(t);
            setView('edit');
          }}
          brushPct={brushPct}
          onBrushPct={setBrushPct}
          part={element?.label.toLowerCase() ?? null}
          picking={picking ? (elementsFor(roomType).find((e) => e.id === picking)?.label ?? null) : null}
          markers={markers}
          onPick={placeArea}
          onCancelPick={() => setPicking(null)}
          steps={steps}
          onChoose={choose}
          onUndo={undo}
          onRetry={retry}
          onDownload={download}
          saved={saved}
          unsaved={unsaved}
          final={freshFinal}
          onFinal={runFinal}
          onDownloadFinal={downloadFinal}
          debug={DEBUG}
        />
      </div>
    </div>
  );
}
