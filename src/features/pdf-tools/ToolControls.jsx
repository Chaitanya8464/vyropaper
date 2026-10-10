import React from "react";
import Field from "../../components/forms/Field.jsx";
import NumberControl from "../../components/forms/NumberControl.jsx";

export default function ToolControls({ toolId, config, setConfig, imageFile, setImageFile }) {
  const update = (key) => (value) => setConfig((previous) => ({ ...previous, [key]: value }));
  const textField = (label, key, placeholder, hint) => (
    <Field label={label} hint={hint}>
      <input value={config[key] || ""} onChange={(event) => update(key)(event.target.value)} placeholder={placeholder} />
    </Field>
  );
  const pages = (placeholder = "1,3-5") => (
    <Field label="Pages" hint="Use page numbers starting at 1, ranges, or both.">
      <input value={config.pages || ""} onChange={(event) => update("pages")(event.target.value)} placeholder={placeholder} />
    </Field>
  );
  const position = (
    <>
      <NumberControl label="Left position (pt)" value={config.x ?? 48} onChange={update("x")} />
      <NumberControl label="Top position (pt)" value={config.y ?? 80} onChange={update("y")} />
      <NumberControl label="Font size (pt)" value={config.fontSize ?? 18} min={1} max={144} onChange={update("fontSize")} />
    </>
  );

  switch (toolId) {
    case "edit-pdf":
      return <>{textField("Text to add", "text", "Type text to place on each page")}{position}</>;
    case "annotate-and-highlight":
      return <>{pages("All pages")}{textField("Optional note", "text", "Add a note inside the highlight")}<NumberControl label="Highlight width (pt)" value={config.width ?? 180} min={1} onChange={update("width")} /><NumberControl label="Highlight height (pt)" value={config.height ?? 24} min={1} onChange={update("height")} />{position}</>;
    case "add-text-and-images":
      return <>{textField("Text to add", "text", "Type text to place on every page")}{position}<NumberControl label="Image target page" value={config.page ?? 1} min={1} onChange={update("page")} /><NumberControl label="Image width (pt)" value={config.imageWidth ?? 120} min={1} onChange={update("imageWidth")} /><Field label="Optional image (PNG or JPG)"><input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={(event) => setImageFile(event.target.files?.[0] || null)} /></Field>{imageFile && <span className="pdfw-file-note">{imageFile.name}</span>}</>;
    case "fill-pdf-forms":
      return <Field label="Form field values" hint="One per line. Example: CustomerName=Alex Smith">
        <textarea rows={5} value={config.values || ""} onChange={(event) => update("values")(event.target.value)} placeholder={"FieldName=value\nCheckboxName=yes"} />
      </Field>;
    case "sign-a-pdf":
      return <>{textField("Signature", "signature", "Type your name")}{position}</>;
    case "add-page-numbers":
      return <>{textField("Prefix", "prefix", "Optional prefix, e.g. Page ")}{textField("Suffix", "suffix", "Optional suffix, e.g.  / 12")}</>;
    case "add-a-watermark":
      return <>{textField("Watermark text", "text", "CONFIDENTIAL")}{position}<NumberControl label="Opacity" value={config.opacity ?? 0.25} min={0.05} max={1} step={0.05} onChange={update("opacity")} /></>;
    case "split-a-pdf":
    case "extract-pages":
    case "delete-pages":
      return pages(toolId === "split-a-pdf" ? "All pages" : "Enter pages");
    case "reorder-or-rotate-pages":
      return <>{textField("New page order", "order", "3,1,2", "Enter every page exactly once. Leave blank to rotate pages.")}{pages("All pages")}{!config.order?.trim() && <Field label="Rotation">
        <select value={config.rotation ?? "90"} onChange={(event) => update("rotation")(event.target.value)}>
          <option value="90">Rotate clockwise 90°</option><option value="180">Rotate 180°</option><option value="270">Rotate clockwise 270°</option>
        </select>
      </Field>}</>;
    case "crop-pages":
      return <>{pages("All pages")}<NumberControl label="Inset from each edge (pt)" value={config.inset ?? 36} min={1} onChange={update("inset")} /></>;
    case "pdf-to-jpg-or-images":
      return <Field label="Image quality"><select value={config.quality || "standard"} onChange={(event) => update("quality")(event.target.value)}><option value="standard">Standard</option><option value="high">High</option></select></Field>;
    case "compress-a-pdf":
      return (
        <Field label="Compression level" hint="Higher compression removes more metadata but may affect form fields.">
          <select value={config.compression || "medium"} onChange={(event) => update("compression")(event.target.value)}>
            <option value="low">Low — Basic optimization, keeps metadata</option>
            <option value="medium">Medium — Removes metadata, good results</option>
            <option value="high">High — Aggressive, strips everything</option>
          </select>
        </Field>
      );
    case "images-to-pdf":
      return <Field label="Page sizing"><select value={config.pageSize || "image"} onChange={(event) => update("pageSize")(event.target.value)}><option value="image">Fit each page to its image</option></select></Field>;
    default:
      return null;
  }
}
