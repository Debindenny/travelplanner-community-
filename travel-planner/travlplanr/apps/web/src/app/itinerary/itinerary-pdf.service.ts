import { Injectable } from '@angular/core';
import { ItineraryPdfData } from './itinerary-pdf.models';

@Injectable({ providedIn: 'root' })
export class ItineraryPdfService {
  async download(element: HTMLElement, filename: string): Promise<void> {
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(element)
      .save();
  }

  buildFilename(data: ItineraryPdfData): string {
    const slug = data.tripTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${slug || 'itinerary'}-travlplanr.pdf`;
  }
}
