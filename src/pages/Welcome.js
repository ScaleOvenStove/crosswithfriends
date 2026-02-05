import './css/welcome.css';

import React, {Component} from 'react';
import {Helmet} from 'react-helmet';
import Flex from 'react-flexview';
import {MdSearch, MdCheckBoxOutlineBlank, MdCheckBox, MdExpandMore, MdExpandLess, MdFilterList, MdClose} from 'react-icons/md';
import _ from 'lodash';
// eslint-disable-next-line import/no-extraneous-dependencies
import classnames from 'classnames';
import Nav from '../components/common/Nav';
import Upload from '../components/Upload';
import {getUser} from '../store';
import PuzzleList from '../components/PuzzleList';
import {WelcomeVariantsControl} from '../components/WelcomeVariantsControl';
import {isMobile, colorAverage} from '../lib/jsUtils';

const BLUE = '#6aa9f4';
const WHITE = '#FFFFFF';

export default class Welcome extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userHistory: {},
      collapsedFilters: {Day: true, Type: true, Status: true},
      mobileSidebarOpen: false,
    };
    this.loading = false;
    this.mobile = isMobile();
    this.searchInput = React.createRef();
    this.nav = React.createRef();
    this.uploadedPuzzles = 0;
  }

  componentDidMount() {
    this.initializeUser();
    this.navHeight = this.nav.current.getBoundingClientRect().height;
  }

  componentWillUnmount() {
    this.user.offAuth(this.handleAuth);
  }

  handleAuth = () => {
    this.user.listUserHistory().then((userHistory) => {
      this.setState({userHistory});
    });
  };

  initializeUser() {
    this.user = getUser();
    this.user.onAuth(this.handleAuth);
  }

  get showingSidebar() {
    // eventually, allow mobile to toggle sidebar
    return !this.mobile;
  }

  get navStyle() {
    if (!this.mobile) return undefined;
    const motion = this.motion;
    const {searchFocused} = this.state;
    const offset = motion;
    const top = -this.navHeight * offset;
    const height = this.navHeight * (1 - offset);
    return {
      position: 'relative',
      top,
      height,
      opacity: searchFocused && motion === 1 ? 0 : 1,
    };
  }

  get navTextStyle() {
    if (!this.mobile) return undefined;
    const motion = this.motion;
    const opacity = _.clamp(1 - 3 * motion, 0, 1);
    const translateY = this.navHeight * motion;
    return {
      opacity,
      transform: `translateY(${translateY}px)`,
    };
  }

  get navLinkStyle() {
    if (!this.mobile) return undefined;
    const motion = this.motion;
    const translateY = this.navHeight * motion;
    return {
      transform: `translateY(${translateY}px)`,
      zIndex: 2,
    };
  }

  handleScroll = (top) => {
    if (!this.mobile) return;
    const motion = _.clamp(top / 100, 0, 1);
    this.setState({
      motion,
    });
  };

  renderPuzzles() {
    const {userHistory} = this.state;
    return (
      <PuzzleList
        fencing={this.props.fencing}
        uploadedPuzzles={this.uploadedPuzzles}
        userHistory={userHistory}
        sizeFilter={this.props.sizeFilter}
        statusFilter={this.props.statusFilter}
        typeFilter={this.props.typeFilter}
        dayOfWeekFilter={this.props.dayOfWeekFilter}
        search={this.props.search}
        onScroll={this.handleScroll}
      />
    );
  }

  handleCreatePuzzle = () => {
    this.uploadedPuzzles += 1;
  };

  handleFilterChange = (header, name, on) => {
    if (header === 'Size') {
      this.props.setSizeFilter({
        ...this.props.sizeFilter,
        [name]: on,
      });
    } else if (header === 'Status') {
      this.props.setStatusFilter({
        ...this.props.statusFilter,
        [name]: on,
      });
    } else if (header === 'Type') {
      this.props.setTypeFilter({
        ...this.props.typeFilter,
        [name]: on,
      });
    } else if (header === 'Day') {
      this.props.setDayOfWeekFilter({
        ...this.props.dayOfWeekFilter,
        [name]: on,
      });
    }
  };

  updateSearch = _.debounce((search) => {
    this.props.setSearch(search);
  }, 250);

  handleSearchInput = (e) => {
    const search = e.target.value;
    this.updateSearch(search);
  };

  handleSearchFocus = () => {
    this.setState({searchFocused: true});
  };

  handleSearchBlur = () => {
    this.setState({searchFocused: false});
  };

  toggleFilterGroup = (header) => {
    this.setState((prev) => ({
      collapsedFilters: {
        ...prev.collapsedFilters,
        [header]: !prev.collapsedFilters[header],
      },
    }));
  };

  toggleMobileSidebar = () => {
    this.setState((prev) => ({mobileSidebarOpen: !prev.mobileSidebarOpen}));
  };

  closeMobileSidebar = () => {
    this.setState({mobileSidebarOpen: false});
  };

  renderFilters() {
    const sizeFilter = this.props.sizeFilter;
    const statusFilter = this.props.statusFilter;
    const typeFilter = this.props.typeFilter;
    const dayOfWeekFilter = this.props.dayOfWeekFilter;
    const {collapsedFilters} = this.state;

    const headerStyle = {
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      userSelect: 'none',
    };
    const groupStyle = {
      padding: '8px 20px',
    };
    const inputStyle = {
      margin: 'unset',
    };

    const checkboxGroup = (header, items, handleChange) => {
      const collapsed = collapsedFilters[header];
      return (
        <Flex column style={groupStyle} className="checkbox-group">
          <span style={headerStyle} onClick={() => this.toggleFilterGroup(header)}>
            {header}
            {collapsed ? (
              <MdExpandMore style={{width: 20, height: 20}} />
            ) : (
              <MdExpandLess style={{width: 20, height: 20}} />
            )}
          </span>
          {!collapsed &&
            _.keys(items).map((name, i) => (
              <label
                key={i}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
              >
                <input
                  type="checkbox"
                  style={inputStyle}
                  checked={items[name]}
                  onChange={(e) => {
                    handleChange(header, name, e.target.checked);
                  }}
                />
                {items[name] ? (
                  <MdCheckBox className="checkbox-icon" />
                ) : (
                  <MdCheckBoxOutlineBlank className="checkbox-icon" />
                )}
                <span>{name}</span>
              </label>
            ))}
        </Flex>
      );
    };

    return (
      <Flex className="filters" column hAlignContent="left" shrink={0}>
        {checkboxGroup('Size', sizeFilter, this.handleFilterChange)}
        {checkboxGroup('Type', typeFilter, this.handleFilterChange)}
        {checkboxGroup('Day', dayOfWeekFilter, this.handleFilterChange)}
        {checkboxGroup('Status', statusFilter, this.handleFilterChange)}
      </Flex>
    );
  }

  get motion() {
    const {motion, searchFocused} = this.state;
    if (this.state.motion === undefined) return 0;

    return searchFocused ? Math.round(motion) : motion;
  }

  get colorMotion() {
    if (!this.mobile) return 0;
    // if (this.state.searchFocused) return 0;
    const motion = this.motion;
    const result = _.clamp(motion * 3, 0, 1);
    return result;
  }

  get searchStyle() {
    if (!this.mobile) return {flexGrow: 1};
    const motion = this.motion;
    const color = colorAverage(BLUE, WHITE, this.colorMotion);
    const {searchFocused} = this.state;
    const width = searchFocused ? 1 : _.clamp(1 - motion, 0.1, 1);
    const zIndex = searchFocused ? 3 : 0;
    return {
      color,
      width: `${width * 100}%`,
      zIndex,
    };
  }

  get searchInputStyle() {
    if (!this.mobile) return undefined;
    const color = colorAverage(BLUE, WHITE, this.colorMotion);
    const backgroundColor = colorAverage(WHITE, BLUE, this.colorMotion);
    const paddingTop = (1 - this.motion) * 10;
    const paddingBottom = paddingTop;
    return {
      color,
      backgroundColor,
      paddingTop,
      paddingBottom,
    };
  }

  get searchIconGraphicsStyle() {
    if (!this.mobile) return undefined;
    const stroke = colorAverage(BLUE, WHITE, this.colorMotion);
    return {
      stroke,
    };
  }

  handleSearchIconTouchEnd = (e) => {
    this.searchInput.current && this.searchInput.current.focus();
    e.preventDefault();
    e.stopPropagation();
  };

  renderSearch() {
    const hAlignContent = this.mobile ? 'right' : 'left';
    const grow = this.mobile ? 0 : 1;
    return (
      <Flex className="welcome--searchbar--container" shrink={0} hAlignContent={hAlignContent}>
        <Flex
          vAlignContent="center"
          style={this.searchStyle}
          grow={grow}
          className="welcome--searchbar--wrapper"
        >
          <MdSearch className="welcome--searchicon" onTouchEnd={this.handleSearchIconTouchEnd} />
          <input
            ref={this.searchInput}
            style={this.searchInputStyle}
            placeholder=" "
            onFocus={this.handleSearchFocus}
            onBlur={this.handleSearchBlur}
            onInput={this.handleSearchInput}
            defaultValue={this.props.search}
            className="welcome--searchbar"
          />
        </Flex>
      </Flex>
    );
  }

  renderQuickUpload() {
    return (
      <Flex className="quickplay" style={{width: 200}}>
        <Upload v2 fencing={this.props.fencing} onCreate={this.handleCreatePuzzle} />
      </Flex>
    );
  }

  renderMobileSidebar() {
    const {mobileSidebarOpen} = this.state;
    return (
      <>
        <div
          className={classnames('mobile-sidebar-overlay', {open: mobileSidebarOpen})}
          onClick={this.closeMobileSidebar}
        />
        <Flex
          className={classnames('mobile-sidebar', {open: mobileSidebarOpen})}
          column
        >
          <Flex className="mobile-sidebar--header" vAlignContent="center">
            <span>Filters</span>
            <MdClose
              className="mobile-sidebar--close"
              onClick={this.closeMobileSidebar}
            />
          </Flex>
          <Flex column grow={1} style={{overflowY: 'auto'}}>
            {this.renderFilters()}
            <WelcomeVariantsControl fencing={this.props.fencing} />
          </Flex>
          <Flex className="quickplay" style={{width: '100%'}}>
            <Upload v2 fencing={this.props.fencing} onCreate={this.handleCreatePuzzle} />
          </Flex>
        </Flex>
      </>
    );
  }

  render() {
    return (
      <Flex className={classnames('welcome', {mobile: this.mobile})} column grow={1}>
        <Helmet>
          <title>Cross with Friends</title>
        </Helmet>
        <div className="welcome--nav" style={this.navStyle}>
          <Nav
            v2
            mobile={this.mobile}
            textStyle={this.navTextStyle}
            linkStyle={this.navLinkStyle}
            divRef={this.nav}
          />
        </div>
        <Flex grow={1} basis={1}>
          {this.showingSidebar && (
            <Flex className="welcome--sidebar" column shrink={0} style={{justifyContent: 'space-between'}}>
              {this.renderFilters()}
              <WelcomeVariantsControl fencing={this.props.fencing} />
              {!this.mobile && this.renderQuickUpload()}
            </Flex>
          )}
          <Flex className="welcome--main" column grow={1}>
            {this.renderSearch()}
            {this.renderPuzzles()}
          </Flex>
        </Flex>
        {this.mobile && (
          <>
            {this.renderMobileSidebar()}
            <button
              className="mobile-filter-button"
              onClick={this.toggleMobileSidebar}
              aria-label="Open filters"
            >
              <MdFilterList />
            </button>
          </>
        )}
      </Flex>
    );
  }
}
