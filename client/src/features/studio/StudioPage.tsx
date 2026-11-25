import { Link } from 'react-router-dom';
import { AppBar } from '../../components/layout/AppBar';
import { Icon } from '../../components/ui/Icon';
import { ChangePanel } from './components/ChangePanel';
import { DesignPanel } from './components/DesignPanel';
import { GeneratePanel } from './components/GeneratePanel';
import { SourceCard } from './components/SourceCard';
import { StartScreen } from './components/StartScreen';
import { Viewer } from './components/Viewer';
import { useShortcuts } from './hooks/useShortcuts';
import { useStudio, type StudioOptions } from './hooks/useStudio';

// Layout only: the state and actions live in hooks/useStudio.ts.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Open the page with ?debug to see the AI prompt and timing for each change.
const DEBUG = new URLSearchParams(window.location.search).has('debug');

export default function StudioPage(options: StudioOptions) {
  const studio = useStudio(options);
  useShortcuts(studio);
  const { session, mark, standard, gen, mode, roomType, room } = studio;
  const { photo, busy, elapsed, error } = session;

  if (!photo) {
    return (
      <div className="app">
        <AppBar />
        <StartScreen onFile={studio.openPhoto} error={error} />
      </div>
    );
  }

  const crumb = room && (
    <Link to={`/rooms/${room.roomId}`} className="crumb-link" title="Back to the room: history, saved designs, presentation board">
      <Icon name="back" size={13} /> {room.clientName} · {room.roomName}
    </Link>
  );

  const errorAlert = error && (
    <p className="alert alert-error" role="alert">
      <Icon name="alert" size={16} />
      {error}
    </p>
  );

  const working = (
    <>
      <span className="spinner" /> Working… {elapsed}s
    </>
  );

  return (
    <div className="app app-studio">
      <AppBar crumb={crumb}>
        {!room && (
          <button type="button" className="btn btn-sm" onClick={studio.newPhoto} disabled={Boolean(busy)}>
            <Icon name="plus" size={16} /> New photo
          </button>
        )}
      </AppBar>

      <div className="studio">
        <aside className="panel" aria-label={mode === 'mark' ? 'Next change' : mode === 'generate' ? 'Generate concepts' : 'Design options'}>
          <SourceCard
            photo={photo}
            roomType={roomType}
            onRoomType={studio.changeRoom}
            onFile={studio.openPhoto}
            disabled={Boolean(busy)}
            mode={mode}
            onMode={studio.switchMode}
            source={standard.design.source}
            onSource={standard.setSource}
            locked={Boolean(room)}
          />

          {mode === 'mark' ? (
            <>
              <div className="panel-body">
                <ChangePanel roomType={roomType} draft={mark.draft} onDraft={mark.update} marked={mark.marked} done={mark.done} busy={Boolean(busy)} onApply={mark.apply} />
              </div>
              <div className="panel-foot">
                {errorAlert}
                <p className="foot-hint">{busy ? working : mark.hint}</p>
              </div>
            </>
          ) : mode === 'generate' ? (
            <>
              <div className="panel-body">
                <GeneratePanel roomType={roomType} gen={gen} />
              </div>
              <div className="panel-foot">
                {errorAlert}
                <button type="button" className="btn btn-accent btn-lg btn-block" disabled={!gen.canGenerate} onClick={gen.generate}>
                  {busy ? (
                    working
                  ) : (
                    <>
                      <Icon name="sparkle" size={18} /> Generate {plural(gen.spec.concepts.length, 'concept')}
                    </>
                  )}
                </button>
                {gen.replaces && !busy && <p className="foot-hint">Replaces the last set of concepts.</p>}
              </div>
            </>
          ) : (
            <>
              <DesignPanel
                roomType={roomType}
                value={standard.design}
                onChange={standard.setDesign}
                active={standard.active}
                onActive={standard.setActive}
                picking={standard.picking}
                onPickArea={standard.startPicking}
              />
              <div className="panel-foot">
                {errorAlert}
                <p className="summary">
                  <span>
                    <b>{standard.editing.name}</b> · {standard.activeCount.total ? plural(standard.activeCount.total, 'change') : 'no changes'} ·{' '}
                    <span className="summary-locked">
                      <Icon name="lock" size={11} /> {standard.activeCount.locked} kept
                    </span>
                  </span>
                  <span className="summary-out">→ {plural(standard.optionCount, 'image')}</span>
                </p>
                <button type="button" className="btn btn-accent btn-lg btn-block" disabled={!standard.canGenerate} onClick={standard.generate}>
                  {busy ? (
                    working
                  ) : (
                    <>
                      <Icon name="sparkle" size={18} /> {standard.generateLabel}
                    </>
                  )}
                </button>
                {standard.emptyOption ? (
                  <p className="foot-hint">{standard.emptyOption.name} has no changes yet. Change at least one part of the room.</p>
                ) : (
                  standard.replacesDesign && !busy && <p className="foot-hint">Replaces the last Standard design ({session.last!.label}).</p>
                )}
              </div>
            </>
          )}
        </aside>

        <Viewer
          mode={mode}
          original={photo.dataUrl}
          current={session.current}
          width={photo.width}
          height={photo.height}
          view={session.view}
          onView={session.setView}
          busy={busy}
          elapsed={elapsed}
          ops={mark.draft.ops}
          onOps={(ops) => mark.update({ ops })}
          tool={mark.tool}
          onTool={mark.pickTool}
          brushPct={mark.brushPct}
          onBrushPct={mark.setBrushPct}
          part={mark.element?.label.toLowerCase() ?? null}
          picking={standard.pickingLabel}
          markers={standard.markers}
          onPick={standard.placeArea}
          onCancelPick={standard.cancelPicking}
          steps={session.steps}
          onChoose={studio.choose}
          onUndo={studio.undo}
          onRetry={studio.retry}
          onDownload={studio.download}
          saved={session.saved}
          unsaved={session.unsaved}
          final={session.final}
          onFinal={studio.runFinal}
          onDownloadFinal={studio.downloadFinal}
          debug={DEBUG}
          store={session.store}
          onSaveDesign={(which) => void studio.saveDesign(which)}
          isSaved={studio.isSavedDesign}
        />
      </div>
    </div>
  );
}
