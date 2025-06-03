
import type { Metadata } from 'next';
import { AdminAuth } from '@/components/AdminAuth';
import { ManagePdfsClientContent } from '@/components/admin/ManagePdfsClientContent';

export const metadata: Metadata = {
  title: 'Manage PDFs | Weekly Projects Hub Admin',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ManagePdfsPage() {
  return (
    <AdminAuth>
      <ManagePdfsClientContent />
    </AdminAuth>
  );
}
