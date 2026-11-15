import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@pcbk/ui';
import { photoEt as text } from './i18n/et';
import type { PhotoView } from './photo-view';

interface PhotoSettingsMenuProps {
  view: PhotoView;
  onViewChange: (change: Partial<PhotoView>) => void;
  onRotate: () => void;
  onMirror: () => void;
}

export function PhotoSettingsMenu({
  view,
  onViewChange,
  onRotate,
  onMirror,
}: PhotoSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstSlider = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    firstSlider.current?.focus();
    function outsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const origin = event.target;
      if (origin instanceof Element) {
        if (origin.closest('dialog[open], [role="dialog"][aria-modal="true"]')) return;
        if (!panel.current?.contains(origin)) {
          if (origin.closest('input, textarea, select, [role="textbox"]')) return;
          const editor = origin.closest('[contenteditable]');
          if (editor && editor.getAttribute('contenteditable')?.toLowerCase() !== 'false') return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener('pointerdown', outsidePointer);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outsidePointer);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="pcbk-photo-settings">
      <Button
        ref={trigger}
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {text.settings}
      </Button>
      {open && (
        <div
          ref={panel}
          id={id}
          className="pcbk-photo-settings-menu"
          role="dialog"
          aria-label={text.settings}
        >
          <label className="pcbk-photo-range">
            <span>{text.opacity}</span>
            <input
              ref={firstSlider}
              type="range"
              min={10}
              max={100}
              step={1}
              value={Math.round(view.opacity * 100)}
              aria-label={text.opacity}
              aria-valuetext={text.percent(view.opacity)}
              onChange={(event) =>
                onViewChange({ opacity: Number(event.currentTarget.value) / 100 })
              }
            />
            <span>{text.percent(view.opacity)}</span>
          </label>
          <label className="pcbk-photo-range">
            <span>{text.contrast}</span>
            <input
              type="range"
              min={50}
              max={200}
              step={1}
              value={Math.round(view.contrast * 100)}
              aria-label={text.contrast}
              aria-valuetext={text.percent(view.contrast)}
              onChange={(event) =>
                onViewChange({ contrast: Number(event.currentTarget.value) / 100 })
              }
            />
            <span>{text.percent(view.contrast)}</span>
          </label>
          <Button
            variant="ghost"
            aria-pressed={view.gray}
            onClick={() => onViewChange({ gray: !view.gray })}
          >
            {text.gray}
          </Button>
          <Button variant="ghost" onClick={onRotate}>
            {text.rotate}
          </Button>
          <Button variant="ghost" onClick={onMirror}>
            {text.mirror}
          </Button>
        </div>
      )}
    </div>
  );
}
