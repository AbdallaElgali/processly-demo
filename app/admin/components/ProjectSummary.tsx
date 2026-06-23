import React, { useState, useMemo } from 'react';
import { 
  Box, Typography, Card, Button, TextField, 
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Chip 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import { colors } from '@/theme/colors';
import { useProjectSummary } from '@/hooks/useProjectSummary'; 
import { ProjectSummary as ProjectSummaryType } from '@/types/audit';
import ParameterLineage from './ParameterLineage';

interface ParameterRowProps {
  parameter: ProjectSummaryType;
  onClick: () => void;
}

// Redesigned: High-Density Horizontal Row
const ParameterRow: React.FC<ParameterRowProps> = ({ parameter, onClick }) => {
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
      onClick={onClick}
      sx={{ 
        mb: 1.5, 
        elevation: 0, 
        border: `1px solid ${colors.border}`, 
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        p: 2,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
      }}
    >
      {/* 1. Parameter Key (Name) */}
      <Box sx={{ flex: '1 1 25%', minWidth: 200, pr: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
          {parameter.parameterKey}
        </Typography>
      </Box>

      {/* 2. Final Value */}
      <Box sx={{ flex: '1 1 25%', pr: 2, borderLeft: `1px solid ${colors.border}`, pl: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Final Value
        </Typography>
        <Typography variant="body2" fontWeight="bold" color={parameter.finalValue ? 'text.primary' : 'text.disabled'}>
          {parameter.finalValue !== null ? parameter.finalValue : 'Unassigned'}
        </Typography>
      </Box>

      {/* 3. Micro-Stats (Candidates / Runs / Flags) */}
      <Box sx={{ flex: '1 1 25%', pr: 2, borderLeft: `1px solid ${colors.border}`, pl: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Extraction Stats
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span><b>{parameter.totalCandidates}</b> cands</span>
          <span>•</span>
          <span><b>{parameter.totalExtractionRuns}</b> runs</span>
          <span>•</span>
          <span style={{ color: parameter.totalFlags > 0 ? '#d32f2f' : 'inherit' }}>
            <b>{parameter.totalFlags}</b> flags
          </span>
        </Typography>
      </Box>

      {/* 4. Status Badges */}
      <Box sx={{ flex: '1 1 25%', display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
        {parameter.isAiAccepted && (
          <Typography variant="caption" fontWeight="bold" color="success.main" sx={{ border: '1px solid', borderColor: 'success.light', px: 1, py: 0.25, borderRadius: 1 }}>
            AI Won
          </Typography>
        )}
        {parameter.isHumanModified && (
          <Typography variant="caption" fontWeight="bold" color="warning.main" sx={{ border: '1px solid', borderColor: 'warning.light', px: 1, py: 0.25, borderRadius: 1 }}>
            Human Edited
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
  const { summaryData, isLoading, error } = useProjectSummary(projectId);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState('ALL');
  const [runsFilter, setRunsFilter] = useState('ALL');
  const [flagsFilter, setFlagsFilter] = useState('ALL');
  
  // Track selected parameter for drill-down routing
  const [selectedParameterKey, setSelectedParameterKey] = useState<string | null>(null);

  // Derive filtered parameters based on UI state
  const filteredParameters = useMemo(() => {
    return summaryData.filter(param => {
      // Search text
      const matchesSearch = param.parameterKey.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Review Status
      const matchesReview = reviewFilter === 'ALL' || param.reviewAction === reviewFilter;
      
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

  // Route to Lineage view if a parameter is selected
  if (selectedParameterKey) {
    return (
      <ParameterLineage 
        projectId={projectId} 
        parameterKey={selectedParameterKey} 
        onBack={() => setSelectedParameterKey(null)} 
      />
    );
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Typography color="error">Error loading project details: {error}</Typography>;
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ textTransform: 'none', color: colors.textSecondary }}>
          Back to Overview
        </Button>
      </Box>

      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Project Parameters
      </Typography>

      {/* Controls Bar: Flex-wrap added to support multiple dropdowns */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search parameters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flex: 1, minWidth: 200, bgcolor: colors.surface }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
          }}
        />
        
        {/* Review Status Filter */}
        <FormControl size="small" sx={{ minWidth: 160, bgcolor: colors.surface }}>
          <InputLabel>Review Status</InputLabel>
          <Select
            value={reviewFilter}
            label="Review Status"
            onChange={(e) => setReviewFilter(e.target.value)}
          >
            <MenuItem value="ALL">All Statuses</MenuItem>
            <MenuItem value="ACCEPTED">Accepted</MenuItem>
            <MenuItem value="MODIFIED">Modified</MenuItem>
            <MenuItem value="REJECTED">Rejected</MenuItem>
          </Select>
        </FormControl>

        {/* Extraction Runs Filter */}
        <FormControl size="small" sx={{ minWidth: 160, bgcolor: colors.surface }}>
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
        <FormControl size="small" sx={{ minWidth: 160, bgcolor: colors.surface }}>
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
              onClick={() => setSelectedParameterKey(param.parameterKey)} 
            />
          ))
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 2 }}>
            <Typography color="text.secondary">No parameters match your search filters.</Typography>
          </Box>
        )}
      </Box>

    </Box>
  );
};

export default ProjectSummary;