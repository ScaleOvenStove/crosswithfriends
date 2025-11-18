import {Box, Stack, Chip, Tooltip} from '@mui/material';
import _ from 'lodash';
import React from 'react';
import {GiCrossedSwords} from 'react-icons/gi';
import {MdRadioButtonUnchecked, MdCheckCircle} from 'react-icons/md';
import {Link} from 'react-router-dom';

export interface EntryProps {
  info: {
    type: string;
  };
  title: string;
  author: string;
  pid: string;
  status: 'started' | 'solved' | undefined;
  stats: {
    numSolves?: number;
    solves?: Array<any>;
  };
  fencing?: boolean;
}

const Entry: React.FC<EntryProps> = ({title, author, pid, status, stats, fencing, info}) => {
  const handleClick = () => {
    /*
    // Expanded state removed - can be added back with useState if needed
    // onPlay?.(pid);
    */
  };

  const handleMouseLeave = () => {};

  const getSize = () => {
    const {type} = info;
    if (type === 'Daily Puzzle') {
      return 'Standard';
    }
    if (type === 'Mini Puzzle') {
      return 'Mini';
    }
    return 'Puzzle'; // shouldn't get here???
  };

  const numSolvesOld = _.size(stats?.solves || []);
  const numSolves = numSolvesOld + (stats?.numSolves || 0);
  const displayName = _.compact([author.trim(), getSize()]).join(' | ');

  return (
    <Link
      to={`/beta/play/${pid}${fencing ? '?fencing=1' : ''}`}
      style={{textDecoration: 'none', color: 'initial'}}
    >
      <Stack className="entry" direction="column" onClick={handleClick} onMouseLeave={handleMouseLeave}>
        <Box className="entry--top--left" sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <Box sx={{flexGrow: 1, minWidth: 0, display: 'flex'}}>
            <Tooltip title={displayName} arrow>
              <p
                style={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  margin: 0,
                  flex: 1,
                }}
              >
                {displayName}
              </p>
            </Tooltip>
          </Box>
          <Box sx={{display: 'flex', flexShrink: 0, gap: 0.5}}>
            {status === 'started' && (
              <Tooltip title="In Progress" arrow>
                <Chip
                  icon={<MdRadioButtonUnchecked />}
                  label="In Progress"
                  size="small"
                  variant="outlined"
                  color="warning"
                  sx={{height: 24, fontSize: '0.7rem'}}
                />
              </Tooltip>
            )}
            {status === 'solved' && (
              <Tooltip title="Solved" arrow>
                <Chip
                  icon={<MdCheckCircle />}
                  label="Solved"
                  size="small"
                  variant="outlined"
                  color="success"
                  sx={{height: 24, fontSize: '0.7rem'}}
                />
              </Tooltip>
            )}
            {status !== 'started' && status !== 'solved' && fencing && (
              <Tooltip title="Fencing Available" arrow>
                <Chip
                  icon={<GiCrossedSwords />}
                  label="Fencing"
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{height: 24, fontSize: '0.7rem'}}
                />
              </Tooltip>
            )}
          </Box>
        </Box>
        <Box className="entry--main" sx={{display: 'flex', minHeight: '40px', alignItems: 'center'}}>
          <Box sx={{flexGrow: 1, minWidth: 0, display: 'flex'}}>
            <Tooltip title={title} arrow>
              <p
                style={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  margin: 0,
                  width: '100%',
                }}
              >
                {title}
              </p>
            </Tooltip>
          </Box>
        </Box>
        <Box className="entry--details" sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <Chip
            label={`Solved ${numSolves} ${numSolves === 1 ? 'time' : 'times'}`}
            size="small"
            variant="outlined"
            sx={{height: 20, fontSize: '0.65rem'}}
          />
        </Box>
      </Stack>
    </Link>
  );
};

export default Entry;
