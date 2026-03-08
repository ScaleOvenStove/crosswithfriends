import './css/welcome.css';

import React, {Component} from 'react';
import {Helmet} from 'react-helmet-async';
import {
  MdSearch,
  MdCheckBoxOutlineBlank,
  MdCheckBox,
  MdExpandMore,
  MdExpandLess,
  MdFilterList,
  MdClose,
} from 'react-icons/md';
import _ from 'lodash';

import clsx from 'clsx';
import Nav from '../components/common/Nav';
import Upload from '../components/Upload';
import PuzzleList from '../components/PuzzleList';
import {WelcomeVariantsControl} from '../components/WelcomeVariantsControl';
import {isMobile, colorAverage} from '../lib/jsUtils';

const BLUE = '#6aa9f4';
const WHITE = '#FFFFFF';

const handleLabelMouseDown = (e) => {
  e.preventDefault();
};

export default class Welcome extends Component {
  constructor(props) {
    super(props);
    this.state = {
      collapsedFilters: {},
      mobileSidebarOpen: false,
      uploadedPuzzles: 0,
    };
    this.loading = false;
    this.mobile = isMobile();
    this.searchInput = React.createRef();
    this.nav = React.createRef();
  }

  componentDidMount() {
    this.navHeight = this.nav.current.getBoundingClientRect().height;
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
    return (
      <PuzzleList
        fencing={this.props.fencing}
        uploadedPuzzles={this.state.uploadedPuzzles}
        userHistory={{}}
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
    this.setState((prev) => ({uploadedPuzzles: prev.uploadedPuzzles + 1}));
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

  handleSelectAll = (header) => {
    if (header === 'Day') {
      this.props.setDayOfWeekFilter({
        Mon: true,
        Tue: true,
        Wed: true,
        Thu: true,
        Fri: true,
        Sat: true,
        Sun: true,
        Unknown: true,
      });
    }
  };

  handleSelectNone = (header) => {
    if (header === 'Day') {
      this.props.setDayOfWeekFilter({
        Mon: false,
        Tue: false,
        Wed: false,
        Thu: false,
        Fri: false,
        Sat: false,
        Sun: false,
        Unknown: false,
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

  handleCloseSidebarKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.closeMobileSidebar();
    }
  };

  handleCheckboxChange = (e) => {
    const {header, name} = e.target.dataset;
    this.handleFilterChange(header, name, e.target.checked);
  };

  handleToggleFilterGroupClick = (e) => {
    const {header} = e.currentTarget.dataset;
    this.toggleFilterGroup(header);
  };

  handleToggleFilterGroupKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const {header} = e.currentTarget.dataset;
      this.toggleFilterGroup(header);
    }
  };

  handleSelectAllClick = (e) => {
    const {header} = e.currentTarget.dataset;
    this.handleSelectAll(header);
  };

  handleSelectAllKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const {header} = e.currentTarget.dataset;
      this.handleSelectAll(header);
    }
  };

  handleSelectNoneClick = (e) => {
    const {header} = e.currentTarget.dataset;
    this.handleSelectNone(header);
  };

  handleSelectNoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const {header} = e.currentTarget.dataset;
      this.handleSelectNone(header);
    }
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

    const checkboxGroup = (header, items, showQuickToggle = false) => {
      const collapsed = collapsedFilters[header];
      return (
        <div className="flex--column checkbox-group" style={groupStyle}>
          <span
            role="button"
            tabIndex={0}
            style={headerStyle}
            data-header={header}
            onClick={this.handleToggleFilterGroupClick}
            onKeyDown={this.handleToggleFilterGroupKeyDown}
          >
            {header}
            {collapsed ? (
              <MdExpandMore style={{width: 20, height: 20}} />
            ) : (
              <MdExpandLess style={{width: 20, height: 20}} />
            )}
          </span>
          {!collapsed && showQuickToggle && (
            <div className="filter-quick-toggle">
              <span
                role="button"
                tabIndex={0}
                className="filter-quick-toggle--link"
                data-header={header}
                onClick={this.handleSelectAllClick}
                onKeyDown={this.handleSelectAllKeyDown}
              >
                All
              </span>
              <span className="filter-quick-toggle--separator">/</span>
              <span
                role="button"
                tabIndex={0}
                className="filter-quick-toggle--link"
                data-header={header}
                onClick={this.handleSelectNoneClick}
                onKeyDown={this.handleSelectNoneKeyDown}
              >
                None
              </span>
            </div>
          )}
          {!collapsed &&
            _.keys(items).map((name, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <label key={i} role="presentation" onMouseDown={handleLabelMouseDown}>
                <input
                  type="checkbox"
                  style={inputStyle}
                  checked={items[name]}
                  data-header={header}
                  data-name={name}
                  onChange={this.handleCheckboxChange}
                />
                {items[name] ? (
                  <MdCheckBox className="checkbox-icon" />
                ) : (
                  <MdCheckBoxOutlineBlank className="checkbox-icon" />
                )}
                <span>{name}</span>
              </label>
            ))}
        </div>
      );
    };

    return (
      <div className="flex--column flex--shrink-0 filters">
        {checkboxGroup('Size', sizeFilter)}
        {checkboxGroup('Type', typeFilter)}
        {checkboxGroup('Day', dayOfWeekFilter, true)}
        {checkboxGroup('Status', statusFilter)}
      </div>
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
    const grow = this.mobile ? 0 : 1;
    return (
      <div
        className="flex flex--shrink-0 welcome--searchbar--container"
        style={{justifyContent: this.mobile ? 'flex-end' : 'flex-start'}}
      >
        <div
          className="flex flex--align-center welcome--searchbar--wrapper"
          style={{...this.searchStyle, flexGrow: grow}}
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
        </div>
        {this.mobile && (
          <button
            className="mobile-filter-button"
            onClick={this.toggleMobileSidebar}
            aria-label="Open filters"
          >
            <MdFilterList />
          </button>
        )}
      </div>
    );
  }

  renderQuickUpload() {
    return (
      <div className="flex quickplay" style={{width: 200}}>
        <Upload v2 fencing={this.props.fencing} onCreate={this.handleCreatePuzzle} />
      </div>
    );
  }

  renderMobileSidebar() {
    const {mobileSidebarOpen} = this.state;
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          className={clsx('mobile-sidebar-overlay', {open: mobileSidebarOpen})}
          onClick={this.closeMobileSidebar}
          onKeyDown={this.handleCloseSidebarKeyDown}
        />
        <div className={clsx('flex--column mobile-sidebar', {open: mobileSidebarOpen})}>
          <div className="flex flex--align-center mobile-sidebar--header">
            <span>Filters</span>
            <MdClose className="mobile-sidebar--close" onClick={this.closeMobileSidebar} />
          </div>
          <div className="flex--column flex--grow" style={{overflowY: 'auto'}}>
            {this.renderFilters()}
            <WelcomeVariantsControl fencing={this.props.fencing} />
          </div>
          <div className="flex quickplay" style={{width: '100%'}}>
            <Upload v2 fencing={this.props.fencing} onCreate={this.handleCreatePuzzle} />
          </div>
        </div>
      </>
    );
  }

  render() {
    return (
      <div className={clsx('flex--column flex--grow welcome', {mobile: this.mobile})}>
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
        <div className="flex flex--grow" style={{flexBasis: 1}}>
          {this.showingSidebar && (
            <div className="flex--column flex--shrink-0 welcome--sidebar">
              {this.renderFilters()}
              <WelcomeVariantsControl fencing={this.props.fencing} />
              {!this.mobile && this.renderQuickUpload()}
            </div>
          )}
          <div className="flex--column flex--grow welcome--main">
            {this.renderSearch()}
            {this.renderPuzzles()}
          </div>
        </div>
        {this.mobile && this.renderMobileSidebar()}
      </div>
    );
  }
}
