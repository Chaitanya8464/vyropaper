import React, { useEffect, useRef, useState } from "react";

const SCRIPT_FONTS = [
  { id: "style-1", name: "Brush Signature", font: 'italic 500 48px "Brush Script MT", "Segoe Script", cursive' },
  { id: "style-2", name: "Classic Cursive", font: 'italic 400 44px "Snell Roundhand", "Apple Chancery", cursive' },
  { id: "style-3", name: "Modern Autograph", font: 'italic 600 42px "Caveat", "Segoe Print", cursive' },
  { id: "style-4", name: "Executive Script", font: 'italic 400 46px "Times New Roman", Times, serif' },
];

const SIGN_COLORS = [
  { label: "Black", value: "#111827" },
  { label: "Navy Blue", value: "#1e3a8a" },
  { label: "Classic Green", value: "#14532d" },
];

function trimCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return canvas.toDataURL("image/png");

  const pad = 12;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, maxX - minX + pad * 2);
  const cropH = Math.min(height - cropY, maxY - minY + pad * 2);

  const trimmed = document.createElement("canvas");
  trimmed.width = cropW;
  trimmed.height = cropH;
  const trimmedCtx = trimmed.getContext("2d");
  trimmedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return trimmed.toDataURL("image/png");
}

export default function SignatureModal({ isOpen, onClose, onApplySignature }) {
  const [tab, setTab] = useState("draw"); // "draw" | "type" | "upload"
  const [color, setColor] = useState("#111827");
  const [strokeWidth, setStrokeWidth] = useState(3.5);
  const [typedName, setTypedName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("style-1");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [removeBg, setRemoveBg] = useState(true);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  // Clear draw canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  useEffect(() => {
    if (tab === "draw" && canvasRef.current) {
      clearCanvas();
    }
  }, [tab]);

  const onPointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    isDrawingRef.current = true;
    lastPointRef.current = { x, y };
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPointRef.current = { x, y };
    setHasDrawn(true);
  };

  const onPointerUp = () => {
    isDrawingRef.current = false;
  };

  const renderTypedSignature = () => {
    if (!typedName.trim()) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const style = SCRIPT_FONTS.find((s) => s.id === selectedStyle) || SCRIPT_FONTS[0];
    ctx.font = style.font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);

    return trimCanvas(canvas);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        if (removeBg) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > 220 && g > 220 && b > 220) {
              data[i + 3] = 0; // transparent
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        setUploadedImage(trimCanvas(canvas));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    let dataUrl = null;
    if (tab === "draw") {
      if (!canvasRef.current || !hasDrawn) return;
      dataUrl = trimCanvas(canvasRef.current);
    } else if (tab === "type") {
      dataUrl = renderTypedSignature();
    } else if (tab === "upload") {
      dataUrl = uploadedImage;
    }

    if (dataUrl) {
      onApplySignature(dataUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pde-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pde-sig-title">
      <div className="pde-modal-card">
        <header className="pde-modal-header">
          <h3 id="pde-sig-title">Create Signature</h3>
          <button type="button" className="pde-modal-close" onClick={onClose} aria-label="Close signature dialog">×</button>
        </header>

        <div className="pde-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "draw"}
            className={tab === "draw" ? "is-active" : ""}
            onClick={() => setTab("draw")}
          >
            Draw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "type"}
            className={tab === "type" ? "is-active" : ""}
            onClick={() => setTab("type")}
          >
            Type
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upload"}
            className={tab === "upload" ? "is-active" : ""}
            onClick={() => setTab("upload")}
          >
            Upload
          </button>
        </div>

        <div className="pde-modal-body">
          {/* DRAW TAB */}
          {tab === "draw" && (
            <div className="pde-sig-draw-pane">
              <div className="pde-sig-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={190}
                  className="pde-sig-canvas"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
                {!hasDrawn && <div className="pde-sig-guide">Sign here with mouse, pen, or touch</div>}
              </div>
              <div className="pde-sig-controls">
                <div className="pde-sig-colors">
                  <span>Color:</span>
                  {SIGN_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={`pde-color-dot ${color === c.value ? "is-selected" : ""}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setColor(c.value)}
                      title={c.label}
                    />
                  ))}
                </div>
                <div className="pde-sig-strokes">
                  <span>Width:</span>
                  {[2, 3.5, 5].map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`pde-stroke-btn ${strokeWidth === w ? "is-selected" : ""}`}
                      onClick={() => setStrokeWidth(w)}
                    >
                      <span style={{ height: `${w}px` }} />
                    </button>
                  ))}
                </div>
                <button type="button" className="pde-sig-clear" onClick={clearCanvas}>Clear</button>
              </div>
            </div>
          )}

          {/* TYPE TAB */}
          {tab === "type" && (
            <div className="pde-sig-type-pane">
              <label className="pde-sig-input-label">
                Your full name
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="pde-sig-name-input"
                  autoFocus
                />
              </label>

              <div className="pde-sig-colors" style={{ margin: "10px 0" }}>
                <span>Ink color:</span>
                {SIGN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`pde-color-dot ${color === c.value ? "is-selected" : ""}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>

              <div className="pde-sig-font-grid">
                {SCRIPT_FONTS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    className={`pde-sig-font-card ${selectedStyle === font.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedStyle(font.id)}
                  >
                    <span className="pde-sig-font-name">{font.name}</span>
                    <span
                      className="pde-sig-font-preview"
                      style={{
                        color,
                        fontFamily: font.font.split('"')[1] || "cursive",
                        fontStyle: "italic",
                      }}
                    >
                      {typedName.trim() || "Your Signature"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* UPLOAD TAB */}
          {tab === "upload" && (
            <div className="pde-sig-upload-pane">
              <label className="pde-sig-upload-box">
                <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} />
                <span>Upload PNG or JPG image of signature</span>
                <small>Recommended: clean signature on plain white paper</small>
              </label>
              {uploadedImage && (
                <div className="pde-sig-upload-preview">
                  <img src={uploadedImage} alt="Uploaded signature" />
                  <label className="pde-sig-checkbox">
                    <input
                      type="checkbox"
                      checked={removeBg}
                      onChange={(e) => setRemoveBg(e.target.checked)}
                    />
                    Transparent background
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="pde-modal-footer">
          <button type="button" className="pde-btn-subtle" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="pde-btn-primary"
            onClick={handleApply}
            disabled={
              (tab === "draw" && !hasDrawn) ||
              (tab === "type" && !typedName.trim()) ||
              (tab === "upload" && !uploadedImage)
            }
          >
            Apply Signature
          </button>
        </footer>
      </div>
    </div>
  );
}
