import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { EditorProps } from '@owload/editor-sdk';
import { DecodeError, decodeHeic } from './lib/decode';
import './heic-viewer.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; width: number; height: number }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

const DOWNLOAD_HINT = 'Download the file to open it in another program.';

/**
 * A view-only viewer (owload-docs/decisions/0026, 0027): it decodes the photo with libheif and draws it on a canvas, scaled
 * to fit the window. It never edits, is never dirty and never saves.
 */
export function HeicViewer({ data, fileName, onError, onClose, className, ref }: EditorProps) {
  // `data` is read once, when the viewer opens.
  const [bytes] = useState(data);
  const [state, setState] = useState<State>(bytes && bytes.byteLength > 0 ? { kind: 'loading' } : { kind: 'empty' });
  const canvas = useRef<HTMLCanvasElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({ save: async () => undefined, isDirty: () => false }), []);

  // Decode, then let the canvas (which is only there once the state says "ready") be drawn on.
  const [picture, setPicture] = useState<{ width: number; height: number; data: Uint8ClampedArray } | null>(null);

  useEffect(() => {
    if (!bytes || bytes.byteLength === 0) return;
    let cancelled = false;
    (async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0)); // let "Opening the photo…" be painted first
      try {
        const decoded = await decodeHeic(bytes);
        if (cancelled) return;
        setPicture(decoded);
        setState({ kind: 'ready', width: decoded.width, height: decoded.height });
      } catch (e) {
        if (cancelled) return;
        const error = e instanceof Error ? e : new Error(String(e));
        setState({ kind: 'error', message: e instanceof DecodeError ? e.message : 'The photo could not be decoded.' });
        onErrorRef.current?.(error);
      }
    })();
    return () => { cancelled = true; };
  }, [bytes]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !picture) return;
    element.width = picture.width;
    element.height = picture.height;
    const context = element.getContext('2d');
    context?.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
    setPicture(null); // the canvas holds the pixels now
  }, [picture, state]);

  return (
    <div className={`hv${className ? ` ${className}` : ''}`}>
      <div className="hv-bar">
        <span className="hv-name" title={fileName}>{fileName}</span>
        {state.kind === 'ready' && <span className="hv-size">{state.width} × {state.height}</span>}
        <button className="hv-close" aria-label="Close" title="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="hv-body">
        {state.kind === 'loading' && <p className="hv-state" role="status">Opening the photo…</p>}
        {state.kind === 'ready' && <canvas ref={canvas} className="hv-canvas" aria-label={fileName} role="img" />}
        {state.kind === 'empty' && <p className="hv-state">There is no photo in this file.</p>}
        {state.kind === 'error' && <p role="alert" className="hv-state hv-error">{state.message} {DOWNLOAD_HINT}</p>}
      </div>
    </div>
  );
}
