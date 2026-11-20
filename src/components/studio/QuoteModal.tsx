import { useState, type FormEvent } from 'react';
import type { Variation } from '../../../shared/types';
import { submitQuote } from '../../api/studio';
import { Modal } from '../ui/Modal';

interface Props {
  variation: Variation | null;
  onClose: () => void;
}

const empty = { name: '', phone: '', email: '', city: '', message: '' };

export function QuoteModal({ variation, onClose }: Props) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function close() {
    onClose();
    // Reset after the dialog is gone so the next quote starts clean.
    setTimeout(() => {
      setSent(false);
      setError('');
    }, 200);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!variation?.id) return;
    setBusy(true);
    setError('');
    try {
      await submitQuote({ designId: variation.id, ...form });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={variation !== null} onClose={close} label="Get a quote for this design">
      {variation &&
        (sent ? (
          <div className="modal-body">
            <div className="success">
              <span className="success-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              <h2>Thank you, {form.name.split(' ')[0]}!</h2>
              <p className="muted">
                We have your {variation.label} design. Our team will call you on {form.phone} to discuss your quote.
              </p>
              <button type="button" className="btn btn-primary" onClick={close}>
                Back to my designs
              </button>
            </div>
          </div>
        ) : (
          <form className="modal-body" onSubmit={submit}>
            <div>
              <h2 style={{ fontSize: 24 }}>Get a quote for this design</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                Share your details and our team will get back to you with a quote.
              </p>
            </div>

            <div className="quote-preview">
              <img src={variation.image} alt="" />
              <div>
                <strong>{variation.label} design</strong>
                <span>This design is attached to your request.</span>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Your name</span>
                <input className="input" required autoComplete="name" value={form.name} onChange={set('name')} />
              </label>
              <label className="field">
                <span>Mobile number</span>
                <input className="input" required type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={form.phone} onChange={set('phone')} />
              </label>
              <label className="field">
                <span>Email (optional)</span>
                <input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
              </label>
              <label className="field">
                <span>City (optional)</span>
                <input className="input" autoComplete="address-level2" value={form.city} onChange={set('city')} />
              </label>
              <label className="field wide">
                <span>Anything we should know? (optional)</span>
                <textarea rows={2} maxLength={500} value={form.message} onChange={set('message')} />
              </label>
            </div>

            {error && (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <span className="spinner" /> : 'Request my quote'}
            </button>
          </form>
        ))}
    </Modal>
  );
}
