import './css/profile.css';
import './css/play.css';

import {useContext, useState, useEffect, useCallback} from 'react';
import {Helmet} from 'react-helmet-async';
import {useParams, useNavigate, Link} from 'react-router';

import {MdPeople} from 'react-icons/md';
import {FaPlay} from 'react-icons/fa';
import Nav from '../components/common/Nav';
import Footer from '../components/common/Footer';
import ConfirmDialog from '../components/common/ConfirmDialog';
import AuthContext from '../lib/AuthContext';
import {getUserStats} from '../api/user_stats';
import {dismissGame} from '../api/create_game';
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

function OriginalLabel({originalTitle, originalAuthor}) {
  if (!originalTitle && !originalAuthor) return null;
  const parts = [];
  if (originalTitle) parts.push(originalTitle);
  if (originalAuthor) parts.push(`by ${originalAuthor}`);
  return <span className="profile--original-title">Originally: {parts.join(' ')}</span>;
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

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function usePagination(items, storageKey, defaultPageSize = 10) {
  const [pageSize, setPageSizeState] = useState(
    () => Number(localStorage.getItem(storageKey)) || defaultPageSize
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const setPageSize = useCallback(
    (n) => {
      setPageSizeState(n);
      setPage(1);
      localStorage.setItem(storageKey, n);
    },
    [storageKey]
  );

  const handlePrev = useCallback(() => setPage((p) => p - 1), []);
  const handleNext = useCallback(() => setPage((p) => p + 1), []);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  return {page, pageItems, totalPages, pageSize, setPageSize, handlePrev, handleNext};
}

function PageSizeSelector({value, onChange}) {
  const handleClick = useCallback((e) => onChange(Number(e.currentTarget.dataset.size)), [onChange]);
  return (
    <span className="profile--page-size-selector">
      Show:{' '}
      {PAGE_SIZE_OPTIONS.map((n) => (
        <button
          key={n}
          data-size={n}
          className={`profile--page-size-btn${value === n ? ' profile--page-size-btn--active' : ''}`}
          onClick={handleClick}
        >
          {n}
        </button>
      ))}
    </span>
  );
}

function Paginator({page, totalPages, onPrev, onNext}) {
  if (totalPages <= 1) return null;
  return (
    <div className="profile--paginator">
      <button className="profile--paginator-btn" disabled={page === 1} onClick={onPrev}>
        ‹ Prev
      </button>
      <span className="profile--paginator-info">
        {page} / {totalPages}
      </span>
      <button className="profile--paginator-btn" disabled={page === totalPages} onClick={onNext}>
        Next ›
      </button>
    </div>
  );
}

const STATS_MODES = [
  {key: 'all', label: 'All'},
  {key: 'solo', label: 'Solo'},
  {key: 'coop', label: 'Co-op'},
];

function StatsCards({stats}) {
  const [mode, setMode] = useState('all');

  const modeData = {
    all: {total: stats.totalSolved, bySize: stats.bySize, byDay: stats.byDay},
    solo: {total: stats.totalSolvedSolo, bySize: stats.bySizeSolo, byDay: stats.byDaySolo},
    coop: {total: stats.totalSolvedCoop, bySize: stats.bySizeCoop, byDay: stats.byDayCoop},
  };

  const hasModes = stats.totalSolvedSolo > 0 && stats.totalSolvedCoop > 0;
  const {total, bySize, byDay} = modeData[mode];
  const sortedByDay = byDay ? DAY_ORDER.map((d) => byDay.find((s) => s.day === d)).filter(Boolean) : [];

  const handleTabClick = useCallback((e) => {
    setMode(e.currentTarget.dataset.mode);
  }, []);

  return (
    <>
      {hasModes && (
        <div className="profile--stats-tabs">
          {STATS_MODES.map((m) => (
            <button
              key={m.key}
              data-mode={m.key}
              className={`profile--stats-tab${mode === m.key ? ' profile--stats-tab--active' : ''}`}
              onClick={handleTabClick}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <div className="profile--stats-grid">
        <div className="profile--stat-card">
          <div className="profile--stat-card--value">{total}</div>
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
      {sortedByDay.length > 0 && (
        <>
          <h3 className="profile--stats-section-title">By Day of Week</h3>
          <div className="profile--stats-grid">
            {sortedByDay.map((s) => (
              <div key={s.day} className="profile--stat-card">
                <div className="profile--stat-card--value">{s.count}</div>
                <div className="profile--stat-card--label">{s.day}</div>
                <div className="profile--stat-card--sub">avg {formatTime(s.avgTime)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function HistoryTable({history}) {
  const {page, pageItems, totalPages, pageSize, setPageSize, handlePrev, handleNext} = usePagination(
    history,
    'profile.pageSize.history',
    10
  );

  if (history.length === 0) return null;

  return (
    <div className="profile--history">
      <div className="profile--section-header">
        <h3>Solve History</h3>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>
      <table className="profile--history-table">
        <thead>
          <tr>
            <th>Puzzle</th>
            <th>Size</th>
            <th className="profile--day-col">Day</th>
            <th>Time</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((item) => (
            <tr key={`${item.pid}-${item.gid}`}>
              <td>
                {item.title}
                <OriginalLabel originalTitle={item.originalTitle} originalAuthor={item.originalAuthor} />
                <CollabTag
                  playerCount={item.playerCount}
                  coSolvers={item.coSolvers}
                  anonCount={item.anonCount}
                />
              </td>
              <td>{item.size}</td>
              <td className="profile--day-col">{item.dow || '\u2014'}</td>
              <td>{formatTime(item.time)}</td>
              <td>{formatDate(item.solvedAt)}</td>
              <td className="profile--actions">
                <Link to={`/beta/replay/${item.gid}`} className="profile--replay-link" title="Watch replay">
                  <span className="profile--actions-full">View Replay</span>
                  <span className="profile--actions-short">Replay</span>
                </Link>
                <span className="profile--actions-sep">|</span>
                <Link
                  to={`/beta/play/${item.pid}`}
                  className="profile--replay-link"
                  title="View solved puzzle"
                >
                  <span className="profile--actions-full">View Solved Puzzle</span>
                  <span className="profile--actions-short">Puzzle</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Paginator page={page} totalPages={totalPages} onPrev={handlePrev} onNext={handleNext} />
    </div>
  );
}

function InProgressTable({inProgress, onRemove}) {
  const {page, pageItems, totalPages, pageSize, setPageSize, handlePrev, handleNext} = usePagination(
    inProgress || [],
    'profile.pageSize.inProgress',
    10
  );

  if (!inProgress || inProgress.length === 0) return null;

  return (
    <div className="profile--history">
      <div className="profile--section-header">
        <h3>In Progress</h3>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>
      <table className="profile--history-table">
        <thead>
          <tr>
            <th>Puzzle</th>
            <th>Size</th>
            <th>Progress</th>
            <th>Last Played</th>
            <th>Resume</th>
            {onRemove && <th />}
          </tr>
        </thead>
        <tbody>
          {pageItems.map((item) => (
            <tr key={item.gid}>
              <td>
                <Link to={`/beta/play/${item.pid}`} style={{color: 'inherit'}}>
                  {item.title}
                </Link>
                <OriginalLabel originalTitle={item.originalTitle} originalAuthor={item.originalAuthor} />
              </td>
              <td>{item.size}</td>
              <td>{item.percentComplete > 0 ? `${item.percentComplete}%` : '–'}</td>
              <td>{formatDate(item.lastActivity)}</td>
              <td>
                <Link to={`/beta/game/${item.gid}`} className="profile--replay-link" title="Resume game">
                  <FaPlay size={10} />
                </Link>
              </td>
              {onRemove && (
                <td>
                  <button
                    className="play--abandon"
                    title="Remove this game"
                    data-gid={item.gid}
                    onClick={onRemove}
                  >
                    &times;
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <Paginator page={page} totalPages={totalPages} onPrev={handlePrev} onNext={handleNext} />
    </div>
  );
}

function UploadsTable({uploads}) {
  const {page, pageItems, totalPages, pageSize, setPageSize, handlePrev, handleNext} = usePagination(
    uploads || [],
    'profile.pageSize.uploads',
    10
  );

  if (!uploads || uploads.length === 0) return null;

  return (
    <div className="profile--uploads">
      <div className="profile--section-header">
        <h3>Uploaded Puzzles</h3>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>
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
          {pageItems.map((item) => (
            <tr key={item.pid}>
              <td>
                <Link to={`/beta/play/${item.pid}`} style={{color: 'inherit'}}>
                  {item.title}
                </Link>
                <OriginalLabel originalTitle={item.originalTitle} originalAuthor={item.originalAuthor} />
              </td>
              <td>{item.size}</td>
              <td>{item.isPublic ? 'Public' : 'Unlisted'}</td>
              <td>{formatDate(item.uploadedAt)}</td>
              <td>{item.timesSolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Paginator page={page} totalPages={totalPages} onPrev={handlePrev} onNext={handleNext} />
    </div>
  );
}

export default function Profile() {
  const {userId: paramUserId} = useParams();
  const navigate = useNavigate();
  const {isAuthenticated, user, accessToken} = useContext(AuthContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [dismissGid, setDismissGid] = useState(null);

  // If visiting /profile with no userId, redirect to own profile
  useEffect(() => {
    if (!paramUserId && isAuthenticated && user?.id) {
      navigate(`/profile/${user.id}`, {replace: true});
    }
  }, [paramUserId, isAuthenticated, user, navigate]);

  const targetUserId = paramUserId || user?.id;

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setIsPrivate(false);
    setData(null);
    getUserStats(targetUserId, accessToken).then((result) => {
      if (cancelled) return;
      if (!result) {
        setNotFound(true);
      } else if (result.isPrivate) {
        setIsPrivate(true);
        setData(result);
      } else {
        setData(result);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [targetUserId, accessToken]);

  const isOwnProfile = isAuthenticated && user?.id === targetUserId;

  const handleDismissClick = useCallback((e) => {
    setDismissGid(e.currentTarget.dataset.gid);
  }, []);

  const handleDismissClose = useCallback(() => {
    setDismissGid(null);
  }, []);

  const handleDismissConfirm = useCallback(async () => {
    if (!dismissGid || !accessToken) return;
    await dismissGame(dismissGid, accessToken);
    setData((prev) => ({
      ...prev,
      inProgress: prev.inProgress?.filter((g) => g.gid !== dismissGid),
    }));
    setDismissGid(null);
  }, [dismissGid, accessToken]);

  return (
    <div className="profile">
      <Helmet>
        <title>Profile - Cross with Friends</title>
      </Helmet>
      <Nav />
      <div className="profile--main">
        {loading && (
          <div className="profile--loading">
            <span className="spinner" />
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

        {!loading && isPrivate && !isOwnProfile && (
          <div className="profile--not-found">
            <p>This profile is private.</p>
          </div>
        )}

        {!loading && data && !isPrivate && (
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
                <InProgressTable
                  inProgress={data.inProgress}
                  onRemove={isOwnProfile ? handleDismissClick : null}
                />
                <HistoryTable history={data.history} />
                <UploadsTable uploads={data.uploads} />
              </>
            )}
          </>
        )}
      </div>
      <Footer />
      <ConfirmDialog
        open={!!dismissGid}
        onOpenChange={handleDismissClose}
        title="Remove game?"
        confirmLabel="Remove"
        danger
        onConfirm={handleDismissConfirm}
      >
        This will remove the game from your list. You can rejoin later if you have the link.
      </ConfirmDialog>
    </div>
  );
}
