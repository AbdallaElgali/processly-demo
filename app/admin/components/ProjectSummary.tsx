import React, { useState, useMemo } from 'react';
import { 
  Box, Typography, Card, Button, TextField, 
  MenuItem, Select, FormControl, InputLabel, Chip 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import Link from 'next/link';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { useProjectSummary } from '@/hooks/useProjectSummary'; 
import { ProjectSummary as ProjectSummaryType } from '@/types/audit';
import { formatDisplayValue } from '@/lib/review/format';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRows } from '@/components/ui/Skeletons';

interface ParameterRowProps {
  parameter: ProjectSummaryType;
  href: string;
}

// Redesigned: High-Density Horizontal Row
const ParameterRow: React.FC<ParameterRowProps> = ({ parameter, href }) => {
  // Determine color coding for the main review action
  const getActionColor = (action: string | null) => {
    switch (action) {
      case 'ACCEPTED': return 'success';
      case 'MODIFIED': return 'warning';
      case 'REJECTED': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card
      component={Link}
      href={href}
      variant="outlined"
      aria-label={`${parameter.parameterKey}: open the Audit`}
      sx={{
        mb: 1.5,
        borderColor: 'border.subtle',
        bgcolor: 'surface.panel',
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        p: 2,
        color: 'inherit',
        textDecoration: 'none',
        transition: 'background-color 0.2s',
        '&:hover': { bgcolor: 'surface.hover' },
      }}
    >
      {/* 1. Parameter Key (Name) */}
      <Box sx={{ flex: '1 1 25%', minWidth: 200, pr: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
          {parameter.parameterKey}
        </Typography>
      </Box>

      {/* 2. Final Value */}
      <Box sx={{ flex: '1 1 25%', pr: 2, borderLeft: '1px solid', borderColor: 'border.subtle', pl: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Final value
        </Typography>
        <Typography variant="body2" fontWeight="bold" color={parameter.finalValue !== null ? 'text.primary' : 'text.disabled'} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {parameter.finalValue !== null ? formatDisplayValue(parameter.finalValue) : 'Unassigned'}
        </Typography>
      </Box>

      {/* 3. Micro-Stats (Candidates / Runs / Flags) */}
      <Box sx={{ flex: '1 1 25%', pr: 2, borderLeft: '1px solid', borderColor: 'border.subtle', pl: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Activity
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span><b>{parameter.totalCandidates}</b> candidates</span>
          <span>•</span>
          <span><b>{parameter.totalExtractionRuns}</b> runs</span>
          <span>•</span>
          <Box component="span" sx={{ color: parameter.totalFlags > 0 ? 'status.danger' : 'inherit' }}>
            <b>{parameter.totalFlags}</b> flags
          </Box>
        </Typography>
      </Box>

      {/* 4. Status Badges */}
      <Box sx={{ flex: '1 1 25%', display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
        {parameter.isAiAccepted && (
          <Typography variant="caption" fontWeight="bold" sx={{ color: 'status.success', border: '1px solid', borderColor: 'status.success', px: 1, py: 0.25, borderRadius: 1 }}>
            From AI
          </Typography>
        )}
        {parameter.isHumanModified && (
          <Typography variant="caption" fontWeight="bold" sx={{ color: 'status.warning', border: '1px solid', borderColor: 'status.warning', px: 1, py: 0.25, borderRadius: 1 }}>
            Edited
          </Typography>
        )}
        <Chip 
          label={parameter.reviewAction || 'PENDING'} 
          size="small" 
          color={getActionColor(parameter.reviewAction)}
          variant={parameter.reviewAction === 'PENDING' ? 'outlined' : 'filled'}
          sx={{ fontWeight: 'bold', ml: 1 }} 
        />
      </Box>
    </Card>
  );
};

interface ProjectSummaryProps {
  projectId: string;
  onBack: () => void;
}

const ProjectSummary: React.FC<ProjectSummaryProps> = ({ projectId, onBack }) => {
  const { summaryData, isLoading, error, reload } = useProjectSummary(projectId);
  const auditHref = `/projects/${projectId}/audit`;
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState('ALL');
  const [runsFilter, setRunsFilter] = useState('ALL');
  const [flagsFilter, setFlagsFilter] = useState('ALL');
  
  // Derive filtered parameters based on UI state
  const filteredParameters = useMemo(() => {
    return summaryData.filter(param => {
      // Search text
      const matchesSearch = param.parameterKey.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Review Status
      // A row with no stored action is shown as PENDING, so it filters as PENDING.
      const matchesReview = reviewFilter === 'ALL' || (param.reviewAction ?? 'PENDING') === reviewFilter;
      
      // Extraction Runs Logic
      let matchesRuns = true;
      if (runsFilter === 'MULTIPLE') matchesRuns = param.totalExtractionRuns > 1;
      if (runsFilter === 'ONE_PLUS') matchesRuns = param.totalExtractionRuns >= 1;
      if (runsFilter === 'ZERO') matchesRuns = param.totalExtractionRuns === 0;

      // Flags Logic
      let matchesFlags = true;
      if (flagsFilter === 'HAS_FLAGS') matchesFlags = param.totalFlags > 0;
      if (flagsFilter === 'NO_FLAGS') matchesFlags = param.totalFlags === 0;

      return matchesSearch && matchesReview && matchesRuns && matchesFlags;
    });
  }, [summaryData, searchQuery, reviewFilter, runsFilter, flagsFilter]);

  if (isLoading) {
    return <Box sx={{ p: 1 }} aria-busy="true"><SkeletonRows count={8} columns={4} /></Box>;
  }

  if (error) {
    return (
      <Box sx={{ flex: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ textTransform: 'none', color: 'text.secondary' }}>
          Back to Overview
        </Button>
        <ErrorState title="Could not load this project's parameters" description={error} onRetry={reload} />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ textTransform: 'none', color: 'text.secondary' }}>
          Back to Overview
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>
          Project Parameters
        </Typography>
        <Button component={Link} href={auditHref} variant="outlined" startIcon={<FactCheckOutlinedIcon />}>
          Open this project&rsquo;s Audit
        </Button>
      </Box>

      {/* Controls Bar: Flex-wrap added to support multiple dropdowns */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search parameters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flex: 1, minWidth: 200, bgcolor: 'surface.panel' }}
          slotProps={{ input: { startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} /> } }}
        />
        
        {/* Review Status Filter */}
        <FormControl size="small" sx={{ minWidth: 160, bgcolor: 'surface.panel' }}>
          <InputLabel>Review Status</InputLabel>
          <Select
            value={reviewFilter}
            label="Review Status"
            onChange={(e) => setReviewFilter(e.target.value)}
          >
            <MenuItem value="ALL">All Statuses</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="ACCEPTED">Accepted</MenuItem>
            <MenuItem value="MODIFIED">Modified</MenuItem>
            <MenuItem value="REJECTED">Rejected</MenuItem>
          </Select>
        </FormControl>

        {/* Extraction Runs Filter */}
        <FormControl size="small" sx={{ minWidth: 160, bgcolor: 'surface.panel' }}>
          <InputLabel>Extraction Runs</InputLabel>
          <Select
            value={runsFilter}
            label="Extraction Runs"
            onChange={(e) => setRunsFilter(e.target.value)}
          >
            <MenuItem value="ALL">All Runs</MenuItem>
            <MenuItem value="ONE_PLUS">1+ Runs</MenuItem>
            <MenuItem value="MULTIPLE">Multiple Runs (2+)</MenuItem>
            <MenuItem value="ZERO">Zero Runs (Manual)</MenuItem>
          </Select>
        </FormControl>

        {/* Flags Filter */}
        <FormControl size="small" sx={{ minWidth: 160, bgcolor: 'surface.panel' }}>
          <InputLabel>Flags</InputLabel>
          <Select
            value={flagsFilter}
            label="Flags"
            onChange={(e) => setFlagsFilter(e.target.value)}
          >
            <MenuItem value="ALL">All Flags</MenuItem>
            <MenuItem value="HAS_FLAGS">Has Flags (1+)</MenuItem>
            <MenuItem value="NO_FLAGS">No Flags (0)</MenuItem>
          </Select>
        </FormControl>

      </Box>

      {/* Render the List of Parameter Rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {filteredParameters.length > 0 ? (
          filteredParameters.map((param) => (
            <ParameterRow 
              key={param.parameterKey} 
              parameter={param} 
              href={auditHref}
            />
          ))
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'border.strong', borderRadius: 2 }}>
            <Typography color="text.secondary">No parameters match your search filters.</Typography>
          </Box>
        )}
      </Box>

    </Box>
  );
};

export default ProjectSummary;