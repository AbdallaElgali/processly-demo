'use client';

import React, { useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  Divider
} from '@mui/material';
import { InputField, SpecificationSource, SCHEMA_GROUPS } from '@/types';
import { InputFieldItem } from './input-field-item';
import { colors } from '@/theme/colors';

interface InputFieldsListProps {
  fields: InputField[];
  onFieldChange: (id: string, value: string, unit: string) => void;
  onRemoveField: (id: string) => void;
  onShowSource: (source: SpecificationSource) => void;
  onSwitchSpecification: (fieldId: string, specId: string) => void;
  onFlag?: (id: string, isFlagged: boolean, reason?: string | null) => void;
  readOnly?: boolean;
}

export const InputFieldsList = ({
  fields,
  onFieldChange,
  onRemoveField,
  onShowSource,
  onSwitchSpecification,
  onFlag,
  readOnly = false,
}: InputFieldsListProps) => {
  const groupedFields = useMemo(() => {
    return SCHEMA_GROUPS.map((group) => {
      const groupFields = fields.filter((f) =>
        group.fields.some((schemaField) => schemaField.id === f.id)
      );

      const filledCount = groupFields.filter((f) => {
        const activeSpec = f.specifications.find((s) => s.id === f.selectedSpecId) || f.specifications[0];
        return activeSpec && activeSpec.value && activeSpec.value !== '';
      }).length;

      return {
        group,
        groupFields,
        filledCount,
      };
    });
  }, [fields]);
  
  return (
    <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
      {groupedFields.map(({ group, groupFields, filledCount }, index) => {

        if (groupFields.length === 0) return null;

        return (
          <Box key={group.group}>
            {/* FORM SECTION HEADER */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              bgcolor: colors.surfaceHighlight, 
              px: 3, 
              py: 1.5,
              borderBottom: `1px solid ${colors.border}`,
              borderTop: index > 0 ? `1px solid ${colors.border}` : 'none'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                {group.group}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                {filledCount} / {groupFields.length} Completed
              </Typography>
            </Box>

            {/* FORM FIELDS */}
            <Box sx={{ px: 3, py: 1 }}>
              {groupFields.map((field) => (
                <InputFieldItem
                  key={field.id}
                  field={field}
                  onChange={onFieldChange}
                  onRemove={onRemoveField}
                  onShowSource={onShowSource}
                  onSwitch={onSwitchSpecification}
                  onFlag={onFlag}
                  readOnly={readOnly}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
};

export const MemoizedInputFieldsList = React.memo(InputFieldsList);