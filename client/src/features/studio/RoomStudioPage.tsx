import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { imageUrl, type RoomDetail } from '@shared/workspace';
import { rooms } from '../../api/workspace';
import { AppBar } from '../../components/layout/AppBar';
import { Icon } from '../../components/ui/Icon';
import { prepareImage, type PreparedImage } from '../../lib/image';
import type { RoomContext } from './hooks/usePersist';
import type { Mode } from './model/steps';
import type { ChangeLine } from './model/steps';
import StudioPage from './StudioPage';

/**
 * The studio for one project room. It starts from the room's original photo, or
 * from a later result (?from=<image id>), and stores every result back in the room.
 */
export default function RoomStudioPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const [state, setState] = useState<{ detail: RoomDetail; photo: PreparedImage; room: RoomContext } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setState(null);
    (async () => {
      const detail = await rooms.get(id);
      const start = detail.images.find((i) => i.id === from && i.kind !== 'board') ?? detail.images.find((i) => i.kind === 'original');
      if (!start) throw new Error('This room has no photo yet.');
      const blob = await (await fetch(imageUrl(start.id))).blob();
      const photo = await prepareImage(new File([blob], `${detail.room.name}.jpg`, { type: blob.type }));
      const changes = (start.meta as { changes?: ChangeLine[] }).changes;
      const room: RoomContext = {
        roomId: detail.room.id,
        projectId: detail.project.id,
        projectName: detail.project.name,
        clientName: detail.project.clientName,
        roomName: detail.room.name,
        startImageId: start.id,
        startChanges: Array.isArray(changes) ? changes : [],
      };
      if (live) setState({ detail, photo, room });
    })().catch((err: unknown) => live && setError(err instanceof Error ? err.message : 'Could not open the room.'));
    return () => {
      live = false;
    };
  }, [id, from]);

  if (error) {
    return (
      <div className="app">
        <AppBar />
        <main className="page">
          <div className="page-inner">
            <p className="alert alert-error" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </p>
          </div>
        </main>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="app">
        <AppBar />
        <div className="page-loading">
          <span className="spinner" /> Opening the room…
        </div>
      </div>
    );
  }
  if (!state.detail.project.canEdit) return <Navigate to={`/rooms/${id}`} replace />;

  const mode = (['mark', 'standard', 'generate'] as const).find((m) => m === params.get('mode')) as Mode | undefined;
  return <StudioPage key={state.room.startImageId} room={state.room} photo={state.photo} roomType={state.detail.room.roomType} mode={mode} />;
}
