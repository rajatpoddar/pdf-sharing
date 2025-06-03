
"use client";

import { useEffect, useState } from 'react';
import { Loader2, Lightbulb } from 'lucide-react';
import { suggestProjects } from '@/ai/flows/suggest-projects';
import type { PdfDocument } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDisplayDateRangeForWeek } from '@/lib/date-utils';
import { parseISO } from 'date-fns';

interface SuggestedProjectsProps {
  allPdfs: PdfDocument[]; 
  triggerUpdate: number; 
}

// const LOCAL_STORAGE_KEY = 'pdfDownloadHistory'; // Defined in UserDashboard

export function SuggestedProjects({ allPdfs, triggerUpdate }: SuggestedProjectsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const historyString = localStorage.getItem('pdfDownloadHistory'); // Use literal key
        const downloadHistory: string[] = historyString ? JSON.parse(historyString) : [];
        
        if (downloadHistory.length === 0) {
          setSuggestions([]);
          setIsLoading(false);
          return;
        }

        const result = await suggestProjects({
          downloadHistory: downloadHistory,
          numSuggestions: 3,
        });
        setSuggestions(result.suggestions);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setError("Could not load suggestions.");
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [triggerUpdate]);

  const detailedSuggestions = suggestions
    .map(suggestionName => allPdfs.find(pdf => pdf.originalName === suggestionName || pdf.fileName === suggestionName))
    .filter((pdf): pdf is PdfDocument => pdf !== undefined);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading suggestions...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-center py-4">{error}</p>;
  }
  
  if (detailedSuggestions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card className="mt-8 mb-6 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-headline">
          <Lightbulb className="mr-2 h-6 w-6 text-primary" />
          Suggested For You
        </CardTitle>
      </CardHeader>
      <CardContent>
        {detailedSuggestions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {detailedSuggestions.map((pdf) => (
              <LinkToPdf key={pdf.id} pdf={pdf} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No new suggestions at the moment. Download more projects to get personalized recommendations!</p>
        )}
      </CardContent>
    </Card>
  );
}

function LinkToPdf({ pdf }: { pdf: PdfDocument }) {
  const [displayWeekRange, setDisplayWeekRange] = useState<string>(pdf.week);

  useEffect(() => {
    try {
      const refDate = parseISO(pdf.uploadDate);
      setDisplayWeekRange(getDisplayDateRangeForWeek(pdf.week, refDate));
    } catch (e) {
      setDisplayWeekRange(pdf.week); 
      console.error("Error formatting week range for SuggestedProjects:", e);
    }
  }, [pdf.uploadDate, pdf.week]);

  const handleDownloadSuggestion = () => {
    const link = document.createElement('a');
    link.href = pdf.path;
    link.download = pdf.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
     <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{pdf.originalName}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <p><Badge variant="outline" className="whitespace-nowrap">{displayWeekRange}</Badge></p>
          {/* Weekday removed from display */}
        </CardContent>
        <CardFooter>
           <Button onClick={handleDownloadSuggestion} size="sm" variant="outline" className="w-full">
            View & Download
          </Button>
        </CardFooter>
      </Card>
  );
}
