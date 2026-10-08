import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  idFor,
  clamp,
  colorToRgb,
  fontFamilyFor,
  fontWeightFor,
  fontStyleFor,
  textRunsForPage,
  colorsForTextItems,
  browserFontFor,
  standardFontName,
  getBounds,
  pointsToSvgPath,
} from "./editorUtils.js";
import SignatureModal from "./SignatureModal.jsx";
import ResizeHandles from "./ResizeHandles.jsx";
import SearchOverlay from "./SearchOverlay.jsx";
import "./document-editor.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TOOLS = [
  ["select", "Select"],
  ["text", "Add text"],
  ["draw", "Draw / Pen"],
  ["highlight", "Highlight"],
  ["whiteout", "Whiteout"],
  ["shape", "Shape"],
  ["image", "Add image"],
  ["signature", "Signature"],
  ["comment", "Comment"],
];

const ZOOM_PRESETS = [
  { label: "Fit Width", value: "fit" },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1.0 },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2.0 },
];

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
  const [zoom, setZoom] = useState("fit");
  const [clipboard, setClipboard] = useState(null);

  // Modals & Panels
  const [showSigModal, setShowSigModal] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(null);

  // Tool Specific Options
  const [shapeType, setShapeType] = useState("rectangle");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(2);
  const [shapeFillColor, setShapeFillColor] = useState("transparent");
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Helvetica");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [textAlign, setTextAlign] = useState("left");
  const [textColor, setTextColor] = useState("#20231f");
  const [textBgColor, setTextBgColor] = useState("#ffffff");
  const [highlightColor, setHighlightColor] = useState("#f4db74");

  // Draw tool options
  const [drawColor, setDrawColor] = useState("#111827");
  const [drawWidth, setDrawWidth] = useState(2.5);
  const [drawMode, setDrawMode] = useState("pen"); // "pen" | "highlighter"
  const [currentStroke, setCurrentStroke] = useState(null);

  // Image options
  const [imageData, setImageData] = useState(null);
  const [imageType, setImageType] = useState(null);

  const [stageWidth, setStageWidth] = useState(800);
  const stageRef = useRef(null);
  const pageRefs = useRef({});
  const pageCanvasRefs = useRef({});
  const canvasRefs = useRef({});
  const inlineTextRefs = useRef({});
  const dragRef = useRef(null);
  const textEditRef = useRef(null);
  const drawRef = useRef(null);
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
      setPast((items) => [...items.slice(-49), edit.before]);
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
    setPast((items) => [...items.slice(-49), previous]);
    setFuture([]);
    currentOverlayRef.current = next;
    setOverlays(next);
  }, []);

  const updateOverlay = useCallback((id, changes, record = true) => {
    const previous = currentOverlayRef.current;
    setSavedPdfUrl("");
    const next = previous.map((item) => (item.id === id ? { ...item, ...changes } : item));
    if (record) {
      setPast((items) => [...items.slice(-49), previous]);
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

  // Load PDF and extract page content with accurate operator typography
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
          const rawTextItems = content.items.filter((item) => "str" in item && item.str.trim());
          const operatorList = await page.getOperatorList();
          const { runs, fontColors } = textRunsForPage(operatorList);
          const textColors = colorsForTextItems(rawTextItems, runs, fontColors);

          const textItems = rawTextItems.flatMap((item, itemIndex) => {
            if (!("str" in item) || !item.str.trim()) return [];
            const transform = pdfjs.Util.transform(viewport.transform, item.transform);
            const angle = Math.atan2(transform[1], transform[0]);
            if (Math.abs(angle) > 0.02) return [];
            const textStyle = content.styles[item.fontName];
            const fontInfo = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
            const height = Math.max(item.height, Math.hypot(transform[2], transform[3]));
            const ascent = textStyle?.ascent > 0 ? textStyle.ascent : 1;
            const weight = fontWeightFor(fontInfo);
            const style = fontStyleFor(fontInfo);
            return [
              {
                id: `${pageNumber}-${itemIndex}`,
                text: item.str,
                x: transform[4],
                y: transform[5] - height * ascent,
                width: Math.max(item.width, 8),
                height,
                baselineRatio: ascent,
                fontFamily: fontFamilyFor(textStyle, fontInfo),
                isBold: weight === "bold",
                isItalic: style === "italic",
                color: textColors.get(`${pageNumber}-${itemIndex}`) || "#20231f",
                fontSize: height,
              },
            ];
          });

          pageList.push({
            pageNumber,
            originalIndex: pageNumber,
            rotation: 0,
            page,
            viewport,
            textItems,
          });
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

  // Compute scale for a page based on zoom setting
  const getPageScale = useCallback(
    (pageInfo) => {
      const effectiveRotation = (pageInfo.page.rotate + (pageInfo.rotation || 0)) % 360;
      const rotViewport = pageInfo.page.getViewport({ scale: 1, rotation: effectiveRotation });
      const fitScale = Math.min((stageWidth - 64) / rotViewport.width, 1.35);
      if (zoom === "fit") return Math.max(0.35, fitScale);
      return Number(zoom) * (stageWidth > 800 ? 1.0 : fitScale);
    },
    [stageWidth, zoom]
  );

  // Render pages to canvas
  useEffect(() => {
    if (!pages.length || !stageWidth) return undefined;
    let cancelled = false;
    const renderTasks = [];

    pages.forEach((pageInfo) => {
      const { pageNumber, page, rotation = 0 } = pageInfo;
      const canvas = canvasRefs.current[pageNumber];
      if (!canvas) return;

      const effectiveRotation = (page.rotate + rotation) % 360;
      const scale = getPageScale(pageInfo);
      const viewport = page.getViewport({ scale, rotation: effectiveRotation });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const context = canvas.getContext("2d", { alpha: false });
      const task = page.render({
        canvasContext: context,
        viewport,
        transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
      });
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
  }, [pages, stageWidth, zoom, getPageScale]);

  // Undo / Redo
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

  // Duplicate Selected
  const duplicateSelected = useCallback(() => {
    if (!selectedOverlay) return;
    const clone = {
      ...selectedOverlay,
      id: idFor(),
      x: selectedOverlay.x + 18,
      y: selectedOverlay.y + 18,
    };
    commit([...currentOverlayRef.current, clone]);
    setSelectedId(clone.id);
  }, [selectedOverlay, commit]);

  // Layering
  const bringForward = useCallback(() => {
    if (!selectedId) return;
    const items = [...currentOverlayRef.current];
    const idx = items.findIndex((o) => o.id === selectedId);
    if (idx === -1 || idx === items.length - 1) return;
    const [item] = items.splice(idx, 1);
    items.push(item);
    commit(items);
  }, [selectedId, commit]);

  const sendBackward = useCallback(() => {
    if (!selectedId) return;
    const items = [...currentOverlayRef.current];
    const idx = items.findIndex((o) => o.id === selectedId);
    if (idx <= 0) return;
    const [item] = items.splice(idx, 1);
    items.unshift(item);
    commit(items);
  }, [selectedId, commit]);

  // Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (event) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(window.document.activeElement?.tagName);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (event.target.closest?.(".pde-edit-text textarea")) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedId) {
        event.preventDefault();
        duplicateSelected();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && selectedId && !isInput) {
        event.preventDefault();
        const item = currentOverlayRef.current.find((o) => o.id === selectedId);
        if (item) setClipboard(item);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && clipboard && !isInput) {
        event.preventDefault();
        const clone = {
          ...clipboard,
          id: idFor(),
          page: activePage,
          x: clipboard.x + 20,
          y: clipboard.y + 20,
        };
        commit([...currentOverlayRef.current, clone]);
        setSelectedId(clone.id);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !isInput) {
        event.preventDefault();
        const selected = currentOverlayRef.current.find((overlay) => overlay.id === selectedId);
        if (selected?.kind === "edit-text") updateOverlay(selectedId, { text: "" });
        else {
          commit(currentOverlayRef.current.filter((overlay) => overlay.id !== selectedId));
          setSelectedId(null);
        }
      } else if (event.key === "Escape") {
        setSelectedId(null);
        setShowSearch(false);
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && selectedId && !isInput) {
        event.preventDefault();
        const delta = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0;
        const dy = event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0;
        const target = currentOverlayRef.current.find((o) => o.id === selectedId);
        if (target) {
          updateOverlay(selectedId, {
            x: Math.max(0, target.x + dx),
            y: Math.max(0, target.y + dy),
          });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commit, redo, selectedId, undo, updateOverlay, duplicateSelected, clipboard, activePage]);

  // Page Operations
  const rotatePage = (pageNumber, deltaAngle) => {
    setPages((curr) =>
      curr.map((p) =>
        p.pageNumber === pageNumber
          ? { ...p, rotation: ((p.rotation || 0) + deltaAngle + 360) % 360 }
          : p
      )
    );
    setSavedPdfUrl("");
  };

  const deletePage = (pageNumber) => {
    if (pages.length <= 1) return;
    const nextPages = pages.filter((p) => p.pageNumber !== pageNumber);
    const updated = nextPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    setPages(updated);
    setOverlays((curr) => curr.filter((o) => o.page !== pageNumber));
    if (activePage > updated.length) setActivePage(updated.length);
    setSavedPdfUrl("");
  };

  const movePage = (pageNumber, direction) => {
    const idx = pages.findIndex((p) => p.pageNumber === pageNumber);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return;

    const list = [...pages];
    const [moved] = list.splice(idx, 1);
    list.splice(targetIdx, 0, moved);

    const remapped = list.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    setPages(remapped);
    setActivePage(targetIdx + 1);
    setSavedPdfUrl("");
  };

  const duplicatePage = (pageNumber) => {
    const idx = pages.findIndex((p) => p.pageNumber === pageNumber);
    if (idx === -1) return;
    const source = pages[idx];
    const clone = { ...source, rotation: source.rotation };

    const list = [...pages];
    list.splice(idx + 1, 0, clone);
    const remapped = list.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    setPages(remapped);
    setActivePage(idx + 2);
    setSavedPdfUrl("");
  };

  const addOverlay = (page, point) => {
    const defaults = {
      id: idFor(),
      page: page.pageNumber,
      x: point.x,
      y: point.y,
      width: 160,
      height: 36,
      color: textColor,
      fontSize: Number(fontSize),
      fontFamily,
      isBold,
      isItalic,
      align: textAlign,
      bgColor: textBgColor,
      text: "",
      shape: shapeType,
      strokeWidth: shapeStrokeWidth,
      fillColor: shapeFillColor,
    };
    let next;
    if (tool === "text") {
      next = { ...defaults, kind: "text", text: "New text" };
    } else if (tool === "signature") {
      if (savedSignature) {
        next = {
          ...defaults,
          kind: "signature-stamp",
          imageData: savedSignature,
          width: 170,
          height: 65,
        };
      } else {
        setShowSigModal(true);
        return;
      }
    } else if (tool === "highlight") {
      next = { ...defaults, kind: "highlight", width: 150, height: 26, color: highlightColor };
    } else if (tool === "whiteout") {
      next = { ...defaults, kind: "whiteout", width: 150, height: 32 };
    } else if (tool === "shape") {
      next = {
        ...defaults,
        kind: "shape",
        width: 140,
        height: 75,
        color: textColor,
        shape: shapeType,
        strokeWidth: shapeStrokeWidth,
        fillColor: shapeFillColor,
      };
    } else if (tool === "comment") {
      next = { ...defaults, kind: "comment", width: 190, height: 84, text: "Add a note" };
    } else if (tool === "image" && imageData) {
      next = { ...defaults, kind: "image", width: 160, height: 100, imageData, imageType };
    } else {
      return;
    }

    const nextOverlays = [...currentOverlayRef.current, next];
    commit(nextOverlays);
    setSelectedId(next.id);
    setTool("select");
  };

  const getPoint = (event, page) => {
    const bounds = pageCanvasRefs.current[page.pageNumber]?.getBoundingClientRect();
    if (!bounds) return { x: 24, y: 24 };
    const scale = getPageScale(page);
    return {
      x: clamp((event.clientX - bounds.left) / scale, 0, page.viewport.width - 12),
      y: clamp((event.clientY - bounds.top) / scale, 0, page.viewport.height - 12),
    };
  };

  // Drawing tool pointer handlers
  const onDrawStart = (event, page) => {
    const point = getPoint(event, page);
    drawRef.current = {
      page: page.pageNumber,
      points: [point],
    };
    setCurrentStroke({
      page: page.pageNumber,
      points: [point],
      color: drawColor,
      strokeWidth: drawWidth,
      opacity: drawMode === "highlighter" ? 0.38 : 1.0,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onDrawMove = (event, page) => {
    if (!drawRef.current || drawRef.current.page !== page.pageNumber) return;
    const point = getPoint(event, page);
    drawRef.current.points.push(point);
    setCurrentStroke({
      page: page.pageNumber,
      points: [...drawRef.current.points],
      color: drawColor,
      strokeWidth: drawWidth,
      opacity: drawMode === "highlighter" ? 0.38 : 1.0,
    });
  };

  const onDrawEnd = (event, page) => {
    if (!drawRef.current || drawRef.current.page !== page.pageNumber) return;
    const points = drawRef.current.points;
    if (points.length > 1) {
      const nextStroke = {
        id: idFor(),
        kind: "draw",
        page: page.pageNumber,
        points,
        color: drawColor,
        strokeWidth: drawWidth,
        opacity: drawMode === "highlighter" ? 0.38 : 1.0,
        x: 0,
        y: 0,
        width: page.viewport.width,
        height: page.viewport.height,
      };
      commit([...currentOverlayRef.current, nextStroke]);
      setSelectedId(nextStroke.id);
    }
    drawRef.current = null;
    setCurrentStroke(null);
  };

  const onPagePointerDown = (event, page) => {
    if (event.target.closest(".pde-overlay")) return;
    setActivePage(page.pageNumber);

    if (tool === "draw") {
      onDrawStart(event, page);
      return;
    }

    if (tool !== "select" && !(tool === "image" && !imageData)) {
      addOverlay(page, getPoint(event, page));
    } else {
      setSelectedId(null);
    }
  };

  const editTextItem = (event, page, item) => {
    event?.stopPropagation?.();
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
      width: Math.max(item.width, 16),
      height: Math.max(item.height, 14),
      color: item.color || "#20231f",
      bgColor: "#ffffff",
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      isBold: Boolean(item.isBold),
      isItalic: Boolean(item.isItalic),
      align: "left",
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
    const scale = getPageScale(page);
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
    if (drag.moved) {
      updateOverlay(drag.id, { x: Math.max(0, drag.x + dx), y: Math.max(0, drag.y + dy) }, false);
    }
  };

  const onOverlayPointerUp = () => {
    if (dragRef.current?.moved) {
      setPast((items) => [...items.slice(-49), dragRef.current.before]);
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

  // Export to PDF
  const exportPdf = async () => {
    if (!file || !document || exporting) return;
    setExporting(true);
    setError("");
    setSavedPdfUrl("");
    try {
      const sourcePdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const outputPdf = await PDFDocument.create();

      const fontCache = new Map();
      const getFont = async (family, bold, italic) => {
        const name = standardFontName(family, bold, italic);
        if (!fontCache.has(name)) {
          fontCache.set(name, await outputPdf.embedFont(name));
        }
        return fontCache.get(name);
      };

      for (let i = 0; i < pages.length; i += 1) {
        const pageInfo = pages[i];
        const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageInfo.originalIndex - 1]);
        const initialRotation = copiedPage.getRotation().angle;
        const totalRotation = (initialRotation + (pageInfo.rotation || 0)) % 360;
        copiedPage.setRotation(degrees(totalRotation));
        outputPdf.addPage(copiedPage);

        const viewport = pageInfo.viewport;
        const pageOverlays = overlays.filter((o) => o.page === pageInfo.pageNumber);

        for (const overlay of pageOverlays) {
          const bounds = getBounds(overlay, viewport);
          const color = colorToRgb(overlay.color || "#20231f");

          if (overlay.kind === "edit-text") {
            if (overlay.bgColor !== "transparent") {
              const bgCol = overlay.bgColor ? colorToRgb(overlay.bgColor) : rgb(1, 1, 1);
              copiedPage.drawRectangle({
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                color: bgCol,
                borderWidth: 0,
              });
            }

            if (overlay.text) {
              const font = await getFont(overlay.fontFamily, overlay.isBold, overlay.isItalic);
              const baseline = overlay.y + Number(overlay.fontSize) * (overlay.baselineRatio || 0.8);
              const [textX] = viewport.convertToPdfPoint(overlay.x, baseline);
              const [, baselineY] = viewport.convertToPdfPoint(overlay.x, baseline);

              const lines = overlay.text.split("\n");
              const lineHeight = Number(overlay.fontSize) * 1.25;

              for (let l = 0; l < lines.length; l += 1) {
                const line = lines[l];
                if (!line) continue;
                let drawX = textX;
                if (overlay.align === "center" || overlay.align === "right") {
                  const textWidth = font.widthOfTextAtSize(line, Number(overlay.fontSize));
                  if (overlay.align === "center") {
                    drawX += Math.max(0, (bounds.width - textWidth) / 2);
                  } else {
                    drawX += Math.max(0, bounds.width - textWidth);
                  }
                }

                copiedPage.drawText(line, {
                  x: drawX,
                  y: baselineY - l * lineHeight,
                  size: Number(overlay.fontSize),
                  font,
                  color,
                });
              }
            }
          } else if (overlay.kind === "text") {
            const font = await getFont(overlay.fontFamily, overlay.isBold, overlay.isItalic);
            const [textX] = viewport.convertToPdfPoint(overlay.x, overlay.y + Number(overlay.fontSize));
            const [, baselineY] = viewport.convertToPdfPoint(overlay.x, overlay.y + Number(overlay.fontSize));

            if (overlay.bgColor && overlay.bgColor !== "transparent") {
              copiedPage.drawRectangle({
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                color: colorToRgb(overlay.bgColor),
                borderWidth: 0,
              });
            }

            const lines = (overlay.text || "").split("\n");
            const lineHeight = Number(overlay.fontSize) * 1.25;

            for (let l = 0; l < lines.length; l += 1) {
              const line = lines[l];
              if (!line) continue;
              let drawX = textX;
              if (overlay.align === "center" || overlay.align === "right") {
                const textWidth = font.widthOfTextAtSize(line, Number(overlay.fontSize));
                if (overlay.align === "center") {
                  drawX += Math.max(0, (bounds.width - textWidth) / 2);
                } else {
                  drawX += Math.max(0, bounds.width - textWidth);
                }
              }

              copiedPage.drawText(line, {
                x: drawX,
                y: baselineY - l * lineHeight,
                size: Number(overlay.fontSize),
                font,
                color,
              });
            }
          } else if (overlay.kind === "signature" || overlay.kind === "signature-stamp") {
            if (overlay.imageData) {
              const embedded = overlay.imageData.startsWith("data:image/jpeg")
                ? await outputPdf.embedJpg(overlay.imageData)
                : await outputPdf.embedPng(overlay.imageData);
              copiedPage.drawImage(embedded, bounds);
            } else if (overlay.text) {
              const font = await getFont(overlay.fontFamily || "Times Roman", false, true);
              const [textX] = viewport.convertToPdfPoint(overlay.x, overlay.y + Number(overlay.fontSize));
              const [, baselineY] = viewport.convertToPdfPoint(overlay.x, overlay.y + Number(overlay.fontSize));
              copiedPage.drawText(overlay.text, {
                x: textX,
                y: baselineY,
                size: Number(overlay.fontSize || 24),
                font,
                color,
              });
            }
          } else if (overlay.kind === "draw") {
            const points = overlay.points || [];
            const strokeColor = colorToRgb(overlay.color || "#111827");
            const strokeWidth = overlay.strokeWidth || 2;
            const opacity = overlay.opacity ?? 1;

            for (let p = 0; p < points.length - 1; p += 1) {
              const [x1, y1] = viewport.convertToPdfPoint(points[p].x, points[p].y);
              const [x2, y2] = viewport.convertToPdfPoint(points[p + 1].x, points[p + 1].y);
              copiedPage.drawLine({
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
                thickness: strokeWidth,
                color: strokeColor,
                opacity,
              });
            }
          } else if (overlay.kind === "highlight") {
            copiedPage.drawRectangle({
              ...bounds,
              color,
              opacity: 0.38,
              borderWidth: 0,
            });
          } else if (overlay.kind === "whiteout") {
            copiedPage.drawRectangle({
              ...bounds,
              color: rgb(1, 1, 1),
              borderColor: rgb(0.85, 0.85, 0.85),
              borderWidth: 0.5,
            });
          } else if (overlay.kind === "shape") {
            const hasFill = overlay.fillColor && overlay.fillColor !== "transparent";
            const fillColor = hasFill ? colorToRgb(overlay.fillColor) : undefined;
            const borderWidth = overlay.strokeWidth || 2;

            if (overlay.shape === "ellipse") {
              copiedPage.drawEllipse({
                x: bounds.x + bounds.width / 2,
                y: bounds.y + bounds.height / 2,
                xScale: bounds.width / 2,
                yScale: bounds.height / 2,
                borderColor: color,
                borderWidth,
                color: fillColor,
              });
            } else if (overlay.shape === "line") {
              copiedPage.drawLine({
                start: { x: bounds.x, y: bounds.y },
                end: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                color,
                thickness: borderWidth,
              });
            } else if (overlay.shape === "arrow") {
              const start = { x: bounds.x, y: bounds.y };
              const end = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
              copiedPage.drawLine({ start, end, color, thickness: borderWidth });

              const theta = Math.atan2(end.y - start.y, end.x - start.x);
              const arrowLen = Math.max(9, borderWidth * 3.5);
              const arrowAngle = Math.PI / 6;

              const w1 = {
                x: end.x - arrowLen * Math.cos(theta - arrowAngle),
                y: end.y - arrowLen * Math.sin(theta - arrowAngle),
              };
              const w2 = {
                x: end.x - arrowLen * Math.cos(theta + arrowAngle),
                y: end.y - arrowLen * Math.sin(theta + arrowAngle),
              };

              copiedPage.drawLine({ start: end, end: w1, color, thickness: borderWidth });
              copiedPage.drawLine({ start: end, end: w2, color, thickness: borderWidth });
            } else if (overlay.shape === "checkmark") {
              const p1 = { x: bounds.x + bounds.width * 0.15, y: bounds.y + bounds.height * 0.45 };
              const p2 = { x: bounds.x + bounds.width * 0.42, y: bounds.y + bounds.height * 0.15 };
              const p3 = { x: bounds.x + bounds.width * 0.88, y: bounds.y + bounds.height * 0.85 };
              copiedPage.drawLine({ start: p1, end: p2, color, thickness: borderWidth + 1 });
              copiedPage.drawLine({ start: p2, end: p3, color, thickness: borderWidth + 1 });
            } else {
              copiedPage.drawRectangle({
                ...bounds,
                borderColor: color,
                borderWidth,
                color: fillColor,
              });
            }
          } else if (overlay.kind === "image") {
            const embedded =
              overlay.imageType === "image/png"
                ? await outputPdf.embedPng(overlay.imageData)
                : await outputPdf.embedJpg(overlay.imageData);
            copiedPage.drawImage(embedded, bounds);
          } else if (overlay.kind === "comment") {
            copiedPage.drawRectangle({
              ...bounds,
              color: rgb(1, 0.96, 0.76),
              borderColor: rgb(0.72, 0.62, 0.31),
              borderWidth: 0.8,
            });
            const font = await getFont("Helvetica", false, false);
            const [textX, textY] = viewport.convertToPdfPoint(overlay.x + 7, overlay.y + 19);
            copiedPage.drawText(overlay.text || "", {
              x: textX,
              y: textY,
              size: 11,
              font,
              color: rgb(0.2, 0.2, 0.16),
              maxWidth: Math.max(20, bounds.width - 14),
              lineHeight: 13,
            });
          }
        }
      }

      const bytes = await outputPdf.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setSavedPdfUrl(url);
    } catch (exportError) {
      setError(exportError?.message || "The edited PDF could not be saved.");
    } finally {
      setExporting(false);
    }
  };

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
          <p>
            Click text on a page to edit it, or draw, sign, add shapes, and annotate. All changes
            are rendered in high resolution and saved into a new PDF copy.
          </p>
        </div>
        <div className="pde-header-actions">
          <span className="pde-local">
            <i aria-hidden="true" /> Files stay on this device
          </span>
          <button className="pde-change-file" type="button" onClick={onReplaceFile}>
            Choose another PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="pde-error" role="alert">
          <strong>Could not complete that action.</strong> {error}
        </div>
      )}
      {!file && (
        <div className="pde-empty">Upload a PDF in the file area above to start editing.</div>
      )}

      {file && (
        <div className="pde-workspace">
          {/* TOPBAR */}
          <div className="pde-topbar">
            <div className="pde-tools" role="toolbar" aria-label="Editor tools">
              {TOOLS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={tool === id ? "is-active" : ""}
                  onClick={() => {
                    if (id === "signature" && !savedSignature) {
                      setShowSigModal(true);
                    } else {
                      setTool(id);
                    }
                  }}
                  aria-pressed={tool === id}
                  disabled={loading || !document}
                >
                  {label}
                </button>
              ))}

              <div className="pde-tool-divider" />

              <button
                type="button"
                className={`pde-search-trigger ${showSearch ? "is-active" : ""}`}
                onClick={() => setShowSearch(!showSearch)}
                title="Find & Replace text"
                disabled={loading || !document}
              >
                🔍 Find
              </button>
            </div>

            {/* ZOOM CONTROLS */}
            <div className="pde-zoom-bar">
              <button
                type="button"
                className="pde-zoom-btn"
                onClick={() => {
                  const curr = typeof zoom === "number" ? zoom : 1.0;
                  const idx = ZOOM_PRESETS.findIndex((p) => p.value === curr);
                  if (idx > 1) setZoom(ZOOM_PRESETS[idx - 1].value);
                  else if (curr > 0.5) setZoom(Math.max(0.4, Number((curr - 0.25).toFixed(2))));
                }}
                title="Zoom Out"
                disabled={loading}
              >
                −
              </button>

              <select
                className="pde-zoom-select"
                value={zoom}
                onChange={(e) => {
                  const val = e.target.value;
                  setZoom(val === "fit" ? "fit" : Number(val));
                }}
                aria-label="Zoom level"
                disabled={loading}
              >
                {ZOOM_PRESETS.map((p) => (
                  <option key={p.label} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="pde-zoom-btn"
                onClick={() => {
                  const curr = typeof zoom === "number" ? zoom : 1.0;
                  const idx = ZOOM_PRESETS.findIndex((p) => p.value === curr);
                  if (idx !== -1 && idx < ZOOM_PRESETS.length - 1)
                    setZoom(ZOOM_PRESETS[idx + 1].value);
                  else if (curr < 2.5) setZoom(Math.min(2.5, Number((curr + 0.25).toFixed(2))));
                }}
                title="Zoom In"
                disabled={loading}
              >
                +
              </button>
            </div>

            {/* HISTORY & EXPORT */}
            <div className="pde-history">
              <button
                type="button"
                onClick={undo}
                disabled={!past.length || loading}
                aria-label="Undo last edit (Ctrl+Z)"
                title="Undo (Ctrl+Z)"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!future.length || loading}
                aria-label="Redo last edit (Ctrl+Shift+Z)"
                title="Redo (Ctrl+Shift+Z)"
              >
                Redo
              </button>
              <button
                type="button"
                className="pde-save"
                onClick={exportPdf}
                disabled={loading || exporting || !document}
              >
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

          {/* SEARCH OVERLAY */}
          <SearchOverlay
            isOpen={showSearch}
            onClose={() => {
              setShowSearch(false);
              setSearchHighlight(null);
            }}
            pages={pages}
            activePage={activePage}
            onNavigateToMatch={(match) => {
              setActivePage(match.pageNumber);
              setSearchHighlight(match);
              pageRefs.current[match.pageNumber]?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
            onReplaceCurrent={(match, replaceTerm) => {
              editTextItem(null, match.page, { ...match.item, text: replaceTerm });
            }}
            onReplaceAll={(matches, replaceTerm) => {
              const newOverlays = [...currentOverlayRef.current];
              matches.forEach((m) => {
                const existingIdx = newOverlays.findIndex((o) => o.sourceTextId === m.item.id);
                if (existingIdx !== -1) {
                  newOverlays[existingIdx] = { ...newOverlays[existingIdx], text: replaceTerm };
                } else {
                  newOverlays.push({
                    id: idFor(),
                    sourceTextId: m.item.id,
                    originalText: m.item.text,
                    kind: "edit-text",
                    page: m.pageNumber,
                    x: m.item.x,
                    y: m.item.y,
                    width: Math.max(m.item.width, 16),
                    height: Math.max(m.item.height, 14),
                    color: m.item.color || "#20231f",
                    bgColor: "#ffffff",
                    fontSize: m.item.fontSize,
                    fontFamily: m.item.fontFamily,
                    isBold: Boolean(m.item.isBold),
                    isItalic: Boolean(m.item.isItalic),
                    align: "left",
                    text: replaceTerm,
                  });
                }
              });
              commit(newOverlays);
            }}
          />

          <div className="pde-body">
            {/* SIDEBAR */}
            <aside className="pde-sidebar" aria-label="Page navigation and selected item settings">
              <h3>
                Pages <span>{pages.length || "—"}</span>
              </h3>
              <div className="pde-page-list">
                {pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className={`pde-page-thumb-card ${activePage === page.pageNumber ? "is-current" : ""}`}
                    onClick={() => {
                      setActivePage(page.pageNumber);
                      pageRefs.current[page.pageNumber]?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    <div className="pde-page-thumb-meta">
                      <span className="pde-page-num">{page.pageNumber}</span>
                      <small>Page {page.pageNumber}</small>
                      {page.rotation > 0 && <span className="pde-rot-tag">{page.rotation}°</span>}
                    </div>

                    <div className="pde-page-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => rotatePage(page.pageNumber, 90)}
                        title="Rotate 90° clockwise"
                        aria-label="Rotate clockwise"
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(page.pageNumber, "up")}
                        disabled={page.pageNumber === 1}
                        title="Move page up"
                        aria-label="Move page up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(page.pageNumber, "down")}
                        disabled={page.pageNumber === pages.length}
                        title="Move page down"
                        aria-label="Move page down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicatePage(page.pageNumber)}
                        title="Duplicate page"
                        aria-label="Duplicate page"
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePage(page.pageNumber)}
                        disabled={pages.length <= 1}
                        title="Delete page"
                        aria-label="Delete page"
                        className="pde-btn-danger-icon"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
                {loading && <p className="pde-side-note">Loading pages…</p>}
              </div>

              {/* INSPECTOR */}
              <div className="pde-inspector">
                <h3>{selectedOverlay ? "Selected item" : "Tool settings"}</h3>

                {/* DRAW TOOL SETTINGS */}
                {tool === "draw" && !selectedOverlay && (
                  <>
                    <div className="pde-field">
                      <span>Drawing Mode</span>
                      <div className="pde-btn-group">
                        <button
                          type="button"
                          className={drawMode === "pen" ? "is-active" : ""}
                          onClick={() => setDrawMode("pen")}
                        >
                          Pen
                        </button>
                        <button
                          type="button"
                          className={drawMode === "highlighter" ? "is-active" : ""}
                          onClick={() => setDrawMode("highlighter")}
                        >
                          Highlighter
                        </button>
                      </div>
                    </div>

                    <label className="pde-field">
                      Stroke color
                      <input
                        type="color"
                        value={drawColor}
                        onChange={(e) => setDrawColor(e.target.value)}
                      />
                    </label>

                    <label className="pde-field">
                      Thickness ({drawWidth}px)
                      <input
                        type="range"
                        min="1"
                        max="16"
                        step="0.5"
                        value={drawWidth}
                        onChange={(e) => setDrawWidth(Number(e.target.value))}
                      />
                    </label>
                  </>
                )}

                {/* SHAPE TOOL SETTINGS */}
                {tool === "shape" && !selectedOverlay && (
                  <>
                    <label className="pde-field">
                      Shape
                      <select
                        value={shapeType}
                        onChange={(event) => setShapeType(event.target.value)}
                        aria-label="Shape type"
                      >
                        <option value="rectangle">Rectangle</option>
                        <option value="ellipse">Ellipse / Circle</option>
                        <option value="line">Line</option>
                        <option value="arrow">Arrow</option>
                        <option value="checkmark">Checkmark</option>
                      </select>
                    </label>

                    <label className="pde-field">
                      Line color
                      <input
                        type="color"
                        value={textColor}
                        onChange={(event) => setTextColor(event.target.value)}
                      />
                    </label>

                    <label className="pde-field">
                      Border thickness ({shapeStrokeWidth}px)
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={shapeStrokeWidth}
                        onChange={(e) => setShapeStrokeWidth(Number(e.target.value))}
                      />
                    </label>

                    <label className="pde-field">
                      Fill color
                      <select
                        value={shapeFillColor}
                        onChange={(e) => setShapeFillColor(e.target.value)}
                      >
                        <option value="transparent">Transparent (None)</option>
                        <option value="#ffffff">White</option>
                        <option value="#fef08a">Light Yellow</option>
                        <option value="#bbf7d0">Light Green</option>
                        <option value="#bfdbfe">Light Blue</option>
                      </select>
                    </label>
                  </>
                )}

                {/* SIGNATURE TOOL SETTINGS */}
                {tool === "signature" && !selectedOverlay && (
                  <div style={{ padding: "0 13px" }}>
                    <button
                      type="button"
                      className="pde-btn-primary"
                      style={{ width: "100%", marginBottom: "8px" }}
                      onClick={() => setShowSigModal(true)}
                    >
                      {savedSignature ? "Change Signature" : "Create Signature"}
                    </button>
                    {savedSignature && (
                      <p className="pde-side-note">Click anywhere on the document to stamp your signature.</p>
                    )}
                  </div>
                )}

                {/* IMAGE TOOL SETTINGS */}
                {tool === "image" && !selectedOverlay && (
                  <label className="pde-file-button">
                    Choose PNG or JPEG
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => chooseImage(event.currentTarget)}
                      aria-label="Choose image to place"
                    />
                  </label>
                )}

                {/* TEXT TOOL SETTINGS */}
                {tool === "text" && !selectedOverlay && (
                  <>
                    <label className="pde-field">
                      Font family
                      <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                        <option value="Helvetica">Helvetica (Sans-Serif)</option>
                        <option value="Times Roman">Times Roman (Serif)</option>
                        <option value="Courier">Courier (Monospace)</option>
                      </select>
                    </label>

                    <div className="pde-field">
                      <span>Font styling</span>
                      <div className="pde-btn-group">
                        <button
                          type="button"
                          className={isBold ? "is-active" : ""}
                          onClick={() => setIsBold(!isBold)}
                          style={{ fontWeight: "bold" }}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          className={isItalic ? "is-active" : ""}
                          onClick={() => setIsItalic(!isItalic)}
                          style={{ fontStyle: "italic" }}
                        >
                          I
                        </button>
                      </div>
                    </div>

                    <label className="pde-field">
                      Font size
                      <input
                        type="number"
                        min="6"
                        max="96"
                        value={fontSize}
                        onChange={(e) => setFontSize(clamp(Number(e.target.value), 6, 96))}
                      />
                    </label>

                    <label className="pde-field">
                      Text color
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                      />
                    </label>

                    <label className="pde-field">
                      Background fill
                      <select value={textBgColor} onChange={(e) => setTextBgColor(e.target.value)}>
                        <option value="transparent">Transparent</option>
                        <option value="#ffffff">White</option>
                        <option value="#f8fafc">Light Gray</option>
                        <option value="#fef9c3">Soft Yellow</option>
                      </select>
                    </label>
                  </>
                )}

                {tool === "highlight" && !selectedOverlay && (
                  <label className="pde-field">
                    Highlight color
                    <input
                      type="color"
                      value={highlightColor}
                      onChange={(event) => setHighlightColor(event.target.value)}
                    />
                  </label>
                )}

                {tool === "whiteout" && !selectedOverlay && (
                  <p className="pde-warning">
                    <strong>Visual Whiteout.</strong> Whiteout covers text visually for printing or
                    display.
                  </p>
                )}

                {/* SELECTED OVERLAY PROPERTIES */}
                {selectedOverlay && (
                  <>
                    <div className="pde-layering-row">
                      <button
                        type="button"
                        className="pde-btn-tiny"
                        onClick={duplicateSelected}
                        title="Duplicate item (Ctrl+D)"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="pde-btn-tiny"
                        onClick={bringForward}
                        title="Bring to front"
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        className="pde-btn-tiny"
                        onClick={sendBackward}
                        title="Send to back"
                      >
                        Back
                      </button>
                    </div>

                    <div className="pde-field-row">
                      <label className="pde-field">
                        Width
                        <input
                          type="number"
                          min="10"
                          max="2000"
                          value={Math.round(selectedOverlay.width)}
                          onChange={(event) =>
                            updateOverlay(selectedId, {
                              width: clamp(Number(event.target.value), 10, 2000),
                            })
                          }
                        />
                      </label>
                      <label className="pde-field">
                        Height
                        <input
                          type="number"
                          min="10"
                          max="2000"
                          value={Math.round(selectedOverlay.height)}
                          onChange={(event) =>
                            updateOverlay(selectedId, {
                              height: clamp(Number(event.target.value), 10, 2000),
                            })
                          }
                        />
                      </label>
                    </div>

                    {(selectedOverlay.kind === "text" ||
                      selectedOverlay.kind === "edit-text" ||
                      selectedOverlay.kind === "comment") && (
                      <>
                        <label className="pde-field">
                          {selectedOverlay.kind === "comment" ? "Note" : "Text"}
                          <textarea
                            rows={3}
                            value={selectedOverlay.text || ""}
                            onChange={(event) =>
                              updateOverlay(selectedId, { text: event.target.value })
                            }
                            aria-label="Selected overlay text"
                          />
                        </label>

                        {selectedOverlay.kind !== "comment" && (
                          <>
                            <label className="pde-field">
                              Font family
                              <select
                                value={selectedOverlay.fontFamily || "Helvetica"}
                                onChange={(event) =>
                                  updateOverlay(selectedId, { fontFamily: event.target.value })
                                }
                                aria-label="Selected text font family"
                              >
                                <option value="Helvetica">Helvetica (Sans)</option>
                                <option value="Times Roman">Times Roman (Serif)</option>
                                <option value="Courier">Courier (Mono)</option>
                              </select>
                            </label>

                            <div className="pde-field">
                              <span>Font style</span>
                              <div className="pde-btn-group">
                                <button
                                  type="button"
                                  className={selectedOverlay.isBold ? "is-active" : ""}
                                  onClick={() =>
                                    updateOverlay(selectedId, { isBold: !selectedOverlay.isBold })
                                  }
                                  style={{ fontWeight: "bold" }}
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  className={selectedOverlay.isItalic ? "is-active" : ""}
                                  onClick={() =>
                                    updateOverlay(selectedId, {
                                      isItalic: !selectedOverlay.isItalic,
                                    })
                                  }
                                  style={{ fontStyle: "italic" }}
                                >
                                  I
                                </button>
                              </div>
                            </div>

                            <label className="pde-field">
                              Font size
                              <input
                                type="number"
                                min="6"
                                max="96"
                                value={Math.round(selectedOverlay.fontSize || 16)}
                                onChange={(event) =>
                                  updateOverlay(selectedId, {
                                    fontSize: clamp(Number(event.target.value), 6, 96),
                                  })
                                }
                              />
                            </label>

                            <div className="pde-field">
                              <span>Alignment</span>
                              <div className="pde-btn-group">
                                <button
                                  type="button"
                                  className={selectedOverlay.align === "left" ? "is-active" : ""}
                                  onClick={() => updateOverlay(selectedId, { align: "left" })}
                                >
                                  Left
                                </button>
                                <button
                                  type="button"
                                  className={selectedOverlay.align === "center" ? "is-active" : ""}
                                  onClick={() => updateOverlay(selectedId, { align: "center" })}
                                >
                                  Center
                                </button>
                                <button
                                  type="button"
                                  className={selectedOverlay.align === "right" ? "is-active" : ""}
                                  onClick={() => updateOverlay(selectedId, { align: "right" })}
                                >
                                  Right
                                </button>
                              </div>
                            </div>

                            <label className="pde-field">
                              Background cover
                              <select
                                value={selectedOverlay.bgColor || "transparent"}
                                onChange={(e) =>
                                  updateOverlay(selectedId, { bgColor: e.target.value })
                                }
                              >
                                <option value="transparent">Transparent</option>
                                <option value="#ffffff">White</option>
                                <option value="#f8fafc">Light Gray</option>
                                <option value="#fef9c3">Soft Yellow</option>
                              </select>
                            </label>
                          </>
                        )}

                        <label className="pde-field">
                          Color
                          <input
                            type="color"
                            value={selectedOverlay.color || "#20231f"}
                            onChange={(event) =>
                              updateOverlay(selectedId, { color: event.target.value })
                            }
                          />
                        </label>
                      </>
                    )}

                    {selectedOverlay.kind === "shape" && (
                      <>
                        <label className="pde-field">
                          Shape
                          <select
                            value={selectedOverlay.shape || "rectangle"}
                            onChange={(e) => updateOverlay(selectedId, { shape: e.target.value })}
                          >
                            <option value="rectangle">Rectangle</option>
                            <option value="ellipse">Ellipse</option>
                            <option value="line">Line</option>
                            <option value="arrow">Arrow</option>
                            <option value="checkmark">Checkmark</option>
                          </select>
                        </label>

                        <label className="pde-field">
                          Stroke color
                          <input
                            type="color"
                            value={selectedOverlay.color || "#20231f"}
                            onChange={(event) =>
                              updateOverlay(selectedId, { color: event.target.value })
                            }
                          />
                        </label>

                        <label className="pde-field">
                          Stroke width ({selectedOverlay.strokeWidth || 2}px)
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={selectedOverlay.strokeWidth || 2}
                            onChange={(e) =>
                              updateOverlay(selectedId, { strokeWidth: Number(e.target.value) })
                            }
                          />
                        </label>

                        <label className="pde-field">
                          Fill color
                          <select
                            value={selectedOverlay.fillColor || "transparent"}
                            onChange={(e) =>
                              updateOverlay(selectedId, { fillColor: e.target.value })
                            }
                          >
                            <option value="transparent">Transparent</option>
                            <option value="#ffffff">White</option>
                            <option value="#fef08a">Light Yellow</option>
                            <option value="#bbf7d0">Light Green</option>
                            <option value="#bfdbfe">Light Blue</option>
                          </select>
                        </label>
                      </>
                    )}

                    {selectedOverlay.kind === "draw" && (
                      <>
                        <label className="pde-field">
                          Stroke color
                          <input
                            type="color"
                            value={selectedOverlay.color || "#111827"}
                            onChange={(event) =>
                              updateOverlay(selectedId, { color: event.target.value })
                            }
                          />
                        </label>
                        <label className="pde-field">
                          Thickness ({selectedOverlay.strokeWidth || 2}px)
                          <input
                            type="range"
                            min="1"
                            max="16"
                            value={selectedOverlay.strokeWidth || 2}
                            onChange={(e) =>
                              updateOverlay(selectedId, { strokeWidth: Number(e.target.value) })
                            }
                          />
                        </label>
                      </>
                    )}

                    {selectedOverlay.kind === "highlight" && (
                      <label className="pde-field">
                        Color
                        <input
                          type="color"
                          value={selectedOverlay.color || "#f4db74"}
                          onChange={(event) =>
                            updateOverlay(selectedId, { color: event.target.value })
                          }
                        />
                      </label>
                    )}

                    {selectedOverlay.kind === "edit-text" ? (
                      <button
                        className="pde-delete"
                        type="button"
                        onClick={() => updateOverlay(selectedId, { text: "" })}
                      >
                        Clear text
                      </button>
                    ) : (
                      <button className="pde-delete" type="button" onClick={removeSelected}>
                        Delete selected item
                      </button>
                    )}

                    <p className="pde-side-note">
                      {selectedOverlay.kind === "edit-text"
                        ? "Click directly on the text box to type. Drag corner handles to resize."
                        : "Drag handles to resize. Drag body to reposition."}
                    </p>
                  </>
                )}

                {!selectedOverlay && (
                  <p className="pde-side-note">
                    {tool === "select"
                      ? "Choose an item or click existing text on the page to edit it."
                      : `Click on a page to place ${tool}.`}
                  </p>
                )}
              </div>
            </aside>

            {/* MAIN STAGE */}
            <main className="pde-stage" ref={stageRef} aria-label="PDF pages">
              {loading && (
                <div className="pde-loading" role="status">
                  <span className="pde-spinner" /> Opening {file.name}…
                </div>
              )}

              {!loading &&
                !error &&
                pages.map((page) => {
                  const scale = getPageScale(page);
                  return (
                    <article
                      key={page.pageNumber}
                      className="pde-page"
                      ref={(node) => {
                        pageRefs.current[page.pageNumber] = node;
                      }}
                      onPointerUp={() => setActivePage(page.pageNumber)}
                    >
                      <div className="pde-page-header-row">
                        <span className="pde-page-label">PAGE {page.pageNumber}</span>
                        <div className="pde-page-quick-ops">
                          <button
                            type="button"
                            onClick={() => rotatePage(page.pageNumber, 90)}
                            title="Rotate 90° clockwise"
                          >
                            ↻ Rotate
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicatePage(page.pageNumber)}
                            title="Duplicate this page"
                          >
                            ⧉ Duplicate
                          </button>
                          {pages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deletePage(page.pageNumber)}
                              title="Delete this page"
                            >
                              🗑 Delete
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className={`pde-page-canvas pde-active-${tool}`}
                        ref={(node) => {
                          pageCanvasRefs.current[page.pageNumber] = node;
                        }}
                        style={{
                          width: page.viewport.width * scale,
                          height: page.viewport.height * scale,
                        }}
                        onPointerDown={(event) => onPagePointerDown(event, page)}
                        onPointerMove={(event) => {
                          if (tool === "draw") onDrawMove(event, page);
                        }}
                        onPointerUp={(event) => {
                          if (tool === "draw") onDrawEnd(event, page);
                        }}
                      >
                        <canvas
                          ref={(node) => {
                            canvasRefs.current[page.pageNumber] = node;
                          }}
                          aria-label={`PDF page ${page.pageNumber}`}
                        />

                        {/* Search Highlight indicator */}
                        {searchHighlight && searchHighlight.pageNumber === page.pageNumber && (
                          <div
                            className="pde-search-highlight-box"
                            style={{
                              left: searchHighlight.item.x * scale - 2,
                              top: searchHighlight.item.y * scale - 2,
                              width: searchHighlight.item.width * scale + 4,
                              height: searchHighlight.item.height * scale + 4,
                            }}
                          />
                        )}

                        {/* Clickable text items for direct replacement */}
                        {page.textItems.map((item) => {
                          const replaced = overlays.some((overlay) => overlay.sourceTextId === item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`pde-text-target${replaced ? " is-replaced" : ""}`}
                              style={{
                                left: item.x * scale,
                                top: item.y * scale,
                                width: item.width * scale,
                                height: item.height * scale,
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => editTextItem(event, page, item)}
                              aria-label={`Edit text: ${item.text}`}
                              aria-hidden={replaced}
                              tabIndex={replaced ? -1 : 0}
                            />
                          );
                        })}

                        {/* Overlays on page */}
                        {overlays
                          .filter((overlay) => overlay.page === page.pageNumber)
                          .map((overlay) => {
                            const isSelected = selectedId === overlay.id;
                            const isDraw = overlay.kind === "draw";

                            const style = isDraw
                              ? {
                                  position: "absolute",
                                  inset: 0,
                                  pointerEvents: tool === "select" ? "auto" : "none",
                                }
                              : {
                                  left: overlay.x * scale,
                                  top: overlay.y * scale,
                                  width: overlay.width * scale,
                                  height: overlay.height * scale,
                                  color: overlay.color,
                                  fontSize: (overlay.fontSize || 14) * scale,
                                  fontFamily: browserFontFor(overlay.fontFamily),
                                  fontWeight: overlay.isBold ? "bold" : "normal",
                                  fontStyle: overlay.isItalic ? "italic" : "normal",
                                  textAlign: overlay.align || "left",
                                  backgroundColor: overlay.bgColor || "transparent",
                                };

                            const overlayClass = `pde-overlay pde-${overlay.kind}${
                              isSelected ? " is-selected" : ""
                            }`;

                            return (
                              <div
                                key={overlay.id}
                                className={overlayClass}
                                style={style}
                                onPointerDown={(event) => onOverlayPointerDown(event, overlay, page)}
                                onPointerMove={onOverlayPointerMove}
                                onPointerUp={onOverlayPointerUp}
                                role={overlay.kind === "edit-text" ? undefined : "button"}
                                tabIndex={overlay.kind === "edit-text" ? -1 : 0}
                                aria-label={`${overlay.kind} overlay${isSelected ? ", selected" : ""}`}
                              >
                                {overlay.kind === "edit-text" && (
                                  <textarea
                                    className="pde-inline-text"
                                    ref={(node) => {
                                      inlineTextRefs.current[overlay.id] = node;
                                    }}
                                    value={overlay.text}
                                    style={{
                                      textAlign: overlay.align || "left",
                                      fontWeight: overlay.isBold ? "bold" : "normal",
                                      fontStyle: overlay.isItalic ? "italic" : "normal",
                                      backgroundColor: overlay.bgColor || "#ffffff",
                                    }}
                                    aria-label="Edit PDF text"
                                    onFocus={() => beginTextEdit(overlay.id)}
                                    onChange={(event) =>
                                      updateOverlay(overlay.id, { text: event.target.value }, false)
                                    }
                                    onBlur={() => finishTextEdit(overlay.id)}
                                    onPointerDown={(event) => {
                                      event.stopPropagation();
                                      setSelectedId(overlay.id);
                                    }}
                                  />
                                )}

                                {overlay.kind === "text" && (
                                  <div
                                    className="pde-text-content"
                                    style={{ width: "100%", height: "100%" }}
                                  >
                                    {overlay.text}
                                  </div>
                                )}

                                {(overlay.kind === "signature" ||
                                  overlay.kind === "signature-stamp") && (
                                  <>
                                    {overlay.imageData ? (
                                      <img
                                        src={overlay.imageData}
                                        alt="Signature stamp"
                                        draggable="false"
                                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                      />
                                    ) : (
                                      <span
                                        style={{
                                          fontFamily: '"Times New Roman", cursive',
                                          fontStyle: "italic",
                                        }}
                                      >
                                        {overlay.text}
                                      </span>
                                    )}
                                  </>
                                )}

                                {overlay.kind === "draw" && (
                                  <svg
                                    width="100%"
                                    height="100%"
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      pointerEvents: "none",
                                      overflow: "visible",
                                    }}
                                  >
                                    <path
                                      d={pointsToSvgPath(
                                        overlay.points.map((p) => ({
                                          x: p.x * scale,
                                          y: p.y * scale,
                                        }))
                                      )}
                                      stroke={overlay.color}
                                      strokeWidth={(overlay.strokeWidth || 2) * scale}
                                      fill="none"
                                      opacity={overlay.opacity ?? 1}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}

                                {overlay.kind === "shape" && (
                                  <svg
                                    width="100%"
                                    height="100%"
                                    style={{ overflow: "visible" }}
                                  >
                                    {overlay.shape === "ellipse" ? (
                                      <ellipse
                                        cx="50%"
                                        cy="50%"
                                        rx="calc(50% - 2px)"
                                        ry="calc(50% - 2px)"
                                        stroke={overlay.color}
                                        strokeWidth={(overlay.strokeWidth || 2) * scale}
                                        fill={overlay.fillColor || "none"}
                                      />
                                    ) : overlay.shape === "line" ? (
                                      <line
                                        x1={2}
                                        y1={2}
                                        x2="calc(100% - 2px)"
                                        y2="calc(100% - 2px)"
                                        stroke={overlay.color}
                                        strokeWidth={(overlay.strokeWidth || 2) * scale}
                                        strokeLinecap="round"
                                      />
                                    ) : overlay.shape === "arrow" ? (
                                      <>
                                        <defs>
                                          <marker
                                            id={`arrow-${overlay.id}`}
                                            markerWidth="6"
                                            markerHeight="6"
                                            refX="5"
                                            refY="3"
                                            orient="auto"
                                          >
                                            <path d="M0,0 L0,6 L6,3 z" fill={overlay.color} />
                                          </marker>
                                        </defs>
                                        <line
                                          x1={2}
                                          y1={2}
                                          x2="calc(100% - 6px)"
                                          y2="calc(100% - 6px)"
                                          stroke={overlay.color}
                                          strokeWidth={(overlay.strokeWidth || 2) * scale}
                                          markerEnd={`url(#arrow-${overlay.id})`}
                                          strokeLinecap="round"
                                        />
                                      </>
                                    ) : overlay.shape === "checkmark" ? (
                                      <path
                                        d="M4 12 L9 17 L20 6"
                                        stroke={overlay.color}
                                        strokeWidth={(overlay.strokeWidth || 3) * scale}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    ) : (
                                      <rect
                                        x={1}
                                        y={1}
                                        width="calc(100% - 2px)"
                                        height="calc(100% - 2px)"
                                        stroke={overlay.color}
                                        strokeWidth={(overlay.strokeWidth || 2) * scale}
                                        fill={overlay.fillColor || "none"}
                                      />
                                    )}
                                  </svg>
                                )}

                                {overlay.kind === "comment" && <span>{overlay.text}</span>}
                                {overlay.kind === "image" && (
                                  <img
                                    src={overlay.imageData}
                                    alt="Placed image"
                                    draggable="false"
                                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                  />
                                )}

                                {/* Interactive Resize Handles */}
                                {isSelected && !isDraw && tool === "select" && (
                                  <ResizeHandles
                                    overlay={overlay}
                                    scale={scale}
                                    onResize={(changes) => updateOverlay(overlay.id, changes, false)}
                                    onResizeEnd={() => commit(currentOverlayRef.current)}
                                  />
                                )}
                              </div>
                            );
                          })}

                        {/* Live Freehand Stroke Preview */}
                        {currentStroke && currentStroke.page === page.pageNumber && (
                          <svg
                            width="100%"
                            height="100%"
                            style={{
                              position: "absolute",
                              inset: 0,
                              pointerEvents: "none",
                              zIndex: 10,
                            }}
                          >
                            <path
                              d={pointsToSvgPath(
                                currentStroke.points.map((p) => ({
                                  x: p.x * scale,
                                  y: p.y * scale,
                                }))
                              )}
                              stroke={currentStroke.color}
                              strokeWidth={currentStroke.strokeWidth * scale}
                              fill="none"
                              opacity={currentStroke.opacity}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                    </article>
                  );
                })}

              {!loading && !error && document && (
                <div className="pde-stage-end">
                  End of document · {pages.length} {pages.length === 1 ? "page" : "pages"}
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {/* SIGNATURE MODAL */}
      <SignatureModal
        isOpen={showSigModal}
        onClose={() => setShowSigModal(false)}
        onApplySignature={(sigDataUrl) => {
          setSavedSignature(sigDataUrl);
          const targetPage = pages.find((p) => p.pageNumber === activePage) || pages[0];
          if (targetPage) {
            const next = {
              id: idFor(),
              kind: "signature-stamp",
              page: targetPage.pageNumber,
              x: 60,
              y: 80,
              width: 170,
              height: 65,
              imageData: sigDataUrl,
            };
            commit([...currentOverlayRef.current, next]);
            setSelectedId(next.id);
            setTool("select");
          }
        }}
      />

      <p className="pde-footnote">
        Clicking existing text replaces it with editable text over the original page content.
        Changes are saved to a new PDF copy; no file is uploaded.
      </p>
    </section>
  );
}

export default PdfDocumentEditor;
