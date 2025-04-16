"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from "next/image";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import PopulateArchivesButton from '../components/PopulateArchivesButton';
import CleanupDocumentsButton from '../components/CleanupDocumentsButton';
import { AddToDocumentDock } from '../../components/ui/AddToDocumentDock';

// Import our custom hooks
import { useJfkDocuments } from '../../hooks/jfk/useJfkDocuments';
import { useJfkProcessing } from '../../hooks/jfk/useJfkProcessing';

// Import our utility functions
import { 
  getDocumentAppUrl, 
  getDocumentJsonUrl, 
  getDocumentPageUrl, 
  getDocumentPdfUrl, 
  getArchivesGovUrl,
  formatDate,
  getProgressPercentage 
} from '../../utils/jfk/docUtils';
import { getLatestStage, getStepStatus } from '../../utils/jfk/statusUtils';
import { JFKDocument, ProcessingUpdate } from '../../utils/jfk/types';

export default function JFKFilesPage() {
  // Use our custom hooks
  const {
    documents,
    isLoading,
    totalDocuments,
    currentPage,
    totalPages,
    setCurrentPage,
    documentIdMap,
    goToNextPage,
    goToPrevPage,
    refreshDocuments
  } = useJfkDocuments();
  
  const [repairingDocuments, setRepairingDocuments] = useState(false);
  const [repairedCount, setRepairedCount] = useState(0);
  
  // State for document ID mapping
  const [localDocumentIdMap, setLocalDocumentIdMap] = useState<Record<string, string>>(documentIdMap);
  
  // Update local state when documentIdMap changes
  useEffect(() => {
    setLocalDocumentIdMap(documentIdMap);
  }, [documentIdMap]);

  const {
    processingUpdates,
    isProcessingAll,
    processedCount,
    totalToProcess,
    processingAllStatus,
    activeProcessingCount,
    concurrencyLimit,
    setConcurrencyLimit,
    limitToImageAnalysis,
    setLimitToImageAnalysis,
    processDocument,
    processAllDocuments,
    repairDocument,
    repairAllBrokenDocuments
  } = useJfkProcessing(
    documents, 
    documentIdMap, 
    (docs) => {
      if (typeof docs === 'function') {
        const updatedDocs = docs(documents);
        refreshDocuments();
          } else {
        refreshDocuments();
      }
    },
    (idMap) => {
      if (typeof idMap === 'function') {
        const updatedIdMap = idMap(localDocumentIdMap);
        setLocalDocumentIdMap(updatedIdMap);
                  } else {
        setLocalDocumentIdMap(idMap);
      }
    }
  );

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<null | (() => void)>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationTitle, setConfirmationTitle] = useState("");

  // Function to handle document processing with confirmation
  const handleProcessDocument = async (documentId: string) => {
    try {
      setConfirmDialogOpen(true);
      setConfirmationTitle("Process Document");
      setConfirmationMessage(`Are you sure you want to process document ${documentId}?`);
      setConfirmationAction(() => async () => {
        try {
      await processDocument(documentId);
        } catch (err) {
          console.error('Error processing document:', err);
        }
      });
        } catch (error) {
      console.error('Error preparing to process document:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        padding: '1.5rem 1rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ 
            width: '2.5rem', 
            height: '2.5rem', 
            borderRadius: '50%', 
            border: '2px solid rgba(59, 130, 246, 0.2)', 
            borderTopColor: '#3b82f6',
            animation: 'spin 1s linear infinite',
            marginBottom: '1rem'
          }}></div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#4b5563' }}>Loading documents...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" style={{ paddingBottom: '80px' }}>
      <h1 style={{ 
        fontFamily: 'Arial, sans-serif', 
        fontWeight: 500,
        fontSize: '1.875rem',
        marginBottom: '1.5rem',
        color: '#1e3a8a' 
      }}>
        JFK Records Collection
      </h1>
      
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => {
            setConfirmDialogOpen(true);
            setConfirmationTitle("Process All Documents");
            setConfirmationMessage("Are you sure you want to process all pending documents? This may take a long time.");
            setConfirmationAction(() => processAllDocuments);
          }}
          disabled={isProcessingAll}
          style={{ marginRight: '0.5rem', background: '#1e3a8a' }}
        >
          Process All Documents
        </Button>
        
        <Button 
          variant="outlined" 
          color="primary"
          onClick={() => {
            setConfirmDialogOpen(true);
            setConfirmationTitle("Repair Broken Documents");
            setConfirmationMessage("This will find and repair documents that have been partially processed or have invalid data. Continue?");
            setConfirmationAction(() => repairAllBrokenDocuments);
          }}
          disabled={repairingDocuments}
          style={{ marginRight: '0.5rem', borderColor: '#1e3a8a', color: '#1e3a8a' }}
        >
          Repair Broken Documents
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={() => refreshDocuments()}
          style={{ marginRight: '0.5rem', borderColor: '#6b7280', color: '#6b7280' }}
        >
          Refresh Documents
        </Button>

        <PopulateArchivesButton />
        <CleanupDocumentsButton />
        
        <div style={{ flexGrow: 1 }}></div>
        
        <FormControl size="small" style={{ minWidth: 120 }}>
          <InputLabel id="concurrency-limit-label">Concurrency</InputLabel>
          <Select
            labelId="concurrency-limit-label"
            id="concurrency-limit"
            value={concurrencyLimit}
            label="Concurrency"
            onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
            disabled={isProcessingAll}
          >
            <MenuItem value={1}>1</MenuItem>
            <MenuItem value={2}>2</MenuItem>
            <MenuItem value={3}>3</MenuItem>
            <MenuItem value={5}>5</MenuItem>
            <MenuItem value={10}>10</MenuItem>
          </Select>
        </FormControl>
        
        <FormControlLabel
          control={
            <Switch
              checked={limitToImageAnalysis} 
              onChange={(e) => setLimitToImageAnalysis(e.target.checked)}
              name="limitToImageAnalysis"
              color="primary"
              disabled={isProcessingAll}
            />
          }
          label="Process Images Only"
        />
          </div>
      
      {isProcessingAll && (
        <div style={{ marginBottom: '1rem' }}>
          <Paper style={{ padding: '1rem', background: '#f9fafb' }}>
            <Typography variant="subtitle1" style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
              Processing Status: {activeProcessingCount} active jobs
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '1rem', color: '#4b5563' }}>
              {processingAllStatus}
            </Typography>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <CircularProgress 
                variant="determinate" 
                value={totalToProcess ? (processedCount / totalToProcess) * 100 : 0} 
                size={32}
                style={{ color: '#1e3a8a' }}
              />
              <Typography variant="body2">
                {processedCount} / {totalToProcess > 0 ? totalToProcess : '?'} documents processed
              </Typography>
        </div>
          </Paper>
      </div>
      )}
      
      {/* Processing progress bars if we have active documents */}
      {Object.keys(processingUpdates).length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <Paper style={{ padding: '1rem', background: '#f3f4f6' }}>
            <Typography variant="subtitle1" style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
              Document Processing Status
            </Typography>
            
            {Object.entries(processingUpdates).map(([docId, update]) => (
              <div key={docId} style={{ 
                marginBottom: '1rem', 
                padding: '0.75rem',
                borderRadius: '0.375rem',
                background: '#ffffff', 
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <Typography variant="subtitle2" style={{ fontWeight: 500 }}>
                    Document {docId}
                  </Typography>
                  <Chip 
                    label={update.status} 
                    size="small" 
                    color={update.type === 'error' ? 'error' : update.type === 'complete' ? 'success' : 'primary'} 
                    variant="outlined"
                  />
          </div>
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: '0.5rem' }}>
                  {update.message}
                </Typography>
                {update.type === 'processing' && update.progress !== undefined && (
                  <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                    <div 
              style={{
                        height: '100%', 
                        width: `${update.progress}%`, 
                        background: '#3b82f6',
                        transition: 'width 0.3s ease'
                      }} 
                    />
                  </div>
                )}
              </div>
            ))}
          </Paper>
            </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <Typography variant="body2" color="textSecondary">
            Showing {documents.length} of {totalDocuments} documents | Page {currentPage} of {totalPages}
          </Typography>
          </div>
        <div>
          <Button 
            onClick={goToPrevPage} 
            disabled={currentPage === 1}
            style={{ minWidth: '40px', marginRight: '0.5rem' }}
          >
            &laquo;
          </Button>
          <Button 
            onClick={goToNextPage} 
            disabled={currentPage === totalPages}
            style={{ minWidth: '40px' }}
          >
            &raquo;
          </Button>
        </div>
      </div>
      
      <TableContainer component={Paper} style={{ marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <Table aria-label="JFK Files table">
          <TableHead style={{ background: '#f3f4f6' }}>
              <TableRow>
              <TableCell style={{ fontWeight: 600 }}>Document ID</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Updated</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Title/Source</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                  <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {doc.id}
                    {doc.dbId && (
                      <Tooltip title="Document has been processed and is in database">
                      <Chip
                          label="DB" 
                        size="small"
                        color="success"
                          style={{ marginLeft: '0.5rem', height: '18px', fontSize: '0.6rem' }} 
                        />
                      </Tooltip>
                    )}
                  </div>
                  </TableCell>
                  <TableCell>
                        <Chip 
                    label={getLatestStage(doc.stages, doc)} 
                          size="small"
                    color={
                      doc.processingStatus === 'failed' ? 'error' :
                      doc.processingStatus === 'processing' ? 'warning' :
                      doc.status === 'ready' ? 'success' :
                      'default'
                    }
                    variant={doc.processingStatus === 'processing' ? 'outlined' : 'filled'}
                  />
                  {doc.processingProgress !== undefined && doc.processingProgress > 0 && (
                    <div style={{ 
                      width: '100%', 
                      height: '3px', 
                      background: '#e5e7eb', 
                      borderRadius: '1.5px',
                      marginTop: '4px',
                      overflow: 'hidden'
                    }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${doc.processingProgress}%`, 
                          background: '#3b82f6',
                          transition: 'width 0.3s ease'
                        }} 
                      />
                    </div>
                  )}
                  </TableCell>
                  <TableCell>
                  {formatDate(doc.lastUpdated)}
                  </TableCell>
                  <TableCell>
                  {doc.title || (
                    <Link 
                      href={getArchivesGovUrl(doc.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#4b5563', textDecoration: 'underline' }}
                    >
                      View on Archives.gov
                    </Link>
                  )}
                  </TableCell>
                  <TableCell>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {doc.dbId && (
                      <Tooltip title="View document">
                          <IconButton
                            size="small"
                          component={Link}
                          href={getDocumentAppUrl(doc.id)}
                          style={{ color: '#1e3a8a' }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                    )}
                    
                    {doc.analysisComplete ? (
                      <Button 
                        variant="outlined" 
                        color="success" 
                        size="small"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      >
                        Ready
                      </Button>
                    ) : doc.processingStatus === 'processing' ? (
                      <CircularProgress size={24} />
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                        onClick={() => handleProcessDocument(doc.id)}
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        >
                          Process
                        </Button>
                      )}
                    
                    {doc.status === 'ready' && doc.pageCount === 0 && (
                      <Button 
                        variant="outlined" 
                        color="warning" 
                        size="small"
                        onClick={() => repairDocument(doc.id)}
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      >
                        Repair
                      </Button>
                    )}
                    
                    {doc.dbId && (
                      <AddToDocumentDock 
                        item={{
                          id: doc.dbId,
                          title: `JFK Document ${doc.id}`,
                          url: getDocumentAppUrl(doc.id) || '',
                          type: 'document'
                        }}
                      />
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button 
              onClick={goToPrevPage} 
              disabled={currentPage === 1}
            variant="outlined"
            style={{ minWidth: '80px' }}
            >
              Previous
            </Button>
            <Button 
              onClick={goToNextPage} 
            disabled={currentPage === totalPages}
            variant="contained"
            style={{ minWidth: '80px', background: '#1e3a8a' }}
            >
              Next
            </Button>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{confirmationTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {confirmationMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} color="primary">
            Cancel
          </Button>
            <Button 
            onClick={() => {
              if (confirmationAction) {
                confirmationAction();
              }
              setConfirmDialogOpen(false);
            }} 
            color="primary" 
            autoFocus
          >
            Confirm
            </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 