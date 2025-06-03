
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import type { PdfDocument } from '@/lib/types';
import { PdfCard } from '@/components/PdfCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, XCircle, ListCollapse, FileSearch } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getDisplayDateRangeForWeek } from '@/lib/date-utils';
import { parseISO, getYear as dfGetYear, format, startOfWeek, addWeeks, subWeeks } from 'date-fns';

const LOCAL_STORAGE_KEY = 'pdfDownloadHistory';
const MAX_HISTORY_LENGTH = 10;

interface UserDashboardProps {
  initialDocuments: PdfDocument[];
}

interface FilterOption {
  value: string;
  display: string;
  startDate?: Date; // For sorting
}

export function UserDashboard({ initialDocuments }: UserDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterValue, setSelectedFilterValue] = useState<string>('all');
  const [documents, setDocuments] = useState<PdfDocument[]>(initialDocuments);
  const router = useRouter(); // Initialize router

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    if (searchTerm.toLowerCase().trim() === 'admin') {
      router.push('/admin');
    }
  }, [searchTerm, router]);

  const filterOptions = useMemo(() => {
    const optionsMap = new Map<string, FilterOption>();
    optionsMap.set('all', { value: 'all', display: 'All Weeks' });

    documents.forEach(doc => {
      let optionValue: string;
      let display: string;
      let sortDate: Date;
      const docUploadDate = parseISO(doc.uploadDate); 

      if (/^\d{4}-\d{2}-\d{2}$/.test(doc.week)) { 
        optionValue = doc.week;
        try {
          sortDate = parseISO(doc.week);
          display = getDisplayDateRangeForWeek(doc.week, sortDate); 
        } catch (e) {
          display = doc.week; 
          sortDate = docUploadDate; 
          console.error("Error processing yyyy-MM-dd week for filter:", e);
        }
      } else if (doc.week.match(/^Week (\d+)$/)) { 
        const year = dfGetYear(docUploadDate);
        optionValue = `${doc.week}::${year}`; 
        try {
          display = getDisplayDateRangeForWeek(doc.week, docUploadDate);
          const dateParts = display.split(' - ')[0].split('/'); 
          sortDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
        } catch (e) {
          display = `${doc.week} (${year})`; 
          sortDate = docUploadDate; 
          console.error("Error processing Week N for filter:", e);
        }
      } else { 
        optionValue = doc.week;
        try {
          display = getDisplayDateRangeForWeek(doc.week, new Date()); 
          const dateParts = display.split(' - ')[0].split('/'); 
          sortDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
        } catch (e) {
          display = doc.week; 
          sortDate = new Date(); 
          console.error("Error processing relative week for filter:", e);
        }
      }
      
      if (!optionsMap.has(optionValue)) {
        optionsMap.set(optionValue, { value: optionValue, display, startDate: sortDate });
      }
    });
    
    const options = Array.from(optionsMap.values());
    const allWeeksOption = options.find(opt => opt.value === 'all')!;
    const otherOptions = options.filter(opt => opt.value !== 'all');

    otherOptions.sort((a, b) => {
        if (a.startDate && b.startDate) {
            return a.startDate.getTime() - b.startDate.getTime();
        }
        return 0;
    });

    return [allWeeksOption, ...otherOptions];
  }, [documents]);

  const hasActiveSearchOrFilter = useMemo(() => {
    return searchTerm !== '' || selectedFilterValue !== 'all';
  }, [searchTerm, selectedFilterValue]);

  const filteredDocuments = useMemo(() => {
    if (!hasActiveSearchOrFilter) {
      return []; 
    }
    return documents.filter(doc => {
      // Assuming "work code" could be in originalName, fileName, or a new field if you add one.
      // For now, let's assume "work code" refers to a part of the originalName or fileName.
      const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (doc.relatedPersons && doc.relatedPersons.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()))); // Kept relatedPersons search for now, can be removed if "work code" fully replaces it.


      let matchesWeek = selectedFilterValue === 'all';
      if (selectedFilterValue !== 'all') {
        const docUploadDate = parseISO(doc.uploadDate);

        if (selectedFilterValue.match(/^\d{4}-\d{2}-\d{2}$/)) { 
          matchesWeek = doc.week === selectedFilterValue;
        } else if (selectedFilterValue.includes('::')) { 
          const [filterWeekId, filterYearStr] = selectedFilterValue.split('::');
          const docYear = dfGetYear(docUploadDate);
          matchesWeek = doc.week === filterWeekId && docYear === parseInt(filterYearStr);
        } else { 
            if (doc.week === selectedFilterValue) {
                matchesWeek = true;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(doc.week)) { 
                let referenceFilterDate = new Date();
                if (selectedFilterValue === "Last Week") referenceFilterDate = subWeeks(new Date(),1);
                if (selectedFilterValue === "Next Week") referenceFilterDate = addWeeks(new Date(),1);
                
                const mondayOfFilterWeek = format(startOfWeek(referenceFilterDate, {weekStartsOn: 1}), 'yyyy-MM-dd');
                matchesWeek = doc.week === mondayOfFilterWeek;
            }
        }
      }
      return matchesSearch && matchesWeek;
    });
  }, [documents, searchTerm, selectedFilterValue, hasActiveSearchOrFilter]);

  const handleDownload = (document: PdfDocument) => {
    const historyString = localStorage.getItem(LOCAL_STORAGE_KEY);
    let downloadHistory: string[] = historyString ? JSON.parse(historyString) : [];
    
    if (!downloadHistory.includes(document.originalName)) {
      downloadHistory.unshift(document.originalName);
      if (downloadHistory.length > MAX_HISTORY_LENGTH) {
        downloadHistory = downloadHistory.slice(0, MAX_HISTORY_LENGTH);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(downloadHistory));
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedFilterValue('all');
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <Accordion type="single" collapsible className="w-full bg-card p-4 rounded-lg shadow" defaultValue="filters">
        <AccordionItem value="filters">
          <AccordionTrigger className="text-lg font-headline hover:no-underline">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" /> Search & Filter Projects
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by work code or type 'admin'..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                  aria-label="Search projects by work code or type admin to login"
                />
              </div>
              <Select value={selectedFilterValue} onValueChange={setSelectedFilterValue}>
                <SelectTrigger className="w-full" aria-label="Filter projects by week">
                  <div className="flex items-center gap-2">
                    <ListCollapse className="h-5 w-5 text-muted-foreground" />
                    <SelectValue placeholder="Filter by week" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.display}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveSearchOrFilter && (
                <Button onClick={clearFilters} variant="outline" className="w-full">
                  <XCircle className="mr-2 h-4 w-4" />
                  Clear Search & Filters
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>


      {!hasActiveSearchOrFilter ? (
        <div className="text-center py-10 bg-card rounded-lg shadow">
          <FileSearch className="mx-auto h-16 w-16 text-primary mb-4" />
          <h3 className="text-2xl font-headline text-foreground">Find Your Projects</h3>
          <p className="text-muted-foreground mt-2">
            Use the search or filters above to find specific project PDFs. <br/> Type "admin" in the search bar to access the admin panel.
          </p>
        </div>
      ) : filteredDocuments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredDocuments.map(doc => (
            <PdfCard key={doc.id} document={doc} onDownload={handleDownload} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-card rounded-lg shadow">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground">No projects found.</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          {hasActiveSearchOrFilter && (
             <Button onClick={clearFilters} variant="link" className="mt-4">
                Clear search & filters
             </Button>
          )}
        </div>
      )}
    </div>
  );
}
