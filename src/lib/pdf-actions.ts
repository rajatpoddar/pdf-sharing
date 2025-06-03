
"use server";

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { PdfDocument } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const DATA_DIR = path.join(process.cwd(), 'data');
const METADATA_PATH = path.join(DATA_DIR, 'metadata.json');
const PDFS_DIR = path.join(process.cwd(), 'public', 'uploads', 'pdfs');

// Robust directory/file access functions
async function ensureDataDirectoryExists() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    const errorMessage = `Critical error: Failed to create or access data directory at ${DATA_DIR}. This is required for metadata.json. Please check permissions for the mapped Docker volume. Original error: ${(error as Error).message}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage); // Re-throw to halt operations that depend on this
  }
}

async function ensureUploadsDirectoryExists() {
  try {
    await fs.mkdir(PDFS_DIR, { recursive: true });
  } catch (error) {
    const errorMessage = `Critical error: Failed to create or access PDF uploads directory at ${PDFS_DIR}. Please check permissions for the mapped Docker volume. Original error: ${(error as Error).message}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage); // Re-throw to halt operations that depend on this
  }
}

export async function getPdfDocuments(): Promise<PdfDocument[]> {
  await ensureDataDirectoryExists(); // Ensure data directory exists first
  try {
    const data = await fs.readFile(METADATA_PATH, 'utf8');
    return JSON.parse(data) as PdfDocument[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('metadata.json not found. Attempting to create an empty one.');
      try {
        await fs.writeFile(METADATA_PATH, JSON.stringify([]));
        console.log('Successfully created empty metadata.json.');
        return [];
      } catch (writeError) {
        const errorMessage = `Failed to create metadata.json at ${METADATA_PATH} after it was not found. Please check permissions for the data directory. Original write error: ${(writeError as Error).message}`;
        console.error(errorMessage, writeError);
        throw new Error(errorMessage);
      }
    }
    const errorMessage = `Failed to read or parse metadata.json from ${METADATA_PATH}. Original error: ${(error as Error).message}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}

const UploadFormSchema = z.object({
  pdfFile: z.array(z.instanceof(File))
    .min(1, "At least one PDF file is required.")
    .max(20, "You can upload a maximum of 20 files at a time.")
    .refine(files => files.every(file => file.type === "application/pdf"), "Only PDF files are allowed.")
    .refine(files => files.every(file => file.size <= 10 * 1024 * 1024), "Each file must be 10MB or less."),
  week: z.string().min(1, "Week selection is required."),
  status: z.enum(['paid', 'due']),
  relatedPersons: z.string().optional(),
});

export async function uploadPdf(prevState: any, formData: FormData) {
  await ensureDataDirectoryExists();
  await ensureUploadsDirectoryExists();

  const validatedFields = UploadFormSchema.safeParse({
    pdfFile: formData.getAll('pdfFile'),
    week: formData.get('week'),
    status: formData.get('status'),
    relatedPersons: formData.get('relatedPersons'),
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check your inputs.",
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
      individualResults: [],
    };
  }

  const { pdfFile: files, week, status, relatedPersons: relatedPersonsString } = validatedFields.data;
  const relatedPersonsArray = relatedPersonsString ? relatedPersonsString.split(',').map(p => p.trim()).filter(p => p) : [];

  let documents = await getPdfDocuments();
  const individualResults: {fileName: string; success: boolean; message: string}[] = [];
  let allSucceeded = true;

  for (const file of files) {
    const uniqueFileName = `${uuidv4()}-${file.name}`;
    const filePath = path.join(PDFS_DIR, uniqueFileName);
    const publicPath = `/uploads/pdfs/${uniqueFileName}`;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      const newDocument: PdfDocument = {
        id: uuidv4(),
        fileName: uniqueFileName,
        originalName: file.name,
        week,
        status,
        uploadDate: new Date().toISOString(),
        path: publicPath,
        size: file.size,
        relatedPersons: relatedPersonsArray,
      };
      documents.unshift(newDocument); // Add to the beginning of the array
      individualResults.push({ fileName: file.name, success: true, message: "Uploaded successfully." });
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      individualResults.push({ fileName: file.name, success: false, message: `Upload failed: ${(error as Error).message}` });
      allSucceeded = false;
    }
  }
  
  if (individualResults.length === 0) { // Should not happen if validation passes
    return { message: "No files were processed.", success: false, errors: null, individualResults: [] };
  }

  try {
    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2));
    revalidatePath('/');
    revalidatePath('/admin/manage-pdfs');

    if (allSucceeded) {
      return { message: files.length > 1 ? "All files uploaded successfully!" : "File uploaded successfully!", success: true, errors: null, individualResults };
    } else {
      const successfulUploads = individualResults.filter(r => r.success).length;
      const failedUploads = individualResults.length - successfulUploads;
      return { 
        message: `${successfulUploads} file(s) uploaded successfully. ${failedUploads} file(s) failed. Check details below.`, 
        success: false, // Overall success is false if any file fails
        errors: null, 
        individualResults 
      };
    }

  } catch (error) {
    const errorMessage = `Failed to save metadata after uploads. Some files may have been saved to disk but not recorded. Error: ${(error as Error).message}`;
    console.error(errorMessage, error);
    // Add results for files that were physically saved but whose metadata update failed
     individualResults.forEach(res => {
        if (res.success) { // If it was initially successful before metadata save fail
            res.success = false;
            res.message = "Uploaded, but metadata save failed.";
        }
    });
    return { message: errorMessage, success: false, errors: null, individualResults };
  }
}


export async function deletePdf(id: string): Promise<{ success: boolean, message: string }> {
  await ensureDataDirectoryExists();
  // No need to call ensureUploadsDirectoryExists here if we're only potentially deleting files
  // However, it doesn't hurt to ensure it's there if we needed to list its contents for some reason.

  let documents = await getPdfDocuments();
  const docToDelete = documents.find(doc => doc.id === id);

  if (!docToDelete) {
    return { success: false, message: "Document not found." };
  }

  try {
    // Delete the physical file
    const filePath = path.join(PDFS_DIR, docToDelete.fileName);
    try {
      await fs.unlink(filePath);
    } catch (fileError) {
        // Log if file doesn't exist, but proceed to remove metadata if it's an ENOENT
        if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log(`File ${filePath} not found for deletion, but will remove metadata entry.`);
        } else {
            // For other errors, log a warning but still try to remove metadata.
             console.warn(`Could not delete file ${filePath}: ${(fileError as Error).message}. It might have been already deleted or there's a permission issue. Proceeding to update metadata.`);
        }
    }
    
    // Remove from metadata
    documents = documents.filter(doc => doc.id !== id);
    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2));

    revalidatePath('/');
    revalidatePath('/admin/manage-pdfs');
    return { success: true, message: "PDF deleted successfully." };
  } catch (error) {
    console.error("Error deleting PDF:", error);
    return { success: false, message: `Failed to delete PDF: ${(error as Error).message}` };
  }
}

export async function togglePdfStatus(id: string): Promise<{ success: boolean; message: string; newStatus?: 'paid' | 'due' }> {
  await ensureDataDirectoryExists();
  let documents = await getPdfDocuments();
  const docIndex = documents.findIndex(doc => doc.id === id);

  if (docIndex === -1) {
    return { success: false, message: "Document not found." };
  }

  const newStatus = documents[docIndex].status === 'paid' ? 'due' : 'paid';
  documents[docIndex].status = newStatus;

  try {
    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2));
    revalidatePath('/');
    revalidatePath('/admin/manage-pdfs');
    return { success: true, message: "Status updated successfully.", newStatus };
  } catch (error) {
    console.error("Error toggling PDF status:", error);
    return { success: false, message: `Failed to update status: ${(error as Error).message}` };
  }
}

export async function bulkUpdatePdfStatus(ids: string[], newStatus: 'paid' | 'due'): Promise<{ success: boolean; message: string }> {
  await ensureDataDirectoryExists();
  let documents = await getPdfDocuments();
  let updatedCount = 0;

  documents.forEach(doc => {
    if (ids.includes(doc.id)) {
      if (doc.status !== newStatus) {
        doc.status = newStatus;
        updatedCount++;
      }
    }
  });

  if (updatedCount === 0) {
    return { success: true, message: "No documents required status updates." };
  }

  try {
    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2));
    revalidatePath('/');
    revalidatePath('/admin/manage-pdfs');
    return { success: true, message: `${updatedCount} document(s) updated to ${newStatus} successfully.` };
  } catch (error) {
    console.error("Error bulk updating PDF statuses:", error);
    return { success: false, message: `Failed to bulk update statuses: ${(error as Error).message}` };
  }
}

    