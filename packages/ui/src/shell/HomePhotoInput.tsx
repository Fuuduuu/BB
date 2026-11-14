import { useEffect, useRef, useState } from 'react';
import { et } from './i18n/et';

export function HomePhotoInput({
  onFiles,
  busy,
}: {
  onFiles(files: Iterable<File> | ArrayLike<File>): void;
  busy: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], dialog',
        )
      )
        return;
      if (!event.clipboardData?.files.length) return;
      event.preventDefault();
      onFiles(event.clipboardData.files);
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [onFiles]);
  return (
    <div
      className="pcbk-start__photo"
      data-dragging={dragging}
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        if (--depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        {et.project.dropPhoto}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        disabled={busy}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
