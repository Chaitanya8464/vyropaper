import React, { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { getDocument, GlobalWorkerOptions, OPS } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const IMAGE_OPERATIONS = new Set([
  OPS.paintImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
]);

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const pad = (value) => String(value).padStart(2, "0");

function imageFilename(image) {
  return `paperwork-page-${pad(image.pageNumber)}-image-${pad(image.imageNumber)}.png`;
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function imageDataToCanvas(imageData) {
  const { width, height, data, kind } = imageData;
  if (!width || !height || (!data && !imageData.bitmap)) throw new Error("This PDF image has no decoded pixel data.");
  if (width * height > 40000000) throw new Error("This image is too large to export safely in the browser.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Your browser could not prepare this image for download.");

  if (imageData.bitmap) {
    context.drawImage(imageData.bitmap, 0, 0, width, height);
  } else if (data.length === width * height * 4) {
    context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  } else {
    const rgba = new Uint8ClampedArray(width * height * 4);
    if (kind === 2 && data.length >= width * height * 3) {
      for (let source = 0, target = 0; target < rgba.length; source += 3, target += 4) {
        rgba[target] = data[source];
        rgba[target + 1] = data[source + 1];
        rgba[target + 2] = data[source + 2];
        rgba[target + 3] = 255;
      }
    } else if (kind === 1) {
      for (let pixel = 0; pixel < width * height; pixel += 1) {
        const value = data[pixel >> 3] & (1 << (7 - (pixel & 7))) ? 255 : 0;
        const target = pixel * 4;
        rgba[target] = value;
        rgba[target + 1] = value;
        rgba[target + 2] = value;
        rgba[target + 3] = 255;
      }
    } else {
      throw new Error("This PDF uses an image encoding that cannot be exported by this browser.");
    }
    context.putImageData(new ImageData(rgba, width, height), 0, 0);
  }
  return canvas;
}

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not create a PNG from this image."));
    }, "image/png");
  });
}

async function resolvePageObject(page, objectId) {
  const objects = objectId.startsWith("g_") ? page.commonObjs : page.objs;
  if (objects.has(objectId)) return objects.get(objectId);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("The PDF image did not finish decoding.")), 15000);
    try {
      objects.get(objectId, (imageData) => {
        window.clearTimeout(timeout);
        resolve(imageData);
      });
    } catch (cause) {
      window.clearTimeout(timeout);
      reject(cause);
    }
  });
}

async function decodeImage(page, source, objectId) {
  const imageData = objectId ? await resolvePageObject(page, objectId) : source;
  const canvas = imageDataToCanvas(imageData);
  try {
    const blob = await canvasToPng(canvas);
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function collectPageImages(operatorList) {
  const found = [];
  const seen = new Set();
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index];
    if (!IMAGE_OPERATIONS.has(operation)) continue;
    const args = operatorList.argsArray[index] || [];
    const objectId = operation === OPS.paintImageXObject || operation === OPS.paintImageXObjectRepeat
      ? args[0]
      : null;
    const source = objectId ? null : args[0];
    const key = objectId || source?.data;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    found.push({ objectId, source });
  }
  return found;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ImagePreview({ images, index, onClose, onChange }) {
  const [scale, setScale] = useState(null);
  const image = images[index];
  const touchStart = useRef(null);
  const closeButton = useRef(null);

  useEffect(() => {
    setScale(null);
  }, [index]);

  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onChange(-1);
      if (event.key === "ArrowRight") onChange(1);
      if (event.key === "Tab") {
        const dialog = closeButton.current?.closest(".extract-preview");
        const controls = dialog?.querySelectorAll("button, a[href]");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onChange]);

  if (!image) return null;
  return (
    <div className="extract-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="extract-preview" role="dialog" aria-modal="true" aria-labelledby="extract-preview-title">
        <header className="extract-preview-header">
          <div>
            <span className="extract-kicker">PAGE {pad(image.pageNumber)} · IMAGE {pad(image.imageNumber)}</span>
            <h3 id="extract-preview-title">{image.width} × {image.height}</h3>
          </div>
          <button ref={closeButton} className="extract-icon-button" type="button" onClick={onClose} aria-label="Close image preview">×</button>
        </header>
        <div
          className={`extract-preview-stage${scale !== null ? " is-zoomed" : ""}`}
          onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            if (start !== null && end !== undefined && Math.abs(end - start) > 60) onChange(end < start ? 1 : -1);
            touchStart.current = null;
          }}
        >
          <button className="extract-preview-nav extract-preview-prev" type="button" onClick={() => onChange(-1)} aria-label="Previous image">‹</button>
          <img
            src={image.url}
            alt={`Extracted image ${image.imageNumber} from page ${image.pageNumber}`}
            style={{ transform: `scale(${scale ?? 1})` }}
          />
          <button className="extract-preview-nav extract-preview-next" type="button" onClick={() => onChange(1)} aria-label="Next image">›</button>
        </div>
        <footer className="extract-preview-footer">
          <div className="extract-zoom-controls" aria-label="Image zoom">
            <button type="button" onClick={() => setScale((value) => Math.max(0.25, (value ?? 1) - 0.25))} aria-label="Zoom out">−</button>
            <button type="button" onClick={() => setScale(null)} aria-label="Fit image to screen">Fit</button>
            <span>{scale === null ? "Fit" : `${Math.round(scale * 100)}%`}</span>
            <button type="button" onClick={() => setScale(1)} aria-label="View image at actual size">Actual size</button>
            <button type="button" onClick={() => setScale((value) => Math.min(4, (value ?? 1) + 0.25))} aria-label="Zoom in">+</button>
          </div>
          <div className="extract-preview-meta">
            <span>{formatBytes(image.blob.size)}</span>
            <a className="pdfw-download" href={image.url} download={imageFilename(image)}>Download PNG ↓</a>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function ExtractImages() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [phase, setPhase] = useState("empty");
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState("");
  const [warningCount, setWarningCount] = useState(0);
  const [warningMessage, setWarningMessage] = useState("");
  const [previewIndex, setPreviewIndex] = useState(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const imageUrls = useRef(new Set());
  const previewTrigger = useRef(null);

  const revokeImages = useCallback(() => {
    imageUrls.current.forEach((url) => URL.revokeObjectURL(url));
    imageUrls.current.clear();
  }, []);

  const resetResults = useCallback(() => {
    revokeImages();
    setImages([]);
    setSelected(new Set());
    setPageCount(0);
    setCurrentPage(0);
    setWarningCount(0);
    setWarningMessage("");
    setPreviewIndex(null);
    setError("");
    setPhase("empty");
  }, [revokeImages]);

  const chooseFile = (candidate) => {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file to extract images.");
      return;
    }
    resetResults();
    setError("");
    setFile(candidate);
    setPhase("scanning");
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    if (!file) return undefined;
    let cancelled = false;
    let loadingTask;
    let documentProxy;

    async function scan() {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;
        loadingTask = getDocument({ data: bytes });
        documentProxy = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(documentProxy.numPages);
        setPhase("scanning");

        let imageNumber = 0;
        let skipped = 0;
        for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
          if (cancelled) return;
          setCurrentPage(pageNumber);
          const page = await documentProxy.getPage(pageNumber);
          const operatorList = await page.getOperatorList();
          const sources = collectPageImages(operatorList);

          if (sources.length) {
            const viewport = page.getViewport({ scale: 0.08 });
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            const context = canvas.getContext("2d", { alpha: false });
            if (!context) throw new Error("Your browser could not prepare this PDF page.");
            try {
              await page.render({ canvasContext: context, viewport }).promise;
            } finally {
              canvas.width = 0;
              canvas.height = 0;
            }
          }

          for (const source of sources) {
            if (cancelled) return;
            try {
              const decoded = await decodeImage(page, source.source, source.objectId);
              if (cancelled) return;
              imageNumber += 1;
              const url = URL.createObjectURL(decoded.blob);
              imageUrls.current.add(url);
              const image = {
                id: `${pageNumber}-${imageNumber}`,
                pageNumber,
                imageNumber,
                width: decoded.width,
                height: decoded.height,
                blob: decoded.blob,
                url,
              };
              setImages((previous) => [...previous, image]);
            } catch (cause) {
              skipped += 1;
              setWarningCount(skipped);
              setWarningMessage((message) => message || cause?.message || "An embedded image could not be decoded.");
            }
            await yieldToBrowser();
          }
          await page.cleanup();
          await yieldToBrowser();
        }
        if (!cancelled) setPhase("done");
      } catch (cause) {
        if (!cancelled) {
          setError(cause?.message || "This PDF could not be analyzed. Try a different file.");
          setPhase("error");
        }
      } finally {
        if (!cancelled && loadingTask) await loadingTask.destroy();
      }
    }

    scan();
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [file]);

  useEffect(() => () => revokeImages(), [revokeImages]);

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
    window.requestAnimationFrame(() => previewTrigger.current?.focus());
  }, []);
  const changePreview = useCallback((direction) => {
    setPreviewIndex((index) => index === null ? index : (index + direction + images.length) % images.length);
  }, [images.length]);

  const toggleSelected = (id) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((previous) => previous.size === images.length
      ? new Set()
      : new Set(images.map((image) => image.id)));
  };

  async function downloadSelected() {
    const chosen = images.filter((image) => selected.has(image.id));
    if (!chosen.length) return;
    setZipBusy(true);
    setError("");
    try {
      const zip = new JSZip();
      chosen.forEach((image) => zip.file(imageFilename(image), image.blob));
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "paperwork-extracted-images.zip");
    } catch (cause) {
      setError(cause?.message || "The selected images could not be prepared for download.");
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <section className="pdfw extract-tool" aria-labelledby="extract-title">
      <div className="pdfw-heading">
        <div>
          <span className="pdfw-kicker">PRIVATE BY DESIGN · PROCESSING STAYS ON THIS DEVICE</span>
          <h2 id="extract-title">Extract images from a PDF</h2>
          <p>Find embedded images in your document and save the ones you need. Your PDF never leaves this device.</p>
        </div>
        <span className="pdfw-local-badge"><span /> Browser-only</span>
      </div>

      <input
        ref={inputRef}
        className="pdfw-hidden-input"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />

      {!file ? (
        <div
          className={`pdfw-drop extract-upload${dragging ? " is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            chooseFile(event.dataTransfer.files?.[0]);
          }}
        >
          <span className="pdfw-upload-icon" aria-hidden="true">↑</span>
          <div className="pdfw-drop-copy">
            <strong>Drop a PDF here</strong>
            <span>Embedded image files will be scanned and listed for you.</span>
          </div>
          <button type="button" className="pdfw-secondary" onClick={() => inputRef.current?.click()}>Choose PDF</button>
        </div>
      ) : (
        <div className="extract-file">
          <div className="extract-file-mark" aria-hidden="true">PDF</div>
          <div className="extract-file-info">
            <strong title={file.name}>{file.name}</strong>
            <span>{formatBytes(file.size)}{pageCount ? ` · ${pageCount} pages` : ""}</span>
          </div>
          <button type="button" className="pdfw-secondary" onClick={() => inputRef.current?.click()}>Change PDF</button>
          <button type="button" className="extract-remove" onClick={() => { setFile(null); resetResults(); }} aria-label="Remove PDF">Remove</button>
        </div>
      )}

      {phase === "scanning" && (
        <div className="extract-analysis" role="status" aria-live="polite">
          <span className="pdfw-spinner" aria-hidden="true" />
          <span><strong>Analyzing your PDF…</strong>{pageCount ? ` Scanning page ${currentPage} of ${pageCount}` : " Opening document…"}</span>
          {pageCount > 0 && (
            <div className="pdfw-progress" role="progressbar" aria-label="PDF scan progress" aria-valuemin="0" aria-valuemax={pageCount} aria-valuenow={currentPage}>
              <span style={{ width: `${(currentPage / pageCount) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {file && (phase === "done" || phase === "error") && (
        <div className="extract-summary" aria-live="polite">
          <p><strong>{images.length + warningCount} embedded {images.length + warningCount === 1 ? "image found" : "images found"}</strong><span>{images.length} extracted · {selected.size} selected</span></p>
          {warningCount > 0 && <span className="extract-warning">{warningCount} could not be exported: {warningMessage}</span>}
        </div>
      )}

      {images.length > 0 && (
        <>
          <div className="extract-gallery-toolbar">
            <div>
              <h3>Images in this PDF</h3>
              <span>{images.length} found · {selected.size} selected</span>
            </div>
            <div className="extract-gallery-actions">
              <button type="button" className="extract-text-button" onClick={toggleAll}>
                {selected.size === images.length ? "Deselect all" : "Select all"}
              </button>
              <button type="button" className="pdfw-primary" onClick={downloadSelected} disabled={!selected.size || zipBusy}>
                {zipBusy ? "Preparing ZIP…" : `Download selected${selected.size ? ` (${selected.size})` : ""}`}
              </button>
            </div>
          </div>
          <div className="extract-gallery">
            {images.map((image, index) => (
              <article className="extract-image" key={image.id}>
                <button className="extract-image-open" type="button" onClick={(event) => { previewTrigger.current = event.currentTarget; setPreviewIndex(index); }} aria-label={`Preview image ${image.imageNumber} from page ${image.pageNumber}`}>
                  <img src={image.url} alt="" loading="lazy" />
                </button>
                <div className="extract-image-details">
                  <div className="extract-image-heading">
                    <strong>Image {pad(image.imageNumber)}</strong>
                    <label className="extract-checkbox">
                      <input
                        type="checkbox"
                        checked={selected.has(image.id)}
                        onChange={() => toggleSelected(image.id)}
                        aria-label={`Select image ${image.imageNumber} from page ${image.pageNumber}`}
                      />
                      <span />
                    </label>
                  </div>
                  <p>Page {image.pageNumber} · {image.width} × {image.height}</p>
                  <div className="extract-image-footer">
                    <span>PNG · {formatBytes(image.blob.size)}</span>
                    <a href={image.url} download={imageFilename(image)} aria-label={`Download image ${image.imageNumber} as PNG`}>Download ↓</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {phase === "done" && images.length === 0 && warningCount === 0 && !error && (
        <div className="extract-empty" role="status">
          <strong>No embedded images found</strong>
          <p>This PDF may contain only text, vector artwork, or images that this browser cannot decode.</p>
        </div>
      )}
      {phase === "done" && images.length === 0 && warningCount > 0 && !error && (
        <div className="extract-empty" role="status">
          <strong>Embedded images could not be exported</strong>
          <p>{warningMessage}</p>
        </div>
      )}
      {error && <div className="pdfw-message pdfw-error" role="alert">{error}</div>}
      <p className="pdfw-footnote">Images are exported as PNG from the PDF’s embedded image objects. Page artwork is not captured as a screenshot.</p>
      {previewIndex !== null && (
        <ImagePreview
          images={images}
          index={previewIndex}
          onClose={closePreview}
          onChange={changePreview}
        />
      )}
    </section>
  );
}
