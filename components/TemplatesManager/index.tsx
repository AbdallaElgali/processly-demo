'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Snackbar, 
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Divider,
  Chip,
  Tooltip,
  InputAdornment,
  Paper,
  Switch,
  FormControlLabel
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import DataObjectIcon from '@mui/icons-material/DataObject';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/theme/colors';
import { TemplateRuleUpsert, CanonicalParameter } from '@/api/templates';
import { useTemplateData } from '@/hooks/TemplatesHook';

export function TemplatesManager() {
  const { user, isLoading: authLoading } = useAuth();
  
  // Custom Hook for all API and data state management
  const {
    templates,
    parameters,
    activeTemplate,
    isLoading,
    isSaving,
    defaultTemplateId,
    selectTemplate,
    createNewTemplate,
    removeTemplate,
    saveRule,
    updateDefaultTemplate
  } = useTemplateData(user?.id, authLoading);

  // UI State: Modals, Notifications, & Filters
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [showInactive, setShowInactive] = useState(false);

  // Fallback to system default if user hasn't set a personal default
  const effectiveDefaultTemplateId = defaultTemplateId || templates.find(t => t.is_system_default)?.id;

  // Handlers
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      await selectTemplate(templateId);
    } catch (error) {
      showSnackbar('Failed to load template details', 'error');
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      await createNewTemplate(newTemplateName);
      setIsCreateModalOpen(false);
      setNewTemplateName('');
      showSnackbar('Template created successfully', 'success');
    } catch (error) {
      showSnackbar('Failed to create template', 'error');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await removeTemplate(templateId);
      showSnackbar('Template deleted', 'success');
    } catch (error) {
      showSnackbar('Failed to delete template', 'error');
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await updateDefaultTemplate(templateId);
      showSnackbar('Default template updated', 'success');
    } catch (error) {
      showSnackbar('Failed to update default template', 'error');
    }
  };

  const handleUpsertRule = async (ruleData: TemplateRuleUpsert) => {
    try {
      await saveRule(ruleData);
      showSnackbar('Rule saved successfully', 'success');
    } catch (error) {
      showSnackbar('Failed to save rule', 'error');
    }
  };

  if (authLoading || (isLoading && !activeTemplate && templates.length === 0)) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={40} thickness={4} />
      </Box>
    );
  }

  // Filter rules based on toggle
  const displayedRules = activeTemplate?.rules.filter(rule => showInactive || rule.is_active !== false) || [];

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', bgcolor: colors.background }}>
      
      {/* Sidebar: Template List */}
      <Box sx={{ 
        width: 320, 
        borderRight: `1px solid ${colors.border}`, 
        bgcolor: colors.surface, 
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(0,0,0,0.02)'
      }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DataObjectIcon color="primary" />
            Templates
          </Typography>
          <Tooltip title="Create Template">
            <IconButton 
              size="small" 
              onClick={() => setIsCreateModalOpen(true)} 
              sx={{ bgcolor: 'primary.50', color: 'primary.main', '&:hover': { bgcolor: 'primary.100' } }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
        <List sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {templates.map(template => {
            const isActive = activeTemplate?.id === template.id;
            const isDefault = effectiveDefaultTemplateId === template.id;
            
            return (
              <ListItem 
                key={template.id} 
                
                sx={{ mb: 1 }}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center'}}>
                    {isDefault ? (
                      <Tooltip title="Default">
                        <IconButton 
                          size="small" 
                          color="warning"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StarIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Set as Default">
                        <IconButton 
                          size="small" 
                          onClick={(e) => { e.stopPropagation(); handleSetDefault(template.id); }}
                          sx={{ 
                            opacity: isActive ? 1 : 0.2, 
                            transition: 'all 0.2s', 
                            '&:hover': { color: 'warning.main', opacity: 1 } 
                          }}
                        >
                          <StarBorderIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete Template">
                      <IconButton 
                        edge="end" 
                        size="small" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                        sx={{ opacity: isActive ? 1 : 0.4, transition: 'all 0.2s', ml: 0.5, '&:hover': { color: 'error.main', opacity: 1 } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemButton 
                  selected={isActive}
                  onClick={() => handleSelectTemplate(template.id)}
                  sx={{
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    border: '1px solid transparent',
                    pr: 11, // Safely clear both icon buttons (~88px space on the right)
                    '&.Mui-selected': { 
                      bgcolor: 'primary.50', 
                      borderColor: 'primary.200',
                      '&:hover': { bgcolor: 'primary.100' }
                    },
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <ListItemText 
                    primary={template.name} 
                    secondary={template.is_global ? 'Global Template' : 'Personal'} 
                    primaryTypographyProps={{ fontWeight: isActive ? 600 : 500, noWrap: true }}
                    secondaryTypographyProps={{ fontSize: '0.75rem', mt: 0.5, noWrap: true }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
          
          {templates.length === 0 && (
            <Box sx={{ textAlign: 'center', mt: 4, px: 2 }}>
              <PostAddOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" variant="body2">
                No templates yet.<br/>Create one to get started.
              </Typography>
            </Box>
          )}
        </List>
      </Box>

      {/* Main Area: Template Rules Editor */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', p: { xs: 3, md: 5 } }}>
        {activeTemplate ? (
          <Box sx={{ maxWidth: '900px', mx: 'auto', width: '100%' }}>
            
            {/* Header Section */}
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h4" fontWeight="700" gutterBottom>
                  {activeTemplate.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {activeTemplate.id === effectiveDefaultTemplateId && (
                    <Chip 
                      icon={<StarIcon sx={{ color: 'warning.main' }} fontSize="small" />}
                      label="Default" 
                      size="small" 
                      sx={{ bgcolor: 'warning.50', color: 'warning.dark', fontWeight: '500', border: '1px solid', borderColor: 'warning.200' }}
                    />
                  )}
                  <Chip 
                    label={activeTemplate.is_global ? "Global Template" : "Personal Template"} 
                    size="small" 
                    color={activeTemplate.is_global ? "primary" : "default"}
                    variant={activeTemplate.is_global ? "filled" : "outlined"}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {activeTemplate.rules.length} total {activeTemplate.rules.length === 1 ? 'rule' : 'rules'}
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            <Divider sx={{ mb: 5 }} />
            
            {/* Add New Rule Section */}
            <Typography variant="h6" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsOutlinedIcon color="primary" />
              Configure Parameters
            </Typography>
            
            <Paper 
              variant="outlined" 
              sx={{ 
                mb: 5, 
                bgcolor: 'primary.50',
                borderColor: 'primary.100',
                borderRadius: 3,
                overflow: 'hidden'
              }}
            >
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'primary.100', bgcolor: 'white' }}>
                <Typography variant="subtitle2" fontWeight="600" color="primary.main">
                  Add New Extraction Rule
                </Typography>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <RuleEditorForm 
                  parameters={parameters} 
                  existingRules={activeTemplate.rules}
                  onSave={handleUpsertRule}
                  isSaving={isSaving}
                />
              </CardContent>
            </Paper>

            {/* Existing Rules List Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="600" color="text.secondary">
                Active Rules
              </Typography>
              <FormControlLabel
                control={
                  <Switch 
                    size="small" 
                    checked={showInactive} 
                    onChange={(e) => setShowInactive(e.target.checked)} 
                  />
                }
                label={<Typography variant="body2" color="text.secondary">Show inactive parameters</Typography>}
              />
            </Box>

            {/* Existing Rules List */}
            {displayedRules.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {displayedRules.map(rule => (
                  <Card 
                    key={rule.id} 
                    variant="outlined" 
                    sx={{ 
                      borderRadius: 3, 
                      transition: 'box-shadow 0.2s',
                      opacity: rule.is_active === false ? 0.6 : 1, // Dim if inactive
                      '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.05)', opacity: 1 } 
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DataObjectIcon fontSize="small" />
                          Canonical: <Typography component="span" fontWeight="600" color="text.primary">
                            {parameters.find(p => p.id === rule.parameter_id)?.name || 'Unknown'}
                          </Typography>
                        </Typography>
                        
                        {rule.is_active === false && (
                          <Chip 
                            size="small" 
                            label="Inactive" 
                            color="default" 
                            icon={<VisibilityOffOutlinedIcon />} 
                          />
                        )}
                      </Box>
                      <RuleEditorForm 
                        parameters={parameters} 
                        existingRules={[]} 
                        initialData={rule}
                        onSave={handleUpsertRule}
                        isSaving={isSaving}
                        isEditMode
                      />
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Box sx={{ 
                p: 5, 
                textAlign: 'center', 
                border: '1px dashed', 
                borderColor: 'divider', 
                borderRadius: 3,
                bgcolor: 'white'
              }}>
                <SettingsOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">
                  No parameters to display. Use the form above to add a new rule.
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ 
              p: 4, 
              borderRadius: '50%', 
              bgcolor: 'white', 
              boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
              mb: 3
            }}>
              <DataObjectIcon sx={{ fontSize: 64, color: 'primary.light' }} />
            </Box>
            <Typography variant="h5" fontWeight="600" gutterBottom color="text.primary">
              Template Manager
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 400, textAlign: 'center' }}>
              Select a template from the sidebar to edit its extraction rules, or create a brand new template to get started.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => setIsCreateModalOpen(true)}
              sx={{ mt: 4, borderRadius: 2, px: 3, py: 1 }}
            >
              Create Template
            </Button>
          </Box>
        )}
      </Box>

      {/* Create Template Modal */}
      <Dialog 
        open={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, width: '100%', maxWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>Create New Template</DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Name your new template. You can add extraction rules to it in the next step.
          </Typography>
          <TextField
            autoFocus
            label="Template Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="e.g. Invoice Extractor"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateModalOpen(false)} color="inherit">Cancel</Button>
          <Button 
            onClick={handleCreateTemplate} 
            disabled={!newTemplateName.trim() || isSaving} 
            variant="contained"
            disableElevation
            sx={{ borderRadius: 2 }}
          >
            Create Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// --- Subcomponent for creating/editing a single rule ---

interface RuleEditorFormProps {
  parameters: CanonicalParameter[];
  existingRules: any[];
  initialData?: any;
  onSave: (data: TemplateRuleUpsert) => void;
  isSaving: boolean;
  isEditMode?: boolean;
}

function RuleEditorForm({ parameters, existingRules, initialData, onSave, isSaving, isEditMode = false }: RuleEditorFormProps) {
  const [paramId, setParamId] = useState(initialData?.parameter_id || '');
  const [alias, setAlias] = useState(initialData?.custom_alias || '');
  const [descriptionOverride, setDescriptionOverride] = useState(initialData?.description_override || '');
  const [aiInstructions, setAiInstructions] = useState(initialData?.ai_instructions || '');
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  
  // Auto-fill alias when a canonical param is selected (if alias is empty)
  const handleParamChange = (e: any) => {
    const selectedId = e.target.value;
    setParamId(selectedId);
    if (!alias) {
      const selectedParam = parameters.find(p => p.id === selectedId);
      if (selectedParam) setAlias(selectedParam.name);
    }
  };

  const handleSubmit = () => {
    if (!paramId || !alias) return;
    onSave({
      parameter_id: paramId,
      custom_alias: alias,
      description_override: descriptionOverride,
      ai_instructions: aiInstructions,
      is_active: isActive
    });
    
    // Clear form if it's the "Add New" form
    if (!isEditMode) {
      setParamId('');
      setAlias('');
      setDescriptionOverride('');
      setAiInstructions('');
      setIsActive(true);
    }
  };

  // Filter out parameters that are already in the template (for the Add form)
  const availableParams = isEditMode 
    ? parameters 
    : parameters.filter(p => !existingRules.some(r => r.parameter_id === p.id));

  return (
    <Grid container spacing={3} alignItems="flex-start">
      
      {/* Top Row: Core Identifiers */}
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth>
          <InputLabel>Canonical Parameter</InputLabel>
          <Select
            value={paramId}
            label="Canonical Parameter"
            onChange={handleParamChange}
            disabled={isEditMode}
          >
            {availableParams.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          label="Custom Alias (Label)"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="e.g. Total Amount"
          helperText="Maximum 50 characters"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LabelOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              inputProps: { maxLength: 50 } // Limits varchar to 50
            },
          }}
        />
      </Grid>

      {/* Middle Row: Description Override */}
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Description Override (Optional)"
          value={descriptionOverride}
          onChange={(e) => setDescriptionOverride(e.target.value)}
          placeholder="Provide a detailed description of what this field represents..."
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                  <DescriptionOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Grid>
      
      {/* Bottom Row: AI Instructions */}
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="AI Extraction Instructions (Optional)"
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
          placeholder="Provide specific instructions for the AI. e.g. 'Extract only numeric values and ignore currency symbols...'"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                  <SmartToyOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Grid>
      
      {/* Footer / Actions */}
      <Grid size={{ xs: 12 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2" fontWeight="500" color={isActive ? 'text.primary' : 'text.secondary'}>
                {isActive ? 'Parameter Active' : 'Parameter Inactive'}
              </Typography>
            }
          />
          <Button 
            variant={isEditMode ? "outlined" : "contained"} 
            onClick={handleSubmit}
            disabled={!paramId || !alias || isSaving}
            startIcon={isEditMode ? <SaveIcon /> : <AddIcon />}
            sx={{ minHeight: '40px', px: 4, borderRadius: 1.5 }}
            disableElevation
          >
            {isEditMode ? 'Save Changes' : 'Add Rule'}
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
}