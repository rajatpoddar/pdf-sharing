
export interface PdfDocument {
  id: string;
  fileName: string; // Sanitized name used for storing, e.g., unique-id-original-name.pdf
  originalName: string; // Original uploaded file name
  week: string; // e.g., "Week 1" (legacy), "Current Week" (legacy), or "yyyy-MM-dd" (representing the Monday of the week)
  uploadDate: string; // ISO date string
  path: string; // Public path to the PDF, e.g., "/uploads/pdfs/unique-file-name.pdf"
  size: number; // File size in bytes
  status: 'paid' | 'due'; // Status to control download access
  relatedPersons: string[]; // Array of names related to the PDF
}

// WEEKS can still be used for defining relative week concepts if needed elsewhere,
// but admin form now generates specific date ranges.
export const WEEKS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10", "Current Week", "Next Week", "Last Week"];
