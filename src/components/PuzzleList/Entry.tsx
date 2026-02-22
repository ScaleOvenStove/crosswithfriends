import React, {Component} from 'react';
import _ from 'lodash';
import Flex from 'react-flexview';
import {MdRadioButtonUnchecked, MdCheckCircle} from 'react-icons/md';
import {GiCrossedSwords} from 'react-icons/gi';
import {Link} from 'react-router-dom';

export interface EntryProps {
  info: {
    type: string;
  };
  grid?: string[][];
  title: string;
  author: string;
  pid: string;
  status: 'started' | 'solved' | undefined;
  stats: {
    numSolves?: number;
    solves?: Array<any>;
  };
  fencing?: boolean;
  isPublic?: boolean;
  contest?: boolean;
}

const handleClick = () => {
  /*
  this.setState({
    expanded: !this.state.expanded,
  });
  this.props.onPlay(this.props.pid);
  */
};

const handleMouseLeave = () => {};

export default class Entry extends Component<EntryProps> {
  get size() {
    const {grid, title} = this.props;
    const titleLower = (title || '').toLowerCase();
    const titleHasMini = /\bmini\b/.test(titleLower);
    const titleHasMidi = /\bmidi\b/.test(titleLower);

    // Title-based classification takes priority
    if (titleHasMidi) return 'Midi';
    if (titleHasMini) return 'Mini';

    // Fall back to grid size
    if (grid) {
      const maxDim = Math.max(grid.length, grid[0]?.length ?? 0);
      if (maxDim <= 8) return 'Mini';
      if (maxDim <= 12) return 'Midi';
      if (maxDim <= 16) return 'Standard';
      return 'Large';
    }
    // Fallback to type field if grid not available
    const {type} = this.props.info;
    if (type === 'Daily Puzzle') return 'Standard';
    if (type === 'Mini Puzzle') return 'Mini';
    return 'Puzzle';
  }

  render() {
    const {title, author, pid, status, stats, fencing, isPublic} = this.props;
    const numSolvesOld = _.size(stats?.solves || []);
    const numSolves = numSolvesOld + (stats?.numSolves || 0);
    const displayName = _.compact([author.trim(), this.size]).join(' | ');
    return (
      <Link
        to={`/beta/play/${pid}${fencing ? '?fencing=1' : ''}`}
        style={{textDecoration: 'none', color: 'initial'}}
      >
        <Flex className="entry" column onClick={handleClick} onMouseLeave={handleMouseLeave}>
          <Flex className="entry--top--left">
            <Flex grow={0}>
              <p
                style={{textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden'}}
                title={displayName}
              >
                {displayName}
              </p>
            </Flex>
            <Flex>
              {status === 'started' && !this.props.contest && (
                <MdRadioButtonUnchecked className="entry--icon" />
              )}
              {status === 'started' && this.props.contest && <GiCrossedSwords className="entry--icon" />}
              {status === 'solved' && <MdCheckCircle className="entry--icon" />}
              {status !== 'started' && status !== 'solved' && fencing && (
                <GiCrossedSwords className="entry--icon fencing" />
              )}
            </Flex>
          </Flex>
          <Flex className="entry--main">
            <Flex grow={0}>
              <p style={{textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden'}} title={title}>
                {title}
              </p>
            </Flex>
          </Flex>
          <Flex className="entry--details">
            <p>
              Solved {numSolves} {numSolves === 1 ? 'time' : 'times'}
            </p>
            <Flex>
              {this.props.contest && <span className="entry--contest">Contest</span>}
              {isPublic === false && <span className="entry--unlisted">Unlisted</span>}
            </Flex>
          </Flex>
        </Flex>
      </Link>
    );
  }
}
