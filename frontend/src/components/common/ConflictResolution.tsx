import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';

import type {GameEvent} from '../../types/events';

export interface Conflict {
  id: string;
  optimisticEvent: GameEvent;
  serverEvent: GameEvent;
  baseState: unknown;
  conflictType: 'simple' | 'complex';
  description: string;
}

export interface ConflictResolutionProps {
  conflict: Conflict;
  onResolve: (resolution: 'local' | 'server' | 'merge') => void;
  onDismiss?: () => void;
}

/**
 * Three-way merge algorithm for resolving conflicts
 */
export function threeWayMerge(
  base: unknown,
  local: unknown,
  remote: unknown
): {canAutoResolve: boolean; resolved?: unknown; requiresManual: boolean} {
  // Simple conflicts: timestamp differences, non-overlapping changes
  if (typeof local === 'object' && typeof remote === 'object' && local !== null && remote !== null) {
    const localObj = local as Record<string, unknown>;
    const remoteObj = remote as Record<string, unknown>;
    const baseObj = base as Record<string, unknown> | null;

    // Check if changes are in different fields (can auto-resolve)
    const localKeys = Object.keys(localObj);
    const remoteKeys = Object.keys(remoteObj);
    const overlappingKeys = localKeys.filter((key) => remoteKeys.includes(key));

    // If no overlapping keys, can auto-resolve by merging
    if (overlappingKeys.length === 0) {
      return {
        canAutoResolve: true,
        resolved: {...baseObj, ...localObj, ...remoteObj},
        requiresManual: false,
      };
    }

    // Check if values are the same (no conflict)
    const hasConflict = overlappingKeys.some((key) => {
      const localVal = localObj[key];
      const remoteVal = remoteObj[key];
      const baseVal = baseObj?.[key];

      // If both changed to the same value, no conflict
      if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
        return false;
      }

      // If one matches base, use the other
      if (JSON.stringify(localVal) === JSON.stringify(baseVal)) {
        return false; // Remote changed, use remote
      }
      if (JSON.stringify(remoteVal) === JSON.stringify(baseVal)) {
        return false; // Local changed, use local
      }

      // Both changed differently - conflict
      return true;
    });

    if (!hasConflict) {
      return {
        canAutoResolve: true,
        resolved: {...baseObj, ...localObj, ...remoteObj},
        requiresManual: false,
      };
    }
  }

  // Complex conflicts require manual resolution
  return {
    canAutoResolve: false,
    requiresManual: true,
  };
}

const ConflictResolution: React.FC<ConflictResolutionProps> = ({conflict, onResolve, onDismiss}) => {
  const handleResolve = (resolution: 'local' | 'server' | 'merge') => {
    onResolve(resolution);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Dialog open={true} onClose={onDismiss} maxWidth="md" fullWidth>
      <DialogTitle>Conflict Detected</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{marginBottom: 2}}>
          {conflict.description}
        </Typography>

        <Stack spacing={2} sx={{marginTop: 2}}>
          <Box>
            <Typography variant="subtitle2" sx={{marginBottom: 1}}>
              Your Change (Local):
            </Typography>
            <Box
              sx={{
                padding: 1,
                backgroundColor: '#e3f2fd',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            >
              {JSON.stringify(conflict.optimisticEvent.params, null, 2)}
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{marginBottom: 1}}>
              Server Change (Remote):
            </Typography>
            <Box
              sx={{
                padding: 1,
                backgroundColor: '#fff3e0',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            >
              {JSON.stringify(conflict.serverEvent.params, null, 2)}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleResolve('local')} color="primary" variant="outlined">
          Use My Change
        </Button>
        <Button onClick={() => handleResolve('server')} color="primary" variant="outlined">
          Use Server Change
        </Button>
        {conflict.conflictType === 'complex' && (
          <Button onClick={() => handleResolve('merge')} color="primary" variant="contained">
            Merge Changes
          </Button>
        )}
        {onDismiss && (
          <Button onClick={onDismiss} color="secondary">
            Dismiss
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ConflictResolution;
