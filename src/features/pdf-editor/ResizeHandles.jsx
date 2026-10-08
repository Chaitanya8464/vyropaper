import React, { useRef } from "react";

const HANDLES = [
  { dir: "nw", cursor: "nwse-resize", className: "pde-handle-nw" },
  { dir: "n", cursor: "ns-resize", className: "pde-handle-n" },
  { dir: "ne", cursor: "nesw-resize", className: "pde-handle-ne" },
  { dir: "e", cursor: "ew-resize", className: "pde-handle-e" },
  { dir: "se", cursor: "nwse-resize", className: "pde-handle-se" },
  { dir: "s", cursor: "ns-resize", className: "pde-handle-s" },
  { dir: "sw", cursor: "nesw-resize", className: "pde-handle-sw" },
  { dir: "w", cursor: "ew-resize", className: "pde-handle-w" },
];

export default function ResizeHandles({ overlay, scale, onResize, onResizeEnd }) {
  const resizeRef = useRef(null);

  const onPointerDown = (e, dir) => {
    e.stopPropagation();
    resizeRef.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      initial: {
        x: overlay.x,
        y: overlay.y,
        width: overlay.width,
        height: overlay.height,
      },
      hasMoved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!resizeRef.current) return;
    const { dir, startX, startY, initial } = resizeRef.current;
    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      resizeRef.current.hasMoved = true;
    }

    let { x, y, width, height } = initial;
    const minW = 16;
    const minH = 12;

    if (dir.includes("e")) {
      width = Math.max(minW, initial.width + dx);
    }
    if (dir.includes("s")) {
      height = Math.max(minH, initial.height + dy);
    }
    if (dir.includes("w")) {
      const nextW = Math.max(minW, initial.width - dx);
      x = initial.x + (initial.width - nextW);
      width = nextW;
    }
    if (dir.includes("n")) {
      const nextH = Math.max(minH, initial.height - dy);
      y = initial.y + (initial.height - nextH);
      height = nextH;
    }

    onResize({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width,
      height,
    });
  };

  const onPointerUp = (e) => {
    if (resizeRef.current?.hasMoved) {
      onResizeEnd();
    }
    resizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  return (
    <div className="pde-resize-box" aria-hidden="true">
      {HANDLES.map(({ dir, cursor, className }) => (
        <div
          key={dir}
          className={`pde-handle ${className}`}
          style={{ cursor }}
          onPointerDown={(e) => onPointerDown(e, dir)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      ))}
    </div>
  );
}
