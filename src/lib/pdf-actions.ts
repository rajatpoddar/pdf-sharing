
"use server";

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { PdfDocument } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const PDFS_DIR = path.join(process.cwd(), 'public', 'uploads', 'pdfs');
const DATA_DIR = path.join(process.cwd(), 'data'); // New directory for metadata
const METADATA_PATH = path.join(DATA_DIR, 'metadata.json'); // Updated metadata path

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(PDFS_DIR, { recursive: true });
    await fs.mkdir(DATA_DIR, { recursive: true }); // Ensure data directory exists
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
}

ensureDirectories();

const UploadPdfSchema = z.object({
  week: z.string().min(1, "Week is required"),
  status: z.enum(['paid', 'due'], { required_error: "Status is required" }),
  relatedPersons: z.string().optional(), // Comma-separated names
});

export async function getPdfDocuments(): Promise<PdfDocument[]> {
  try {
    await ensureDirectories(); // Ensures DATA_DIR is created before trying to read
    const data = await fs.readFile(METADATA_PATH, 'utf-8');
    const documents = JSON.parse(data) as PdfDocument[];
    // Ensure all documents have a status and relatedPersons, default if missing
    return documents.map(doc => ({
      ...doc,
      status: doc.status || 'paid',
      relatedPersons: doc.relatedPersons || [],
    })).sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(METADATA_PATH, JSON.stringify([])); // Create empty metadata if not found
      return [];
    }
    console.error("Failed to read PDF metadata:", error);
    return [];
  }
}

export async function uploadPdf(prevState: any, formData: FormData): Promise<{ message: string; success: boolean; errors?: any; individualResults?: {fileName: string, success: boolean, message: string}[] }> {
  try {
    await ensureDirectories();

    const validatedFields = UploadPdfSchema.safeParse({
      week: formData.get('week'),
      status: formData.get('status'),
      relatedPersons: formData.get('relatedPersons'),
    });

    if (!validatedFields.success) {
      return {
        message: "Validation failed.",
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
        individualResults: [] // Ensure consistent shape
      };
    }

    const { week, status, relatedPersons: relatedPersonsString } = validatedFields.data;
    const files = formData.getAll('pdfFile') as File[];

    const relatedPersonsArray = relatedPersonsString
      ? relatedPersonsString.split(',').map(name => name.trim()).filter(name => name.length > 0)
      : [];

    if (!files || files.length === 0 || files.every(f => f.size === 0)) {
      return { message: "No files uploaded or files are empty.", success: false, errors: null, individualResults: [] };
    }

    if (files.length > 20) {
      return { message: "Cannot upload more than 20 files at a time.", success: false, errors: null, individualResults: [] };
    }

    const allDocuments = await getPdfDocuments();
    const individualResults = [];
    let allSuccessful = true;

    for (const file of files) {
      if (file.size === 0) {
        individualResults.push({fileName: file.name, success: false, message: "File is empty."});
        allSuccessful = false;
        continue;
      }
      if (file.type !== 'application/pdf') {
        individualResults.push({fileName: file.name, success: false, message: "Invalid file type. Only PDF is allowed."});
        allSuccessful = false;
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uniqueId = uuidv4();
      const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const fileName = `${uniqueId}-${sanitizedOriginalName}`;
      const filePath = path.join(PDFS_DIR, fileName);
      
      await fs.writeFile(filePath, buffer);

      const newDocument: PdfDocument = {
        id: uniqueId,
        fileName,
        originalName: file.name,
        week,
        status,
        uploadDate: new Date().toISOString(),
        path: `/uploads/pdfs/${fileName}`,
        size: file.size,
        relatedPersons: relatedPersonsArray,
      };
      allDocuments.unshift(newDocument);
      individualResults.push({fileName: file.name, success: true, message: "Uploaded successfully."});
    }
    
    await fs.writeFile(METADATA_PATH, JSON.stringify(allDocuments, null, 2));

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/manage-pdfs');


    if (files.length === 1) {
        // For single file, ensure 'errors' is present even if null for consistency
        return { message: individualResults[0].message, success: individualResults[0].success, errors: null, individualResults: [] };
    } else {
        return { 
            message: allSuccessful ? "All files processed successfully!" : "Some files could not be uploaded.", 
            success: allSuccessful, 
            errors: null, // Ensure consistent shape
            individualResults 
        };
    }

  } catch (error) {
    console.error("Upload failed:", error);
    // Ensure the returned object shape is consistent with initialState
    return { 
        message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        success: false,
        errors: null,
        individualResults: [] 
    };
  }
}

export async function deletePdf(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await ensureDirectories();
    const documents = await getPdfDocuments();
    const docToDelete = documents.find(doc => doc.id === id);

    if (!docToDelete) {
      return { success: false, message: "Document not found." };
    }

    const publicFilePath = path.join(process.cwd(), 'public', docToDelete.path);
    try {
      await fs.unlink(publicFilePath);
    } catch (fileError) {
      console.error(`Failed to delete file ${publicFilePath}:`, fileError);
    }

    const updatedDocuments = documents.filter(doc => doc.id !== id);
    await fs.writeFile(METADATA_PATH, JSON.stringify(updatedDocuments, null, 2));

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/manage-pdfs');

    return { success: true, message: "Document deleted successfully." };
  } catch (error) {
    console.error("Failed to delete PDF:", error);
    return { success: false, message: "Failed to delete document." };
  }
}

export async function togglePdfStatus(id: string): Promise<{ success: boolean; message: string; newStatus?: 'paid' | 'due' }> {
  try {
    await ensureDirectories();
    let documents = await getPdfDocuments();
    const docIndex = documents.findIndex(doc => doc.id === id);

    if (docIndex === -1) {
      return { success: false, message: "Document not found." };
    }

    const currentStatus = documents[docIndex].status;
    const newStatus = currentStatus === 'paid' ? 'due' : 'paid';
    documents[docIndex].status = newStatus;

    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2));

    revalidatePath('/');
    revalidatePath('/admin/manage-pdfs');
    revalidatePath('/admin');


    return { success: true, message: `Status updated to ${newStatus}.`, newStatus };
  } catch (error) {
    console.error("Failed to toggle PDF status:", error);
    return { success: false, message: "Failed to update document status." };
  }
}

export async function bulkUpdatePdfStatus(ids: string[], newStatus: 'paid' | 'due'): Promise<{ success: boolean; message: string; updatedCount: number }> {
  try {
    await ensureDirectories();
    let documents = await getPdfDocuments();
    let updatedCount = 0;

    documents = documents.map(doc => {
      if (ids.includes(doc.id)) {
        if (doc.status !== newStatus) {
          doc.status = newStatus;
          updatedCount++;
        }
      }
      return doc;
    });

    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2));

    revalidatePath('/');
    revalidatePath('/admin/manage-pdfs');
    revalidatePath('/admin');

    if (updatedCount > 0) {
      return { success: true, message: `${updatedCount} document(s) updated to ${newStatus}.`, updatedCount };
    } else {
      return { success: true, message: `No documents required an update to ${newStatus}.`, updatedCount: 0 };
    }
  } catch (error) {
    console.error("Failed to bulk update PDF statuses:", error);
    return { success: false, message: "Failed to bulk update document statuses.", updatedCount: 0 };
  }
}

