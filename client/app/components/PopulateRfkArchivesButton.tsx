'use client';

import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { Progress } from '../../components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { ReloadIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';

export default function PopulateRfkArchivesButton() {
  const [isPopulating, setIsPopulating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handlePopulate = async () => {
    try {
      setIsPopulating(true);
      setShowDialog(true);
      setError(null);
      setResult(null);
      
      const response = await fetch('/api/rfk/populate-archives', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error response from server:', data);
        throw new Error(data.message || data.error || 'Failed to populate archives');
      }
      
      setResult(data);
    } catch (err) {
      console.error('Error populating archives:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unknown error occurred. Check console for details.';
      
      setError(errorMessage);
    } finally {
      setIsPopulating(false);
    }
  };
  
  const retryPopulate = () => {
    handlePopulate();
  };
  
  const closeDialog = () => {
    setShowDialog(false);
    // Refresh the page to show new documents
    if (result?.success) {
      window.location.reload();
    }
  };
  
  return (
    <>
      <Button 
        variant="default" 
        onClick={handlePopulate}
        disabled={isPopulating}
        className="mb-4"
      >
        {isPopulating ? (
          <>
            <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
            Populating RFK Records...
          </>
        ) : (
          <>Populate from RFK Assassination Records at NARA</>
        )}
      </Button>
      
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isPopulating 
                ? 'Populating RFK Archives...' 
                : result?.success 
                  ? 'RFK Archives Populated Successfully' 
                  : 'Population Failed'}
            </DialogTitle>
            <DialogDescription>
              {isPopulating 
                ? 'Fetching RFK documents from archives.gov and adding them to the database. This may take a few minutes...'
                : result?.success
                  ? `Added ${result.newDocuments} new RFK documents to the database.`
                  : 'There was an error populating the RFK archives.'}
            </DialogDescription>
          </DialogHeader>
          
          {isPopulating && (
            <div className="py-6">
              <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-r from-blue-500 via-blue-600 to-blue-500 bg-size-[200%_100%] animate-[gradient_2s_ease-in-out_infinite]"></div>
              </div>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Fetching and processing documents from archives.gov...
              </p>
            </div>
          )}
          
          {result?.success && (
            <Alert variant="default" className="bg-green-50 border-green-200">
              <CheckCircledIcon className="h-4 w-4 text-green-600" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                <ul className="text-sm mt-2 space-y-1">
                  <li>Total RFK documents from archives.gov: {result.totalDocuments}</li>
                  <li>Existing RFK documents in database: {result.existingDocuments}</li>
                  <li>New RFK documents added: {result.newDocuments}</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <CrossCircledIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                <p className="mb-2">{error}</p>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={retryPopulate}
                  className="mt-2"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={closeDialog}
              disabled={isPopulating}
            >
              {result?.success ? 'Reload Page' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 