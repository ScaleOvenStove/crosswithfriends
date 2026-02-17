// eslint-disable-next-line import/no-extraneous-dependencies
import classnames from 'classnames';
import ReactDOM from 'react-dom';
import React from 'react';

import useMediaQuery from '@material-ui/core/useMediaQuery';
import {BrowserRouter as Router, Route, Switch, Redirect, useLocation} from 'react-router-dom';
import {isMobile} from './lib/jsUtils';
import {
  Account,
  Battle,
  Game,
  Play,
  Privacy,
  Profile,
  Replay,
  Replays,
  Room,
  Fencing,
  Terms,
  WrappedWelcome,
  VerifyEmail,
  ForgotPassword,
  ResetPassword,
  Help,
} from './pages';
import GlobalContext from './lib/GlobalContext';
import AuthContext, {AuthProvider} from './lib/AuthContext';
import GoogleCallback from './components/Auth/GoogleCallback';

import './style.css';
import './dark.css';

const darkModeLocalStorageKey = 'dark_mode_preference';

// Gate that redirects unverified email users to /verify-email
function VerificationGate({children}) {
  const {user, isAuthenticated, loading} = React.useContext(AuthContext);
  const location = useLocation();

  if (loading) return children;
  if (!isAuthenticated) return children;

  // If user is verified (or Google OAuth auto-verified), pass through
  if (user?.emailVerified) return children;

  // Allow these paths even when unverified
  const allowedPaths = ['/verify-email', '/account', '/profile', '/privacy', '/terms', '/help'];
  if (allowedPaths.some((p) => location.pathname.startsWith(p))) return children;

  // Redirect unverified users to the verify-email page
  return <Redirect to="/verify-email" />;
}

const DiscordRedirect = () => {
  React.useEffect(() => {
    window.location.href = 'https://discord.gg/RmjCV8EZ73';
  }, []);
  return null;
};

const Root = () => {
  const urlDarkMode = window.location.search.indexOf('dark') !== -1;
  const savedDarkModePreference = (localStorage && localStorage.getItem(darkModeLocalStorageKey)) || '0';
  const [darkModePreference, setDarkModePreference] = React.useState(
    urlDarkMode ? '1' : savedDarkModePreference
  );

  const toggleMolesterMoons = () => {
    let newDarkModePreference;
    switch (darkModePreference) {
      case '0':
        newDarkModePreference = '1';
        break;
      case '1':
        newDarkModePreference = '2';
        break;
      case '2':
      default:
        newDarkModePreference = '0';
    }
    localStorage && localStorage.setItem(darkModeLocalStorageKey, newDarkModePreference);
    setDarkModePreference(newDarkModePreference);
  };

  const systemDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const darkMode = darkModePreference === '2' ? systemDarkMode : darkModePreference === '1';

  // Sync dark class to document.body so MUI portals (Dialog, Menu, etc.) pick it up
  React.useEffect(() => {
    document.body.classList.toggle('dark', !!darkMode);
  }, [darkMode]);

  return (
    <Router>
      <AuthProvider>
        <GlobalContext.Provider value={{toggleMolesterMoons, darkModePreference}}>
          <div className={classnames('router-wrapper', {mobile: isMobile(), dark: darkMode})}>
            <VerificationGate>
              <Switch>
                <Route exact path="/auth/google/callback" component={GoogleCallback} />
                <Route exact path="/verify-email" component={VerifyEmail} />
                <Route exact path="/forgot-password" component={ForgotPassword} />
                <Route exact path="/reset-password" component={ResetPassword} />
                <Route exact path="/" component={WrappedWelcome} />
                <Route exact path="/fencing">
                  <WrappedWelcome fencing />
                </Route>
                {/* <Route exact path="/stats" component={Stats} /> */}
                <Route exact path="/game/:gid" component={Game} />
                <Route exact path="/embed/game/:gid" component={Game} />
                <Route exact path="/room/:rid" component={Room} />
                <Route exact path="/embed/room/:rid" component={Room} />
                <Route exact path="/replay/:gid" component={Replay} />
                <Route exact path="/beta/replay/:gid" component={Replay} />
                <Route exact path="/replays/:pid" component={Replays} />
                <Route exact path="/replays" component={Replays} />
                <Route exact path="/beta" component={WrappedWelcome} />
                <Route exact path="/beta/game/:gid" component={Game} />
                <Route exact path="/beta/battle/:bid" component={Battle} />
                <Route exact path="/beta/play/:pid" component={Play} />
                <Route exact path="/privacy" component={Privacy} />
                <Route exact path="/terms" component={Terms} />
                <Route exact path="/help" component={Help} />
                <Route path="/account" component={Account} />
                <Route exact path="/profile" component={Profile} />
                <Route exact path="/profile/:userId" component={Profile} />
                <Route exact path="/fencing/:gid" component={Fencing} />
                <Route exact path="/beta/fencing/:gid" component={Fencing} />
                <Route exact path="/discord" component={DiscordRedirect} />
              </Switch>
            </VerificationGate>
          </div>
        </GlobalContext.Provider>
      </AuthProvider>
    </Router>
  );
};
/*
ReactDOM.render(
  <h4 style={{marginLeft: 10}}>down for a maintenance</h4>,
  document.getElementById('root')
);
*/
// eslint-disable-next-line react/no-deprecated -- React 16 doesn't support createRoot
ReactDOM.render(<Root />, document.getElementById('root'));
