# Paperwork

Paperwork is a browser-based toolkit for editing, organizing, converting, and securing PDF documents. Files are processed locally in the browser; the application does not upload selected documents to Paperwork servers. Paperwork is currently in development.

**Made by [VayroGlobal](https://Vayro.global).**

## Product specification

### Goals

- Provide common PDF tasks through a clear, browser-based interface.
- Let people select files and process them on their own device.
- Offer document editing and PDF tools without requiring an account.
- Keep the interface responsive and provide light and dark themes.

### Main routes

| Route | Purpose |
| --- | --- |
| `/` | Homepage, featured tools, and tool categories |
| `/tools/:toolId` | Workbench for a listed PDF tool |
| `/edit-pdf` | PDF editor entry point |
| `/privacy` | Privacy information |
| `/terms` | Terms of use |

### PDF tools

**Edit and annotate**

- Edit PDF
- Annotate and highlight
- Add text and images
- Fill PDF forms
- Sign a PDF
- Add page numbers
- Add a watermark

**Organize pages**

- Merge PDFs
- Split a PDF
- Extract pages
- Reorder or rotate pages
- Delete pages
- Crop pages
- Alternate and mix PDFs

**Convert files**

- PDF to Word
- Word to PDF
- PDF to Excel
- Excel to PDF
- PDF to PowerPoint
- PDF to JPG or images
- Extract images from PDF
- Images to PDF

**Compress and secure**

- Compress a PDF
- Protect with a password
- Unlock a PDF
- Repair a PDF
- Recognize text (OCR)
- Flatten a PDF

### PDF editor

The editor provides an in-browser workspace for viewing and adjusting PDF pages. Its interface includes page navigation and document controls, text and drawing overlays, page organization actions, search, and signature tools. Final output should be reviewed by the user before relying on it.

### Processing and privacy

- PDF work is performed in the user's browser using client-side libraries.
- Selected documents are not uploaded to Paperwork servers by the PDF tools.
- Processing depends on the browser, available device memory, and each file's format and characteristics.
- The privacy and terms pages describe the current preview; users should retain their original files and review generated results.

## Technology stack

| Area | Technology |
| --- | --- |
| UI | React 18 |
| Language and modules | JavaScript with ES modules and JSX |
| Development server and build | Vite 6 |
| PDF creation and manipulation | `pdf-lib`, `pdfjs-dist`, `jspdf` |
| Word documents | `docx`, `mammoth` |
| Spreadsheets | `exceljs` |
| PowerPoint documents | `pptxgenjs` |
| OCR | `tesseract.js` and English language data |
| Archives | `jszip` |
| Featured animated navigation | Three.js r128 via `three128` and the vendored ThreeUI Sable dock |
| Styling | CSS, including responsive layouts and theme tokens |

## Requirements

- Node.js and npm compatible with the installed Vite version.
- A modern browser with JavaScript enabled.

No environment file or backend service is required for local development.

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite in your browser.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the production build locally |

There is currently no configured test or lint command in `package.json`.

## Project structure

```text
src/
  app/
    App.jsx                 Route selection and application composition
    ThemeContext.jsx        Shared light/dark theme state
  components/
    forms/                  Reusable labeled form controls
    layout/                 Shared site header, dock, and footer
    ui/                     Brand, icons, and small visual primitives
  features/
    pdf-editor/             Interactive PDF document editor
    pdf-tools/              Tool workbench, operations, and tool catalog
  pages/                    Home, policy, and tool pages
  shaders/                  Vendored animated dock source, shaders, and assets
  styles/                   Global and shared application styles
  main.jsx                  React entry point
index.html                  HTML entry point and page metadata
```

Tool names and their route IDs are maintained in `src/features/pdf-tools/toolCatalog.js`. Feature-specific styles and implementation live alongside their feature; shared page chrome and UI elements are in `src/components/`.
