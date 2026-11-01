import { Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/** A small keyboard-reachable "i" whose tooltip carries the help text. */
export function InfoTip({ text, label = 'More information' }: { text: string; label?: string }) {
  return (
    <Tooltip title={text} arrow enterTouchDelay={0}>
      <InfoOutlinedIcon tabIndex={0} aria-label={`${label}: ${text}`} role="img" sx={{ fontSize: 16, color: 'text.secondary', verticalAlign: 'text-bottom', ml: 0.5, cursor: 'help' }} />
    </Tooltip>
  );
}
