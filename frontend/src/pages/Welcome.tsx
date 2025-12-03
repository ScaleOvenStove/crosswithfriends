import './css/welcome.css';

import {isMobile, colorAverage} from '@crosswithfriends/shared/lib/jsUtils';
import {
  Box,
  Stack,
  Autocomplete,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
  Snackbar,
} from '@mui/material';
import classnames from 'classnames';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {MdSearch} from 'react-icons/md';

type DebouncedFunc<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number = 0): DebouncedFunc<T> => {
  let timeout: NodeJS.Timeout;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
};

const clamp = (val: number, min: number, max: number): number => Math.min(Math.max(val, min), max);

import Nav from '../components/common/Nav';
import PuzzleList from '../components/PuzzleList';
import Upload from '../components/Upload';
import {WelcomeVariantsControl} from '../components/WelcomeVariantsControl';
import {useUser} from '../hooks/useUser';
import {logger} from '../utils/logger';

const BLUE = '#6aa9f4';
const WHITE = '#FFFFFF';

interface SizeFilter {
  Mini: boolean;
  Standard: boolean;
}

interface StatusFilter {
  Complete: boolean;
  'In progress': boolean;
  New: boolean;
}

interface Props {
  fencing?: boolean;
  sizeFilter: SizeFilter;
  statusFilter: StatusFilter;
  search: string;
  setSizeFilter: (filter: SizeFilter) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setSearch: (search: string) => void;
}

const Welcome: React.FC<Props> = (props) => {
  const [userHistory, setUserHistory] = useState<Record<string, unknown>>({});
  const [motion, setMotion] = useState<number | undefined>(undefined);
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState<boolean>(isMobile());

  const user = useUser();
  const [uploadedPuzzles, setUploadedPuzzles] = useState<number>(0);
  const [navHeight, setNavHeight] = useState<number>(0);
  const navHeightRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Handle window resize with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setMobile(isMobile());
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleAuth = useCallback((): void => {
    if (user.id) {
      user
        .listUserHistory()
        .then((history) => {
          setUserHistory(history);
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load puzzle history';
          setError(errorMessage);
          logger.errorWithException('Failed to load user history', err);
        });
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = user.onAuth(handleAuth);

    if (navRef.current) {
      const height = navRef.current.getBoundingClientRect().height;
      navHeightRef.current = height;
      setNavHeight(height);
    }

    return () => {
      unsubscribe();
    };
  }, [handleAuth, user]);

  const showingSidebar = useMemo(() => !mobile, [mobile]);

  const motionValue = useMemo(() => {
    if (motion === undefined) return 0;
    return searchFocused ? Math.round(motion) : motion;
  }, [motion, searchFocused]);

  const colorMotion = useMemo(() => {
    if (!mobile) return 0;
    const result = clamp(motionValue * 3, 0, 1);
    return result;
  }, [mobile, motionValue]);

  const navStyle = useMemo((): React.CSSProperties | undefined => {
    if (!mobile) return undefined;
    const offset = motionValue;
    const top = -navHeight * offset;
    const height = navHeight * (1 - offset);
    return {
      position: 'relative',
      top,
      height,
      opacity: searchFocused && motionValue === 1 ? 0 : 1,
      transition: 'opacity 0.2s ease',
    };
  }, [mobile, motionValue, searchFocused, navHeight]);

  const navTextStyle = useMemo((): React.CSSProperties | undefined => {
    if (!mobile) return undefined;
    const opacity = clamp(1 - 3 * motionValue, 0, 1);
    const translateY = navHeight * motionValue;
    return {
      opacity,
      transform: `translateY(${translateY}px)`,
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    };
  }, [mobile, motionValue, navHeight]);

  const navLinkStyle = useMemo((): React.CSSProperties | undefined => {
    if (!mobile) return undefined;
    const translateY = navHeight * motionValue;
    return {
      transform: `translateY(${translateY}px)`,
      zIndex: 2,
      transition: 'transform 0.2s ease',
    };
  }, [mobile, motionValue, navHeight]);

  const handleScroll = useCallback(
    (top: number): void => {
      if (!mobile) return;
      const newMotion = clamp(top / 100, 0, 1);
      setMotion(newMotion);
    },
    [mobile]
  );

  const handleCreatePuzzle = useCallback((): void => {
    setUploadedPuzzles((prev) => prev + 1);
  }, []);

  const handleFilterChange = useCallback(
    (header: string, name: string, on: boolean): void => {
      if (header === 'Size') {
        props.setSizeFilter({
          ...props.sizeFilter,
          [name]: on,
        });
      } else if (header === 'Status') {
        props.setStatusFilter({
          ...props.statusFilter,
          [name]: on,
        });
      }
    },
    [props.sizeFilter, props.statusFilter, props.setSizeFilter, props.setStatusFilter]
  );

  const updateSearchRef = useRef<DebouncedFunc<(search: string) => void>>();
  useEffect(() => {
    if (!updateSearchRef.current) {
      updateSearchRef.current = debounce((search: string) => {
        props.setSearch(search);
      }, 250);
    }
  }, [props.setSearch]);

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const search = e.target.value;
    updateSearchRef.current?.(search);
  }, []);

  const handleSearchFocus = useCallback((): void => {
    setSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback((): void => {
    setSearchFocused(false);
  }, []);

  const handleCloseError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    document.title = 'Cross with Friends';
  }, []);

  const searchStyle = useMemo((): React.CSSProperties => {
    if (!mobile) return {flexGrow: 1};
    const color = colorAverage(BLUE, WHITE, colorMotion);
    const width = searchFocused ? 1 : clamp(1 - motionValue, 0.1, 1);
    const zIndex = searchFocused ? 3 : 0;
    return {
      color,
      width: `${width * 100}%`,
      zIndex,
      transition: 'width 0.3s ease, color 0.3s ease',
    };
  }, [mobile, colorMotion, searchFocused, motionValue]);

  const searchInputStyle = useMemo((): React.CSSProperties | undefined => {
    if (!mobile) return undefined;
    const color = colorAverage(BLUE, WHITE, colorMotion);
    const backgroundColor = colorAverage(WHITE, BLUE, colorMotion);
    const paddingTop = (1 - motionValue) * 10;
    const paddingBottom = paddingTop;
    return {
      color,
      backgroundColor,
      paddingTop,
      paddingBottom,
      transition: 'color 0.3s ease, background-color 0.3s ease, padding 0.3s ease',
    };
  }, [mobile, colorMotion, motionValue]);

  const handleSearchIconTouchEnd = useCallback((e: React.TouchEvent): void => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape' && searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }, []);

  const filterGroup = useCallback(
    (
      header: string,
      items: Record<string, boolean>,
      handleChange: (header: string, name: string, on: boolean) => void
    ) => {
      return (
        <Box component="fieldset" sx={{mb: 1, border: 'none', padding: 0, margin: 0}}>
          <Box component="legend" sx={{fontWeight: 600, mb: 0.5, color: 'text.primary'}}>
            {header}
          </Box>
          <Stack direction="column" spacing={0.5} role="group" aria-label={`${header} filters`}>
            {Object.keys(items).map((name) => (
              <FormControlLabel
                key={name}
                control={
                  <Checkbox
                    checked={items[name]}
                    onChange={(e) => handleChange(header, name, e.target.checked)}
                    size="small"
                    aria-label={`Filter by ${name}`}
                  />
                }
                label={name}
                sx={{
                  margin: 0,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.875rem',
                  },
                }}
              />
            ))}
          </Stack>
        </Box>
      );
    },
    []
  );

  return (
    <Stack
      className={classnames('welcome', {mobile})}
      direction="column"
      role="main"
      aria-label="Puzzle list"
      sx={{flex: 1}}
    >
      <nav className="welcome--nav" style={navStyle} aria-label="Main navigation">
        <Nav v2 mobile={mobile} textStyle={navTextStyle} linkStyle={navLinkStyle} divRef={navRef} />
      </nav>
      <Box sx={{flex: 1, flexBasis: 1, display: 'flex'}}>
        {showingSidebar && (
          <Stack
            component="aside"
            className="welcome--sidebar"
            direction="column"
            aria-label="Filters and controls"
            sx={{
              flexShrink: 0,
              width: 240,
              padding: 2,
              gap: 1,
            }}
          >
            <Stack className="filters" direction="column" sx={{alignItems: 'left', flexShrink: 0, gap: 0.5}}>
              {filterGroup('Size', props.sizeFilter, handleFilterChange)}
              {filterGroup('Status', props.statusFilter, handleFilterChange)}
            </Stack>
            <WelcomeVariantsControl fencing={props.fencing} />
            {!mobile && (
              <Box
                className="quickplay"
                sx={{
                  width: '100%',
                  display: 'flex',
                  marginTop: 2,
                  paddingTop: 2,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Upload v2 fencing={props.fencing} onCreate={handleCreatePuzzle} />
              </Box>
            )}
          </Stack>
        )}
        <Stack className="welcome--main" direction="column" sx={{flex: 1}}>
          <Box
            component="section"
            className="welcome--searchbar--container"
            aria-label="Search puzzles"
            sx={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: mobile ? 'right' : 'left',
              p: mobile ? 1.5 : 3,
              transition: 'padding 0.3s ease',
            }}
          >
            <Box
              sx={{
                alignItems: 'center',
                display: 'flex',
                flexGrow: mobile ? 0 : 1,
                maxWidth: mobile ? 'none' : 600,
                ...searchStyle,
              }}
              className="welcome--searchbar--wrapper"
            >
              {mobile ? (
                <>
                  <MdSearch
                    className="welcome--searchicon"
                    onTouchEnd={handleSearchIconTouchEnd}
                    role="button"
                    aria-label="Focus search input"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        searchInputRef.current?.focus();
                      }
                    }}
                  />
                  <input
                    ref={searchInputRef}
                    style={searchInputStyle}
                    placeholder="Search puzzles..."
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    onChange={handleSearchInput}
                    onKeyDown={handleSearchKeyDown}
                    defaultValue={props.search}
                    className="welcome--searchbar"
                    aria-label="Search puzzles"
                    type="search"
                  />
                </>
              ) : (
                <Autocomplete
                  freeSolo
                  options={[]}
                  value={props.search}
                  onInputChange={(event, newValue) => {
                    if (typeof newValue === 'string') {
                      updateSearchRef.current?.(newValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search puzzles..."
                      variant="outlined"
                      size="small"
                      aria-label="Search puzzles"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <Box
                            component="span"
                            aria-hidden="true"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mr: 1,
                              color: 'text.secondary',
                            }}
                          >
                            <MdSearch />
                          </Box>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                            },
                          },
                          '&.Mui-focused': {
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                              borderWidth: '2px',
                            },
                          },
                          '&:focus-within': {
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                            },
                          },
                        },
                      }}
                    />
                  )}
                  sx={{flexGrow: 1}}
                />
              )}
            </Box>
          </Box>
          <PuzzleList
            fencing={props.fencing}
            uploadedPuzzles={uploadedPuzzles}
            userHistory={userHistory}
            sizeFilter={props.sizeFilter}
            statusFilter={props.statusFilter}
            search={props.search}
            onScroll={handleScroll}
          />
        </Stack>
      </Box>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{width: '100%'}}>
          {error}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Welcome;
