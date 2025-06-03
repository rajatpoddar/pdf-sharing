import { UserDashboard } from '@/components/UserDashboard';
import { getPdfDocuments } from '@/lib/pdf-actions';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects | Weekly Projects Hub',
};

export default async function HomePage() {
  const initialDocuments = await getPdfDocuments();

  return (
    <div className="w-full">
      <UserDashboard initialDocuments={initialDocuments} />
    </div>
  );
}
