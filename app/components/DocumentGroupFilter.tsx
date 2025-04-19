'use client';

import React, { useState } from 'react';
import { Box, ToggleButtonGroup, ToggleButton, styled } from '@mui/material';
import { useDocumentGroups, DocumentGroup } from '../../lib/context/DocumentGroupContext';
import { titleCase } from '../../lib/utils/stringHelpers';

// Styled Toggle Button Group for better appearance
const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButtonGroup-grouped': {
    marginRight: 4,
    borderRadius: 8,
    borderColor: theme.palette.divider,
    '&.Mui-selected': {
      borderColor: theme.palette.primary.main,
      backgroundColor: `${theme.palette.primary.main}10`,
      color: theme.palette.primary.main,
      '&:hover': {
        backgroundColor: `${theme.palette.primary.main}20`,
      },
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&:not(:first-of-type)': {
      borderRadius: 8,
      borderLeft: '1px solid',
      borderLeftColor: theme.palette.divider,
    },
    '&:first-of-type': {
      borderRadius: 8,
    },
    textTransform: 'capitalize',
    fontSize: '0.85rem',
    padding: theme.spacing(0.5, 1),
    height: 32,
  },
  backgroundColor: 'transparent',
}));

// Styled Toggle Button for consistent sizing
const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  minWidth: 55,
  fontWeight: 'medium',
}));

interface DocumentGroupFilterProps {
  onGroupChange: (selectedGroups: string[]) => void;
  initialSelectedGroups?: string[];
}

/**
 * DocumentGroupFilter component for filtering documents by their document group
 */
export function DocumentGroupFilter({
  onGroupChange,
  initialSelectedGroups = [],
}: DocumentGroupFilterProps) {
  const { documentGroups } = useDocumentGroups();
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialSelectedGroups);

  const handleGroupChange = (_event: React.MouseEvent<HTMLElement>, newGroups: string[]) => {
    setSelectedGroups(newGroups);
    onGroupChange(newGroups);
  };

  const formatGroupContent = (group: DocumentGroup) => {
    return (
      <span>
        {titleCase(group.name)}
      </span>
    );
  };

  return (
    <Box>
      <StyledToggleButtonGroup
        value={selectedGroups}
        onChange={handleGroupChange}
        aria-label="document groups"
      >
        {documentGroups.map((group: DocumentGroup) => (
          <StyledToggleButton 
            key={group.id} 
            value={group.id}
            aria-label={`filter by ${group.name}`}
          >
            {formatGroupContent(group)}
          </StyledToggleButton>
        ))}
      </StyledToggleButtonGroup>
    </Box>
  );
} 