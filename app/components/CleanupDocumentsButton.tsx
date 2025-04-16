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
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { ReloadIcon, CheckCircledIcon, CrossCircledIcon, TrashIcon } from '@radix-ui/react-icons';

export default function CleanupDocumentsButton() {
  const [isCleaning, setIsCleaning] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleCleanup = async () => {
    try {
      setIsCleaning(true);
      setShowDialog(true);
      setError(null);
      setResult(null);
      
      const response = await fetch('/api/jfk/cleanup-documents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error response from server:', data);
        throw new Error(data.message || data.error || 'Failed to clean up documents');
      }
      
      setResult(data);
    } catch (err) {
      console.error('Error cleaning up documents:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unknown error occurred. Check console for details.';
      
      setError(errorMessage);
    } finally {
      setIsCleaning(false);
    }
  };
  
  const closeDialog = () => {
    setShowDialog(false);
  };
  
  return (
    <>
      <Button 
        variant="destructive" 
        onClick={handleCleanup}
        disabled={isCleaning}
        className="mb-4"
      >
        {isCleaning ? (
          <>
            <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
            Cleaning Documents...
          </>
        ) : (
          <>
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete Documents with .pdf IDs
          </>
        )}
      </Button>
      
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isCleaning 
                ? 'Cleaning Documents...' 
                : result?.success 
                  ? 'Documents Cleaned Successfully' 
                  : 'Cleanup Failed'}
            </DialogTitle>
            <DialogDescription>
              {isCleaning 
                ? 'Removing documents with .pdf extension in their IDs...'
                : result?.success
                  ? `Deleted ${result.docsDeleted} documents with .pdf extension.`
                  : 'There was an error cleaning up the documents.'}
            </DialogDescription>
          </DialogHeader>
          
          {result?.success && (
            <Alert variant="default" className="bg-green-50 border-green-200">
              <CheckCircledIcon className="h-4 w-4 text-green-600" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                <p>Removed {result.docsDeleted} documents with incorrect IDs.</p>
                {result.docsDeleted > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold text-sm">Deleted documents:</p>
                    <div className="max-h-40 overflow-y-auto mt-1 text-xs">
                      <ul className="list-disc pl-5 space-y-1">
                        {result.deletedDocs?.slice(0, 10).map((doc: any, idx: number) => (
                          <li key={idx}>
                            {doc.title || doc.id}
                            <span className="text-gray-500 ml-1">({doc.id})</span>
                          </li>
                        ))}
                        {result.deletedDocs?.length > 10 && (
                          <li className="text-gray-500">
                            ...and {result.deletedDocs.length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                <p className="mt-3">You can now run "Populate Archives from NARA" to add documents with correct IDs.</p>
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <CrossCircledIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={closeDialog}
              disabled={isCleaning}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 