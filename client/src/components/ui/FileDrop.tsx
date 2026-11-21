import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  onFile: (file: File) => void;
  className?: string;
  children: ReactNode;
}

/** A label that opens the file picker on click and accepts a dropped image. */
export function FileDrop({ onFile, className = '', children }: Props) {
  const [over, setOver] = useState(false);

  // Stop the browser from opening a file that is dropped outside a drop zone.
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
      className={`${className}${over ? ' over' : ''}`}
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
      {children}
    </label>
  );
}
