# Paperwork

Paperwork is a browser-based PDF tools app built with React and Vite. PDF files are processed locally in the browser.

## Project structure

```text
src/
  app/                    Application routing and composition
  components/
    forms/                Reusable labeled form controls
    layout/               Shared site header and footer
    ui/                   Brand, icons, and small visual primitives
  features/
    pdf-editor/           Interactive PDF page editor
    pdf-tools/            Tool workbench, operations, and tool catalog
  pages/                  Home, policy, and tool pages
  styles/                 Global application styles
  main.jsx                React entry point
```

## Development

- `npm run dev` starts the local development server.
- `npm run build` creates a production build in `dist/`.

Feature-specific styles live alongside their feature. Shared form controls and site chrome are in `components/` so they can be reused across pages and tools.
