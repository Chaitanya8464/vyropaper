export const toolRouteIds = {
  "Edit PDF": "edit-pdf",
  "Annotate and highlight": "annotate-and-highlight",
  "Add text and images": "add-text-and-images",
  "Fill PDF forms": "fill-pdf-forms",
  "Sign a PDF": "sign-a-pdf",
  "Add page numbers": "add-page-numbers",
  "Add a watermark": "add-a-watermark",
  "Merge PDFs": "merge-pdfs",
  "Split a PDF": "split-a-pdf",
  "Extract pages": "extract-pages",
  "Reorder or rotate pages": "reorder-or-rotate-pages",
  "Delete pages": "delete-pages",
  "Crop pages": "crop-pages",
  "Alternate and mix PDFs": "alternate-and-mix-pdfs",
  "PDF to Word": "pdf-to-word",
  "PDF to Excel": "pdf-to-excel",
  "PDF to PowerPoint": "pdf-to-powerpoint",
  "PDF to JPG or images": "pdf-to-jpg-or-images",
  "Extract images from PDF": "extract-images",
  "Word to PDF": "word-to-pdf",
  "Excel to PDF": "excel-to-pdf",
  "Images to PDF": "images-to-pdf",
  "Compress a PDF": "compress-a-pdf",
  "Protect with a password": "protect-with-a-password",
  "Unlock a PDF": "unlock-a-pdf",
  "Repair a PDF": "repair-a-pdf",
  "Recognize text (OCR)": "recognize-text-ocr",
  "Flatten a PDF": "flatten-a-pdf",
};

export const toolNamesById = Object.fromEntries(
  Object.entries(toolRouteIds).map(([name, id]) => [id, name]),
);

export const toolGroups = [
  {
    title: "Edit & annotate",
    description: "Make changes and add information to a document.",
    icon: "edit",
    tools: ["Edit PDF", "Annotate and highlight", "Add text and images", "Fill PDF forms", "Sign a PDF", "Add page numbers", "Add a watermark"],
  },
  {
    title: "Organize pages",
    description: "Put pages and documents in the right order.",
    icon: "pages",
    tools: ["Merge PDFs", "Split a PDF", "Extract pages", "Reorder or rotate pages", "Delete pages", "Crop pages", "Alternate and mix PDFs"],
  },
  {
    title: "Convert files",
    description: "Convert PDFs to and from everyday file formats.",
    icon: "convert",
    tools: ["PDF to Word", "PDF to Excel", "PDF to PowerPoint", "PDF to JPG or images", "Extract images from PDF", "Word to PDF", "Excel to PDF", "Images to PDF"],
  },
  {
    title: "Compress & secure",
    description: "Reduce file size and manage document access.",
    icon: "secure",
    tools: ["Compress a PDF", "Protect with a password", "Unlock a PDF", "Repair a PDF", "Recognize text (OCR)", "Flatten a PDF"],
  },
];
