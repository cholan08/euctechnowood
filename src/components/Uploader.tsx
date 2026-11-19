import { useEffect, useState } from 'react';
import type { PreparedImage } from '../image';

interface Props {
  photo: PreparedImage | null;
  onFile: (file: File) => void;
}

export function Uploader({ photo, onFile }: Props) {
  const [over, setOver] = useState(false);

  // Stop the browser from opening a file that is dropped outside the drop zone.
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);

  return (
    <label
      className={`drop${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      {/* Visually hidden but still focusable, so keyboard users can upload too. */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ''; // allow choosing the same file again
        }}
      />
      {photo ? (
        <>
          <img src={photo.dataUrl} alt="Your uploaded room" />
          <span>Click or drop to replace</span>
        </>
      ) : (
        <>
          <strong>Upload a room photo</strong>
          <span>Drag a JPG or PNG here, or click to choose one.</span>
        </>
      )}
    </label>
  );
}
