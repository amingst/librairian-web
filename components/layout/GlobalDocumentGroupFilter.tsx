'use client';

import React from 'react';
import { useDocumentGroups, DocumentGroup } from '../../lib/context/DocumentGroupContext';
import { Box, Chip, Tooltip, Stack } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { titleCase } from '../../lib/utils/stringHelpers';

/**
 * A component that provides global filtering for document groups
 * Designed to be placed in the header to control app-wide filtering
 */
export default function GlobalDocumentGroupFilter() {
  const { documentGroups, enabledGroups, toggleGroup } = useDocumentGroups();

  // Determine color for each group
  const getGroupColor = (groupId: string): string => {
    switch(groupId) {
      case 'jfk': return '#2196f3'; // blue
      case 'rfk': return '#9c27b0'; // purple
      default: return '#4caf50';    // green for any other groups
    }
  };

  // Get a formatted display name for each group
  const getDisplayName = (groupId: string): string => {
    switch(groupId) {
      case 'jfk': return 'JFK Files';
      case 'rfk': return 'RFK Files';
      default: return titleCase(groupId.replace('-', ' '));
    }
  };

  const handleToggle = (groupId: string) => {
    toggleGroup(groupId);
  };

  return (
    <div className="document-filter-container">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Tooltip title="Document Group Filters">
          <FilterAltIcon sx={{ mr: 1, color: 'white' }} fontSize="small" />
        </Tooltip>
        
        <Stack direction="row" spacing={1}>
          {documentGroups.map((group: DocumentGroup) => {
            const isEnabled = enabledGroups.includes(group.id);
            return (
              <Chip
                key={group.id}
                label={getDisplayName(group.id)}
                onClick={() => handleToggle(group.id)}
                sx={{
                  bgcolor: isEnabled ? getGroupColor(group.id) : 'transparent',
                  color: isEnabled ? 'white' : 'white',
                  border: `1px solid ${isEnabled ? getGroupColor(group.id) : 'white'}`,
                  '&:hover': {
                    opacity: 0.9,
                  },
                  fontSize: '0.75rem',
                  height: '28px',
                }}
                size="small"
              />
            );
          })}
        </Stack>
      </Box>
    </div>
  );
} 