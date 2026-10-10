import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import tesseractWorkerUrl from "tesseract.js/dist/worker.min.js?url";
import englishDataUrl from "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const LIMITATIONS = {
  "protect-with-a-password":
    "Password encryption is not available in this browser-only build. No file was changed.",
  "unlock-a-pdf":
    "Removing PDF passwords is not supported here. No password or document is sent anywhere.",
};

const safeName = (name) => (name || "document").replace(/\.[^.]+$/, "") || "document";
const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const bytesOf = async (file) => new Uint8Array(await file.arrayBuffer());
const pdfFrom = async (file) => PDFDocument.load(await bytesOf(file), { ignoreEncryption: false });
const output = (bytes, type = "application/pdf") => new Blob([bytes], { type });
const parsePages = (value, count) => {
  const pages = [];
  const input = String(value || "").trim();
  if (!input) return pages;
  for (const part of input.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid page selection “${part.trim()}”. Use page numbers and ranges, such as 1,3-5.`);
    const start = Number(match[1]);
    const end = Number(match[2] || start);
    if (start < 1 || end < 1 || start > count || end > count) {
      throw new Error(`Page numbers must be between 1 and ${count}.`);
    }
    for (let page = Math.min(start, end); page <= Math.max(start, end); page += 1) {
      if (!pages.includes(page - 1)) pages.push(page - 1);
    }
  }
  return pages;
};
const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const makePdf = () => PDFDocument.create();

async function parsePdfJs(file) {
  const document = await getDocument({ data: await bytesOf(file) }).promise;
  return document;
}

async function renderPage(pdf, pageNumber, scale = 1.5) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

function pdfTextLayout(textContent) {
  return textContent.items
    .filter((item) => typeof item.str === "string" && item.str.trim())
    .map((item) => item.str.trim());
}

async function addText(doc, config, mode = "text", pageIndexes = doc.getPageIndices()) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const message = mode === "signature" ? config.signature : config.text;
  for (const pageIndex of pageIndexes) {
    const page = doc.getPages()[pageIndex];
    const x = n(config.x, 48);
    const y = page.getHeight() - n(config.y, 80);
    if (mode === "highlight") {
      page.drawRectangle({
        x,
        y: y - n(config.height, 24),
        width: n(config.width, 180),
        height: n(config.height, 24),
        color: rgb(1, 0.88, 0.2),
        opacity: 0.38,
        borderWidth: 0,
      });
      if (config.text) page.drawText(config.text, { x: x + 3, y: y - 17, size: n(config.fontSize, 12), font });
      continue;
    }
    page.drawText(message, {
      x, y, size: n(config.fontSize, 18), font,
      color: rgb(0.08, 0.12, 0.2),
      opacity: mode === "watermark" ? n(config.opacity, 0.25) : 1,
      rotate: mode === "watermark" ? degrees(-35) : undefined,
    });
  }
}

async function fillForm(doc, values) {
  const form = doc.getForm();
  const fields = new Map(form.getFields().map((field) => [field.getName(), field]));
  if (!String(values || "").trim()) throw new Error("Enter at least one form field value in the form shown.");
  let updated = 0;
  for (const line of String(values || "").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1) {
      if (line.trim()) throw new Error("Enter each value as FieldName=value.");
      continue;
    }
    const fieldName = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    const field = fields.get(fieldName);
    if (!field) throw new Error(`No form field named “${fieldName}”. Check the field names and try again.`);
    if (typeof field.setText === "function") {
      field.setText(value);
      updated += 1;
    }
    else if (typeof field.check === "function") {
      if (/^(true|yes|1|checked)$/i.test(value)) field.check();
      else field.uncheck();
      updated += 1;
    } else if (typeof field.select === "function") field.select(value);
    else throw new Error(`The form field “${fieldName}” cannot be filled by this tool.`);
    if (typeof field.select === "function") updated += 1;
  }
  if (!updated) throw new Error("Enter at least one valid form field value.");
}

async function savePdf(doc) {
  return output(await doc.save({ useObjectStreams: true }));
}

async function createPdfFromText(lines, title = "Converted document") {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  let y = margin;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const textLines = lines.length ? lines : [title];
  for (const line of textLines) {
    const wrapped = pdf.splitTextToSize(line || " ", 612 - margin * 2);
    for (const row of wrapped) {
      if (y > 740) { pdf.addPage(); y = margin; }
      pdf.text(row, margin, y);
      y += 15;
    }
  }
  return pdf.output("blob");
}

async function pdfToDocx(file) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const pdf = await parsePdfJs(file);
  const paragraphs = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const text = await pdf.getPage(page).then((p) => p.getTextContent());
    if (page > 1) paragraphs.push(new Paragraph({ children: [new TextRun({ text: `Page ${page}`, bold: true })], pageBreakBefore: true }));
    paragraphs.push(...pdfTextLayout(text).map((line) => new Paragraph(line)));
  }
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  return Packer.toBlob(doc);
}

async function convertPdfToExcel(file) {
  const ExcelJS = (await import("exceljs")).default;
  const pdf = await parsePdfJs(file);
  const workbook = new ExcelJS.Workbook();
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const text = await pdf.getPage(page).then((p) => p.getTextContent());
    const rows = pdfTextLayout(text).map((line) => line.split(/\s{2,}|\t/));
    const worksheet = workbook.addWorksheet(`Page ${page}`);
    (rows.length ? rows : [["No selectable text on this page"]]).forEach((row) => worksheet.addRow(row));
  }
  return output(new Uint8Array(await workbook.xlsx.writeBuffer()), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

async function convertPdfToPptx(file, progress) {
  const pptxgen = (await import("pptxgenjs")).default;
  const pdf = await parsePdfJs(file);
  const deck = new pptxgen();
  deck.layout = "LAYOUT_WIDE";
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const image = await renderPage(pdf, page, 1.5);
    const slide = deck.addSlide();
    slide.addImage({ data: image, x: 0, y: 0, w: 13.333, h: 7.5 });
    progress?.(page / pdf.numPages);
  }
  return output(await deck.write({ outputType: "arraybuffer" }), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
}

async function convertImagesToPdf(files) {
  if (!files.length) throw new Error("Choose one or more PNG or JPG images.");
  const doc = await makePdf();
  for (const file of files) {
    let image;
    if (/png/i.test(file.type) || /\.png$/i.test(file.name)) image = await doc.embedPng(await bytesOf(file));
    else if (/jpe?g/i.test(file.type) || /\.jpe?g$/i.test(file.name)) image = await doc.embedJpg(await bytesOf(file));
    else throw new Error(`${file.name} is not a PNG or JPG image.`);
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return savePdf(doc);
}

async function convertOfficeToPdf(file, toolId) {
  if (toolId === "word-to-pdf") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (!result.value.trim()) throw new Error("No text could be read from this Word document.");
    return createPdfFromText(result.value.split(/\r?\n/), file.name);
  }
  const lines = [];
  if (/\.csv$/i.test(file.name)) {
    for (const row of parseCsv(await file.text())) lines.push(row.join(" | "));
  } else {
    if (/\.xls$/i.test(file.name)) throw new Error("Legacy .xls files are not supported. Save the workbook as .xlsx or CSV and try again.");
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.eachSheet((worksheet) => {
      lines.push(worksheet.name);
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        lines.push(row.values.slice(1).map((_, index) => row.getCell(index + 1).text).join(" | "));
      });
      lines.push("");
    });
  }
  return createPdfFromText(lines, file.name);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value); value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = []; value = "";
    } else value += character;
  }
  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}
async function ocrPdf(file, progress) {
  const Tesseract = (await import("tesseract.js")).default;
  const pdf = await parsePdfJs(file);
  const modelResponse = await fetch(englishDataUrl);
  if (!modelResponse.ok) throw new Error("The bundled English OCR model could not be loaded.");
  const englishData = new Uint8Array(await modelResponse.arrayBuffer());
  const worker = await Tesseract.createWorker([{ code: "eng", data: englishData }], 1, {
    workerPath: tesseractWorkerUrl,
    workerBlobURL: false,
    logger: (event) => { if (event.status === "recognizing text") progress?.(event.progress); },
  });
  try {
    const result = [];
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const image = await renderPage(pdf, page, 1.7);
      const recognized = await worker.recognize(image);
      result.push(`--- Page ${page} ---`, recognized.data.text.trim(), "");
      progress?.(page / pdf.numPages);
    }
    return output(new Blob([result.join("\n")], { type: "text/plain;charset=utf-8" }), "text/plain");
  } finally {
    await worker.terminate();
  }
}

async function zipPageImages(file, progress, scale = 1.6) {
  const JSZip = (await import("jszip")).default;
  const pdf = await parsePdfJs(file);
  const zip = new JSZip();
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const image = await renderPage(pdf, page, scale);
    const base64 = image.split(",")[1];
    zip.file(`page-${String(page).padStart(3, "0")}.jpg`, base64, { base64: true });
    progress?.(page / pdf.numPages);
  }
  return output(await zip.generateAsync({ type: "uint8array" }), "application/zip");
}

export async function runPdfTool({ toolId, files = [], imageFile, config = {}, onProgress }) {
  if (LIMITATIONS[toolId]) throw new Error(LIMITATIONS[toolId]);
  const file = files[0];
  let blob;
  let filename;

  if (toolId === "images-to-pdf") {
    blob = await convertImagesToPdf(files);
    filename = "images.pdf";
  } else if (toolId === "word-to-pdf" || toolId === "excel-to-pdf") {
    if (!file) throw new Error("Choose a Word (.docx) or Excel (.xlsx or .csv) file.");
    blob = await convertOfficeToPdf(file, toolId);
    filename = `${safeName(file.name)}.pdf`;
  } else {
    if (!file) throw new Error("Choose a PDF file first.");
    const doc = await pdfFrom(file);
    const count = doc.getPageCount();
    const selected = parsePages(config.pages, count);
    const base = safeName(file.name);

    switch (toolId) {
      case "edit-pdf":
        if (!config.text?.trim()) throw new Error("Enter the text you want to add.");
        await addText(doc, config);
        blob = await savePdf(doc); filename = `${base}-edited.pdf`; break;
      case "add-text-and-images":
        if (!config.text?.trim() && !imageFile) throw new Error("Enter text or choose an image to add.");
        if (config.text?.trim()) await addText(doc, config);
        if (imageFile) {
          const image = /png/i.test(imageFile.type) ? await doc.embedPng(await bytesOf(imageFile)) : await doc.embedJpg(await bytesOf(imageFile));
          const page = doc.getPages()[Math.max(0, n(config.page, 1) - 1)];
          if (!page) throw new Error("The selected page does not exist.");
          const width = n(config.imageWidth, 120);
          page.drawImage(image, { x: n(config.x, 48), y: page.getHeight() - n(config.y, 80) - width * image.height / image.width, width, height: width * image.height / image.width });
        }
        blob = await savePdf(doc); filename = `${base}-edited.pdf`; break;
      case "annotate-and-highlight":
        await addText(doc, config, "highlight", selected.length ? selected : doc.getPageIndices());
        blob = await savePdf(doc); filename = `${base}-annotated.pdf`; break;
      case "sign-a-pdf":
        if (!config.signature?.trim()) throw new Error("Enter the signature text you want to add.");
        await addText(doc, config, "signature"); blob = await savePdf(doc); filename = `${base}-signed.pdf`; break;
      case "add-page-numbers": {
        const font = await doc.embedFont(StandardFonts.Helvetica);
        doc.getPages().forEach((page, index) => page.drawText(`${config.prefix || ""}${index + 1}${config.suffix || ""}`, {
          x: page.getWidth() - 54, y: 24, size: 10, font, color: rgb(0.25, 0.3, 0.38),
        }));
        blob = await savePdf(doc); filename = `${base}-numbered.pdf`; break;
      }
      case "add-a-watermark":
        if (!config.text?.trim()) throw new Error("Enter the watermark text you want to add.");
        await addText(doc, config, "watermark");
        blob = await savePdf(doc); filename = `${base}-watermarked.pdf`; break;
      case "fill-pdf-forms":
        await fillForm(doc, config.values); blob = await savePdf(doc); filename = `${base}-filled.pdf`; break;
      case "flatten-a-pdf":
        if (!doc.getForm().getFields().length) throw new Error("This PDF has no interactive form fields to flatten.");
        doc.getForm().flatten(); blob = await savePdf(doc); filename = `${base}-flattened.pdf`; break;
      case "merge-pdfs": {
        if (files.length < 2) throw new Error("Choose at least two PDF files to merge.");
        const merged = await makePdf();
        for (const input of files) {
          const source = await pdfFrom(input);
          const pages = await merged.copyPages(source, source.getPageIndices());
          pages.forEach((page) => merged.addPage(page));
        }
        blob = await savePdf(merged); filename = "merged.pdf"; break;
      }
      case "split-a-pdf": {
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        const pages = selected.length ? selected : doc.getPageIndices();
        for (const index of pages) {
          const part = await makePdf();
          const [page] = await part.copyPages(doc, [index]);
          part.addPage(page);
          zip.file(`${base}-page-${index + 1}.pdf`, await part.save());
        }
        blob = output(await zip.generateAsync({ type: "uint8array" }), "application/zip");
        filename = `${base}-split.zip`; break;
      }
      case "extract-pages": {
        if (!selected.length) throw new Error("Enter valid page numbers, such as 1,3-5.");
        const extracted = await makePdf();
        (await extracted.copyPages(doc, selected)).forEach((page) => extracted.addPage(page));
        blob = await savePdf(extracted); filename = `${base}-pages.pdf`; break;
      }
      case "delete-pages": {
        const pages = selected.length ? selected : [];
        if (!pages.length) throw new Error("Enter page numbers to delete, such as 2,4.");
        if (pages.length >= count) throw new Error("A PDF must keep at least one page.");
        pages.sort((a, b) => b - a).forEach((index) => doc.removePage(index));
        blob = await savePdf(doc); filename = `${base}-pages-deleted.pdf`; break;
      }
      case "reorder-or-rotate-pages": {
        if (config.order?.trim()) {
          const order = parsePages(config.order, count);
          if (order.length !== count) throw new Error(`Enter every page exactly once in the new order (1–${count}).`);
          const reordered = await makePdf();
          (await reordered.copyPages(doc, order)).forEach((page) => reordered.addPage(page));
          blob = await savePdf(reordered);
        } else {
          const rotation = n(config.rotation, 90);
          for (const index of selected.length ? selected : doc.getPageIndices()) {
            const page = doc.getPages()[index];
            page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
          }
          blob = await savePdf(doc);
        }
        filename = `${base}-organized.pdf`; break;
      }
      case "crop-pages":
        for (const index of selected.length ? selected : doc.getPageIndices()) {
          const page = doc.getPages()[index];
          const inset = n(config.inset, 36);
          if (inset * 2 >= Math.min(page.getWidth(), page.getHeight())) throw new Error("Crop margin is too large for the selected page.");
          page.setCropBox(inset, inset, page.getWidth() - inset * 2, page.getHeight() - inset * 2);
        }
        blob = await savePdf(doc); filename = `${base}-cropped.pdf`; break;
      case "alternate-and-mix-pdfs": {
        if (files.length < 2) throw new Error("Choose two PDFs: the first is document A and the second is document B.");
        const second = await pdfFrom(files[1]);
        const mixed = await makePdf();
        const max = Math.max(count, second.getPageCount());
        for (let index = 0; index < max; index += 1) {
          for (const [source, sourceIndex] of [[doc, index], [second, index]]) {
            if (sourceIndex < source.getPageCount()) {
              const [page] = await mixed.copyPages(source, [sourceIndex]);
              mixed.addPage(page);
            }
          }
        }
        blob = await savePdf(mixed); filename = "alternated.pdf"; break;
      }
      case "pdf-to-word":
        blob = await pdfToDocx(file); filename = `${base}.docx`; break;
      case "pdf-to-excel":
        blob = await convertPdfToExcel(file); filename = `${base}.xlsx`; break;
      case "pdf-to-powerpoint":
        blob = await convertPdfToPptx(file, onProgress); filename = `${base}.pptx`; break;
      case "pdf-to-jpg-or-images":
        blob = await zipPageImages(file, onProgress, config.quality === "high" ? 2.2 : 1.6); filename = `${base}-images.zip`; break;
      case "compress-a-pdf": {
        // Server-side compression with image downscaling
        const level = config.compression || "medium";
        const fileBytes = await bytesOf(file);

        const response = await fetch(`/api/compress-pdf?level=${level}`, {
          method: "POST",
          body: fileBytes,
          headers: { "Content-Type": "application/octet-stream" },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Server compression failed");
        }

        const result = await response.json();
        const compressedBuffer = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
        blob = output(compressedBuffer);
        filename = `${base}-compressed.pdf`;
        break;
      }
      case "repair-a-pdf":
        blob = await savePdf(doc); filename = `${base}-repaired.pdf`; break;
      case "recognize-text-ocr":
        blob = await ocrPdf(file, onProgress); filename = `${base}-ocr.txt`; break;
      default:
        throw new Error("This tool is not available.");
    }
  }

  if (!(blob instanceof Blob)) throw new Error("The operation did not produce a downloadable file.");
  // Verify output: at minimum must have content and correct type
  if (blob.size < 100) throw new Error("Output file is too small; processing may have failed.");
  return { blob, filename };
}
Co-Authored-By: Claude Code <noreply@anthropic.com>
🤖 Generated with [Claude Code](https://claude.com/claude-code)
