import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { printElementById } from './printDocument';

export interface PdfOptions {
  orientation?: 'landscape' | 'portrait';
  margin?: number;
}

/**
 * Captures an HTML element by ID and downloads it as a sharp, high-resolution A4 PDF.
 * Supports Wide A4 (landscape: 297mm x 210mm) and Portrait (210mm x 297mm).
 */
export async function downloadElementAsPdf(
  elementId: string,
  filename: string,
  options?: PdfOptions
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return false;
  }

  const orientation = options?.orientation || 'portrait';
  const margin = options?.margin ?? 8; // 8mm margin for clean A4 printing

  try {
    // Render the element to a canvas with 2.5x scale for sharp vector-like print quality
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: orientation === 'landscape' ? 1200 : 800
    });

    const imgData = canvas.toDataURL('image/png');

    // A4 dimensions in mm:
    // Landscape: 297mm width x 210mm height
    // Portrait: 210mm width x 297mm height
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = orientation === 'landscape' ? 297 : 210;
    const pageHeight = orientation === 'landscape' ? 210 : 297;

    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const contentWidth = printableWidth;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (contentHeight <= printableHeight) {
      // Content fits neatly on one single A4 sheet
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else {
      // Content is slightly taller than printable height: scale down proportionally to fit one page perfectly
      const scaledWidth = (printableHeight * canvas.width) / canvas.height;
      const xOffset = margin + (printableWidth - scaledWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, scaledWidth, printableHeight);
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating PDF with html2canvas/jsPDF:', error);
    // Fallback to isolated document-only print dialog (never prints surrounding webpage)
    printElementById(elementId, { title: filename, orientation });
    return false;
  }
}
