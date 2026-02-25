'use client';

import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { InputField } from '@/types';
import { InputFieldItem } from './input-field-item';
import { SCHEMA_GROUPS } from '@/types';
import { colors } from '@/theme/colors';

// FIX: Cleaned up the props to match exactly what is being passed from App.tsx
interface InputFieldsListProps {
  fields: InputField[];
  onFieldChange: (id: string, value: string) => void;
  onRemoveField: (id: string) => void;
  onShowSource: (source: any) => void;
  onSwitchSpecification: (fieldId: string, specId: string) => void; // <-- NEW
}

export const InputFieldsList = ({
  fields,
  onFieldChange,
  onRemoveField,
  onShowSource,
  onSwitchSpecification // <-- NEW
}: InputFieldsListProps) => {
  
  const [expanded, setExpanded] = useState<string | false>(SCHEMA_GROUPS[0].group);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {SCHEMA_GROUPS.map((group) => {
        const groupFields = fields.filter(f => 
          group.fields.some(schemaField => schemaField.id === f.type)
        );

        if (groupFields.length === 0) return null;

        // FIX: Updated logic to check if the *active specification* has a value
        const filledCount = groupFields.filter(f => {
          const activeSpec = f.specifications.find(s => s.id === f.selectedSpecId) || f.specifications[0];
          return activeSpec && activeSpec.value && activeSpec.value !== '';
        }).length;
        
        const totalCount = groupFields.length;

        return (
          <Accordion 
            key={group.group}
            expanded={expanded === group.group}
            onChange={handleChange(group.group)}
            disableGutters
            elevation={0}
            sx={{
              border: `1px solid ${colors.border}`,
              borderRadius: '8px !important',
              overflow: 'hidden',
              '&:before': { display: 'none' }, 
              mb: 1
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: colors.primary }} />}
              sx={{ 
                bgcolor: colors.surface,
                '&:hover': { bgcolor: colors.surfaceHighlight },
                px: 2
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', pr: 2 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 700, 
                    color: colors.primary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}
                >
                  {group.group}
                </Typography>
                
                <Chip 
                  label={`${filledCount} / ${totalCount} Filled`}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.65rem', 
                    fontWeight: 600,
                    borderColor: filledCount === totalCount ? colors.success : colors.border,
                    color: filledCount === totalCount ? colors.success : colors.textSecondary
                  }} 
                />
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 2, bgcolor: colors.background }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {groupFields.map((field) => (
                  <InputFieldItem
                    key={field.id}
                    field={field}
                    onChange={onFieldChange}
                    onRemove={onRemoveField}
                    onShowSource={onShowSource}
                    onSwitch={onSwitchSpecification} // <-- PASSED DOWN!
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};