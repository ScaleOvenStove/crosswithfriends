import React from 'react';
import _ from 'lodash';
import {Box, Stack} from '@mui/material';
import {MdRadioButtonUnchecked, MdCheckCircle} from 'react-icons/md';
import {GiCrossedSwords} from 'react-icons/gi';
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
        <Box className="entry--top--left" sx={{display: 'flex'}}>
          <Box sx={{flexGrow: 0, display: 'flex'}}>
            <p
              style={{textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden'}}
              title={displayName}
            >
              {displayName}
            </p>
          </Box>
          <Box sx={{display: 'flex'}}>
            {status === 'started' && <MdRadioButtonUnchecked className="entry--icon" />}
            {status === 'solved' && <MdCheckCircle className="entry--icon" />}
            {status !== 'started' && status !== 'solved' && fencing && (
              <GiCrossedSwords className="entry--icon fencing" />
            )}
          </Box>
        </Box>
        <Box className="entry--main" sx={{display: 'flex'}}>
          <Box sx={{flexGrow: 0, display: 'flex'}}>
            <p style={{textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden'}} title={title}>
              {title}
            </p>
          </Box>
        </Box>
        <Box className="entry--details" sx={{display: 'flex'}}>
          <p>
            Solved {numSolves} {numSolves === 1 ? 'time' : 'times'}
          </p>
        </Box>
      </Stack>
    </Link>
  );
};

export default Entry;
