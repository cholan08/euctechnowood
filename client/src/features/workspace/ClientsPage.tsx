import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clients } from '../../api/workspace';
import { useAuth } from '../../app/auth';
import { Icon } from '../../components/ui/Icon';
import { ClientDialog } from './components/ClientDialog';
import { Empty, ErrorNote, Page, ago, plural, useLoad } from './components/common';

export default function ClientsPage() {
  const { canWork } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const { data, error, loading } = useLoad(() => clients.list(q.trim()), [q]);

  return (
    <Page
      title="Clients"
      actions={
        canWork && (
          <button type="button" className="btn btn-accent" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> New client
          </button>
        )
      }
    >
      <div className="filters">
        <label className="search">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or email" aria-label="Search clients" />
        </label>
      </div>
      <ErrorNote error={error} />
      {loading && !data ? (
        <div className="page-loading">
          <span className="spinner" /> Loading clients…
        </div>
      ) : data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Projects</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/clients/${c.id}`} className="row-link">
                      {c.name}
                    </Link>
                    {c.address && <small className="cell-sub">{c.address}</small>}
                  </td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>{plural(c.projectCount, 'project')}</td>
                  <td>{ago(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="users" title={q ? 'No clients match.' : 'No clients yet.'} />
      )}
      {adding && <ClientDialog onClose={() => setAdding(false)} onSaved={(c) => navigate(`/clients/${c.id}`)} />}
    </Page>
  );
}
