import { FileDrop } from '../../../components/ui/FileDrop';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onFile: (file: File) => void;
  error: string;
}

const STEPS = [
  ['Generate', 'Empty room? Pick a style and its colours: up to four designed concepts, walls and windows kept.'],
  ['Mark & edit', 'Mark one part, then change it, add an object or remove one. Only the marked area changes.'],
  ['Standard', 'New finishes for the whole room, or start from a style, with options A–D to compare.'],
  ['Final 2K image', 'Every change stacks on the last. At the end, one realism pass at 2K, then download.'],
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
          Upload the customer's room photo or a Cabinet Vision image. Generate concepts for an empty room, or change one part at a time
          while the rest stays exactly as it is. Nothing here is saved: to keep results, work in a project room.
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
