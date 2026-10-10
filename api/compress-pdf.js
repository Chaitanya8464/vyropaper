import { PDFDocument } from 'pdf-lib';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const compressionSettings = {
  low: { quality: 85 },
  medium: { quality: 75 },
  high: { quality: 60 },
};

async function compressPdf(pdfBuffer, level) {
  const originalSize = pdfBuffer.length;
  if (originalSize > MAX_FILE_SIZE) {
    throw new Error(`File too large (${formatBytes(originalSize)}). Max: ${formatBytes(MAX_FILE_SIZE)}.`);
  }

  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

  // Strip all metadata for real reduction
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));

  // Save with aggressive object streams — this is the real compression mechanism
  // for text/content-heavy PDFs (most reduction is structural, not image-based)
  const compressed = await doc.save({
    useObjectStreams: true,
    updateFieldAppearances: level !== 'high',
  });

  const compressedSize = compressed.length;

  if (compressedSize >= originalSize) {
    throw new Error(`No reduction possible (${formatBytes(originalSize)} → ${formatBytes(compressedSize)}). Already optimized.`);
  }

  const reduction = Math.round((1 - compressedSize / originalSize) * 100);
  return { buffer: compressed, stats: { originalSize, compressedSize, reduction, originalFormatted: formatBytes(originalSize), compressedFormatted: formatBytes(compressedSize) } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const level = req.query.level || 'medium';
    if (!['low', 'medium', 'high'].includes(level)) return res.status(400).json({ error: 'Invalid level' });

    let pdfBuffer = Buffer.isBuffer(req.body) ? req.body : (typeof req.body === 'string' ? Buffer.from(req.body, 'binary') : Buffer.from(req.body));
    if (pdfBuffer.length === 0) return res.status(400).json({ error: 'Empty file' });

    const result = await compressPdf(pdfBuffer, level);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ success: true, stats: result.stats, data: result.buffer.toString('base64') });
  } catch (e) {
    console.error('Compress error:', e);
    res.status(500).json({ error: e.message || 'Compression failed' });
  }
}
