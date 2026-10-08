import { StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";

export const idFor = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function colorToRgb(hex) {
  if (!hex || typeof hex !== "string") return rgb(0.12, 0.14, 0.12);
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return rgb(r, g, b);
  }
  const r = parseInt(clean.slice(0, 2) || "00", 16) / 255;
  const g = parseInt(clean.slice(2, 4) || "00", 16) / 255;
  const b = parseInt(clean.slice(4, 6) || "00", 16) / 255;
  return rgb(r, g, b);
}

export function fontFamilyFor(style, fontInfo) {
  const description = `${style?.fontFamily || ""} ${style?.fontName || ""} ${fontInfo?.name || ""} ${fontInfo?.fallbackName || ""}`.toLowerCase();
  const isCourier = /courier|mono|typewriter/i.test(description);
  const isTimes = /times|serif|roman/i.test(description) && !/sans[- ]serif/i.test(description);

  if (isCourier) return "Courier";
  if (isTimes) return "Times Roman";
  return "Helvetica";
}

export function fontWeightFor(fontInfo) {
  const weight = Number(fontInfo?.cssFontInfo?.fontWeight || fontInfo?.fontWeight);
  const description = `${fontInfo?.name || ""} ${fontInfo?.fallbackName || ""}`;
  return fontInfo?.bold || fontInfo?.black || weight >= 600 || /bold|black|heavy|demi|semibold/i.test(description)
    ? "bold"
    : "normal";
}

export function fontStyleFor(fontInfo) {
  const italicAngle = Number(fontInfo?.cssFontInfo?.italicAngle || fontInfo?.italicAngle || 0);
  const description = `${fontInfo?.name || ""} ${fontInfo?.fallbackName || ""}`;
  return fontInfo?.italic || italicAngle !== 0 || /italic|oblique/i.test(description) ? "italic" : "normal";
}

export function colorFromOperator(operation, args, currentColor) {
  if (operation === pdfjs.OPS.setFillRGBColor) {
    const value = args[0];
    if (typeof value === "string" && /^#[\da-f]{3,8}$/i.test(value)) return value;
    if (Array.isArray(value) && value.length >= 3) {
      return `#${value.slice(0, 3).map((channel) => Math.round(clamp(Number(channel) * 255, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
    }
  }
  if (operation === pdfjs.OPS.setFillGray) {
    const gray = Math.round(clamp(Number(args[0]) * 255, 0, 255)).toString(16).padStart(2, "0");
    return `#${gray}${gray}${gray}`;
  }
  if (operation === pdfjs.OPS.setFillCMYKColor && args.length >= 4) {
    const [cyan, magenta, yellow, black] = args.map((channel) => clamp(Number(channel), 0, 1));
    const channels = [cyan, magenta, yellow].map((channel) => Math.round(255 * (1 - channel) * (1 - black)));
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  if (operation === pdfjs.OPS.setFillColor && typeof args[0] === "string" && /^#[\da-f]{3,8}$/i.test(args[0])) {
    return args[0];
  }
  return currentColor;
}

export function textRunsForPage(operatorList) {
  const textOperations = new Set([
    pdfjs.OPS.showText,
    pdfjs.OPS.showSpacedText,
    pdfjs.OPS.nextLineShowText,
    pdfjs.OPS.nextLineSetSpacingShowText,
  ]);
  const runs = [];
  const fontColors = new Map();
  let color = "#000000";
  let fontName = "";
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] || [];
    if (operation === pdfjs.OPS.setFont) fontName = args[0] || fontName;
    color = colorFromOperator(operation, args, color);
    if (!textOperations.has(operation)) continue;
    const glyphs = [];
    const collectGlyphs = (value) => {
      if (Array.isArray(value)) value.forEach(collectGlyphs);
      else if (value && typeof value === "object") {
        if (typeof value.unicode === "string") glyphs.push(value.unicode);
        else if (Array.isArray(value.items)) collectGlyphs(value.items);
      }
    };
    collectGlyphs(args);
    const text = glyphs.join("");
    if (fontName) fontColors.set(fontName, color);
    if (text) runs.push({ text, color, fontName });
  }
  return { runs, fontColors };
}

export function colorsForTextItems(items, runs, fontColors) {
  const offsets = [];
  let stream = "";
  for (const run of runs) {
    offsets.push({ start: stream.length, end: stream.length + run.text.length, color: run.color });
    stream += run.text;
  }
  let cursor = 0;
  return new Map(items.map((item) => {
    const start = stream.indexOf(item.str, cursor);
    if (start < 0) return [item.id, fontColors.get(item.fontName) || "#000000"];
    cursor = start + item.str.length;
    const color = offsets.find((range) => start >= range.start && start < range.end)?.color
      || fontColors.get(item.fontName)
      || "#000000";
    return [item.id, color];
  }));
}

export function browserFontFor(family) {
  if (!family) return 'Arial, sans-serif';
  if (family.startsWith("Times")) return '"Times New Roman", Times, serif';
  if (family.startsWith("Courier")) return '"Courier New", Courier, monospace';
  return 'Arial, Helvetica, sans-serif';
}

export function standardFontName(family, isBold = false, isItalic = false) {
  const fam = (family || "Helvetica").toLowerCase();
  const bold = isBold || /bold/i.test(fam);
  const italic = isItalic || /italic|oblique/i.test(fam);

  if (/times/i.test(fam)) {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (/courier|mono/i.test(fam)) {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  // Default: Helvetica
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

export function getBounds(overlay, viewport) {
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

export function pointsToSvgPath(points) {
  if (!points || points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const pt = points[i];
    path += ` L ${pt.x} ${pt.y}`;
  }
  return path;
}
