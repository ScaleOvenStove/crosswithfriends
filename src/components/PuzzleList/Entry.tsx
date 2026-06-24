import {Component} from 'react';
import _ from 'lodash';
import {MdRadioButtonUnchecked, MdCheckCircle, MdStar, MdAccessTime, MdVisibilityOff} from 'react-icons/md';
import {GiCrossedSwords} from 'react-icons/gi';
import {Link} from 'react-router';
import {formatMilliseconds} from '../Toolbar/Clock';

export interface EntryProps {
  info: {
    type: string;
  };
  grid?: string[][];
  title: string;
  author: string;
  originalTitle?: string;
  originalAuthor?: string;
  pid: string;
  status: 'started' | 'solved' | undefined;
  stats: {
    numSolves?: number;
    solves?: Array<any>;
    ratingAverage?: number | null;
    ratingCount?: number;
    medianSolveMs?: number | null;
    solveSampleCount?: number;
  };
  fencing?: boolean;
  isPublic?: boolean;
  contest?: boolean;
  zenMode?: boolean;
}

function ratingTitle(average: number | null | undefined, count: number | undefined): string {
  if (average == null || !count) return 'No ratings yet';
  return `Average rating ${average.toFixed(1)} from ${count} ${count === 1 ? 'rating' : 'ratings'}`;
}

function typicalSolveTitle(medianMs: number | null | undefined, sampleCount: number | undefined): string {
  if (medianMs == null || !sampleCount) return '';
  return `Typical solve time: ${formatMilliseconds(medianMs)} across ${sampleCount} solves`;
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
    const {title, author, originalTitle, originalAuthor, pid, status, stats, fencing, isPublic} = this.props;
    // Zen mode: hide spoilers (median time, rating) until this puzzle is solved.
    const showStats = !this.props.zenMode || status === 'solved';
    const numSolvesOld = _.size(stats?.solves || []);
    const numSolves = numSolvesOld + (stats?.numSolves || 0);
    const displayName = _.compact([this.size, author.trim()]).join(' | ');
    const originalDisplay =
      originalTitle || originalAuthor
        ? `Originally: ${originalTitle || title}${originalAuthor ? ` by ${originalAuthor}` : ''}`
        : null;
    return (
      <Link
        to={`/beta/play/${pid}${fencing ? '?fencing=1' : ''}`}
        style={{textDecoration: 'none', color: 'initial'}}
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- interactive via parent Link */}
        <div className="flex--column entry" onClick={handleClick} onMouseLeave={handleMouseLeave}>
          <div className="flex entry--top--left">
            <div className="flex--column entry--title-block">
              <p className="entry--title" title={title}>
                {title}
              </p>
              {originalDisplay && (
                <p className="entry--original" title={originalDisplay}>
                  {originalDisplay}
                </p>
              )}
            </div>
            <div className="flex entry--status-icons">
              {status === 'started' && !this.props.contest && (
                <MdRadioButtonUnchecked className="entry--icon" />
              )}
              {status === 'started' && this.props.contest && <GiCrossedSwords className="entry--icon" />}
              {status === 'solved' && <MdCheckCircle className="entry--icon" />}
              {fencing && <GiCrossedSwords className="entry--icon fencing" />}
            </div>
          </div>
          <div className="flex--column entry--main">
            <p className="entry--meta-line" title={displayName}>
              {displayName}
            </p>
            <div className="flex entry--details">
              <p>
                Solved {numSolves} {numSolves === 1 ? 'time' : 'times'}
              </p>
              <div className="flex entry--detail-stats">
                {showStats && stats?.medianSolveMs != null && (
                  <span
                    className="entry--solve-time"
                    title={typicalSolveTitle(stats.medianSolveMs, stats.solveSampleCount)}
                  >
                    <MdAccessTime className="entry--solve-time-icon" />
                    {formatMilliseconds(stats.medianSolveMs)}
                  </span>
                )}
                {showStats && (
                  <span
                    className="entry--rating"
                    title={ratingTitle(stats?.ratingAverage, stats?.ratingCount)}
                  >
                    <MdStar className="entry--rating-icon" />
                    {stats?.ratingAverage != null
                      ? `${stats.ratingAverage.toFixed(1)} (${stats.ratingCount ?? 0})`
                      : 'Not yet rated'}
                  </span>
                )}
                {!showStats && (
                  <span
                    className="entry--zen-hidden"
                    title="Rating and solve time are hidden until you finish this puzzle (Zen Mode)"
                  >
                    <MdVisibilityOff className="entry--zen-hidden-icon" />
                    Hidden by Zen Mode
                  </span>
                )}
                {this.props.contest && <span className="entry--contest">Contest</span>}
                {isPublic === false && <span className="entry--unlisted">Unlisted</span>}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }
}
