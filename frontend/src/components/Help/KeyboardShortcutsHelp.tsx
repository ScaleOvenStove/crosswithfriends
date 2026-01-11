/**
 * Keyboard Shortcuts Help Modal
 * Displays all available keyboard shortcuts for the crossword game
 *
 * Features:
 * - Organized sections for different shortcut categories
 * - Clear formatting of key combinations
 * - Accessible dialog with keyboard support
 * - Opens with ? or F1 key
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  styled,
  Divider,
} from '@mui/material';
import { Close as CloseIcon, Keyboard as KeyboardIcon } from '@mui/icons-material';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(2, 3),
}));

const TitleContent = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(1),
  color: theme.palette.primary.main,
  '&:first-of-type': {
    marginTop: 0,
  },
}));

const ShortcutKey = styled('kbd')(({ theme }) => ({
  display: 'inline-block',
  padding: '3px 8px',
  fontSize: '0.85em',
  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  lineHeight: 1.4,
  color: theme.palette.mode === 'dark' ? '#e0e0e0' : '#24292e',
  verticalAlign: 'middle',
  backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f6f8fa',
  border: `1px solid ${theme.palette.mode === 'dark' ? '#444' : '#d1d5da'}`,
  borderBottomColor: theme.palette.mode === 'dark' ? '#555' : '#c6cbd1',
  borderRadius: 6,
  boxShadow: theme.palette.mode === 'dark' ? 'inset 0 -1px 0 #444' : 'inset 0 -1px 0 #c6cbd1',
  marginRight: 4,
}));

const DescriptionCell = styled(TableCell)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.9rem',
  paddingLeft: theme.spacing(2),
}));

const ShortcutCell = styled(TableCell)({
  whiteSpace: 'nowrap',
  width: '45%',
});

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
}));

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

const ShortcutRow = ({ keys, description }: ShortcutRowProps) => (
  <StyledTableRow>
    <ShortcutCell>
      {keys.map((key, index) => (
        <span key={`${key}-${index}`}>
          <ShortcutKey>{key}</ShortcutKey>
          {index < keys.length - 1 && ' + '}
        </span>
      ))}
    </ShortcutCell>
    <DescriptionCell>{description}</DescriptionCell>
  </StyledTableRow>
);

/**
 * KeyboardShortcutsHelp component
 */
export const KeyboardShortcutsHelp = ({ open, onClose }: KeyboardShortcutsHelpProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="keyboard-shortcuts-title"
      PaperProps={{
        sx: { maxHeight: '85vh' },
      }}
    >
      <StyledDialogTitle id="keyboard-shortcuts-title">
        <TitleContent>
          <KeyboardIcon />
          <Typography variant="h6" component="span" fontWeight={600}>
            Keyboard Shortcuts
          </Typography>
        </TitleContent>
        <IconButton aria-label="close" onClick={onClose} sx={{ color: 'inherit' }}>
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {/* How to Enter Answers */}
        <SectionTitle variant="h6">How to Enter Answers</SectionTitle>
        <Box sx={{ mb: 3, pl: 1 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            Click a cell once to enter an answer, and click that same cell again to switch between
            horizontal and vertical orientations.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Click the clues to move the cursor directly to the cell for that answer.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hold down the <ShortcutKey>Shift</ShortcutKey> key to enter multiple characters for
            rebus answers.
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Basic Keyboard Shortcuts */}
        <SectionTitle variant="h6">Basic Keyboard Shortcuts</SectionTitle>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableBody>
              <ShortcutRow
                keys={['Letter', '/', 'Number']}
                description="Fill in current cell and advance cursor to next unfilled cell in the same word, if any"
              />
              <ShortcutRow keys={['.']} description="Toggle pencil mode on/off" />
              <ShortcutRow
                keys={['Arrow keys']}
                description="Move cursor along current orientation or change orientation if perpendicular"
              />
              <ShortcutRow keys={['Space']} description="Flip orientation between down/across" />
              <ShortcutRow keys={['Delete', '/', 'Backspace']} description="Clear current cell" />
              <ShortcutRow keys={['Alt', 'S']} description="Check Square" />
              <ShortcutRow keys={['Alt', 'W']} description="Check Word" />
              <ShortcutRow keys={['Alt', 'P']} description="Check Puzzle" />
              <ShortcutRow keys={['Alt', 'Shift', 'S']} description="Reveal Square" />
              <ShortcutRow keys={['Alt', 'Shift', 'W']} description="Reveal Word" />
              <ShortcutRow keys={['Alt', 'Shift', 'P']} description="Reveal Puzzle" />
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 2 }} />

        {/* Advanced Keyboard Shortcuts */}
        <SectionTitle variant="h6">Advanced Keyboard Shortcuts</SectionTitle>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableBody>
              <ShortcutRow
                keys={['[', ']']}
                description="Move cursor perpendicular to current orientation without changing orientation"
              />
              <ShortcutRow
                keys={['Shift', 'Arrow keys']}
                description="Move cursor perpendicular to current orientation without changing orientation"
              />
              <ShortcutRow
                keys={['Tab']}
                description="Move cursor to first unfilled square of next unfilled clue"
              />
              <ShortcutRow
                keys={['Shift', 'Tab']}
                description="Move cursor to first unfilled square of previous unfilled clue"
              />
              <ShortcutRow keys={['Home']} description="Move cursor to the beginning of a clue" />
              <ShortcutRow keys={['End']} description="Move cursor to the end of a clue" />
              <ShortcutRow keys={['?', '/', 'F1']} description="Show this help dialog" />
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Press <ShortcutKey>Esc</ShortcutKey> to close this dialog
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsHelp;
