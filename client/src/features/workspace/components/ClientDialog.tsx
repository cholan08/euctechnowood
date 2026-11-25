import { useState, type FormEvent } from 'react';
import type { Client, ClientInput } from '@shared/workspace';
import { clients } from '../../../api/workspace';
import { Dialog } from '../../../components/ui/Dialog';
import { errorText } from './common';

/** Add a client, or edit one. */
export function ClientDialog({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: (c: Client) => void }) {
  const [form, setForm] = useState<Required<ClientInput>>({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    notes: client?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ClientInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSaved(client ? await clients.update(client.id, form) : await clients.add(form));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Dialog title={client ? 'Edit client' : 'New client'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Name</span>
          <input value={form.name} onChange={set('name')} required maxLength={120} placeholder="e.g. Mr. & Mrs. Raman" />
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>Phone</span>
            <input value={form.phone} onChange={set('phone')} maxLength={40} inputMode="tel" />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} maxLength={200} />
          </label>
        </div>
        <label className="form-field">
          <span>Address / site</span>
          <input value={form.address} onChange={set('address')} maxLength={400} placeholder="e.g. Flat 4B, Anna Nagar, Chennai" />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea value={form.notes} onChange={set('notes')} maxLength={2000} rows={3} placeholder="Budget, likes and dislikes, family needs…" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {client ? 'Save' : 'Add client'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
