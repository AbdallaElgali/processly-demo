import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { InputField } from '@/types';
import { colors } from '@/theme/colors';
import { FIELD_TYPES } from '@/app/page';

interface SummaryViewProps {
  fields: InputField[];
  onBack: () => void;
}

type FilterType = 'all' | 'high' | 'review';

export const SummaryView = ({ fields, onBack }: SummaryViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Filter logic
  const filteredFields = useMemo(() => {
    return fields.filter((field) => {
      // --- FIX 1: SAFETY CHECK FOR SEARCH ---
      // Safely convert value to string, fallback to empty string if null/undefined
      const valueStr = field.value ? String(field.value).toLowerCase() : '';
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = 
        field.label.toLowerCase().includes(searchLower) ||
        valueStr.includes(searchLower) ||
        field.id.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // --- FIX 2: STATUS FILTER LOGIC ---
      if (activeFilter === 'high') {
        // Only show items with >= 90% confidence
        return field.confidence !== null && field.confidence >= 0.9;
      }
      if (activeFilter === 'review') {
        // Show Manual (null), Low Confidence, or Warning (< 0.9)
        return field.confidence === null || field.confidence < 0.9;
      }
      
      return true; // 'all'
    });
  }, [fields, searchTerm, activeFilter]);

  const renderStatusBadge = (confidence: number | null) => {
    if (confidence === null) {
      return (
        <Chip 
          label="Manual" 
          size="small" 
          sx={{ 
            bgcolor: colors.surfaceHighlight, 
            color: colors.textPrimary, 
            height: 24,
            border: `1px solid ${colors.border}` 
          }} 
        />
      );
    }
    
    if (confidence >= 0.9) {
      return (
        <Chip 
          icon={<CheckCircleIcon style={{ color: colors.success }} />} 
          label="Verified" 
          size="small" 
          sx={{ 
            bgcolor: `${colors.success}1A`, 
            color: colors.success, 
            border: `1px solid ${colors.success}`, 
            height: 24 
          }} 
        />
      );
    } else if (confidence >= 0.7) {
      return (
        <Chip 
          icon={<WarningIcon style={{ color: colors.warning }} />} 
          label="Review" 
          size="small" 
          sx={{ 
            bgcolor: `${colors.warning}1A`, 
            color: colors.warning, 
            border: `1px solid ${colors.warning}`, 
            height: 24 
          }} 
        />
      );
    } else {
      return (
        <Chip 
          icon={<ErrorIcon style={{ color: colors.error }} />} 
          label="Low Conf." 
          size="small" 
          sx={{ 
            bgcolor: `${colors.error}1A`, 
            color: colors.error, 
            border: `1px solid ${colors.error}`, 
            height: 24 
          }} 
        />
      );
    }
  };

  return (
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      bgcolor: colors.background, 
      color: colors.textPrimary, 
      height: '100%', 
      overflow: 'hidden' 
    }}>
      
      {/* Header Bar */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}` }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={onBack}
          sx={{ color: colors.primary, mr: 2, textTransform: 'none' }}
        >
          Back to Editor
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Specification Summary
        </Typography>
      </Box>

      {/* Toolbar & Search */}
      <Box sx={{ p: 3, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              maxWidth: 500,
              '& .MuiOutlinedInput-root': {
                bgcolor: colors.surface,
                color: colors.textPrimary,
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.primary },
                '&.Mui-focused fieldset': { borderColor: colors.primary },
              },
              '& .MuiInputAdornment-root': { color: colors.textSecondary }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <IconButton sx={{ color: colors.textSecondary }}>
            <FilterListIcon />
          </IconButton>
        </Box>

        {/* --- FIX 3: INTERACTIVE STATUS PILLS --- */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
           <Chip 
             label="All Parameters" 
             onClick={() => setActiveFilter('all')}
             sx={{ 
               bgcolor: activeFilter === 'all' ? colors.primary : colors.surface,
               color: activeFilter === 'all' ? '#000' : colors.textSecondary,
               fontWeight: activeFilter === 'all' ? 'bold' : 'normal',
               border: activeFilter === 'all' ? 'none' : `1px solid ${colors.border}`,
               '&:hover': { bgcolor: activeFilter === 'all' ? colors.primaryHover : colors.surfaceHighlight }
             }} 
            />
           <Chip 
             label="High Confidence" 
             onClick={() => setActiveFilter('high')}
             sx={{ 
               bgcolor: activeFilter === 'high' ? colors.success : colors.surface,
               color: activeFilter === 'high' ? '#000' : colors.textSecondary,
               fontWeight: activeFilter === 'high' ? 'bold' : 'normal',
               border: activeFilter === 'high' ? 'none' : `1px solid ${colors.border}`,
               '&:hover': { bgcolor: activeFilter === 'high' ? colors.success : colors.surfaceHighlight }
             }} 
            />
           <Chip 
             label="Needs Review" 
             onClick={() => setActiveFilter('review')}
             sx={{ 
               bgcolor: activeFilter === 'review' ? colors.warning : colors.surface,
               color: activeFilter === 'review' ? '#000' : colors.textSecondary,
               fontWeight: activeFilter === 'review' ? 'bold' : 'normal',
               border: activeFilter === 'review' ? 'none' : `1px solid ${colors.border}`,
               '&:hover': { bgcolor: activeFilter === 'review' ? colors.warning : colors.surfaceHighlight }
             }} 
            />
        </Box>
      </Box>

      {/* Table Area */}
      <Box sx={{ flex: 1, p: 3, pt: 0, overflow: 'hidden' }}>
        <TableContainer 
          component={Paper} 
          sx={{ 
            bgcolor: colors.surface, 
            height: '100%', 
            borderRadius: 1, 
            border: `1px solid ${colors.border}`,
            backgroundImage: 'none'
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: colors.surface, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>ID</TableCell>
                <TableCell sx={{ bgcolor: colors.surface, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Parameter Name</TableCell>
                <TableCell sx={{ bgcolor: colors.surface, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Extracted Value</TableCell>
                <TableCell sx={{ bgcolor: colors.surface, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Unit</TableCell>
                <TableCell sx={{ bgcolor: colors.surface, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Confidence Status</TableCell>
                <TableCell sx={{ bgcolor: colors.surface, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFields.length > 0 ? (
                filteredFields.map((field) => (
                  <TableRow 
                    key={field.id}
                    sx={{ 
                      '&:hover': { bgcolor: colors.surfaceHighlight },
                      borderBottom: `1px solid ${colors.border}`
                    }}
                  >
                    <TableCell sx={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {field.id.split('_').slice(0,2).join('_').substring(0, 10)}...
                    </TableCell>
                    <TableCell sx={{ color: colors.primary, fontWeight: 500 }}>
                      {field.label}
                    </TableCell>
                    <TableCell sx={{ color: colors.textPrimary }}>
                      {field.value || '-'}
                    </TableCell>
                    <TableCell sx={{ color: colors.textSecondary }}>
                      {field.type ? (FIELD_TYPES.find(t => t.id === field.type)?.unit || '-') : '-'}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(field.confidence)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: colors.primary, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                        Edit
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: colors.textSecondary }}>
                    No parameters found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};