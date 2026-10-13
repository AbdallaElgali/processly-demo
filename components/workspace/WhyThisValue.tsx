'use client';

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import type { Specification } from '@/types';
import { NO_REASONING, NO_SOURCE_TEXT, whyThisValue } from '@/lib/review/why';

const MODEL_NOTE =
  'Written by the extraction model together with its answer. It is the model’s explanation, not a quote from the document, ' +
  'and not its internal reasoning, which the API does not return. Check it against the source text below.';

/**
 * "Why this value" for one candidate (AM15). Two kinds of text, kept visibly
 * apart: what the MODEL wrote (explanation, note on the source, calculation),
 * labelled as such (B13), and what the DOCUMENT says (the recorded source text
 * and its location), which is the evidence. Every empty text says so.
 */
export function WhyThisValue({
  spec,
  location,
  documentName,
  onJump,
  dense = false,
}: {
  spec: Specification;
  /** "Page 4" or "Sheet 3 · B10:D15". */
  location: string | null;
  documentName: string | null;
  onJump?: () => void;
  /** Inside a candidate's disclosure: no section title, tighter spacing. */
  dense?: boolean;
}) {
  const why = whyThisValue(spec);
  const where = [location, documentName].filter(Boolean).join(' · ');

  return (
    <Stack spacing={dense ? 1 : 1.25}>
      {why.reasonCode ? (
        <Block icon={<RemoveCircleOutlineIcon sx={{ fontSize: 15 }} />} label="Why there is no value" tone="neutral">
          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>{why.reasonCode.label}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Recorded by the backend: “{why.reasonCode.text}”
          </Typography>
        </Block>
      ) : (
        <Block
          icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
          label="Model’s explanation"
          tone="model"
          info={MODEL_NOTE}
        >
          <Prose text={why.explanation} empty={NO_REASONING} />
        </Block>
      )}

      {!why.reasonCode && (
        <Block icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />} label="Model’s note on the source" tone="model" info={MODEL_NOTE}>
          <Prose text={why.sourceNote} empty={NO_REASONING} />
        </Block>
      )}

      {why.calculated && (
        <Block icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />} label="Calculation (computed, not read)" tone="model" info={MODEL_NOTE}>
          <Prose text={why.calculation} empty={NO_REASONING} />
        </Block>
      )}

      <Block
        icon={<DescriptionOutlinedIcon sx={{ fontSize: 15 }} />}
        label="Evidence from the document"
        tone="document"
        trailing={
          onJump ? (
            <Button size="small" startIcon={<FindInPageOutlinedIcon fontSize="small" />} onClick={onJump} sx={{ py: 0, minHeight: 0 }}>
              Show in document
            </Button>
          ) : null
        }
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
          {where || 'No location recorded'}
        </Typography>
        {why.snippet ? (
          <Box
            component="blockquote"
            sx={{
              m: 0, pl: 1.25, py: 0.5, pr: 1, borderLeft: 3, borderColor: 'border.strong', bgcolor: 'surface.canvas', borderRadius: 0.5,
              color: 'text.primary', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflowY: 'auto',
            }}
          >
            {why.snippet}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.muted', fontStyle: 'italic' }}>{NO_SOURCE_TEXT}</Typography>
        )}
      </Block>
    </Stack>
  );
}

function Block({
  icon,
  label,
  tone,
  info,
  trailing,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'model' | 'document' | 'neutral';
  info?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const color = tone === 'model' ? 'status.info' : tone === 'document' ? 'accent.text' : 'status.neutral';
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25, minHeight: 24 }}>
        <Box sx={{ color, display: 'flex' }} aria-hidden>{icon}</Box>
        <Typography variant="caption" sx={{ color, fontWeight: 600, letterSpacing: 0.2 }}>{label}</Typography>
        {info && (
          <Tooltip title={info}>
            <InfoOutlinedIcon tabIndex={0} aria-label={info} sx={{ fontSize: 14, color: 'text.muted', '&:focus-visible': { outline: '2px solid', outlineColor: 'accent.focus', borderRadius: '50%' } }} />
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        {trailing}
      </Stack>
      {children}
    </Box>
  );
}

function Prose({ text, empty }: { text: string | null; empty: string }) {
  return text ? (
    <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</Typography>
  ) : (
    <Typography variant="body2" sx={{ color: 'text.muted', fontStyle: 'italic' }}>{empty}</Typography>
  );
}
