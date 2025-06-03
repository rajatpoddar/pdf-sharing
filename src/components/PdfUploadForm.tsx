
"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { uploadPdf } from '@/lib/pdf-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, Loader2, AlertTriangle, CheckCircle, ShieldQuestion, Users } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const initialState = {
  message: "",
  success: false,
  errors: null,
  individualResults: [],
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Uploading...
        </>
      ) : (
        <>
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload PDF(s)
        </>
      )}
    </Button>
  );
}

interface WeekOption {
  value: string;
  display: string;
}

export function PdfUploadForm() {
  const [state, formAction] = useActionState(uploadPdf, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedWeekValue, setSelectedWeekValue] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<'paid' | 'due'>('paid');
  const [relatedPersons, setRelatedPersons] = useState('');


  useEffect(() => {
    const today = new Date();
    const options: WeekOption[] = [];
    const weekStartsOn = 1; // Monday

    [-2, -1, 0, 1, 2].forEach(offset => {
      const targetDate = offset === 0 ? today : (offset < 0 ? subWeeks(today, Math.abs(offset)) : addWeeks(today, offset));
      const monday = startOfWeek(targetDate, { weekStartsOn });
      const sunday = endOfWeek(targetDate, { weekStartsOn });
      
      const optionValue = format(monday, 'yyyy-MM-dd');
      options.push({
        value: optionValue,
        display: `${format(monday, 'dd/MM/yyyy')} - ${format(sunday, 'dd/MM/yyyy')}`
      });
      if (offset === 0) { 
        setSelectedWeekValue(optionValue);
      }
    });
    setWeekOptions(options);
  }, []);

  useEffect(() => {
    if (state?.message) {
      if (!state.individualResults || state.individualResults.length === 0) {
        toast({
          title: state.success ? "Success!" : "Error",
          description: state.message,
          variant: state.success ? "default" : "destructive",
        });
      }

      if (state.success) {
        formRef.current?.reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; 
        }
        const currentWeekValue = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        setSelectedWeekValue(currentWeekValue);
        setSelectedStatus('paid'); // Reset status to default
        setRelatedPersons(''); // Reset related persons field
      }
    }
  }, [state, toast]);


  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Upload New Project PDF(s)</CardTitle>
        <CardDescription>Select PDF file(s), week, status, and related persons. Max 20 files.</CardDescription>
      </CardHeader>
      <form action={formAction} ref={formRef}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pdfFile" className="font-semibold">PDF File(s)</Label>
            <Input 
              id="pdfFile" 
              name="pdfFile" 
              type="file" 
              accept=".pdf" 
              required 
              multiple 
              className="file:text-primary file:font-medium" 
              ref={fileInputRef} 
            />
             {state?.errors?.pdfFile && <p className="text-sm text-destructive">{state.errors.pdfFile[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="week" className="font-semibold">Week</Label>
            <Select 
              name="week" 
              required 
              value={selectedWeekValue}
              onValueChange={setSelectedWeekValue}
            >
              <SelectTrigger id="week">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.length > 0 ? weekOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.display}</SelectItem>
                )) : (
                  <SelectItem value="loading" disabled>Loading weeks...</SelectItem>
                )}
              </SelectContent>
            </Select>
            {state?.errors?.week && <p className="text-sm text-destructive">{state.errors.week[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="font-semibold">Status</Label>
            <Select 
                name="status" 
                required 
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as 'paid' | 'due')}
            >
              <SelectTrigger id="status">
                <div className="flex items-center gap-2">
                   <ShieldQuestion className="h-4 w-4 text-muted-foreground" />
                   <SelectValue placeholder="Select status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid (Download Unlocked)</SelectItem>
                <SelectItem value="due">Due (Download Locked)</SelectItem>
              </SelectContent>
            </Select>
            {state?.errors?.status && <p className="text-sm text-destructive">{state.errors.status[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatedPersons" className="font-semibold">Related Persons (comma-separated)</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="relatedPersons"
                name="relatedPersons"
                type="text"
                placeholder="e.g. John Doe, Jane Smith"
                value={relatedPersons}
                onChange={(e) => setRelatedPersons(e.target.value)}
                className="pl-10"
              />
            </div>
            {state?.errors?.relatedPersons && <p className="text-sm text-destructive">{state.errors.relatedPersons[0]}</p>}
          </div>


        </CardContent>
        <CardFooter className="flex-col items-start">
          <SubmitButton />
          {state?.message && state.individualResults && state.individualResults.length > 0 && (
            <Alert className={`mt-4 ${state.success ? 'border-green-500' : 'border-destructive'}`}>
              <AlertTitle className="flex items-center gap-2">
                {state.success ? <CheckCircle className="text-green-500" /> : <AlertTriangle className="text-destructive" />}
                Upload Summary
              </AlertTitle>
              <AlertDescription>
                {state.message}
                <ul className="list-disc pl-5 mt-2 max-h-40 overflow-y-auto">
                  {state.individualResults.map((res, index) => (
                    <li key={index} className={res.success ? 'text-green-700' : 'text-destructive'}>
                      {res.fileName}: {res.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {state?.message && (!state.individualResults || state.individualResults.length === 0) && !state.success && (
            <p className="mt-4 text-sm text-destructive">{state.message}</p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
