/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker source using a reliable CDN matching version or local URL
try {
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('Could not set pdfjs workerSrc:', e);
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ParsePdfResult {
  pages: ExtractedPage[];
  pageCount: number;
  totalChars: number;
}

/**
 * Extracts text from an uploaded PDF file, page-by-page
 */
export async function extractTextFromPdf(file: File): Promise<ParsePdfResult> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const pageCount = pdfDocument.numPages;
    const pages: ExtractedPage[] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Assemble lines maintaining reasonable whitespace
      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items as any[]) {
        if (!item.str) continue;

        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        } else if (pageText && !pageText.endsWith(' ') && !item.str.startsWith(' ')) {
          pageText += ' ';
        }

        pageText += item.str;
        lastY = item.transform[5];
      }

      const cleanText = pageText.replace(/[ \t]+/g, ' ').trim();
      if (cleanText) {
        pages.push({
          pageNumber: pageNum,
          text: cleanText,
        });
        totalChars += cleanText.length;
      }
    }

    // If PDF yielded empty text (e.g. scanned image or unsupported encoding)
    if (pages.length === 0) {
      // Fallback: try raw string extraction from buffer
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = textDecoder.decode(arrayBuffer);
      const readableStrings = rawText.match(/[\x20-\x7E]{6,}/g) || [];
      if (readableStrings.length > 0) {
        const fallbackText = readableStrings.join(' ').slice(0, 5000);
        pages.push({ pageNumber: 1, text: fallbackText });
        totalChars = fallbackText.length;
      } else {
        throw new Error(
          'No extractable text found in this PDF. It might be a scanned image or password-protected document.'
        );
      }
    }

    return {
      pages,
      pageCount: Math.max(pageCount, pages.length),
      totalChars,
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    // If standard PDF loading fails, check if it's text/markdown file masquerading as document
    try {
      const text = await file.text();
      if (text && text.trim().length > 20) {
        return {
          pages: [{ pageNumber: 1, text: text.trim() }],
          pageCount: 1,
          totalChars: text.length,
        };
      }
    } catch {
      // ignore
    }
    throw new Error(error.message || 'Failed to extract text from PDF file');
  }
}
