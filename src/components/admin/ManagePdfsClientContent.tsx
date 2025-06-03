
"use client";

import { useEffect, useState, useTransition, useMemo } from 'react';
import { getPdfDocuments, deletePdf, togglePdfStatus, bulkUpdatePdfStatus, bulkDeletePdfs } from '@/lib/pdf-actions';
import type { PdfDocument } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Send, Trash2, FileText, HardDriveDownload, AlertCircle, Loader2, Lock, Unlock, ShieldCheck, ShieldAlert, Users, Filter, XCircle, ListCollapse, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDisplayDateRangeForWeek } from '@/lib/date-utils';
import { parseISO, format as formatDate, getYear as dfGetYear, startOfWeek, addWeeks, subWeeks, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  display: string;
  startDate?: Date;
}

export function ManagePdfsClientContent() {
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [isTogglingStatusPending, startToggleStatusTransition] = useTransition();
  const [isDeletingPending, startDeleteTransition] = useTransition();
  const [isBulkUpdating, startBulkUpdateTransition] = useTransition();
  const [isBulkDeleting, startBulkDeleteTransition] = useTransition();
  const [isTogglingStatus, setIsTogglingStatus] = useState<string | null>(null); // Tracks individual status toggle
  const [docToDelete, setDocToDelete] = useState<PdfDocument | null>(null);

  // Filter states
  const [filterName, setFilterName] = useState('');
  const [filterWeek, setFilterWeek] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'due'>('all');
  const [filterRelatedPerson, setFilterRelatedPerson] = useState('');
  
  const [bulkActionConfirmation, setBulkActionConfirmation] = useState<{ action: 'lock' | 'unlock'; count: number } | null>(null);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{ count: number } | null>(null);


  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const docs = await getPdfDocuments(); 
      setDocuments(docs);
    } catch (e) {
      setError("Failed to load documents.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const weekOptions = useMemo(() => {
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
        }
      }
      
      if (!optionsMap.has(optionValue)) {
        optionsMap.set(optionValue, { value: optionValue, display, startDate: sortDate });
      }
    });
    
    const options = Array.from(optionsMap.values());
    const allWeeksOption = options.find(opt => opt.value === 'all')!;
    const otherOptions = options.filter(opt => opt.value !== 'all');
    otherOptions.sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0)); 
    return [allWeeksOption, ...otherOptions];
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesName = filterName ? doc.originalName.toLowerCase().includes(filterName.toLowerCase()) : true;
      const matchesStatus = filterStatus === 'all' ? true : doc.status === filterStatus;
      const matchesRelatedPerson = filterRelatedPerson ? doc.relatedPersons.some(p => p.toLowerCase().includes(filterRelatedPerson.toLowerCase())) : true;

      let matchesWeek = filterWeek === 'all';
      if (filterWeek !== 'all') {
        const docUploadDate = parseISO(doc.uploadDate);
        if (filterWeek.match(/^\d{4}-\d{2}-\d{2}$/)) {
          matchesWeek = doc.week === filterWeek;
        } else if (filterWeek.includes('::')) {
          const [filterWeekId, filterYearStr] = filterWeek.split('::');
          const docYear = dfGetYear(docUploadDate);
          matchesWeek = doc.week === filterWeekId && docYear === parseInt(filterYearStr);
        } else {
           if (doc.week === filterWeek) {
                matchesWeek = true;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(doc.week)) { 
                let referenceFilterDate = new Date();
                if (filterWeek === "Last Week") referenceFilterDate = subWeeks(new Date(),1);
                if (filterWeek === "Next Week") referenceFilterDate = addWeeks(new Date(),1);
                const mondayOfFilterWeek = format(startOfWeek(referenceFilterDate, {weekStartsOn: 1}), 'yyyy-MM-dd');
                matchesWeek = doc.week === mondayOfFilterWeek;
            }
        }
      }
      return matchesName && matchesStatus && matchesWeek && matchesRelatedPerson;
    });
  }, [documents, filterName, filterWeek, filterStatus, filterRelatedPerson]);

  const clearFilters = () => {
    setFilterName('');
    setFilterWeek('all');
    setFilterStatus('all');
    setFilterRelatedPerson('');
  };
  
  const handleDownload = (docPath: string, originalName: string) => {
    const link = document.createElement('a');
    link.href = docPath;
    link.download = originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download Started", description: originalName });
  };

  const handleShare = async (docPath: string, originalName: string) => {
    const fullUrl = `${window.location.origin}${docPath}`;
    if (navigator.share && navigator.canShare) {
      try {
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        const blob = await response.blob();
        const file = new File([blob], originalName, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: originalName, text: `Check out this PDF: ${originalName}` });
          toast({ title: "File Shared", description: `${originalName} has been shared successfully.` });
        } else {
          await navigator.clipboard.writeText(fullUrl);
          toast({ title: "Link Copied!", description: "File type not shareable, PDF link copied to clipboard instead." });
        }
      } catch (err) {
        console.error('File sharing or fetching failed: ', err);
        try {
          await navigator.clipboard.writeText(fullUrl);
          toast({ title: "Share Failed, Link Copied", description: "Could not share file directly. PDF link copied to clipboard.", variant: "default" });
        } catch (copyError) {
          toast({ title: "Share Failed", description: "Could not share file or copy link to clipboard.", variant: "destructive" });
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast({ title: "Link Copied!", description: "Web Share API not supported. PDF link copied to clipboard." });
      } catch (err) {
        toast({ title: "Copy Failed", description: "Could not copy link to clipboard.", variant: "destructive" });
      }
    }
  };

  const handleDeleteRequest = (doc: PdfDocument) => setDocToDelete(doc);

  const handleDeleteConfirm = async () => {
    if (!docToDelete) return;
    startDeleteTransition(async () => {
      const result = await deletePdf(docToDelete.id);
      if (result.success) {
        toast({ title: "Deleted!", description: `${docToDelete.originalName} has been deleted.` });
        setDocuments(prevDocs => prevDocs.filter(d => d.id !== docToDelete.id));
      } else {
        toast({ title: "Delete Failed", description: result.message, variant: "destructive" });
      }
      setDocToDelete(null);
    });
  };

  const handleToggleStatus = async (docId: string) => {
    setIsTogglingStatus(docId);
    startToggleStatusTransition(async () => {
      const result = await togglePdfStatus(docId);
      if (result.success && result.newStatus) {
        toast({ title: "Status Updated!", description: `Status for document changed to ${result.newStatus}.` });
        setDocuments(prevDocs => 
          prevDocs.map(d => d.id === docId ? { ...d, status: result.newStatus! } : d)
        );
      } else {
        toast({ title: "Status Update Failed", description: result.message, variant: "destructive" });
      }
      setIsTogglingStatus(null);
    });
  };

  const handleBulkStatusUpdateRequest = (action: 'lock' | 'unlock') => {
    const count = filteredDocuments.filter(doc => doc.status !== (action === 'lock' ? 'due' : 'paid')).length;
    if (count === 0) {
        toast({ title: "No Action Needed", description: `All filtered documents are already ${action === 'lock' ? 'due (locked)' : 'paid (unlocked)'}.`});
        return;
    }
    setBulkActionConfirmation({ action, count });
  };

  const confirmBulkStatusUpdate = async () => {
    if (!bulkActionConfirmation) return;
    const newStatus = bulkActionConfirmation.action === 'lock' ? 'due' : 'paid';
    const idsToUpdate = filteredDocuments
      .filter(doc => doc.status !== newStatus)
      .map(doc => doc.id);

    if (idsToUpdate.length === 0) {
      toast({ title: "No Action Needed", description: `All filtered items already have the target status.`});
      setBulkActionConfirmation(null);
      return;
    }

    startBulkUpdateTransition(async () => {
      const result = await bulkUpdatePdfStatus(idsToUpdate, newStatus);
      if (result.success) {
        toast({ title: "Bulk Update Successful!", description: result.message });
        setDocuments(prevDocs => 
          prevDocs.map(d => idsToUpdate.includes(d.id) ? { ...d, status: newStatus } : d)
        );
      } else {
        toast({ title: "Bulk Update Failed", description: result.message, variant: "destructive" });
      }
      setBulkActionConfirmation(null);
    });
  };

  const handleBulkDeleteRequest = () => {
    if (filteredDocuments.length === 0) {
        toast({ title: "No Documents Filtered", description: "There are no documents currently matching your filters to delete."});
        return;
    }
    setBulkDeleteConfirmation({ count: filteredDocuments.length });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteConfirmation) return;
    const idsToDelete = filteredDocuments.map(doc => doc.id);

    if (idsToDelete.length === 0) {
      setBulkDeleteConfirmation(null);
      return;
    }

    startBulkDeleteTransition(async () => {
      const result = await bulkDeletePdfs(idsToDelete);
      if (result.success) {
        toast({ 
          title: "Bulk Delete Successful!", 
          description: `${result.metadataRemovedCount} document(s) removed. ${result.filesActuallyDeletedCount} file(s) deleted. ${result.fileDeletionErrors.length > 0 ? `${result.fileDeletionErrors.length} file deletion error(s).` : ''}`
        });
        setDocuments(prevDocs => 
          prevDocs.filter(d => !idsToDelete.includes(d.id))
        );
      } else {
        toast({ title: "Bulk Delete Failed", description: result.message, variant: "destructive" });
      }
      setBulkDeleteConfirmation(null);
    });
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <HardDriveDownload className="h-12 w-12 animate-pulse text-primary" />
        <p className="ml-4 text-lg">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto my-8 bg-destructive/10 border-destructive">
        <CardHeader><CardTitle className="flex items-center text-destructive"><AlertCircle className="mr-2" /> Error Loading Documents</CardTitle></CardHeader>
        <CardContent><p>{error}</p><Button onClick={fetchDocuments} className="mt-4">Try Again</Button></CardContent>
      </Card>
    );
  }
  
  const hasActiveFilters = filterName || filterWeek !== 'all' || filterStatus !== 'all' || filterRelatedPerson;

  return (
    <div className="py-8">
      <Card className="w-full max-w-6xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileText className="mr-3 h-7 w-7 text-primary" /> Manage Uploaded PDFs
          </CardTitle>
          <CardDescription>
            Filter, view, download, share, delete, or toggle payment status for uploaded PDF documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="mb-6 bg-muted/50 p-4 rounded-lg" defaultValue="filters">
                <AccordionItem value="filters">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5" /> Filters
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input
                            type="text"
                            placeholder="Filter by name..."
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                            className="pl-3"
                        />
                        <Select value={filterWeek} onValueChange={setFilterWeek}>
                            <SelectTrigger><div className="flex items-center gap-2"><ListCollapse className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Filter by week" /></div></SelectTrigger>
                            <SelectContent>
                                {weekOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.display}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | 'paid' | 'due')}>
                            <SelectTrigger><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Filter by status" /></div></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="paid">Paid (Unlocked)</SelectItem>
                                <SelectItem value="due">Due (Locked)</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            type="text"
                            placeholder="Filter by related person..."
                            value={filterRelatedPerson}
                            onChange={(e) => setFilterRelatedPerson(e.target.value)}
                            className="pl-3"
                        />
                    </div>
                    {hasActiveFilters && (
                        <Button onClick={clearFilters} variant="outline" className="w-full md:w-auto mt-4">
                            <XCircle className="mr-2 h-4 w-4" /> Clear All Filters
                        </Button>
                    )}
                </AccordionContent>
                </AccordionItem>
            </Accordion>

            {hasActiveFilters && filteredDocuments.length > 0 && (
              <Card className="mb-6 p-4 bg-accent/10 border-accent dark:bg-accent/20">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-md flex items-center">Bulk Actions for Filtered PDFs ({filteredDocuments.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleBulkStatusUpdateRequest('lock')} 
                    disabled={isBulkUpdating || isBulkDeleting || filteredDocuments.every(doc => doc.status === 'due')}
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Lock className="mr-2 h-4 w-4" />}
                     Lock All Filtered
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleBulkStatusUpdateRequest('unlock')} 
                    disabled={isBulkUpdating || isBulkDeleting || filteredDocuments.every(doc => doc.status === 'paid')}
                    variant="outline"
                    className="border-green-600 text-green-600 hover:bg-green-600/10 dark:text-green-500 dark:border-green-500 dark:hover:bg-green-500/10"
                  >
                    {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlock className="mr-2 h-4 w-4" />}
                     Unlock All Filtered
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkDeleteRequest}
                    disabled={isBulkDeleting || isBulkUpdating || filteredDocuments.length === 0}
                    variant="destructive"
                  >
                    {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete All Filtered
                  </Button>
                </CardContent>
              </Card>
            )}

          {documents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No documents have been uploaded yet.</p>
          ) : filteredDocuments.length === 0 && hasActiveFilters ? (
             <div className="text-center py-10">
                <EyeOff className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No documents match your filters.</h3>
                <p className="text-muted-foreground">Try adjusting or clearing your search criteria.</p>
                 <Button onClick={clearFilters} variant="link" className="mt-4">
                    Clear Filters
                 </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Original Name</TableHead>
                      <TableHead className="min-w-[180px]">Week</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[150px]">Related Persons</TableHead>
                      <TableHead className="min-w-[150px]">Uploaded</TableHead>
                      <TableHead className="min-w-[100px]">Size</TableHead>
                      <TableHead className="text-right min-w-[240px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium truncate max-w-xs">{doc.originalName}</TableCell>
                        <TableCell>
                          {getDisplayDateRangeForWeek(doc.week, parseISO(doc.uploadDate))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={doc.status === 'paid' ? 'default' : 'destructive'} className="capitalize flex items-center gap-1 w-fit">
                             {doc.status === 'due' ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                             {doc.status}
                          </Badge>
                        </TableCell>
                         <TableCell className="max-w-[200px] whitespace-normal">
                          {doc.relatedPersons && doc.relatedPersons.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {doc.relatedPersons.map((person, index) => (
                                <Badge key={index} variant="secondary">{person}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(parseISO(doc.uploadDate), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>{(doc.size / (1024 * 1024)).toFixed(2)} MB</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => handleToggleStatus(doc.id)} 
                              title={doc.status === 'paid' ? 'Lock (Set to Due)' : 'Unlock (Set to Paid)'}
                              disabled={isTogglingStatus === doc.id || isTogglingStatusPending || isBulkUpdating || isBulkDeleting}
                              className="transition-colors"
                          >
                            {(isTogglingStatus === doc.id && isTogglingStatusPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : (doc.status === 'paid' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-green-600" />)}
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleDownload(doc.path, doc.originalName)} title="Download" disabled={isBulkUpdating || isBulkDeleting} className="transition-colors">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleShare(doc.path, doc.originalName)} title="Share File" disabled={isBulkUpdating || isBulkDeleting} className="transition-colors">
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteRequest(doc)} title="Delete" disabled={isDeletingPending || isBulkUpdating || isBulkDeleting} className="transition-colors">
                              {(isDeletingPending && docToDelete?.id === doc.id) ? <Loader2 className="h-4 w-4 animate-spin" /> :<Trash2 className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4 mt-4">
                  {filteredDocuments.map((doc) => (
                      <Card key={`${doc.id}-mobile`} className="shadow-lg rounded-lg overflow-hidden">
                          <CardHeader className="pb-3 bg-muted/30">
                              <CardTitle className="text-base font-semibold leading-tight">{doc.originalName}</CardTitle>
                              <CardDescription className="text-xs">
                                  Week: {getDisplayDateRangeForWeek(doc.week, parseISO(doc.uploadDate))}
                              </CardDescription>
                          </CardHeader>
                          <CardContent className="text-sm space-y-2 pt-3">
                              <div className="flex items-center">
                                  <span className="font-medium w-20">Status:</span>
                                  <Badge variant={doc.status === 'paid' ? 'default' : 'destructive'} className="capitalize">
                                      {doc.status === 'due' ? <Lock className="mr-1 h-3 w-3" /> : <Unlock className="mr-1 h-3 w-3" />} 
                                      {doc.status}
                                  </Badge>
                              </div>
                              {doc.relatedPersons && doc.relatedPersons.length > 0 && (
                                  <div>
                                      <span className="font-medium">Related:</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                          {doc.relatedPersons.map((person, index) => (
                                              <Badge key={index} variant="secondary" className="text-xs">{person}</Badge>
                                          ))}
                                      </div>
                                  </div>
                              )}
                              <div><span className="font-medium w-20 inline-block">Uploaded:</span> {formatDate(parseISO(doc.uploadDate), 'dd/MM/yy HH:mm')}</div>
                              <div><span className="font-medium w-20 inline-block">Size:</span> {(doc.size / (1024 * 1024)).toFixed(2)} MB</div>
                          </CardContent>
                          <CardFooter className="flex flex-wrap justify-end gap-2 pt-3 border-t">
                              <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleToggleStatus(doc.id)} 
                                  title={doc.status === 'paid' ? 'Lock (Set to Due)' : 'Unlock (Set to Paid)'}
                                  disabled={isTogglingStatus === doc.id || isTogglingStatusPending || isBulkUpdating || isBulkDeleting}
                                  className="flex-grow sm:flex-grow-0"
                              >
                                  {(isTogglingStatus === doc.id && isTogglingStatusPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : (doc.status === 'paid' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-green-600" />)}
                                  <span className="ml-2 sm:inline">{doc.status === 'paid' ? 'Set Due' : 'Set Paid'}</span>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDownload(doc.path, doc.originalName)} title="Download" disabled={isBulkUpdating || isBulkDeleting} className="flex-grow sm:flex-grow-0">
                                  <Download className="h-4 w-4" />
                                  <span className="ml-2 sm:inline">Download</span>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleShare(doc.path, doc.originalName)} title="Share File" disabled={isBulkUpdating || isBulkDeleting} className="flex-grow sm:flex-grow-0">
                                  <Send className="h-4 w-4" />
                                  <span className="ml-2 sm:inline">Share</span>
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteRequest(doc)} title="Delete" disabled={isDeletingPending || isBulkUpdating || isBulkDeleting} className="flex-grow sm:flex-grow-0">
                                  {(isDeletingPending && docToDelete?.id === doc.id) ? <Loader2 className="h-4 w-4 animate-spin" /> :<Trash2 className="h-4 w-4" />}
                                  <span className="ml-2 sm:inline">Delete</span>
                              </Button>
                          </CardFooter>
                      </Card>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {docToDelete && (
          <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete this PDF?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the file "{docToDelete.originalName}".
                  </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDocToDelete(null)} disabled={isDeletingPending || isBulkUpdating || isBulkDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeletingPending || isBulkUpdating || isBulkDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      {(isDeletingPending && docToDelete?.id ) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Delete
                  </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
      )}

      {bulkActionConfirmation && (
        <AlertDialog open={!!bulkActionConfirmation} onOpenChange={(open) => !open && setBulkActionConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Bulk Status Update</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to {bulkActionConfirmation.action} {bulkActionConfirmation.count} document(s)? This will change their status to '{bulkActionConfirmation.action === 'lock' ? 'due' : 'paid'}'.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setBulkActionConfirmation(null)} disabled={isBulkUpdating || isBulkDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={confirmBulkStatusUpdate} 
                        disabled={isBulkUpdating || isBulkDeleting} 
                        className={cn(bulkActionConfirmation.action === 'lock' ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : "bg-green-600 hover:bg-green-700 text-white dark:text-foreground")}
                    >
                        {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirm {bulkActionConfirmation.action === 'lock' ? 'Lock' : 'Unlock'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

      {bulkDeleteConfirmation && (
        <AlertDialog open={!!bulkDeleteConfirmation} onOpenChange={(open) => !open && setBulkDeleteConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to permanently delete {bulkDeleteConfirmation.count} document(s)? This action cannot be undone and will remove the files and their records.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setBulkDeleteConfirmation(null)} disabled={isBulkDeleting || isBulkUpdating}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={confirmBulkDelete} 
                        disabled={isBulkDeleting || isBulkUpdating} 
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                        {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirm Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

