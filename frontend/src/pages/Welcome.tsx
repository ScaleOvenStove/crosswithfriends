import './css/welcome.css';

import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {Helmet} from 'react-helmet';
import {
  Box,
  Stack,
  Autocomplete,
  TextField,
  Chip,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material';
import {MdSearch, MdExpandMore} from 'react-icons/md';
import _ from 'lodash';
// eslint-disable-next-line import/no-extraneous-dependencies
import classnames from 'classnames';
import Nav from '../components/common/Nav';
import Upload from '../components/Upload';
import PuzzleList from '../components/PuzzleList';
import {WelcomeVariantsControl} from '../components/WelcomeVariantsControl';
import {isMobile, colorAverage} from '@crosswithfriends/shared/lib/jsUtils';
import {useUser} from '../hooks/useUser';

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
  const [userHistory, setUserHistory] = useState<Record<string, any>>({});
  const [motion, setMotion] = useState<number | undefined>(undefined);
  const [searchFocused, setSearchFocused] = useState<boolean>(false);

  const user = useUser();
  const uploadedPuzzlesRef = useRef<number>(0);
  const navHeightRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const mobile = useMemo(() => isMobile(), []);

  const handleAuth = useCallback((): void => {
    if (user.id) {
      user.listUserHistory().then((history) => {
        setUserHistory(history);
      });
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = user.onAuth(handleAuth);

    if (navRef.current) {
      navHeightRef.current = navRef.current.getBoundingClientRect().height;
    }

    return () => {
      unsubscribe();
    };
  }, [handleAuth, user]);

  const showingSidebar = useMemo(() => {
    return !mobile;
  }, [mobile]);

  const motionValue = useMemo(() => {
    if (motion === undefined) return 0;
    return searchFocused ? Math.round(motion) : motion;
  }, [motion, searchFocused]);

  const colorMotion = useMemo(() => {
    if (!mobile) return 0;
    const result = _.clamp(motionValue * 3, 0, 1);
    return result;
  }, [mobile, motionValue]);

  const navStyle = useMemo((): React.CSSProperties | undefined => {
    if (!mobile) return undefined;
    const offset = motionValue;
    const top = -navHeightRef.current * offset;
    const height = navHeightRef.current * (1 - offset);
    return {
      position: 'relative',
      top,
      height,
      opacity: searchFocused && motionValue === 1 ? 0 : 1,
    };
  }, [mobile, motionValue, searchFocused]);

  const navTextStyle = useMemo((): React.CSSProperties | undefined => {
    if (!mobile) return undefined;
    const opacity = _.clamp(1 - 3 * motionValue, 0, 1);
    const translateY = navHeightRef.current * motionValue;
    return {
      opacity,
      transform: `translateY(${translateY}px)`,
    };
  }, [mobile, motionValue]);

  const navLinkStyle = useMemo((): React.CSSProperties | undefined => {
    if (!mobile) return undefined;
    const translateY = navHeightRef.current * motionValue;
    return {
      transform: `translateY(${translateY}px)`,
      zIndex: 2,
    };
  }, [mobile, motionValue]);

  const handleScroll = useCallback(
    (top: number): void => {
      if (!mobile) return;
      const newMotion = _.clamp(top / 100, 0, 1);
      setMotion(newMotion);
    },
    [mobile]
  );

  const handleCreatePuzzle = useCallback((): void => {
    uploadedPuzzlesRef.current += 1;
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

  const updateSearchRef = useRef<_.DebouncedFunc<(search: string) => void>>();
  if (!updateSearchRef.current) {
    updateSearchRef.current = _.debounce((search: string) => {
      props.setSearch(search);
    }, 250);
  }

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

  const searchStyle = useMemo((): React.CSSProperties => {
    if (!mobile) return {flexGrow: 1};
    const color = colorAverage(BLUE, WHITE, colorMotion);
    const width = searchFocused ? 1 : _.clamp(1 - motionValue, 0.1, 1);
    const zIndex = searchFocused ? 3 : 0;
    return {
      color,
      width: `${width * 100}%`,
      zIndex,
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
    };
  }, [mobile, colorMotion, motionValue]);

  const handleSearchIconTouchEnd = useCallback((e: React.TouchEvent): void => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const filterGroup = useCallback(
    (
      header: string,
      items: Record<string, boolean>,
      handleChange: (header: string, name: string, on: boolean) => void
    ) => {
      return (
        <Accordion
          defaultExpanded={!mobile}
          sx={{
            boxShadow: 'none',
            '&:before': {display: 'none'},
            '&.Mui-expanded': {
              margin: '0 !important',
            },
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(106, 169, 244, 0.03)',
            },
            transition: 'background-color 0.2s ease',
          }}
        >
          <AccordionSummary
            expandIcon={<MdExpandMore />}
            sx={{
              px: 2,
              minHeight: 48,
              '&.Mui-expanded': {minHeight: 48},
              '&:hover': {
                backgroundColor: 'rgba(106, 169, 244, 0.05)',
              },
              transition: 'background-color 0.2s ease',
            }}
          >
            <Typography variant="subtitle2" sx={{fontWeight: 600, color: 'text.primary'}}>
              {header}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{px: 2, pt: 1, pb: 2}}>
            <Stack direction="row" spacing={1} sx={{flexWrap: 'wrap', gap: 1}}>
              {_.keys(items).map((name) => (
                <Chip
                  key={name}
                  label={name}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChange(header, name, !items[name]);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  color={items[name] ? 'primary' : 'default'}
                  variant={items[name] ? 'filled' : 'outlined'}
                  size="small"
                  clickable
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: items[name]
                        ? '0 2px 4px rgba(106, 169, 244, 0.3)'
                        : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    },
                  }}
                />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      );
    },
    [mobile]
  );

  return (
    <Stack className={classnames('welcome', {mobile})} direction="column" sx={{flex: 1}}>
      <Helmet>
        <title>Cross with Friends</title>
      </Helmet>
      <div className="welcome--nav" style={navStyle}>
        <Nav v2 mobile={mobile} textStyle={navTextStyle} linkStyle={navLinkStyle} divRef={navRef} />
      </div>
      <Box sx={{flex: 1, flexBasis: 1, display: 'flex'}}>
        {showingSidebar && (
          <Stack
            className="welcome--sidebar"
            direction="column"
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
            className="welcome--searchbar--container"
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
                  <MdSearch className="welcome--searchicon" onTouchEnd={handleSearchIconTouchEnd} />
                  <input
                    ref={searchInputRef}
                    style={searchInputStyle}
                    placeholder=" "
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    onChange={handleSearchInput}
                    defaultValue={props.search}
                    className="welcome--searchbar"
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
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <Box
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
            uploadedPuzzles={uploadedPuzzlesRef.current}
            userHistory={userHistory}
            sizeFilter={props.sizeFilter}
            statusFilter={props.statusFilter}
            search={props.search}
            onScroll={handleScroll}
          />
        </Stack>
      </Box>
    </Stack>
  );
};

export default Welcome;
