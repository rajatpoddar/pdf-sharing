
"use client";

import { useState, useEffect } from 'react';
import type { PdfDocument } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, CalendarDays, FileText, Lock, Unlock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDisplayDateRangeForWeek } from '@/lib/date-utils';
import { parseISO } from 'date-fns';

interface PdfCardProps {
  document: PdfDocument;
  onDownload: (document: PdfDocument) => void;
}

export function PdfCard({ document, onDownload }: PdfCardProps) {
  const [formattedUploadDate, setFormattedUploadDate] = useState<string>('Processing date...');
  const [displayWeekRange, setDisplayWeekRange] = useState<string>(document.week);
  const isLocked = document.status === 'due';

  useEffect(() => {
    setFormattedUploadDate(new Date(document.uploadDate).toLocaleDateString());
    try {
      const refDate = parseISO(document.uploadDate);
      setDisplayWeekRange(getDisplayDateRangeForWeek(document.week, refDate));
    } catch (e) {
      setDisplayWeekRange(document.week);
      console.error("Error formatting week range for PdfCard:", e);
    }
  }, [document.uploadDate, document.week]);

  const handleDownloadClick = () => {
    if (isLocked) {
      console.log("Download attempted on a locked PDF.");
      return;
    }
    onDownload(document);
    const link = window.document.createElement('a');
    link.href = document.path;
    link.download = document.originalName;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {document.originalName}
            </CardTitle>
            {isLocked ? <Lock className="h-5 w-5 text-destructive" title="Download Locked"/> : <Unlock className="h-5 w-5 text-green-600" title="Download Unlocked"/>}
        </div>
        <CardDescription className="text-xs text-muted-foreground pt-1">
          Uploaded: {formattedUploadDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span>{displayWeekRange}</span>
        </div>
        <Badge variant="secondary" className="mt-2">
          {(document.size / (1024 * 1024)).toFixed(2)} MB
        </Badge>
        {document.relatedPersons && document.relatedPersons.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Related Persons:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {document.relatedPersons.map((person, index) => (
                <Badge key={index} variant="outline">{person}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleDownloadClick}
          className={`w-full transition-colors duration-300 ${isLocked ? 'bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted' : 'bg-accent text-accent-foreground hover:bg-accent/90'}`}
          disabled={isLocked}
          aria-disabled={isLocked}
        >
          {isLocked ? <Lock className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
          {isLocked ? 'Locked' : 'Download'}
        </Button>
      </CardFooter>
    </Card>
  );
}
