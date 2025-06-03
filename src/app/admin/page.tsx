
import { PdfUploadForm } from '@/components/PdfUploadForm';
import { AdminAuth } from '@/components/AdminAuth';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upload PDFs | Weekly Projects Hub Admin', // Updated title
  robots: {
    index: false, 
    follow: false,
  },
};

export default function AdminPage() {
  return (
    <AdminAuth>
      <div className="py-8">
        <PdfUploadForm />
      </div>
    </AdminAuth>
  );
}
