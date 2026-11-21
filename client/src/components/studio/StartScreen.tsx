import type { RedesignRequest } from '../../../../shared/types';
import { FileDrop } from '../ui/FileDrop';
import { Icon } from '../ui/Icon';
import { CompareSlider } from './CompareSlider';

type Source = RedesignRequest['source'];

interface Props {
  onFile: (file: File, source: Source) => void;
  error: string;
}

const TIPS = [
  'Daylight, with the room lights on',
  'Stand in a corner, phone held level',
  'Normal 1× lens, not ultra-wide',
  'Whole room in frame, no people',
];

/** First screen of a session: pick what to upload. Fits one screen on desktop. */
export function StartScreen({ onFile, error }: Props) {
  return (
    <main className="start">
      <section className="start-main">
        <p className="eyebrow">New session</p>
        <h1>What are we designing today?</h1>
        <p className="start-sub">
          Drop in the customer's room photo or a Cabinet Vision render. Photoreal designs come back in under a minute, ready to
          compare and download.
        </p>

        <div className="drop-grid">
          <FileDrop onFile={(f) => onFile(f, 'photo')} className="drop-tile">
            <span className="drop-icon">
              <Icon name="photo" size={22} />
            </span>
            <strong>Room photo</strong>
            <span className="drop-desc">Restyle a real kitchen, hall or bedroom with new looks and finishes.</span>
            <span className="drop-cta">
              <Icon name="upload" size={16} /> Choose photo
            </span>
          </FileDrop>

          <FileDrop onFile={(f) => onFile(f, 'render')} className="drop-tile">
            <span className="drop-icon">
              <Icon name="cube" size={22} />
            </span>
            <strong>Cabinet Vision render</strong>
            <span className="drop-desc">Turn a 3D render into a photo-quality image for the customer.</span>
            <span className="drop-cta">
              <Icon name="upload" size={16} /> Choose render
            </span>
          </FileDrop>
        </div>

        <p className="start-hint">
          JPG, PNG or WebP · drag a file onto a tile, or paste with <kbd>Ctrl</kbd> <kbd>V</kbd>
        </p>

        {error && (
          <p className="alert alert-error" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </p>
        )}

        <div className="tips">
          <p className="eyebrow">For the best result</p>
          <ul>
            {TIPS.map((t, i) => (
              <li key={t}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <aside className="start-side" aria-label="Example">
        <figure className="showcase">
          <CompareSlider
            before="/brand/design.jpg"
            after="/brand/manufactured.jpg"
            ratio={1600 / 806}
            label="Cabinet Vision design to photoreal kitchen"
            beforeLabel="Cabinet Vision"
            afterLabel="Room Studio"
          />
          <figcaption>
            <span className="eyebrow">Example</span>
            <span>Drag across the image to compare</span>
          </figcaption>
        </figure>

        <ol className="flow">
          <li>
            <span className="eyebrow">01</span>
            <strong>Upload</strong>
            <span>A room photo or a render.</span>
          </li>
          <li>
            <span className="eyebrow">02</span>
            <strong>Choose the look</strong>
            <span>Up to four styles, plus finishes.</span>
          </li>
          <li>
            <span className="eyebrow">03</span>
            <strong>Download</strong>
            <span>Nothing is stored. Save what you keep.</span>
          </li>
        </ol>
      </aside>
    </main>
  );
}
