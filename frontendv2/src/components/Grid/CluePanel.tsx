/**
 * CluePanel Component - Container for Across and Down clues
 * Implements REQ-1.4: Clue Display
 *
 * Features:
 * - Tabbed interface for Across/Down
 * - Auto-switch tab based on selected direction
 * - Responsive layout
 */

import { useState, useEffect } from 'react';
import { Paper, Tabs, Tab, Box, styled } from '@mui/material';
import { ClueList } from './ClueList';
import type { Clue } from '@types/index';

interface CluePanelProps {
  acrossClues: Clue[];
  downClues: Clue[];
  currentClue: Clue | null;
  completedClues: Set<string>;
  selectedDirection: 'across' | 'down';
  onClueClick: (clue: Clue) => void;
}

const CluePanelContainer = styled(Paper)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}));

const TabPanel = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0, // Critical for flex scrolling
});

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const CustomTabPanel = ({ children, value, index }: TabPanelProps) => {
  return (
    <TabPanel
      role="tabpanel"
      hidden={value !== index}
      id={`clue-tabpanel-${index}`}
      aria-labelledby={`clue-tab-${index}`}
      sx={{
        display: value === index ? 'flex' : 'none',
      }}
    >
      {value === index && children}
    </TabPanel>
  );
};

/**
 * CluePanel manages the display of Across and Down clues
 */
export const CluePanel = ({
  acrossClues,
  downClues,
  currentClue,
  completedClues,
  selectedDirection,
  onClueClick,
}: CluePanelProps) => {
  const [tabValue, setTabValue] = useState(0);

  // Auto-switch tab based on selected direction
  useEffect(() => {
    if (selectedDirection === 'across') {
      setTabValue(0);
    } else if (selectedDirection === 'down') {
      setTabValue(1);
    }
  }, [selectedDirection]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <CluePanelContainer elevation={2}>
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        aria-label="Clues tabs"
        variant="fullWidth"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 48,
        }}
      >
        <Tab
          label="Across"
          id="clue-tab-0"
          aria-controls="clue-tabpanel-0"
          sx={{ fontWeight: 600 }}
        />
        <Tab
          label="Down"
          id="clue-tab-1"
          aria-controls="clue-tabpanel-1"
          sx={{ fontWeight: 600 }}
        />
      </Tabs>

      <CustomTabPanel value={tabValue} index={0}>
        <ClueList
          title="Across"
          clues={acrossClues}
          currentClue={currentClue}
          completedClues={completedClues}
          direction="across"
          onClueClick={onClueClick}
        />
      </CustomTabPanel>

      <CustomTabPanel value={tabValue} index={1}>
        <ClueList
          title="Down"
          clues={downClues}
          currentClue={currentClue}
          completedClues={completedClues}
          direction="down"
          onClueClick={onClueClick}
        />
      </CustomTabPanel>
    </CluePanelContainer>
  );
};
