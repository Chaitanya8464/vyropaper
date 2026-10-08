import { StandardFonts, rgb } from "pdf-lib";

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

export function fontFamilyFor(style) {
  const description = `${style?.fontFamily || ""} ${style?.fontName || ""}`.toLowerCase();
  const isCourier = /courier|mono|typewriter/i.test(description);
  const isTimes = /times|serif|roman/i.test(description) && !/sans[- ]serif/i.test(description);
  const isBold = /bold|black|heavy|w[7-9]00/i.test(description);
  const isItalic = /italic|oblique/i.test(description);

  let family = "Helvetica";
  if (isCourier) family = "Courier";
  else if (isTimes) family = "Times Roman";

  if (isBold && isItalic) return `${family} Bold Italic`;
  if (isBold) return `${family} Bold`;
  if (isItalic) return `${family} Italic`;
  return family;
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
