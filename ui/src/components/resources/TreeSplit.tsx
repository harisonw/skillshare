import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useT } from '../../i18n';

export const TREE_WIDTH_KEY = 'skillshare:tree-width';
const MIN = 280;
const MAX = 560;
const DEFAULT = 380;
const STEP = 16;

const clamp = (w: number) => Math.min(MAX, Math.max(MIN, Math.round(w)));

function loadWidth(): number {
  try {
    const n = Number(localStorage.getItem(TREE_WIDTH_KEY));
    if (n) return clamp(n);
  } catch { /* storage unavailable */ }
  return DEFAULT;
}

function saveWidth(w: number) {
  try { localStorage.setItem(TREE_WIDTH_KEY, String(w)); } catch { /* storage unavailable */ }
}

/** One framed box: the tree on the left, the detail pane on the right, a draggable divider between. */
export default function TreeSplit({ tree, pane }: { tree: ReactNode; pane: ReactNode }) {
  const t = useT();
  const [width, setWidth] = useState(loadWidth);
  const drag = useRef<{ x: number; w: number } | null>(null);

  const set = (w: number) => {
    const next = clamp(w);
    setWidth(next);
    saveWidth(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (drag.current) setWidth(clamp(drag.current.w + e.clientX - drag.current.x));
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!drag.current) return;
    set(drag.current.w + e.clientX - drag.current.x);
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowLeft: -STEP, ArrowRight: STEP }[e.key];
    if (delta) { set(width + delta); e.preventDefault(); }
    else if (e.key === 'Home') { set(MIN); e.preventDefault(); }
    else if (e.key === 'End') { set(MAX); e.preventDefault(); }
  };

  return (
    <div className="ss-list ss-split">
      <div className="lp" style={{ width }}>{tree}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('resources.tree.resize')}
        aria-valuenow={width}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        className="dv"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />
      <div className="rp">{pane}</div>
    </div>
  );
}
