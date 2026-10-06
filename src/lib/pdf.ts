/**
 * PDF utilities: hashing, page counting, PDF generation with footers.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const MAX_FILES = 30;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB

export { MAX_FILES, MAX_TOTAL_SIZE };

/**
 * Check PDF magic bytes: %PDF
 */
export function isPdfMagicBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46    // F
  );
}

/**
 * Compute SHA-256 hash of file bytes using Web Crypto API.
 */
export async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get page count from PDF bytes.
 * Returns null if PDF is corrupt/encrypted/unsupported.
 */
export async function getPdfPageCount(
  bytes: ArrayBuffer
): Promise<{ pageCount: number | null; error?: string }> {
  try {
    const pdfDoc = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    const pageCount = pdfDoc.getPageCount();
    return { pageCount };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
      return { pageCount: null, error: 'encrypted' };
    }
    return { pageCount: null, error: 'corrupt' };
  }
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format a date string YYYY-MM-DD to a human-readable form.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

/**
 * Get today's date as YYYY-MM-DD (local date, no timezone shift).
 */
export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface CoverPageData {
  tenderId: string;
  tenderTitle: string;
  procuringEntity: string;
  bidder: string;
  submissionDeadline: string;
  packageDate: string;
  documents: Array<{ order: number; title: string; fileName: string; pages: number }>;
}

/**
 * Generate the complete tender package PDF.
 * 
 * Steps:
 * 1. Create new PDF document
 * 2. Add cover page
 * 3. For each included document in order, copy all pages
 * 4. Two-pass footer: add "Tender ID | Page X of Y" to every page
 * 5. Return the final PDF bytes
 */
export async function generatePackagePdf(
  coverData: CoverPageData,
  documents: Array<{ title: string; order: number; fileBytes: ArrayBuffer }>
): Promise<Uint8Array> {
  // Create the output document
  const outputPdf = await PDFDocument.create();
  
  // Embed standard fonts
  const helveticaBold = await outputPdf.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await outputPdf.embedFont(StandardFonts.Helvetica);

  // ================================================================
  // STEP 1: Create Cover Page
  // ================================================================
  const coverPage = outputPdf.addPage([612, 792]); // Letter size
  const { width, height } = coverPage.getSize();
  
  // Header background bar
  coverPage.drawRectangle({
    x: 0,
    y: height - 80,
    width: width,
    height: 80,
    color: rgb(0.1, 0.22, 0.45),
  });

  // App title in header
  coverPage.drawText('TENDER DOCUMENT PACKAGE', {
    x: 40,
    y: height - 30,
    size: 16,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  coverPage.drawText('Prepared by Tender Document Package Builder', {
    x: 40,
    y: height - 52,
    size: 9,
    font: helvetica,
    color: rgb(0.8, 0.87, 1),
  });

  // Horizontal divider line
  coverPage.drawLine({
    start: { x: 40, y: height - 95 },
    end: { x: width - 40, y: height - 95 },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });

  // Tender ID
  coverPage.drawText('TENDER ID', {
    x: 40,
    y: height - 120,
    size: 8,
    font: helveticaBold,
    color: rgb(0.45, 0.5, 0.6),
  });
  coverPage.drawText(coverData.tenderId, {
    x: 40,
    y: height - 138,
    size: 18,
    font: helveticaBold,
    color: rgb(0.1, 0.22, 0.45),
  });

  // Tender title
  coverPage.drawText('TENDER TITLE', {
    x: 40,
    y: height - 172,
    size: 8,
    font: helveticaBold,
    color: rgb(0.45, 0.5, 0.6),
  });
  const titleLines = wrapText(coverData.tenderTitle, 80);
  titleLines.forEach((line, idx) => {
    coverPage.drawText(line, {
      x: 40,
      y: height - 188 - idx * 16,
      size: 13,
      font: helveticaBold,
      color: rgb(0.08, 0.12, 0.22),
    });
  });

  const afterTitle = height - 188 - titleLines.length * 16 - 16;

  // Info box
  coverPage.drawRectangle({
    x: 40,
    y: afterTitle - 100,
    width: width - 80,
    height: 100,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  const labelColor = rgb(0.45, 0.5, 0.6);
  const valueColor = rgb(0.1, 0.15, 0.3);
  let infoY = afterTitle - 22;

  const drawInfoRow = (label: string, value: string) => {
    coverPage.drawText(label + ':', {
      x: 55,
      y: infoY,
      size: 8,
      font: helveticaBold,
      color: labelColor,
    });
    coverPage.drawText(value, {
      x: 180,
      y: infoY,
      size: 9,
      font: helvetica,
      color: valueColor,
    });
    infoY -= 22;
  };

  drawInfoRow('PROCURING ENTITY', coverData.procuringEntity);
  drawInfoRow('BIDDER', coverData.bidder);
  drawInfoRow('SUBMISSION DEADLINE', formatDate(coverData.submissionDeadline));
  drawInfoRow('PACKAGE PREPARED ON', formatDate(coverData.packageDate));

  // Document list section
  const listStartY = afterTitle - 125;
  
  coverPage.drawText('INCLUDED DOCUMENTS', {
    x: 40,
    y: listStartY,
    size: 10,
    font: helveticaBold,
    color: rgb(0.1, 0.22, 0.45),
  });

  coverPage.drawLine({
    start: { x: 40, y: listStartY - 8 },
    end: { x: width - 40, y: listStartY - 8 },
    thickness: 0.5,
    color: rgb(0.8, 0.83, 0.88),
  });

  // Table header
  let docY = listStartY - 24;
  coverPage.drawText('#', {
    x: 40, y: docY, size: 8, font: helveticaBold, color: rgb(0.45, 0.5, 0.6),
  });
  coverPage.drawText('DOCUMENT', {
    x: 65, y: docY, size: 8, font: helveticaBold, color: rgb(0.45, 0.5, 0.6),
  });
  coverPage.drawText('FILE', {
    x: 320, y: docY, size: 8, font: helveticaBold, color: rgb(0.45, 0.5, 0.6),
  });
  coverPage.drawText('PGS', {
    x: 540, y: docY, size: 8, font: helveticaBold, color: rgb(0.45, 0.5, 0.6),
  });
  docY -= 14;

  // Alternating row colors for document list
  coverData.documents.forEach((doc, idx) => {
    const rowHeight = 14;
    if (idx % 2 === 0) {
      coverPage.drawRectangle({
        x: 40,
        y: docY - 2,
        width: width - 80,
        height: rowHeight,
        color: rgb(0.97, 0.98, 1),
      });
    }

    coverPage.drawText(String(doc.order), {
      x: 40, y: docY, size: 8, font: helvetica, color: rgb(0.3, 0.35, 0.45),
    });

    // Truncate long titles
    const titleStr = doc.title.length > 42 ? doc.title.substring(0, 39) + '...' : doc.title;
    coverPage.drawText(titleStr, {
      x: 65, y: docY, size: 8, font: helvetica, color: rgb(0.1, 0.15, 0.3),
    });

    const fileStr = doc.fileName.length > 30 ? doc.fileName.substring(0, 27) + '...' : doc.fileName;
    coverPage.drawText(fileStr, {
      x: 320, y: docY, size: 7, font: helvetica, color: rgb(0.4, 0.45, 0.55),
    });

    coverPage.drawText(String(doc.pages), {
      x: 540, y: docY, size: 8, font: helvetica, color: rgb(0.3, 0.35, 0.45),
    });

    docY -= rowHeight;
  });

  // Footer bar on cover
  coverPage.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 30,
    color: rgb(0.1, 0.22, 0.45),
  });

  // ================================================================
  // STEP 2: Copy pages from each included document
  // ================================================================
  for (const doc of documents) {
    try {
      const srcPdf = await PDFDocument.load(doc.fileBytes);
      const pageIndices = srcPdf.getPageIndices();
      const copiedPages = await outputPdf.copyPages(srcPdf, pageIndices);
      
      for (const page of copiedPages) {
        outputPdf.addPage(page);
      }
    } catch (e) {
      // If a document fails to copy, we skip it and continue
      console.error(`Failed to copy pages from document "${doc.title}":`, e);
    }
  }

  // ================================================================
  // STEP 3: Add footers to ALL pages (two-pass approach)
  // The total page count (Y) is known after all pages are added.
  // ================================================================
  const totalPages = outputPdf.getPageCount();
  const footerText = (pageNum: number) =>
    `${coverData.tenderId}   |   Page ${pageNum} of ${totalPages}`;

  const FOOTER_HEIGHT = 20;
  const FOOTER_MARGIN = 5;

  const allPages = outputPdf.getPages();
  
  for (let i = 0; i < allPages.length; i++) {
    const page = allPages[i];
    const pageWidth = page.getWidth();
    
    const text = footerText(i + 1);
    const fontSize = 8;
    const textWidth = helvetica.widthOfTextAtSize(text, fontSize);

    // Draw a white background strip to avoid overlapping original content
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: FOOTER_HEIGHT + FOOTER_MARGIN,
      color: rgb(1, 1, 1),
      opacity: 0.85,
    });

    // Draw footer line
    page.drawLine({
      start: { x: 30, y: FOOTER_HEIGHT + FOOTER_MARGIN },
      end: { x: pageWidth - 30, y: FOOTER_HEIGHT + FOOTER_MARGIN },
      thickness: 0.5,
      color: rgb(0.7, 0.73, 0.78),
    });

    // Draw footer text centered
    page.drawText(text, {
      x: (pageWidth - textWidth) / 2,
      y: FOOTER_MARGIN + 4,
      size: fontSize,
      font: helvetica,
      color: rgb(0.3, 0.35, 0.45),
    });
  }

  return outputPdf.save();
}

/**
 * Simple text wrapper for cover page titles.
 */
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
