import { PDFDocument } from 'pdf-lib';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
    throw new Error(`File too large (${formatBytes(originalSize)}). Maximum is ${formatBytes(MAX_FILE_SIZE)}.`);
  }

  try {
    // Load the PDF document
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    // Strip metadata to reduce size
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setCreator('');
    doc.setProducer('');
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));

    // Save with object streams for additional compression
    const compressed = await doc.save({
      useObjectStreams: true,
      updateFieldAppearances: level !== 'high',
    });

    const compressedSize = compressed.length;

    if (compressedSize >= originalSize) {
      throw new Error(
        `Compression would not reduce file size (${formatBytes(originalSize)} → ${formatBytes(compressedSize)}). This PDF may already be optimized.`
      );
    }

    const reduction = Math.round((1 - compressedSize / originalSize) * 100);

    return {
      buffer: compressed,
      stats: {
        originalSize,
        compressedSize,
        reduction,
        originalFormatted: formatBytes(originalSize),
        compressedFormatted: formatBytes(compressedSize),
      },
    };
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const level = req.query.level || 'medium';
    if (!['low', 'medium', 'high'].includes(level)) {
      return res.status(400).json({ error: 'Invalid compression level' });
    }

    // Get PDF buffer from request body
    let pdfBuffer;
    if (typeof req.body === 'string') {
      pdfBuffer = Buffer.from(req.body, 'binary');
    } else if (Buffer.isBuffer(req.body)) {
      pdfBuffer = req.body;
    } else {
      pdfBuffer = Buffer.from(req.body);
    }

    if (pdfBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty file' });
    }

    const result = await compressPdf(pdfBuffer, level);

    // Return compressed PDF as base64 and stats
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      stats: result.stats,
      data: result.buffer.toString('base64'),
    });
  } catch (error) {
    console.error('Compression error:', error);
    res.status(500).json({
      error: error.message || 'Compression failed',
    });
  }
}
