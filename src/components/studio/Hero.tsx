import type { RedesignRequest } from '../../../shared/types';
import { FileDrop } from '../ui/FileDrop';
import { CompareSlider } from './CompareSlider';

type Source = RedesignRequest['source'];

interface Props {
  onFile: (file: File, source: Source) => void;
}

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3M12 16V4M7 9l5-5 5 5" />
  </svg>
);

export function Hero({ onFile }: Props) {
  return (
    <>
      <section className="hero">
        <div className="hero-inner container">
          <p className="hero-badge">
            <span className="dot" aria-hidden="true" />
            AI Room Studio by EUC Technowood
          </p>
          <h1>
            See it designed.
            <span>Before it's built.</span>
          </h1>
          <p className="hero-sub">
            Turn a room photo or a Cabinet Vision render into photoreal interior designs in under a minute. Compare styles,
            finishes and colours, then request a quote.
          </p>

          <div className="mode-cards">
            <FileDrop onFile={(f) => onFile(f, 'photo')} className="mode-card">
              <span className="mode-kicker">For homeowners & showrooms</span>
              <strong>Redesign a room photo</strong>
              <span className="mode-desc">Upload a kitchen, hall or bedroom photo and see it in new styles and finishes.</span>
              <span className="btn btn-gold mode-btn">
                <UploadIcon /> Upload room photo
              </span>
            </FileDrop>

            <FileDrop onFile={(f) => onFile(f, 'render')} className="mode-card">
              <span className="mode-kicker">
                <img src="/brand/cabinet-vision-icon.png" alt="" width={18} height={18} /> For Cabinet Vision users
              </span>
              <strong>Make a render photoreal</strong>
              <span className="mode-desc">Upload a Cabinet Vision 3D render and get a photo-quality image to show your client.</span>
              <span className="btn mode-btn">
                <UploadIcon /> Upload render
              </span>
            </FileDrop>
          </div>
          <p className="hero-note">JPG, PNG or WebP · or drag a file onto either card</p>

          <div className="showcase">
            <CompareSlider
              before="/brand/design.jpg"
              after="/brand/manufactured.jpg"
              ratio={1600 / 806}
              label="Cabinet Vision design to photoreal kitchen"
              beforeLabel="Cabinet Vision design"
              afterLabel="Photoreal"
            />
            <p>Drag to compare</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how container">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <b>01</b>
            <strong>Upload</strong>
            <span>A clear photo of the room, or a 3D render exported from Cabinet Vision.</span>
          </li>
          <li>
            <b>02</b>
            <strong>Choose the look</strong>
            <span>Pick up to four styles, plus wall colour, shutters, countertop, flooring and extras.</span>
          </li>
          <li>
            <b>03</b>
            <strong>Compare and get a quote</strong>
            <span>Slide between before and after for every style, then request a quote for the one you like.</span>
          </li>
        </ol>

        <aside className="tips">
          <strong>Tips for the best photo</strong>
          <ul>
            <li>Shoot in daylight with the lights on</li>
            <li>Stand in a corner and hold the phone level</li>
            <li>Use the normal 1× lens, not ultra-wide</li>
            <li>Show the whole room, with no people in it</li>
          </ul>
        </aside>
      </section>
    </>
  );
}
