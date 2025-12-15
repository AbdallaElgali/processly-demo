'use client';

import { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { InputField, FieldType } from '@/types';
import { InputFieldItem } from './input-field-item';

interface InputFieldsListProps {
  fields: InputField[];
  availableFieldTypes: FieldType[];
  onFieldChange: (id: string, value: string) => void;
  onRemoveField: (id: string) => void;
  onAddField: (fieldTypeId: string) => void;
}

export const InputFieldsList = ({
  fields,
  availableFieldTypes,
  onFieldChange,
  onRemoveField,
  onAddField,
}: InputFieldsListProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSelectField = (typeId: string) => {
    onAddField(typeId);
    handleMenuClose();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" color="text.primary">
          Extracted Data
        </Typography>
        
        <Box>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleMenuClick}
          >
            Add Field
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleMenuClose}
            PaperProps={{
              style: { maxHeight: 300, width: 200 },
            }}
          >
            {availableFieldTypes.map((type) => (
              <MenuItem key={type.id} onClick={() => handleSelectField(type.id)}>
                {type.label}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>

      <Box>
        {fields.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
            <Typography color="text.secondary">No fields added yet.</Typography>
          </Box>
        ) : (
          fields.map((field) => (
            <InputFieldItem
              key={field.id}
              field={field}
              onChange={onFieldChange}
              onRemove={onRemoveField}
            />
          ))
        )}
      </Box>
    </Box>
  );
};