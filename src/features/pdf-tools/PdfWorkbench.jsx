import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./workbench.css";
import ToolControls from "./ToolControls.jsx";

const PdfDocumentEditor = lazy(() => import("../pdf-editor/PdfDocumentEditor.jsx"));

const LIMITATIONS = {
  "protect-with-a-password": "Password encryption is not available in this browser-only build. No file was changed.",
  "unlock-a-pdf": "Removing PDF passwords is not supported here. No password or document is sent anywhere.",
};

const FILE_TYPES = {
  "word-to-pdf": ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "excel-to-pdf": ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
  "images-to-pdf": "image/png,image/jpeg,.png,.jpg,.jpeg",
};

const MULTI_FILE_TOOLS = new Set(["merge-pdfs", "alternate-and-mix-pdfs", "images-to-pdf"]);

const TOOL_HELP = {
  "edit-pdf": "Open your PDF and make page-by-page edits with text, images, shapes, and annotations.",
  "annotate-and-highlight": "Place a translucent highlight on each page. Coordinates are measured from the upper-left corner, in PDF points.",
  "add-text-and-images": "Place text on every page and optionally add one PNG or JPG to a selected page.",
  "fill-pdf-forms": "Enter one field per line as FieldName=value. Only existing fillable PDF fields can be changed.",
  "sign-a-pdf": "Type a signature to stamp it on each page. This is a visual signature, not a certificate-based digital signature.",
  "add-page-numbers": "Number every page in the lower-right corner.",
  "add-a-watermark": "Stamp angled text onto each page.",
  "merge-pdfs": "Combine selected PDFs in the order shown.",
  "split-a-pdf": "Create a ZIP containing one PDF per selected page. Leave pages blank to split every page.",
  "extract-pages": "Create one PDF from the pages you select.",
  "reorder-or-rotate-pages": "Enter a full page order (for example 3,1,2), or leave it blank to rotate selected pages.",
  "delete-pages": "Delete the listed pages. At least one page must remain.",
  "crop-pages": "Crop selected pages by the same inset on all four sides.",
  "alternate-and-mix-pdfs": "Interleave page 1 of each PDF, then page 2, and so on.",
  "pdf-to-word": "Extract selectable text into a DOCX file. Layout and images are not preserved.",
  "pdf-to-excel": "Extract selectable text into an XLSX workbook, with one worksheet per PDF page.",
  "pdf-to-powerpoint": "Create one slide per PDF page using a page image; slides are not text-editable.",
  "pdf-to-jpg-or-images": "Render every page to JPG and download the images as a ZIP.",
  "word-to-pdf": "Convert the readable text in a DOCX file. Original styling and images may not be preserved.",
  "excel-to-pdf": "Convert spreadsheet cell values to a readable PDF.",
  "images-to-pdf": "Create one PDF page per selected PNG or JPG image.",
  "compress-a-pdf": "Rewrite the PDF in the browser with compact object streams. Existing image data is not recompressed.",
  "repair-a-pdf": "Try to parse and rewrite a readable PDF. Severely damaged or unsupported PDFs cannot be repaired.",
  "recognize-text-ocr": "Run English OCR in this browser and download recognized text as a TXT file.",
  "flatten-a-pdf": "Flatten interactive form fields into page content.",
};

export default function PdfWorkbench({ toolId, toolLabel }) {
  const [files, setFiles] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [config, setConfig] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const resultUrl = useMemo(() => result ? URL.createObjectURL(result.blob) : "", [result]);
  const editorOpen = toolId === "edit-pdf" && Boolean(files[0]);
  const isLimited = Boolean(LIMITATIONS[toolId]);
  const supported = Object.prototype.hasOwnProperty.call(TOOL_HELP, toolId) || toolId === "protect-with-a-password" || toolId === "unlock-a-pdf";
  const isMulti = MULTI_FILE_TOOLS.has(toolId);
  const accept = FILE_TYPES[toolId] || (toolId === "images-to-pdf" ? FILE_TYPES["images-to-pdf"] : "application/pdf,.pdf");

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => {
    setFiles([]);
    setImageFile(null);
    setConfig({});
    setError("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [toolId]);

  const addFiles = (selected) => {
    setFiles(Array.from(selected || []));
    if (inputRef.current) inputRef.current.value = "";
    setError("");
    setResult(null);
  };

  async function run() {
    setError("");
    setResult(null);
    setProgress(null);
    if (isLimited) { setError(LIMITATIONS[toolId]); return; }
    if (!supported) { setError("This tool is not available."); return; }
    if (!files.length) { setError("Choose a file to get started."); return; }
    setBusy(true);
    try {
      const { runPdfTool } = await import("./pdfTools.js");
      const response = await runPdfTool({
        toolId,
        files,
        imageFile,
        config,
        onProgress: (value) => setProgress(Math.min(100, Math.round(value * 100))),
      });
      setResult(response);
    } catch (cause) {
      setError(cause?.message || "The file could not be processed. Please try another file.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const label = toolLabel || "PDF tool";
  return (
    <section
      className={`pdfw${editorOpen ? " pdfw-editor-open" : ""}`}
      aria-labelledby={editorOpen ? undefined : "pdfw-title"}
      aria-label={editorOpen ? "Edit PDF workspace" : undefined}
    >
      <div className={`pdfw-heading${editorOpen ? " pdfw-heading-hidden" : ""}`}>
        <div>
          <span className="pdfw-kicker">PRIVATE BY DESIGN · PROCESSING STAYS ON THIS DEVICE</span>
          <h2 id="pdfw-title">{label}</h2>
          <p>{TOOL_HELP[toolId] || LIMITATIONS[toolId] || "Choose files to use this browser-based PDF tool."}</p>
        </div>
        <span className="pdfw-local-badge"><span /> Browser-only</span>
      </div>

      {isLimited && <div className="pdfw-limit" role="status"><strong>Not supported in browser-only mode</strong><span>{LIMITATIONS[toolId]}</span></div>}

      <div
        className={`pdfw-drop${dragging ? " is-dragging" : ""}${files.length ? " has-files" : ""}${editorOpen ? " pdfw-drop-hidden" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
      >
        <input ref={inputRef} className="pdfw-hidden-input" type="file" accept={accept} multiple={isMulti} onChange={(event) => addFiles(event.target.files)} />
        <span className="pdfw-upload-icon" aria-hidden="true">↑</span>
        <div className="pdfw-drop-copy">
          <strong>
            {files.length
              ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
              : isMulti
                ? "Drop your files here"
                : "Drop your file here"}
          </strong>
          <span>{files.length ? files.map((item) => item.name).join(" · ") : isMulti ? "Or choose multiple files in the required order" : "PDF stays on your device — nothing is uploaded"}</span>
        </div>
        <button type="button" className="pdfw-secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {files.length ? "Choose different file" : "Choose file"}
        </button>
      </div>

      {toolId === "edit-pdf" && files[0] && (
        <div>
          <Suspense fallback={<div className="pdfw-message" role="status">Opening PDF editor…</div>}>
            <PdfDocumentEditor file={files[0]} onReplaceFile={() => inputRef.current?.click()} />
          </Suspense>
        </div>
      )}

      {toolId !== "edit-pdf" && supported && !isLimited && (
        <div className="pdfw-controls">
          <ToolControls toolId={toolId} config={config} setConfig={setConfig} imageFile={imageFile} setImageFile={setImageFile} />
        </div>
      )}

      {toolId !== "edit-pdf" && (
        <>
          <div className="pdfw-actions">
            <button type="button" className="pdfw-primary" onClick={run} disabled={busy || !supported || isLimited || !files.length}>
              {busy ? <><span className="pdfw-spinner" /> Processing{progress !== null ? ` ${progress}%` : "…"}</> : `Run ${label}`}
            </button>
            {result && <a className="pdfw-download" href={resultUrl} download={result.filename}>Download {result.filename} <span aria-hidden="true">↓</span></a>}
          </div>
          {busy && <div className="pdfw-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress ?? 10}><span style={{ width: `${progress ?? 10}%` }} /></div>}
          {error && <div className="pdfw-message pdfw-error" role="alert">{error}</div>}
          {result && <div className="pdfw-message pdfw-success" role="status"><strong>Your file is ready.</strong> Processing completed locally in your browser.</div>}
          {!supported && <div className="pdfw-message pdfw-error" role="status">No browser operation is configured for this tool ID.</div>}
          <p className="pdfw-footnote">Files are processed locally in your browser. Results are not sent to a server.</p>
        </>
      )}
    </section>
  );
}
