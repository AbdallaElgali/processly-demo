'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';

import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/theme/colors';

// Import API functions and Types (adjust path as needed)
import { 
  getUserTemplates, 
  getTemplateDetails, 
  createTemplate, 
  deleteTemplate, 
  upsertTemplateRule, 
  getParameters 
} from '@/api/templates';
import { 
  ExtractionTemplateBase, 
  TemplateWithRules, 
  CanonicalParameter, 
  TemplateRuleUpsert 
} from '@/api/templates';

export function TemplatesManager() {
  const { user, isLoading: authLoading } = useAuth();
  
  // State
  const [templates, setTemplates] = useState<ExtractionTemplateBase[]>([]);
  const [parameters, setParameters] = useState<CanonicalParameter[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<TemplateWithRules | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modals & Notifications
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Load initial data
  useEffect(() => {
    if (authLoading || !user) return;
    
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const [fetchedTemplates, fetchedParams] = await Promise.all([
          getUserTemplates(user.id),
          getParameters()
        ]);
        setTemplates(fetchedTemplates);
        setParameters(fetchedParams);
      } catch (error) {
        showSnackbar('Failed to load templates or parameters', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, [user, authLoading]);

  // Handlers
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      setIsLoading(true);
      const details = await getTemplateDetails(templateId);
      setActiveTemplate(details);
    } catch (error) {
      showSnackbar('Failed to load template details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !user) return;
    try {
      setIsSaving(true);
      const newTemplate = await createTemplate({
        name: newTemplateName,
        user_id: user.id,
        is_global: false
      });
      setTemplates(prev => [...prev, newTemplate]);
      setIsCreateModalOpen(false);
      setNewTemplateName('');
      showSnackbar('Template created successfully', 'success');
      handleSelectTemplate(newTemplate.id);
    } catch (error) {
      showSnackbar('Failed to create template', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (activeTemplate?.id === templateId) setActiveTemplate(null);
      showSnackbar('Template deleted', 'success');
    } catch (error) {
      showSnackbar('Failed to delete template', 'error');
    }
  };

  const handleUpsertRule = async (ruleData: TemplateRuleUpsert) => {
    if (!activeTemplate) return;
    try {
      setIsSaving(true);
      await upsertTemplateRule(activeTemplate.id, ruleData);
      // Refresh active template to get updated rules
      await handleSelectTemplate(activeTemplate.id);
      showSnackbar('Rule saved successfully', 'success');
    } catch (error) {
      showSnackbar('Failed to save rule', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (isLoading && !activeTemplate && templates.length === 0)) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* Sidebar: Template List */}
      <Box sx={{ 
        width: 300, 
        borderRight: `1px solid ${colors.border}`, 
        bgcolor: colors.surface, 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">My Templates</Typography>
          <IconButton size="small" onClick={() => setIsCreateModalOpen(true)} color="primary">
            <AddIcon />
          </IconButton>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto' }}>
          {templates.map(template => (
            <ListItem 
              key={template.id} 
              disablePadding
              secondaryAction={
                <IconButton edge="end" aria-label="delete" size="small" onClick={() => handleDeleteTemplate(template.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton 
                selected={activeTemplate?.id === template.id}
                onClick={() => handleSelectTemplate(template.id)}
              >
                <ListItemText primary={template.name} secondary={template.is_global ? 'Global' : 'Personal'} />
              </ListItemButton>
            </ListItem>
          ))}
          {templates.length === 0 && (
            <Typography sx={{ p: 2, color: 'text.secondary', textAlign: 'center' }}>
              No templates found. Create one to get started.
            </Typography>
          )}
        </List>
      </Box>

      {/* Main Area: Template Rules Editor */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: colors.background, overflowY: 'auto', p: 4 }}>
        {activeTemplate ? (
          <Box maxWidth="800px">
            <Typography variant="h4" gutterBottom>{activeTemplate.name}</Typography>
            <Divider sx={{ mb: 4 }} />
            
            <Typography variant="h6" gutterBottom>Extraction Rules</Typography>
            
            {/* Add New Rule Section */}
            <Card sx={{ mb: 4, bgcolor: colors.surface }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Add Parameter to Template</Typography>
                <RuleEditorForm 
                  parameters={parameters} 
                  existingRules={activeTemplate.rules}
                  onSave={handleUpsertRule}
                  isSaving={isSaving}
                />
              </CardContent>
            </Card>

            {/* Existing Rules List */}
            {activeTemplate.rules.length > 0 ? (
              activeTemplate.rules.map(rule => (
                <Card key={rule.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Canonical Parameter: {parameters.find(p => p.id === rule.parameter_id)?.name || 'Unknown'}
                    </Typography>
                    <RuleEditorForm 
                      parameters={parameters} 
                      existingRules={[]} // pass empty so we don't disable the current parameter in the dropdown
                      initialData={rule}
                      onSave={handleUpsertRule}
                      isSaving={isSaving}
                      isEditMode
                    />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Typography color="text.secondary">No parameters added to this template yet.</Typography>
            )}

          </Box>
        ) : (
          <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Select a template from the sidebar or create a new one.</Typography>
          </Box>
        )}
      </Box>

      {/* Create Template Modal */}
      <Dialog open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTemplate} disabled={!newTemplateName.trim() || isSaving} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
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
  const [aiInstructions, setAiInstructions] = useState(initialData?.ai_instructions || '');
  
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
      ai_instructions: aiInstructions,
      is_active: true
    });
    
    // Clear form if it's the "Add New" form
    if (!isEditMode) {
      setParamId('');
      setAlias('');
      setAiInstructions('');
    }
  };

  // Filter out parameters that are already in the template (for the Add form)
  const availableParams = isEditMode 
    ? parameters 
    : parameters.filter(p => !existingRules.some(r => r.parameter_id === p.id));

  return (
    <Grid container spacing={2} alignItems="flex-start" sx={{ mt: 1 }}>
      {/* Replaced item and xs/md with size={{ xs: 12, md: 3 }} */}
      <Grid size={{ xs: 12, md: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Parameter</InputLabel>
          <Select
            value={paramId}
            label="Parameter"
            onChange={handleParamChange}
            disabled={isEditMode}
          >
            {availableParams.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      
      <Grid size={{ xs: 12, md: 3 }}>
        <TextField
          fullWidth
          size="small"
          label="Custom Alias (Label)"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />
      </Grid>
      
      <Grid size={{ xs: 12, md: 5 }}>
        <TextField
          fullWidth
          size="small"
          label="AI Instructions (Optional)"
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
          placeholder="e.g. Extract only numbers..."
        />
      </Grid>
      
      <Grid size={{ xs: 12, md: 1 }}>
        <Button 
          variant={isEditMode ? "outlined" : "contained"} 
          fullWidth 
          onClick={handleSubmit}
          disabled={!paramId || !alias || isSaving}
          sx={{ height: '40px' }}
        >
          {isEditMode ? 'Update' : <AddIcon />}
        </Button>
      </Grid>
    </Grid>
  );
}