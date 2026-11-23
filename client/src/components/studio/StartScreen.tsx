import { FileDrop } from '../ui/FileDrop';
import { Icon } from '../ui/Icon';

interface Props {
  onFile: (file: File) => void;
  error: string;
}

const STEPS = [
  ['Mark & edit', 'Mark one part on the photo, then click a suggested change. Only the marked area changes.'],
  ['Or Standard', 'Set new finishes for the whole room, with options A–D to compare.'],
  ['Mix both', 'Every change stacks on the last one. Undo or try again at any step.'],
  ['Final 2K image', 'At the end, one realism pass at 2K, then download.'],
] as const;

const TIPS = ['Daylight, with the room lights on', 'Phone held level, normal 1× lens', 'Whole room in frame, no people'];

/** First screen of a session: upload the customer's photo. Fits one screen on desktop. */
export function StartScreen({ onFile, error }: Props) {
  return (
    <main className="start">
      <section className="start-main">
        <p className="eyebrow">New session</p>
        <h1>Change exactly what the customer asks.</h1>
        <p className="start-sub">
          Upload the customer's room photo or a Cabinet Vision image. Mark one part at a time and pick its change, or set the whole room
          in Standard mode. Finish with a realistic 2K image.
        </p>

        <FileDrop onFile={onFile} className="drop-tile">
          <span className="drop-icon">
            <Icon name="photo" size={22} />
          </span>
          <span className="drop-text">
            <strong>Upload the photo</strong>
            <span className="drop-desc">JPG, PNG or WebP · drag it here, or paste with <kbd>Ctrl</kbd> <kbd>V</kbd></span>
          </span>
          <span className="drop-cta">
            <Icon name="upload" size={16} /> Choose photo
          </span>
        </FileDrop>

        {error && (
          <p className="alert alert-error" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </p>
        )}

        <ol className="flow">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>

        <p className="tips">
          <span className="eyebrow">Best photos</span>
          {TIPS.join(' · ')}
        </p>
      </section>
    </main>
  );
}
