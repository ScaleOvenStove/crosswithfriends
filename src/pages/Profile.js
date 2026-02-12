import './css/profile.css';

import React, {useContext, useState, useEffect} from 'react';
import {useParams, useHistory, Link} from 'react-router-dom';
import CircularProgress from '@material-ui/core/CircularProgress';
import {MdPeople} from 'react-icons/md';
import {FaPlay} from 'react-icons/fa';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import AuthContext from '../lib/AuthContext';
import {getUserStats} from '../api/user_stats';
import {formatMilliseconds} from '../components/Toolbar/Clock';

function formatTime(ms) {
  if (!ms && ms !== 0) return '--';
  return formatMilliseconds(ms);
}

function formatDate(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
}

function CollabTag({playerCount, coSolvers, anonCount}) {
  if (playerCount <= 1) return null;

  const parts = [];
  coSolvers.forEach((cs) => {
    parts.push(
      <Link key={cs.userId} to={`/profile/${cs.userId}`} style={{color: 'inherit'}}>
        {cs.displayName}
      </Link>
    );
  });
  if (anonCount > 0) {
    parts.push(`${anonCount} other${anonCount > 1 ? 's' : ''}`);
  }

  let label;
  if (parts.length === 0) {
    label = `${playerCount - 1} other${playerCount - 1 > 1 ? 's' : ''}`;
  } else {
    label = parts.reduce((acc, part, i) => {
      if (i === 0) return [part];
      if (i === parts.length - 1) return [...acc, ' & ', part];
      return [...acc, ', ', part];
    }, []);
  }

  return (
    <span className="profile--collab-tag">
      <MdPeople size={14} />
      <span>with {label}</span>
    </span>
  );
}

function StatsCards({stats}) {
  const {totalSolved, bySize} = stats;

  return (
    <div className="profile--stats-grid">
      <div className="profile--stat-card">
        <div className="profile--stat-card--value">{totalSolved}</div>
        <div className="profile--stat-card--label">Puzzles Solved</div>
      </div>
      {bySize.map((s) => (
        <div key={s.size} className="profile--stat-card">
          <div className="profile--stat-card--value">{s.count}</div>
          <div className="profile--stat-card--label">{s.size}</div>
          <div className="profile--stat-card--sub">avg {formatTime(s.avgTime)}</div>
        </div>
      ))}
    </div>
  );
}

function HistoryTable({history}) {
  if (history.length === 0) return null;

  return (
    <div className="profile--history">
      <h3>Solve History</h3>
      <table className="profile--history-table">
        <thead>
          <tr>
            <th>Puzzle</th>
            <th>Size</th>
            <th>Time</th>
            <th>Date</th>
            <th>Replay</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item) => (
            <tr key={`${item.pid}-${item.gid}`}>
              <td>
                {item.title}
                <CollabTag
                  playerCount={item.playerCount}
                  coSolvers={item.coSolvers}
                  anonCount={item.anonCount}
                />
              </td>
              <td>{item.size}</td>
              <td>{formatTime(item.time)}</td>
              <td>{formatDate(item.solvedAt)}</td>
              <td>
                <Link to={`/replay/${item.gid}`} className="profile--replay-link" title="Watch replay">
                  <FaPlay size={10} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InProgressTable({inProgress}) {
  if (!inProgress || inProgress.length === 0) return null;

  return (
    <div className="profile--history">
      <h3>In Progress</h3>
      <table className="profile--history-table">
        <thead>
          <tr>
            <th>Puzzle</th>
            <th>Size</th>
            <th>Last Played</th>
            <th>Resume</th>
          </tr>
        </thead>
        <tbody>
          {inProgress.map((item) => (
            <tr key={item.gid}>
              <td>{item.title}</td>
              <td>{item.size}</td>
              <td>{formatDate(item.lastActivity)}</td>
              <td>
                <Link to={`/game/${item.gid}`} className="profile--replay-link" title="Resume game">
                  <FaPlay size={10} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadsTable({uploads}) {
  if (!uploads || uploads.length === 0) return null;

  return (
    <div className="profile--uploads">
      <h3>Uploaded Puzzles</h3>
      <table className="profile--history-table">
        <thead>
          <tr>
            <th>Puzzle</th>
            <th>Size</th>
            <th>Visibility</th>
            <th>Uploaded</th>
            <th>Times Solved</th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((item) => (
            <tr key={item.pid}>
              <td>
                <Link to={`/beta/play/${item.pid}`} style={{color: 'inherit'}}>
                  {item.title}
                </Link>
              </td>
              <td>{item.size}</td>
              <td>{item.isPublic ? 'Public' : 'Unlisted'}</td>
              <td>{formatDate(item.uploadedAt)}</td>
              <td>{item.timesSolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Profile() {
  const {userId: paramUserId} = useParams();
  const history = useHistory();
  const {isAuthenticated, user} = useContext(AuthContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // If visiting /profile with no userId, redirect to own profile
  useEffect(() => {
    if (!paramUserId && isAuthenticated && user?.id) {
      history.replace(`/profile/${user.id}`);
    }
  }, [paramUserId, isAuthenticated, user, history]);

  const targetUserId = paramUserId || user?.id;

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    getUserStats(targetUserId).then((result) => {
      if (cancelled) return;
      if (!result) {
        setNotFound(true);
      } else {
        setData(result);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const isOwnProfile = isAuthenticated && user?.id === targetUserId;

  return (
    <div className="profile">
      <Nav />
      <div className="profile--main">
        {loading && (
          <div className="profile--loading">
            <CircularProgress />
          </div>
        )}

        {!loading && !targetUserId && (
          <div className="profile--not-found">
            <h3>Log in to view your profile</h3>
            <p>Sign in to track your puzzle solving stats.</p>
          </div>
        )}

        {!loading && notFound && (
          <div className="profile--not-found">
            <h3>Profile not found</h3>
            <p>This user doesn&apos;t exist or has been deleted.</p>
          </div>
        )}

        {!loading && data && (
          <>
            {isOwnProfile && !user?.emailVerified && (
              <div className="profile--verify-banner">
                Your email is not verified. <Link to="/verify-email">Verify your email</Link>
              </div>
            )}
            <div className="profile--header">
              <h2>{isOwnProfile ? 'Your Profile' : `${data.user.displayName}'s Profile`}</h2>
              <div className="profile--member-since">Member since {formatDate(data.user.createdAt)}</div>
            </div>

            {data.stats.totalSolved === 0 &&
            (!data.uploads || data.uploads.length === 0) &&
            (!data.inProgress || data.inProgress.length === 0) ? (
              <div className="profile--empty">
                <h3>No puzzles solved yet</h3>
                <p>{isOwnProfile ? 'Go solve some puzzles!' : "This user hasn't solved any puzzles yet."}</p>
              </div>
            ) : (
              <>
                {data.stats.totalSolved > 0 && <StatsCards stats={data.stats} />}
                <InProgressTable inProgress={data.inProgress} />
                <HistoryTable history={data.history} />
                <UploadsTable uploads={data.uploads} />
              </>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
