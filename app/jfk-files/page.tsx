"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import PopulateRfkArchivesButton from '../components/PopulateRfkArchivesButton';
import CleanupDocumentsButton from '../components/CleanupDocumentsButton';
import { AddToDocumentDock } from '../../components/ui/AddToDocumentDock';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ImageIcon from '@mui/icons-material/Image';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupIcon from '@mui/icons-material/Group';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
// import { AddDocumentsToDockDialog } from './AddDocumentsToDockDialog';
// import { formatDate, truncateText } from '@/lib/utils';
// import { DocumentStatusDisplay } from "@/components/DocumentStatusDisplay";
// import AddToDocumentDock from '@/components/AddToDocumentDock';

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

// Import the document group context
import { useDocumentGroups } from '../../lib/context/DocumentGroupContext';

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
  
  // Use document groups context to filter documents 
  const { enabledGroups, addDocumentGroup } = useDocumentGroups();

  // Apply document group filtering with better group/type mapping
  const filteredDocuments = documents.filter(doc => {
    // Check for documentGroup property (in the database) first
    const docWithType = doc as JFKDocument & { 
      documentType?: string,
      documentGroup?: string
    };
    
    // Default document group logic:
    // 1. Use explicit documentGroup if set
    // 2. Use documentType as fallback (for backward compatibility)
    // 3. Infer from document ID if possible (RFK documents often have 'RFK' in their ID)
    // 4. Default to 'jfk' as final fallback
    let docGroup = 'jfk';
    
    if (docWithType.documentGroup) {
      // Use the explicitly set document group
      docGroup = docWithType.documentGroup.toLowerCase();
    } else if (docWithType.documentType) {
      // Use documentType as fallback (for backward compatibility)
      docGroup = docWithType.documentType.toLowerCase();
    } else if (doc.id && typeof doc.id === 'string' && doc.id.toUpperCase().includes('RFK')) {
      // Infer RFK from document ID if it contains 'RFK'
      docGroup = 'rfk';
    }
    
    // Log documents for debugging
    if (docGroup === 'rfk') {
      console.log('Found RFK document:', doc.id, docGroup);
    }
    
    return enabledGroups.includes(docGroup);
  });
  
  const [repairingDocuments, setRepairingDocuments] = useState(false);
  const [repairedCount, setRepairedCount] = useState(0);
  
  // State for document ID mapping
  const [localDocumentIdMap, setLocalDocumentIdMap] = useState<Record<string, string>>(documentIdMap);
  
  // Update local state when documentIdMap changes
  useEffect(() => {
    setLocalDocumentIdMap(documentIdMap);
  }, [documentIdMap]);

  // Replace limitToImageAnalysis with processingMode
  const [processingMode, setProcessingMode] = useState<'full' | 'images-only' | 'stop-at-image'>('full');
  
  // Derived state for compatibility with existing code
  const limitToImageAnalysis = processingMode === 'images-only';

  // Calculate pagination values for filtered documents
  const itemsPerPage = 10;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredDocuments.length);
  const filteredTotalPages = Math.max(1, Math.ceil(filteredDocuments.length / itemsPerPage));

  // When showing filtered results, adjust pagination text/controls
  const showFilteredPagination = filteredDocuments.length !== documents.length;
  const effectiveTotalPages = showFilteredPagination ? filteredTotalPages : totalPages;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [enabledGroups, setCurrentPage]); 

  // Make sure currentPage is valid for filtered documents
  useEffect(() => {
    if (currentPage > effectiveTotalPages && effectiveTotalPages > 0 && filteredDocuments.length > 0) {
      setCurrentPage(effectiveTotalPages);
    }
  }, [totalPages, effectiveTotalPages, currentPage, setCurrentPage, filteredDocuments.length]);

  const {
    processingUpdates,
    isProcessingAll,
    processedCount,
    totalToProcess,
    processingAllStatus,
    activeProcessingCount,
    concurrencyLimit,
    setConcurrencyLimit,
    setLimitToImageAnalysis,
    processDocument,
    processAllDocuments,
    repairDocument,
    repairAllBrokenDocuments,
    stopProcessing
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
  
  // Effect to handle processing mode changes - now after useJfkProcessing call
  useEffect(() => {
    // Update the limitToImageAnalysis state when processingMode changes
    if (processingMode === 'images-only') {
      setLimitToImageAnalysis(true);
    } else {
      setLimitToImageAnalysis(false);
    }
    
    // If we're in stop-at-image mode, we'll need to implement a custom behavior
    // This would typically involve an API call to update server-side settings
    if (processingMode === 'stop-at-image') {
      console.log('Stop at image analysis mode activated');
      // Here you would make an API call to set the server-side flag
    }
  }, [processingMode, setLimitToImageAnalysis]);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<null | (() => void)>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationTitle, setConfirmationTitle] = useState("");
  
  // Handler for processing mode changes
  const handleProcessingModeChange = (
    event: React.MouseEvent<HTMLElement>, 
    newMode: 'full' | 'images-only' | 'stop-at-image' | null
  ) => {
    if (newMode !== null) {
      setProcessingMode(newMode);
    }
  };

  // Function to handle document processing with confirmation
  const handleProcessDocument = async (documentId: string) => {
    try {
      setConfirmDialogOpen(true);
      setConfirmationTitle("Process Document");
      setConfirmationMessage(`Are you sure you want to process document ${documentId}?`);
      setConfirmationAction(() => async () => {
        try {
          // First run the normal processing
          await processDocument(documentId);
          
          // Determine if it's an RFK document
          const isRfkDocument = documentId.toLowerCase().includes('rfk') || 
                             documents.some(doc => {
                              const docWithType = doc as JFKDocument & { documentType?: string, documentGroup?: string };
                              return doc.id === documentId && 
                                (docWithType.documentGroup === 'rfk' || docWithType.documentType === 'rfk');
                             });
          
          // Then immediately call the finalize endpoint to ensure data is in the database
          const finalizeResponse = await fetch('/api/jfk/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: documentId,
              processType: 'finalizeDocument',
              documentType: isRfkDocument ? 'rfk' : 'jfk',
              documentGroup: isRfkDocument ? 'rfk' : 'jfk',
              forceDataUpdate: true // Force a complete data update
            })
          });
          
          if (finalizeResponse.ok) {
            console.log(`Document ${documentId} successfully finalized (type: ${isRfkDocument ? 'rfk' : 'jfk'})`);
            
            // Wait a brief moment to ensure database updates are complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Force refresh the documents to show the new data
            await refreshDocuments();
            
            // Add toast notification to inform user
            console.log("Document processing complete - data should now be visible in the UI");
          } else {
            const errorText = await finalizeResponse.text();
            console.error('Failed to finalize document:', errorText);
          }
        } catch (err: unknown) {
          console.error('Error processing document:', err);
        }
      });
    } catch (error: unknown) {
      console.error('Error preparing to process document:', error);
    }
  };

  const [isMigratingGroups, setIsMigratingGroups] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('');

  // Function to run document group migration
  const runDocumentGroupMigration = async () => {
    try {
      setIsMigratingGroups(true);
      setMigrationStatus('Migration in progress...');
      
      const response = await fetch('/api/documents/migrate-groups', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMigrationStatus(`Success: ${result.message}`);
        refreshDocuments();
      } else {
        setMigrationStatus(`Error: ${result.message}`);
      }
    } catch (error: unknown) {
      console.error('Error running document group migration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMigrationStatus(`Error: ${errorMessage}`);
    } finally {
      setIsMigratingGroups(false);
    }
  };

  // Add a function to reset document filters
  const resetDocumentFilters = useCallback(() => {
    // Ensure both JFK and RFK are added to available groups
    addDocumentGroup('jfk');
    addDocumentGroup('rfk');
    
    // Force reset localStorage directly
    localStorage.setItem('enabledDocumentGroups', JSON.stringify(['jfk', 'rfk']));
    localStorage.setItem('availableDocumentGroups', JSON.stringify(['jfk', 'rfk']));
    
    // Reload the page to apply changes
    window.location.reload();
  }, [addDocumentGroup]);

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
        Populate & Process Documents
      </h1>
      
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => {
            setConfirmDialogOpen(true);
            setConfirmationTitle("Process All Documents");
            setConfirmationMessage("Are you sure you want to process all pending documents? This may take a long time.");
            setConfirmationAction(() => () => {
              // Apply the appropriate processing mode settings before processing
              if (processingMode === 'stop-at-image') {
                // Here is where you would set any global flags needed for server-side
                localStorage.setItem('jfk_processing_mode', 'stop-at-image');
              } else {
                localStorage.removeItem('jfk_processing_mode');
              }
              processAllDocuments();
            });
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

        <Button
          variant="contained"
          color="primary"
          component={Link}
          href="/jfk-files/visualizations"
          style={{ marginRight: '0.5rem', background: '#3b82f6' }}
          startIcon={<VisibilityIcon />}
        >
          Visualize
        </Button>
        
        <Button
          variant="contained"
          color="primary"
          component={PopulateArchivesButton}
          style={{ marginRight: '0.5rem', background: '#1e3a8a' }}
        >
          Populate from JFK Assassination Records at NARA
        </Button>
        
        <Button
          variant="contained"
          color="secondary"
          component={PopulateRfkArchivesButton}
          style={{ marginRight: '0.5rem', background: '#9c27b0' }}
        >
          Populate from RFK Assassination Records at NARA
        </Button>
        
        <Button
          variant="outlined"
          color="error"
          component={CleanupDocumentsButton}
          style={{ marginRight: '0.5rem', borderColor: '#ef4444', color: '#ef4444' }}
        >
          Delete Documents with .pdf IDs
        </Button>
        
        <Button
          variant="outlined"
          color="info"
          onClick={() => {
            setConfirmDialogOpen(true);
            setConfirmationTitle("Add Document Group Field");
            setConfirmationMessage("This will migrate existing documents to use the documentGroup field. Use this if you have existing documents that don't have this field. Continue?");
            setConfirmationAction(() => runDocumentGroupMigration);
          }}
          disabled={isMigratingGroups}
          style={{ marginRight: '0.5rem', borderColor: '#0288d1', color: '#0288d1' }}
          startIcon={<GroupIcon />}
        >
          Add Document Group Field To Existing Records
        </Button>
        
        <Button
          variant="outlined" 
          color="warning"
          onClick={resetDocumentFilters}
          style={{ marginRight: '0.5rem', borderColor: '#ed6c02', color: '#ed6c02' }}
          startIcon={<RestartAltIcon />}
        >
          Reset Document Filters
        </Button>
        
        {migrationStatus && (
          <Typography variant="body2" color="info" style={{ marginLeft: '0.5rem' }}>
            {migrationStatus}
          </Typography>
        )}
        
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
        
        <ToggleButtonGroup
          value={processingMode}
          exclusive
          onChange={handleProcessingModeChange}
          aria-label="processing mode"
          size="small"
          disabled={isProcessingAll}
        >
          <ToggleButton value="full" aria-label="full processing">
            <Tooltip title="Full Processing">
              <SettingsIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="images-only" aria-label="process images only">
            <Tooltip title="Process Images Only">
              <ImageIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="stop-at-image" aria-label="stop at image analysis">
            <Tooltip title="Stop at Image Analysis">
              <StopIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
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
              <Button
                variant="contained"
                color="error"
                startIcon={<StopCircleIcon />}
                onClick={() => {
                  setConfirmDialogOpen(true);
                  setConfirmationTitle("Stop Processing");
                  setConfirmationMessage("Are you sure you want to stop all document processing? This will abort any active processing jobs.");
                  setConfirmationAction(() => stopProcessing);
                }}
                style={{ marginLeft: 'auto' }}
              >
                Stop Processing
              </Button>
            </div>
          </Paper>
      </div>
      )}
      
      <TableContainer component={Paper} style={{ marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <Table aria-label="JFK Files table">
          <TableHead style={{ background: '#f3f4f6' }}>
              <TableRow>
              <TableCell style={{ fontWeight: 600 }}>Document ID</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Page Count</TableCell>
              <TableCell style={{ fontWeight: 600 }}>People</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Places</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Dates</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Objects</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Last Updated</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Title/Source</TableCell>
              <TableCell style={{ fontWeight: 600 }}>View</TableCell>
              <TableCell style={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
            {filteredDocuments.map((doc) => {
              // Extract or create empty analytics object if it doesn't exist
              const docWithAnalytics = doc as JFKDocument & { 
                analytics?: { 
                  peopleCount: number; 
                  placesCount: number; 
                  datesCount: number; 
                  objectsCount: number; 
                  inQueue: boolean;
                },
                documentType?: string,
                documentGroup?: string
              };
              
              // Use direct document arrays instead of analytics object
              const peopleCount = Array.isArray(doc.allNames) ? doc.allNames.length : 0;
              const placesCount = Array.isArray(doc.allPlaces) ? doc.allPlaces.length : 0;
              const datesCount = Array.isArray(doc.allDates) ? doc.allDates.length : 0;
              const objectsCount = Array.isArray(doc.allObjects) ? doc.allObjects.length : 0;
              
              // Keep the analytics object for backward compatibility with inQueue
              const analytics = docWithAnalytics.analytics || {
                peopleCount: 0,
                placesCount: 0,
                datesCount: 0,
                objectsCount: 0,
                inQueue: false
              };
              
              // Determine if it's a JFK or RFK document with better fallback
              let documentGroup = 'JFK';
              if (docWithAnalytics.documentGroup) {
                documentGroup = docWithAnalytics.documentGroup.toUpperCase();
              } else if (docWithAnalytics.documentType) {
                documentGroup = docWithAnalytics.documentType.toUpperCase();
              } else if (doc.id && typeof doc.id === 'string' && doc.id.toUpperCase().includes('RFK')) {
                documentGroup = 'RFK';
              }

              // Generate appropriate document title based on type
              const documentTitle = documentGroup === 'RFK' ? `RFK Document ${doc.id}` : `JFK Document ${doc.id}`;

              // Check if we have a processing update for this document
              const processingUpdate = processingUpdates[doc.id];
                
              return (
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
                      label={documentGroup}
                      size="small"
                      color={documentGroup === 'RFK' ? 'secondary' : 'primary'}
                      style={{ 
                        fontWeight: 500,
                        backgroundColor: documentGroup === 'RFK' ? '#9c27b0' : '#2196f3',
                        color: 'white'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {processingUpdate ? (
                      <div>
                        <Tooltip title={processingUpdate.message || ''}>
                          <Chip 
                            label={processingUpdate.status} 
                            size="small" 
                            color={
                              processingUpdate.type === 'error' ? 'error' : 
                              processingUpdate.type === 'complete' ? 'success' : 
                              'primary'
                            } 
                            variant="outlined"
                            style={{ marginBottom: '4px' }}
                          />
                        </Tooltip>
                        
                        {processingUpdate.type === 'processing' && processingUpdate.progress !== undefined && (
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
                                width: `${processingUpdate.progress}%`, 
                                background: '#3b82f6',
                                transition: 'width 0.3s ease'
                              }} 
                            />
                          </div>
                        )}
                        <Typography variant="caption" style={{ display: 'block', color: '#6b7280', marginTop: '2px' }}>
                          {processingUpdate.message}
                        </Typography>
                      </div>
                    ) : (
                      <Chip 
                        label={doc.processingStage || getLatestStage(doc.stages, doc)} 
                        size="small"
                        color={
                          doc.processingStatus === 'failed' ? 'error' :
                          doc.processingStatus === 'processing' ? 'warning' :
                          doc.status === 'ready' ? 'success' :
                          'default'
                        }
                        variant={doc.processingStatus === 'processing' ? 'outlined' : 'filled'}
                      />
                    )}
                    
                    {!processingUpdate && doc.processingProgress !== undefined && doc.processingProgress > 0 && (
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
                    {doc.pageCount}
                  </TableCell>
                  <TableCell>
                    {doc.allNames && doc.allNames.length > 0
                      ? (
                        <div style={{ 
                          maxHeight: '150px', 
                          overflowY: 'auto', 
                          maxWidth: '300px',
                          overflowX: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {doc.allNames.join(', ')}
                        </div>
                      )
                      : 'None'}
                  </TableCell>
                  <TableCell>
                    {doc.allPlaces && doc.allPlaces.length > 0
                      ? (
                        <div style={{ 
                          maxHeight: '150px', 
                          overflowY: 'auto', 
                          maxWidth: '300px',
                          overflowX: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {doc.allPlaces.join(', ')}
                        </div>
                      )
                      : 'None'}
                  </TableCell>
                  <TableCell>
                    {doc.allDates && doc.allDates.length > 0
                      ? (
                        <div style={{ 
                          maxHeight: '150px', 
                          overflowY: 'auto', 
                          maxWidth: '300px',
                          overflowX: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {doc.allDates.join(', ')}
                        </div>
                      )
                      : 'None'}
                  </TableCell>
                  <TableCell>
                    {doc.allObjects && doc.allObjects.length > 0
                      ? (
                        <div style={{ 
                          maxHeight: '150px', 
                          overflowY: 'auto', 
                          maxWidth: '300px',
                          overflowX: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {doc.allObjects.join(', ')}
                        </div>
                      )
                      : 'None'}
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
                    <Link
                      href={`/jfk-files/${doc.id}`}
                      style={{ color: '#1e3a8a', textDecoration: 'underline', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <VisibilityIcon fontSize="small" />
                      View Document
                    </Link>
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
                      <>
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
                        {analytics.inQueue ? (
                          <Chip 
                            label="In Queue"
                            size="small"
                            color="secondary"
                            style={{ fontSize: '0.7rem' }}
                          />
                        ) : (
                          <AddToDocumentDock 
                            item={{
                              id: doc.dbId || doc.id,
                              title: `${documentGroup} Document ${doc.id}`,
                              url: getDocumentAppUrl(doc.id) || '',
                              type: 'document'
                            }}
                          />
                        )}
                      </>
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
                          title: `${documentGroup} Document ${doc.id}`,
                          url: getDocumentAppUrl(doc.id) || '',
                          type: 'document'
                        }}
                      />
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </TableContainer>
        
      {/* Add document count information right before pagination */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '0.5rem'
      }}>
        <Typography variant="body2" color="textSecondary">
          {totalDocuments === 0 ? (
            `No documents found`
          ) : (
            (() => {
              const start = (currentPage - 1) * itemsPerPage + 1;
              const end = Math.min(currentPage * itemsPerPage, totalDocuments);
              return `Showing ${start}-${end} of ${totalDocuments} documents`;
            })()
          )}
        </Typography>
      </div>
      
      {/* Add debug information about current document filters */}
      <div style={{ 
        padding: '10px',
        marginBottom: '1rem',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '0.375rem'
      }}>
        <Typography variant="subtitle2" gutterBottom>Filter Debug Information</Typography>
        <Typography variant="body2">
          Enabled Groups: <code>{JSON.stringify(enabledGroups)}</code>
        </Typography>
        <Typography variant="body2">
          Document Types Found: <code>
            {JSON.stringify(Array.from(new Set(documents.map(doc => {
              const docWithType = doc as JFKDocument & { documentType?: string, documentGroup?: string };
              const groupValue = docWithType.documentGroup || docWithType.documentType || 
                (doc.id && typeof doc.id === 'string' && doc.id.toUpperCase().includes('RFK') ? 'rfk' : 'jfk');
              return groupValue;
            }))))}
          </code>
        </Typography>
        <Typography variant="body2">
          Total JFK Documents: <code>
            {documents.filter(doc => {
              const docWithType = doc as JFKDocument & { documentType?: string, documentGroup?: string };
              if (docWithType.documentGroup) return docWithType.documentGroup.toLowerCase() === 'jfk';
              if (docWithType.documentType) return docWithType.documentType.toLowerCase() === 'jfk';
              return !(doc.id && typeof doc.id === 'string' && doc.id.toUpperCase().includes('RFK'));
            }).length}
          </code>
        </Typography>
        <Typography variant="body2">
          Total RFK Documents: <code>
            {documents.filter(doc => {
              const docWithType = doc as JFKDocument & { documentType?: string, documentGroup?: string };
              if (docWithType.documentGroup) return docWithType.documentGroup.toLowerCase() === 'rfk';
              if (docWithType.documentType) return docWithType.documentType.toLowerCase() === 'rfk';
              return doc.id && typeof doc.id === 'string' && doc.id.toUpperCase().includes('RFK');
            }).length}
          </code>
        </Typography>
        <Typography variant="body2">
          Current Page: <code>{currentPage}</code> of <code>{totalPages}</code>
        </Typography>
        <Typography variant="body2">
          Items Per Page: <code>{itemsPerPage}</code>
        </Typography>
        <Typography variant="body2">
          Start Index: <code>{(currentPage - 1) * itemsPerPage + 1}</code>
        </Typography>
        <Typography variant="body2">
          End Index: <code>{Math.min(currentPage * itemsPerPage, totalDocuments)}</code>
        </Typography>
        <Typography variant="body2">
          Total Documents: <code>{totalDocuments}</code>
        </Typography>
        <Typography variant="body2">
          Current Page Documents: <code>{documents.length}</code>
        </Typography>
      </div>
      
      {/* Use pagination controls that respect filtered documents */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button 
            onClick={() => setCurrentPage(1)} 
            disabled={currentPage === 1 || filteredDocuments.length === 0}
            variant="outlined"
            size="small"
            style={{ minWidth: '60px' }}
          >
            START
          </Button>
          <Button 
            onClick={goToPrevPage} 
            disabled={currentPage === 1 || filteredDocuments.length === 0}
            variant="outlined"
            size="small"
            style={{ minWidth: '80px' }}
          >
            PREVIOUS
          </Button>
          
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            margin: '0 0.5rem'
          }}>
            <Box 
              component="span" 
              sx={{ 
                px: 2, 
                py: 1, 
                border: '1px solid #e2e8f0',
                borderRadius: '0.25rem',
                bgcolor: '#f8fafc',
                fontWeight: 'medium',
                fontSize: '0.875rem',
                display: 'flex', 
                alignItems: 'center'
              }}
            >
              Page
              <TextField
                size="small"
                value={currentPage}
                onChange={(e) => {
                  const pageNum = parseInt(e.target.value);
                  if (!isNaN(pageNum) && pageNum > 0 && pageNum <= effectiveTotalPages && filteredDocuments.length > 0) {
                    setCurrentPage(pageNum);
                  }
                }}
                inputProps={{
                  min: 1,
                  max: effectiveTotalPages,
                  style: { 
                    width: '40px', 
                    padding: '4px 8px',
                    margin: '0 8px',
                    textAlign: 'center'
                  }
                }}
                disabled={filteredDocuments.length === 0}
              />
              of {filteredDocuments.length === 0 ? 0 : effectiveTotalPages}
            </Box>
          </div>
          
          <Button 
            onClick={goToNextPage} 
            disabled={currentPage === effectiveTotalPages || filteredDocuments.length === 0}
            variant="outlined"
            size="small"
            style={{ minWidth: '80px' }}
          >
            NEXT
          </Button>
          <Button 
            onClick={() => setCurrentPage(effectiveTotalPages)} 
            disabled={currentPage === effectiveTotalPages || filteredDocuments.length === 0}
            variant="outlined"
            size="small"
            style={{ minWidth: '60px' }}
          >
            END
          </Button>
        </div>
      </div>
      
      {/* Add pagination summary */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '1.5rem'
      }}>
        <Typography variant="body2" color="textSecondary">
          {(() => {
            const start = (currentPage - 1) * itemsPerPage + 1;
            const end = Math.min(currentPage * itemsPerPage, totalDocuments);
            return `Showing page ${currentPage} of ${totalPages} (${start}-${end} of ${totalDocuments} total documents)`;
          })()}
        </Typography>
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