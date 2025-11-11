// eslint-disable-next-line import/no-extraneous-dependencies
import classnames from 'classnames';
import {createRoot} from 'react-dom/client';
import React from 'react';
import {useMediaQuery, ThemeProvider, createTheme} from '@mui/material';

import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {isMobile} from '@crosswithfriends/shared/lib/jsUtils';
import {
  Account,
  Battle,
  Compose,
  Composition,
  Game,
  Play,
  Replay,
  Replays,
  Room,
  Fencing,
  WrappedWelcome,
} from './pages';
import GlobalContext from '@crosswithfriends/shared/lib/GlobalContext';
import ErrorBoundary from './components/common/ErrorBoundary';

import './style.css';
import './dark.css';

const darkModeLocalStorageKey = 'dark_mode_preference';

const DiscordRedirect: React.FC = () => {
  React.useEffect(() => {
    window.location.href = 'https://discord.gg/RmjCV8EZ73';
  }, []);
  return null;
};

const Root: React.FC = () => {
  const urlDarkMode = window.location.search.indexOf('dark') !== -1;
  const savedDarkModePreference = (localStorage && localStorage.getItem(darkModeLocalStorageKey)) || '0';
  const [darkModePreference, setDarkModePreference] = React.useState<string>(
    urlDarkMode ? '1' : savedDarkModePreference
  );

  const toggleMolesterMoons = () => {
    let newDarkModePreference: string;
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

  const theme = createTheme();

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <Router>
          <GlobalContext.Provider value={{toggleMolesterMoons, darkModePreference}}>
            <div className={classnames('router-wrapper', {mobile: isMobile(), dark: darkMode})}>
              <Routes>
                <Route path="/" element={<WrappedWelcome />} />
                <Route path="/fencing" element={<WrappedWelcome fencing />} />
                {/* <Route path="/stats" element={<Stats />} /> */}
                <Route path="/game/:gid" element={<Game />} />
                <Route path="/embed/game/:gid" element={<Game />} />
                <Route path="/room/:rid" element={<Room />} />
                <Route path="/embed/room/:rid" element={<Room />} />
                <Route path="/replay/:gid" element={<Replay />} />
                <Route path="/beta/replay/:gid" element={<Replay />} />
                <Route path="/replays/:pid" element={<Replays />} />
                <Route path="/replays" element={<Replays />} />
                <Route path="/beta" element={<WrappedWelcome />} />
                <Route path="/beta/game/:gid" element={<Game />} />
                <Route path="/beta/battle/:bid" element={<Battle />} />
                <Route path="/beta/play/:pid" element={<Play />} />
                <Route path="/account" element={<Account />} />
                <Route path="/compose" element={<Compose />} />
                <Route path="/composition/:cid" element={<Composition />} />
                <Route path="/fencing/:gid" element={<Fencing />} />
                <Route path="/beta/fencing/:gid" element={<Fencing />} />
                <Route path="/discord" element={<DiscordRedirect />} />
              </Routes>
            </div>
          </GlobalContext.Provider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};
/*
createRoot(document.getElementById('root')!).render(
  <h4 style={{marginLeft: 10}}>down for a maintenance</h4>
);
*/
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Root />);
} else {
  console.error('Root element not found');
}
