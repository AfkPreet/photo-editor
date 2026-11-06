import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_TYPES } from '../lib/image';

interface Props {
  onFile: (file: File) => void;
  busy?: boolean;
  error?: string | null;
}

export function Dropzone({ onFile, busy, error }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback(
    (files: FileList | null | undefined) => {
      const f = files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) onFile(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFile]);

  return (
    <div
      className={'dropzone' + (over ? ' over' : '')}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',') + ',image/*'}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      <p style={{ marginBottom: 14 }}>Drop a photo here, paste one, or</p>
      <button className="btn primary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Opening…' : 'Choose a photo'}
      </button>
      {error && (
        <p style={{ color: 'var(--danger)', marginTop: 12 }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
