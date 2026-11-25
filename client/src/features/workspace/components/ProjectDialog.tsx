import { useEffect, useState, type FormEvent } from 'react';
import type { Client, Project } from '@shared/workspace';
import { clients, projects } from '../../../api/workspace';
import { Dialog } from '../../../components/ui/Dialog';
import { errorText } from './common';

/** New project, for an existing client or a new one typed in place. */
export function ProjectDialog({ clientId, onClose, onSaved }: { clientId?: string; onClose: () => void; onSaved: (p: Project) => void }) {
  const [list, setList] = useState<Client[]>([]);
  const [client, setClient] = useState(clientId ?? '');
  const [newClient, setNewClient] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const creating = !clientId && client === 'new';

  useEffect(() => {
    clients
      .list()
      .then((l) => {
        setList(l);
        if (!clientId) setClient(l[0]?.id ?? 'new');
      })
      .catch((err: unknown) => setError(errorText(err)));
  }, [clientId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = creating ? (await clients.add({ name: newClient })).id : client;
      onSaved(await projects.add({ clientId: id, name, notes }));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Dialog title="New project" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!clientId && (
          <label className="form-field">
            <span>Client</span>
            <select value={client} onChange={(e) => setClient(e.target.value)}>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
              <option value="new">+ New client…</option>
            </select>
          </label>
        )}
        {creating && (
          <label className="form-field">
            <span>New client's name</span>
            <input value={newClient} onChange={(e) => setNewClient(e.target.value)} required maxLength={120} placeholder="e.g. Mr. & Mrs. Raman" />
            <small>Add the phone and address later on the client's page.</small>
          </label>
        )}
        <label className="form-field">
          <span>Project name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="e.g. 3BHK, Anna Nagar" />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Scope, budget, deadline…" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={busy}>
            Create project
          </button>
        </div>
      </form>
    </Dialog>
  );
}
