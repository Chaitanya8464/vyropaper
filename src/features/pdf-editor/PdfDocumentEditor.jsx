import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./document-editor.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TOOLS = [
  ["select", "Select"],
  ["text", "Add text"],
  ["highlight", "Highlight"],
  ["whiteout", "Whiteout"],
  ["shape", "Shape"],
  ["image", "Add image"],
  ["signature", "Signature"],
  ["comment", "Comment"],
];

const idFor = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function fontFamilyFor(style) {
  const description = `${style?.fontFamily || ""} ${style?.fontName || ""}`;
  const family = /courier|mono/i.test(description) ? "Courier"
    : /times|serif/i.test(description) && !/sans[- ]serif/i.test(description) ? "Times Roman"
      : "Helvetica";
  return /bold|black|heavy/i.test(description) ? `${family} Bold` : family;
}

function browserFontFor(family) {
  if (family.startsWith("Times")) return '"Times New Roman", serif';
  if (family.startsWith("Courier")) return '"Courier New", monospace';
  return "Arial, sans-serif";
}

function colorToRgb(hex) {
  const value = hex.replace("#", "");
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
}

function getBounds(overlay, viewport) {
  const points = [
    viewport.convertToPdfPoint(overlay.x, overlay.y),
    viewport.convertToPdfPoint(overlay.x + overlay.width, overlay.y),
    viewport.convertToPdfPoint(overlay.x, overlay.y + overlay.height),
    viewport.convertToPdfPoint(overlay.x + overlay.width, overlay.y + overlay.height),
  ];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function PdfDocumentEditor({ file, onReplaceFile }) {
  const [document, setDocument] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(Boolean(file));
  const [exporting, setExporting] = useState(false);
  const [savedPdfUrl, setSavedPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [tool, setTool] = useState("select");
  const [overlays, setOverlays] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [activePage, setActivePage] = useState(1);
  const [shapeType, setShapeType] = useState("rectangle");
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState("Helvetica");
  const [textColor, setTextColor] = useState("#263328");
  const [highlightColor, setHighlightColor] = useState("#f4db74");
  const [imageData, setImageData] = useState(null);
  const [imageType, setImageType] = useState(null);
  const [stageWidth, setStageWidth] = useState(760);
  const stageRef = useRef(null);
  const pageRefs = useRef({});
  const pageCanvasRefs = useRef({});
  const canvasRefs = useRef({});
  const inlineTextRefs = useRef({});
  const dragRef = useRef(null);
  const textEditRef = useRef(null);
  const currentOverlayRef = useRef(overlays);
  currentOverlayRef.current = overlays;

  const selectedOverlay = overlays.find((overlay) => overlay.id === selectedId) || null;

  const beginTextEdit = (id) => {
    if (textEditRef.current?.id !== id) {
      textEditRef.current = { id, before: currentOverlayRef.current };
    }
  };

  const finishTextEdit = (id) => {
    const edit = textEditRef.current;
    if (!edit || edit.id !== id) return;
    const beforeText = edit.before.find((overlay) => overlay.id === id)?.text;
    const currentText = currentOverlayRef.current.find((overlay) => overlay.id === id)?.text;
    if (beforeText !== currentText) {
      setPast((items) => [...items.slice(-39), edit.before]);
      setFuture([]);
    }
    textEditRef.current = null;
  };

  useEffect(() => {
    if (selectedOverlay?.kind !== "edit-text") return;
    const input = inlineTextRefs.current[selectedOverlay.id];
    if (!input) return;
    input.focus();
    input.select();
  }, [selectedId, selectedOverlay?.kind]);

  useEffect(() => {
    if (!savedPdfUrl) return undefined;
    return () => URL.revokeObjectURL(savedPdfUrl);
  }, [savedPdfUrl]);

  const commit = useCallback((next) => {
    const previous = currentOverlayRef.current;
    setSavedPdfUrl("");
    setPast((items) => [...items.slice(-39), previous]);
    setFuture([]);
    currentOverlayRef.current = next;
    setOverlays(next);
  }, []);

  const updateOverlay = useCallback((id, changes, record = true) => {
    const previous = currentOverlayRef.current;
    setSavedPdfUrl("");
    const next = previous.map((item) => item.id === id ? { ...item, ...changes } : item);
    if (record) {
      setPast((items) => [...items.slice(-39), previous]);
      setFuture([]);
    }
    currentOverlayRef.current = next;
    setOverlays(next);
  }, []);

  useEffect(() => {
    if (!stageRef.current) return undefined;
    const element = stageRef.current;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setStageWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    setDocument(null);
    setPages([]);
    setOverlays([]);
    currentOverlayRef.current = [];
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setActivePage(1);
    setError("");
    setLoading(Boolean(file));
    setSavedPdfUrl("");
    if (!file) return undefined;

    (async () => {
      try {
        const bytes = await file.arrayBuffer();
        if (cancelled) return;
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
        const loaded = await loadingTask.promise;
        if (cancelled) {
          await loaded.destroy();
          return;
        }
        const pageList = [];
        for (let pageNumber = 1; pageNumber <= loaded.numPages; pageNumber += 1) {
          const page = await loaded.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          const textItems = content.items.flatMap((item, itemIndex) => {
            if (!("str" in item) || !item.str.trim()) return [];
            const transform = pdfjs.Util.transform(viewport.transform, item.transform);
            const angle = Math.atan2(transform[1], transform[0]);
            if (Math.abs(angle) > 0.02) return [];
            const textStyle = content.styles[item.fontName];
            const height = Math.max(item.height, Math.hypot(transform[2], transform[3]));
            const ascent = textStyle?.ascent > 0 ? textStyle.ascent : 1;
            return [{
              id: `${pageNumber}-${itemIndex}`,
              text: item.str,
              x: transform[4],
              y: transform[5] - height * ascent,
              width: Math.max(item.width, 8),
              height,
              baselineRatio: ascent,
              fontFamily: fontFamilyFor(textStyle),
              fontSize: height,
            }];
          });
          pageList.push({ pageNumber, page, viewport, textItems });
        }
        if (!cancelled) {
          setDocument(loaded);
          setPages(pageList);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError?.message || "This PDF could not be opened.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!pages.length || !stageWidth) return undefined;
    let cancelled = false;
    const renderTasks = [];
    pages.forEach(({ pageNumber, page, viewport: baseViewport }) => {
      const canvas = canvasRefs.current[pageNumber];
      if (!canvas) return;
      const scale = Math.min((stageWidth - 48) / baseViewport.width, 1.25);
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d", { alpha: false });
      const task = page.render({ canvasContext: context, viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
      renderTasks.push(task);
      task.promise.catch((renderError) => {
        if (!cancelled && renderError?.name !== "RenderingCancelledException") {
          setError(renderError?.message || "A page could not be rendered.");
        }
      });
    });
    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel());
    };
  }, [pages, stageWidth]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    const current = currentOverlayRef.current;
    setFuture((items) => [...items, current]);
    setPast((items) => items.slice(0, -1));
    currentOverlayRef.current = previous;
    setOverlays(previous);
    if (!previous.some((overlay) => overlay.id === selectedId)) setSelectedId(null);
  }, [past, selectedId]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[future.length - 1];
    const current = currentOverlayRef.current;
    setPast((items) => [...items, current]);
    setFuture((items) => items.slice(0, -1));
    currentOverlayRef.current = next;
    setOverlays(next);
    if (!next.some((overlay) => overlay.id === selectedId)) {
      setSelectedId(next[next.length - 1]?.id || null);
    }
  }, [future, selectedId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (event.target.closest?.(".pde-edit-text textarea")) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !["INPUT", "TEXTAREA", "SELECT"].includes(window.document.activeElement?.tagName)) {
        event.preventDefault();
        const selected = currentOverlayRef.current.find((overlay) => overlay.id === selectedId);
        if (selected?.kind === "edit-text") updateOverlay(selectedId, { text: "" });
        else {
          commit(currentOverlayRef.current.filter((overlay) => overlay.id !== selectedId));
          setSelectedId(null);
        }
      } else if (event.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commit, document, redo, selectedId, undo, updateOverlay]);

  const addOverlay = (page, point) => {
    const defaults = {
      id: idFor(),
      page: page.pageNumber,
      x: point.x,
      y: point.y,
      width: 150,
      height: 30,
      color: textColor,
      fontSize: Number(fontSize),
      fontFamily,
      text: "",
      shape: shapeType,
    };
    let next;
    if (tool === "text") next = { ...defaults, kind: "text", text: "New text" };
    else if (tool === "signature") next = { ...defaults, kind: "signature", text: "Your name", fontFamily: "Times Roman", fontSize: Math.max(24, Number(fontSize)), color: "#273c2b" };
    else if (tool === "highlight") next = { ...defaults, kind: "highlight", width: 150, height: 24, color: highlightColor };
    else if (tool === "whiteout") next = { ...defaults, kind: "whiteout", width: 150, height: 32 };
    else if (tool === "shape") next = { ...defaults, kind: "shape", width: 130, height: 70, color: textColor };
    else if (tool === "comment") next = { ...defaults, kind: "comment", width: 190, height: 84, text: "Add a note" };
    else if (tool === "image" && imageData) next = { ...defaults, kind: "image", width: 160, height: 100, imageData, imageType };
    else return;
    const nextOverlays = [...currentOverlayRef.current, next];
    commit(nextOverlays);
    setSelectedId(next.id);
    setTool("select");
  };

  const getPoint = (event, page) => {
    const bounds = pageCanvasRefs.current[page.pageNumber]?.getBoundingClientRect();
    if (!bounds) return { x: 24, y: 24 };
    const scale = bounds.width / page.viewport.width;
    return {
      x: clamp((event.clientX - bounds.left) / scale, 0, page.viewport.width - 12),
      y: clamp((event.clientY - bounds.top) / scale, 0, page.viewport.height - 12),
    };
  };

  const onPagePointerDown = (event, page) => {
    if (event.target.closest(".pde-overlay")) return;
    setActivePage(page.pageNumber);
    if (tool !== "select" && !(tool === "image" && !imageData)) {
      addOverlay(page, getPoint(event, page));
    } else {
      setSelectedId(null);
    }
  };

  const editTextItem = (event, page, item) => {
    event.stopPropagation();
    const existing = currentOverlayRef.current.find((overlay) => overlay.sourceTextId === item.id);
    if (existing) {
      setSelectedId(existing.id);
      setTool("select");
      setActivePage(page.pageNumber);
      return;
    }
    const next = {
      id: idFor(),
      sourceTextId: item.id,
      originalText: item.text,
      kind: "edit-text",
      page: page.pageNumber,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      color: "#20231f",
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      text: item.text,
    };
    commit([...currentOverlayRef.current, next]);
    setSelectedId(next.id);
    setTool("select");
    setActivePage(page.pageNumber);
  };

  const onOverlayPointerDown = (event, overlay, page) => {
    event.stopPropagation();
    setActivePage(page.pageNumber);
    setSelectedId(overlay.id);
    if (overlay.kind === "edit-text") return;
    if (tool !== "select") return;
    const bounds = pageCanvasRefs.current[page.pageNumber]?.getBoundingClientRect();
    if (!bounds) return;
    const scale = bounds.width / page.viewport.width;
    dragRef.current = {
      id: overlay.id,
      page,
      startX: event.clientX,
      startY: event.clientY,
      x: overlay.x,
      y: overlay.y,
      scale,
      before: currentOverlayRef.current,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onOverlayPointerMove = (event) => {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    const dx = (event.clientX - drag.startX) / drag.scale;
    const dy = (event.clientY - drag.startY) / drag.scale;
    if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
    if (drag.moved) updateOverlay(drag.id, { x: Math.max(0, drag.x + dx), y: Math.max(0, drag.y + dy) }, false);
  };

  const onOverlayPointerUp = () => {
    if (dragRef.current?.moved) {
      setPast((items) => [...items.slice(-39), dragRef.current.before]);
      setFuture([]);
    }
    dragRef.current = null;
  };

  const chooseImage = async (fileInput) => {
    const imageFile = fileInput.files?.[0];
    if (!imageFile) return;
    if (!["image/png", "image/jpeg"].includes(imageFile.type)) {
      setError("Choose a PNG or JPEG image.");
      fileInput.value = "";
      return;
    }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("This image could not be read."));
        reader.readAsDataURL(imageFile);
      });
      setImageData(data);
      setImageType(imageFile.type);
      setTool("image");
      setError("");
    } catch (imageError) {
      setError(imageError.message);
    }
  };

  const exportPdf = async () => {
    if (!file || !document || exporting) return;
    setExporting(true);
    setError("");
    setSavedPdfUrl("");
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const fontCache = new Map();
      const fontFor = async (family) => {
        const name = family === "Helvetica Bold" ? StandardFonts.HelveticaBold
          : family === "Times Roman" ? StandardFonts.TimesRoman
            : family === "Times Roman Bold" ? StandardFonts.TimesRomanBold
              : family === "Courier" ? StandardFonts.Courier
                : family === "Courier Bold" ? StandardFonts.CourierBold
                  : StandardFonts.Helvetica;
        if (!fontCache.has(name)) fontCache.set(name, await pdf.embedFont(name));
        return fontCache.get(name);
      };
      const pdfPages = pdf.getPages();
      for (const overlay of overlays) {
        const page = pdfPages[overlay.page - 1];
        const pageInfo = pages[overlay.page - 1];
        if (!page || !pageInfo) continue;
        const bounds = getBounds(overlay, pageInfo.viewport);
        const color = colorToRgb(overlay.color || "#263328");
        if (overlay.kind === "edit-text") {
          page.drawRectangle({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, color: rgb(1, 1, 1), borderWidth: 0 });
          if (overlay.text) {
            const font = await fontFor(overlay.fontFamily);
              const baseline = overlay.y + Number(overlay.fontSize) * (overlay.baselineRatio || 0.8);
              const [, baselineY] = pageInfo.viewport.convertToPdfPoint(overlay.x, baseline);
              const [textX] = pageInfo.viewport.convertToPdfPoint(overlay.x, baseline);
            page.drawText(overlay.text, {
              x: textX,
              y: baselineY,
              size: Number(overlay.fontSize),
              font,
              color,
              maxWidth: Math.max(1, bounds.width),
              lineHeight: Number(overlay.fontSize) * 1.2,
            });
          }
        } else if (overlay.kind === "text" || overlay.kind === "signature") {
          const font = await fontFor(overlay.fontFamily);
          const [, baselineY] = pageInfo.viewport.convertToPdfPoint(overlay.x, overlay.y + Number(overlay.fontSize));
          const [textX] = pageInfo.viewport.convertToPdfPoint(overlay.x, overlay.y + Number(overlay.fontSize));
          page.drawText(overlay.text || "", {
            x: textX,
            y: baselineY,
            size: Number(overlay.fontSize),
            font,
            color,
          });
        } else if (overlay.kind === "highlight") {
          page.drawRectangle({ ...bounds, color, opacity: 0.36, borderWidth: 0 });
        } else if (overlay.kind === "whiteout") {
          page.drawRectangle({ ...bounds, color: rgb(1, 1, 1), borderColor: rgb(0.82, 0.82, 0.8), borderWidth: 0.4 });
        } else if (overlay.kind === "shape") {
          if (overlay.shape === "ellipse") {
            page.drawEllipse({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, xScale: bounds.width / 2, yScale: bounds.height / 2, borderColor: color, borderWidth: 2 });
          } else if (overlay.shape === "line") {
            page.drawLine({ start: { x: bounds.x, y: bounds.y }, end: { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, color, thickness: 2 });
          } else {
            page.drawRectangle({ ...bounds, borderColor: color, borderWidth: 2 });
          }
        } else if (overlay.kind === "image") {
          const embedded = overlay.imageType === "image/png"
            ? await pdf.embedPng(overlay.imageData)
            : await pdf.embedJpg(overlay.imageData);
          page.drawImage(embedded, bounds);
        } else if (overlay.kind === "comment") {
          page.drawRectangle({ ...bounds, color: rgb(1, 0.96, 0.76), borderColor: rgb(0.72, 0.62, 0.31), borderWidth: 0.8 });
          const font = await fontFor("Helvetica");
          const [textX, textY] = pageInfo.viewport.convertToPdfPoint(overlay.x + 7, overlay.y + 19);
          page.drawText(overlay.text || "", { x: textX, y: textY, size: 11, font, color: rgb(0.2, 0.2, 0.16), maxWidth: Math.max(20, bounds.width - 14), lineHeight: 13 });
        }
      }
      const bytes = await pdf.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setSavedPdfUrl(url);
    } catch (exportError) {
      setError(exportError?.message || "The edited PDF could not be saved.");
    } finally {
      setExporting(false);
    }
  };

  const pageScale = useMemo(() => (page) => {
    const bounds = pageCanvasRefs.current[page.pageNumber]?.getBoundingClientRect();
    return bounds ? bounds.width / page.viewport.width : Math.min((stageWidth - 48) / page.viewport.width, 1.25);
  }, [stageWidth]);

  const removeSelected = () => {
    if (!selectedId) return;
    commit(currentOverlayRef.current.filter((overlay) => overlay.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <section className="pde" aria-label="PDF page editor">
      <header className="pde-header">
        <div>
          <span className="pde-eyebrow">PDF WORKSPACE · {file.name}</span>
          <h2>Edit your PDF</h2>
          <p>Click text on a page to edit it, or add new text and annotations. Text changes cover the original and are saved in a new PDF copy.</p>
        </div>
        <div className="pde-header-actions">
          <span className="pde-local"><i aria-hidden="true" /> Files stay on this device</span>
          <button className="pde-change-file" type="button" onClick={onReplaceFile}>Choose another PDF</button>
        </div>
      </header>

      {error && <div className="pde-error" role="alert"><strong>Could not complete that action.</strong> {error}</div>}
      {!file && <div className="pde-empty">Upload a PDF in the file area above to start editing.</div>}

      {file && <div className="pde-workspace">
        <div className="pde-topbar">
          <div className="pde-tools" role="toolbar" aria-label="Editor tools">
            {TOOLS.map(([id, label]) => (
              <button key={id} type="button" className={tool === id ? "is-active" : ""} onClick={() => setTool(id)} aria-pressed={tool === id} disabled={loading || !document}>
                {label}
              </button>
            ))}
          </div>
          <div className="pde-history">
            <button type="button" onClick={undo} disabled={!past.length || loading} aria-label="Undo last edit">Undo</button>
            <button type="button" onClick={redo} disabled={!future.length || loading} aria-label="Redo last edit">Redo</button>
            <button type="button" className="pde-save" onClick={exportPdf} disabled={loading || exporting || !document}>
              {exporting ? "Preparing PDF…" : savedPdfUrl ? "Prepare new copy" : "Save edited PDF"}
            </button>
            {savedPdfUrl && (
              <a
                className="pde-download"
                href={savedPdfUrl}
                download={`${file.name.replace(/\.pdf$/i, "") || "document"}-edited.pdf`}
              >
                Download PDF
              </a>
            )}
          </div>
        </div>

        <div className="pde-body">
          <aside className="pde-sidebar" aria-label="Page navigation and selected item settings">
            <h3>Pages <span>{pages.length || "—"}</span></h3>
            <div className="pde-page-list">
              {pages.map((page) => (
                <button key={page.pageNumber} className={activePage === page.pageNumber ? "is-current" : ""} type="button" onClick={() => {
                  setActivePage(page.pageNumber);
                  pageRefs.current[page.pageNumber]?.scrollIntoView({ behavior: "smooth", block: "start" });
                }} aria-label={`Go to page ${page.pageNumber}`} aria-current={activePage === page.pageNumber ? "page" : undefined}>
                  <span>{page.pageNumber}</span><small>Page {page.pageNumber}</small>
                </button>
              ))}
              {loading && <p className="pde-side-note">Loading pages…</p>}
            </div>
            <div className="pde-inspector">
              <h3>{selectedOverlay ? "Selected item" : "Tool settings"}</h3>
              {tool === "shape" && <label className="pde-field">Shape
                <select value={shapeType} onChange={(event) => setShapeType(event.target.value)} aria-label="Shape type">
                  <option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="line">Line</option>
                </select>
              </label>}
              {tool === "image" && <label className="pde-file-button">Choose PNG or JPEG
                <input type="file" accept="image/png,image/jpeg" onChange={(event) => chooseImage(event.currentTarget)} aria-label="Choose image to place" />
              </label>}
              {tool === "text" || tool === "signature" ? <>
                <label className="pde-field">Default font size
                  <input type="number" min="6" max="96" value={fontSize} onChange={(event) => setFontSize(clamp(Number(event.target.value), 6, 96))} />
                </label>
                <label className="pde-field">Default font
                  <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}><option>Helvetica</option><option>Helvetica Bold</option><option>Times Roman</option><option>Times Roman Bold</option><option>Courier</option><option>Courier Bold</option></select>
                </label>
                <label className="pde-field">Text color <input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label>
              </> : null}
              {tool === "highlight" && <label className="pde-field">Highlight color <input type="color" value={highlightColor} onChange={(event) => setHighlightColor(event.target.value)} /></label>}
              {tool === "whiteout" && <p className="pde-warning"><strong>Not secure redaction.</strong> Whiteout only covers text visually; underlying content can still be recovered.</p>}
              {selectedOverlay && <>
                <label className="pde-field">Width
                  <input type="number" min="10" max="2000" value={Math.round(selectedOverlay.width)} onChange={(event) => updateOverlay(selectedId, { width: clamp(Number(event.target.value), 10, 2000) })} />
                </label>
                <label className="pde-field">Height
                  <input type="number" min="10" max="2000" value={Math.round(selectedOverlay.height)} onChange={(event) => updateOverlay(selectedId, { height: clamp(Number(event.target.value), 10, 2000) })} />
                </label>
                {(selectedOverlay.kind === "text" || selectedOverlay.kind === "edit-text" || selectedOverlay.kind === "signature" || selectedOverlay.kind === "comment") && <>
                  {selectedOverlay.kind !== "edit-text" && <label className="pde-field">{selectedOverlay.kind === "comment" ? "Note" : "Text"}
                    <textarea rows={3} value={selectedOverlay.text} onChange={(event) => updateOverlay(selectedId, { text: event.target.value })} aria-label="Selected overlay text" />
                  </label>}
                  {selectedOverlay.kind !== "comment" && <label className="pde-field">Font family
                    <select value={selectedOverlay.fontFamily} onChange={(event) => updateOverlay(selectedId, { fontFamily: event.target.value })} aria-label="Selected text font family">
                      <option>Helvetica</option><option>Helvetica Bold</option><option>Times Roman</option><option>Times Roman Bold</option><option>Courier</option><option>Courier Bold</option>
                    </select>
                  </label>}
                  {selectedOverlay.kind !== "comment" && <label className="pde-field">Font size
                    <input type="number" min="6" max="96" value={selectedOverlay.fontSize} onChange={(event) => updateOverlay(selectedId, { fontSize: clamp(Number(event.target.value), 6, 96) })} />
                  </label>}
                  <label className="pde-field">Color <input type="color" value={selectedOverlay.color} onChange={(event) => updateOverlay(selectedId, { color: event.target.value })} /></label>
                </>}
                {selectedOverlay.kind === "shape" && <label className="pde-field">Line color <input type="color" value={selectedOverlay.color} onChange={(event) => updateOverlay(selectedId, { color: event.target.value })} /></label>}
                {selectedOverlay.kind === "highlight" && <label className="pde-field">Color <input type="color" value={selectedOverlay.color} onChange={(event) => updateOverlay(selectedId, { color: event.target.value })} /></label>}
                {selectedOverlay.kind === "edit-text"
                  ? <button className="pde-delete" type="button" onClick={() => updateOverlay(selectedId, { text: "" })}>Remove text</button>
                  : <button className="pde-delete" type="button" onClick={removeSelected}>Delete selected item</button>}
                <p className="pde-side-note">{selectedOverlay.kind === "edit-text" ? "Text replacement is placed over the original. Click the text on the page to edit it." : "Drag the item on the page to move it."}</p>
              </>}
              {!selectedOverlay && <p className="pde-side-note">{tool === "select" ? "Choose an item on a page to edit it, or select a tool to add content." : "Click on a page to place this item."}</p>}
            </div>
          </aside>

          <main className="pde-stage" ref={stageRef} aria-label="PDF pages">
            {loading && <div className="pde-loading" role="status"><span className="pde-spinner" /> Opening {file.name}…</div>}
            {!loading && !error && pages.map((page) => {
              const scale = pageScale(page);
              return <article key={page.pageNumber} className="pde-page" ref={(node) => { pageRefs.current[page.pageNumber] = node; }} onPointerUp={() => setActivePage(page.pageNumber)}>
                <div className="pde-page-label">PAGE {page.pageNumber}</div>
                <div className={`pde-page-canvas pde-active-${tool}`} ref={(node) => { pageCanvasRefs.current[page.pageNumber] = node; }} style={{ width: page.viewport.width * scale, height: page.viewport.height * scale }} onPointerDown={(event) => onPagePointerDown(event, page)}>
                  <canvas ref={(node) => { canvasRefs.current[page.pageNumber] = node; }} aria-label={`PDF page ${page.pageNumber}`} />
                  {page.textItems.map((item) => {
                    const replaced = overlays.some((overlay) => overlay.sourceTextId === item.id);
                    return <button
                      key={item.id}
                      type="button"
                      className={`pde-text-target${replaced ? " is-replaced" : ""}`}
                      style={{ left: item.x * scale, top: item.y * scale, width: item.width * scale, height: item.height * scale }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => editTextItem(event, page, item)}
                      aria-label={`Edit text: ${item.text}`}
                      aria-hidden={replaced}
                      tabIndex={replaced ? -1 : 0}
                    />;
                  })}
                  {overlays.filter((overlay) => overlay.page === page.pageNumber).map((overlay) => {
                    const style = {
                      left: overlay.x * scale,
                      top: overlay.y * scale,
                      width: overlay.width * scale,
                      height: overlay.height * scale,
                      color: overlay.color,
                      fontSize: (overlay.fontSize || 14) * scale,
                      fontFamily: browserFontFor(overlay.fontFamily),
                    };
                    const overlayClass = `pde-overlay pde-${overlay.kind}${selectedId === overlay.id ? " is-selected" : ""}`;
                    return <div key={overlay.id} className={overlayClass} style={style} onPointerDown={(event) => onOverlayPointerDown(event, overlay, page)} onPointerMove={onOverlayPointerMove} onPointerUp={onOverlayPointerUp} role={overlay.kind === "edit-text" ? undefined : "button"} tabIndex={overlay.kind === "edit-text" ? -1 : 0} aria-label={`${overlay.kind} overlay${selectedId === overlay.id ? ", selected" : ""}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(overlay.id); setActivePage(page.pageNumber); } }}>
                      {overlay.kind === "edit-text" ? <textarea
                        className="pde-inline-text"
                        ref={(node) => { inlineTextRefs.current[overlay.id] = node; }}
                        value={overlay.text}
                        aria-label="Edit PDF text"
                        onFocus={() => beginTextEdit(overlay.id)}
                        onChange={(event) => updateOverlay(overlay.id, { text: event.target.value }, false)}
                        onBlur={() => finishTextEdit(overlay.id)}
                        onPointerDown={(event) => { event.stopPropagation(); setSelectedId(overlay.id); }}
                      /> : null}
                      {overlay.kind === "text" || overlay.kind === "signature" ? overlay.text : null}
                      {overlay.kind === "comment" ? <span>{overlay.text}</span> : null}
                      {overlay.kind === "image" ? <img src={overlay.imageData} alt="Placed image" draggable="false" /> : null}
                    </div>;
                  })}
                </div>
              </article>;
            })}
            {!loading && !error && document && <div className="pde-stage-end">End of document · {pages.length} {pages.length === 1 ? "page" : "pages"}</div>}
          </main>
        </div>
      </div>}
      <p className="pde-footnote">Clicking existing text replaces it with editable text over the original page content. Changes are saved to a new PDF copy; no file is uploaded.</p>
    </section>
  );
}

export default PdfDocumentEditor;
