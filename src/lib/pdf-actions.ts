
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
    // Attempt a test write to check permissions
    const testFilePath = path.join(DATA_DIR, '.writable_test');
    await fs.writeFile(testFilePath, 'test_data_dir_writable');
    await fs.unlink(testFilePath); // Clean up
  } catch (error) {
    const errorMessage = `Critical error: Failed to create, access, or write to data directory at ${DATA_DIR}. This is required for metadata.json. Please check permissions for the mapped Docker volume (e.g., on your NAS, ensure the folder mapped to /app/data is writable by the Docker user, typically UID 1000 for 'node' user). Original error: ${(error as Error).message}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage); // Re-throw to halt operations that depend on this
  }
}

async function ensureUploadsDirectoryExists() {
  try {
    await fs.mkdir(PDFS_DIR, { recursive: true });
    // Attempt a test write to check permissions
    const testFilePath = path.join(PDFS_DIR, '.writable_test');
    await fs.writeFile(testFilePath, 'test_uploads_dir_writable');
    await fs.unlink(testFilePath); // Clean up
  } catch (error) {
    const errorMessage = `Critical error: Failed to create, access, or write to PDF uploads directory at ${PDFS_DIR}. Please check permissions for the mapped Docker volume (e.g., on your NAS, ensure the folder mapped to /app/public/uploads/pdfs is writable by the Docker user, typically UID 1000 for 'node' user). Original error: ${(error as Error).message}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage); // Re-throw to halt operations that depend on this
  }
}

export async function getPdfDocuments(): Promise<PdfDocument[]> {
  await ensureDataDirectoryExists(); // Ensure data directory exists and is writable first
  let rawData;
  let parsedData: PdfDocument[];

  try {
    rawData = await fs.readFile(METADATA_PATH, 'utf8');
    try {
      parsedData = JSON.parse(rawData);
    } catch (parseError) {
      const parseErrorMessage = `Failed to parse metadata.json. Content might be empty or corrupted. File path: ${METADATA_PATH}. Parse error: ${(parseError as Error).message}. Raw content: "${rawData.substring(0, 100)}${rawData.length > 100 ? '...' : ''}"`;
      console.error(parseErrorMessage, parseError);
      throw new Error(parseErrorMessage);
    }
    return parsedData;
  } catch (error) {
    // Check if it's the error we threw from the inner parse catch
    if (error instanceof Error && error.message.startsWith('Failed to parse metadata.json')) {
        throw error; // Re-throw the specific parse error
    }

    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`metadata.json not found at ${METADATA_PATH}. Attempting to create an empty one.`);
      try {
        await fs.writeFile(METADATA_PATH, JSON.stringify([]));
        console.log('Successfully created empty metadata.json.');
        return [];
      } catch (writeError) {
        const errorMessage = `Failed to create metadata.json at ${METADATA_PATH} after it was not found, despite directory being accessible. Original write error: ${(writeError as Error).message}`;
        console.error(errorMessage, writeError);
        throw new Error(errorMessage);
      }
    }
    const readErrorMessage = `Failed to read or process metadata.json from ${METADATA_PATH}. Original error: ${(error as Error).message}`;
    console.error(readErrorMessage, error);
    throw new Error(readErrorMessage);
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

  let documents: PdfDocument[];
  try {
    documents = await getPdfDocuments();
  } catch (e) {
     const errMessage = e instanceof Error ? e.message : 'Could not load existing documents for update.';
     console.error("Error fetching documents during upload:", errMessage);
     return { message: `Failed to prepare for upload: ${errMessage}`, success: false, errors: null, individualResults: [] };
  }

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
      documents.unshift(newDocument); 
      individualResults.push({ fileName: file.name, success: true, message: "Uploaded successfully." });
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      const uploadFailMsg = `Upload failed for ${file.name}. Check server logs and NAS permissions for the uploads directory. Error: ${(error as Error).message}`;
      individualResults.push({ fileName: file.name, success: false, message: uploadFailMsg });
      allSucceeded = false;
    }
  }
  
  if (individualResults.length === 0 && files.length > 0) { 
     return { message: "No files were successfully processed for metadata update.", success: false, errors: null, individualResults };
  }
  if (files.length === 0) {
     return { message: "No files provided in the upload.", success: false, errors: null, individualResults: [] };
  }


  try {
    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2)); 
    revalidatePath('/');
    revalidatePath('/admin'); 
    revalidatePath('/admin/manage-pdfs');

    if (allSucceeded) {
      return { message: files.length > 1 ? "All files uploaded successfully!" : "File uploaded successfully!", success: true, errors: null, individualResults };
    } else {
      const successfulUploads = individualResults.filter(r => r.success).length;
      const failedUploads = individualResults.length - successfulUploads;
      return { 
        message: `${successfulUploads} file(s) uploaded successfully. ${failedUploads} file(s) failed. Check details below.`, 
        success: successfulUploads > 0, 
        errors: null, 
        individualResults 
      };
    }

  } catch (error) {
    const errorMessage = `Failed to save metadata after uploads. Some files may have been saved to disk but not recorded. Check server logs and NAS permissions for the data directory. Error: ${(error as Error).message}`;
    console.error(errorMessage, error);
     individualResults.forEach(res => {
        if (res.success) { 
            res.success = false;
            res.message = "Uploaded, but metadata save failed.";
        }
    });
    return { message: errorMessage, success: false, errors: null, individualResults };
  }
}


export async function deletePdf(id: string): Promise<{ success: boolean, message: string }> {
  await ensureDataDirectoryExists(); 
  
  let documents = await getPdfDocuments();
  const docToDelete = documents.find(doc => doc.id === id);

  if (!docToDelete) {
    return { success: false, message: "Document not found." };
  }

  try {
    const filePath = path.join(PDFS_DIR, docToDelete.fileName);
    try {
      await fs.unlink(filePath);
      console.log(`Successfully deleted physical file: ${filePath}`);
    } catch (fileError) {
        if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log(`File ${filePath} not found for deletion, but will remove metadata entry.`);
        } else {
             console.warn(`Could not delete file ${filePath}: ${(fileError as Error).message}. Proceeding to update metadata.`);
        }
    }
    
    documents = documents.filter(doc => doc.id !== id);
    await fs.writeFile(METADATA_PATH, JSON.stringify(documents, null, 2));

    revalidatePath('/');
    revalidatePath('/admin');
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
    revalidatePath('/admin');
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
    revalidatePath('/admin');
    revalidatePath('/admin/manage-pdfs');
    return { success: true, message: `${updatedCount} document(s) updated to ${newStatus} successfully.` };
  } catch (error) {
    console.error("Error bulk updating PDF statuses:", error);
    return { success: false, message: `Failed to bulk update statuses: ${(error as Error).message}` };
  }
}

export async function bulkDeletePdfs(ids: string[]): Promise<{ 
  success: boolean; 
  message: string; 
  metadataRemovedCount: number;
  filesActuallyDeletedCount: number;
  fileDeletionErrors: { fileName: string; error: string }[];
}> {
  await ensureDataDirectoryExists();
  await ensureUploadsDirectoryExists(); // Ensure uploads dir is also checked/accessible for deletion

  let documents: PdfDocument[];
  try {
    documents = await getPdfDocuments();
  } catch (e) {
    const errMessage = e instanceof Error ? e.message : 'Could not load existing documents for bulk deletion.';
    console.error("Error fetching documents during bulk delete:", errMessage);
    return { 
      success: false, 
      message: `Failed to prepare for bulk delete: ${errMessage}`, 
      metadataRemovedCount: 0, 
      filesActuallyDeletedCount: 0, 
      fileDeletionErrors: [] 
    };
  }

  const docsToRemoveMetadataFor = documents.filter(doc => ids.includes(doc.id));
  let filesActuallyDeletedCount = 0;
  const fileDeletionErrors: { fileName: string; error: string }[] = [];

  for (const doc of docsToRemoveMetadataFor) {
    try {
      const filePath = path.join(PDFS_DIR, doc.fileName);
      await fs.unlink(filePath);
      console.log(`Bulk delete: Successfully deleted physical file: ${filePath}`);
      filesActuallyDeletedCount++;
    } catch (fileError) {
      if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`Bulk delete: File ${doc.fileName} not found, presumed already deleted.`);
        // filesActuallyDeletedCount++; // Or don't count if it wasn't there to begin with. For user feedback, maybe better to count if it's gone. Let's count it as "achieved state"
      } else {
        const errMsg = `Bulk delete: Could not delete file ${doc.fileName}: ${(fileError as Error).message}`;
        console.warn(errMsg);
        fileDeletionErrors.push({ fileName: doc.fileName, error: (fileError as Error).message });
      }
    }
  }

  const newDocumentsList = documents.filter(doc => !ids.includes(doc.id));
  const metadataRemovedCount = documents.length - newDocumentsList.length;

  try {
    await fs.writeFile(METADATA_PATH, JSON.stringify(newDocumentsList, null, 2));
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/manage-pdfs');

    let message = `${metadataRemovedCount} document record(s) removed from metadata. ${filesActuallyDeletedCount} physical file(s) confirmed deleted.`;
    if (fileDeletionErrors.length > 0) {
      message += ` Encountered ${fileDeletionErrors.length} error(s) deleting physical files (see server logs for details).`;
    }

    return { 
      success: true, 
      message,
      metadataRemovedCount,
      filesActuallyDeletedCount,
      fileDeletionErrors
    };
  } catch (error) {
    console.error("Error bulk deleting PDF metadata:", error);
    return { 
      success: false, 
      message: `Failed to update metadata after attempting bulk delete: ${(error as Error).message}. Physical files may have been deleted.`,
      metadataRemovedCount: 0, // Because metadata save failed
      filesActuallyDeletedCount, 
      fileDeletionErrors 
    };
  }
}
