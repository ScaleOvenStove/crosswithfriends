import './css/nav.css';

import {Link} from 'react-router-dom';
import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import classnames from 'classnames';
import swal from '@sweetalert/with-react';
import {FaSun, FaMoon, FaDesktop, FaUserCircle} from 'react-icons/fa';
import GlobalContext from '../../lib/GlobalContext';
import AuthContext from '../../lib/AuthContext';
import LoginModal from '../Auth/LoginModal';

function showInfo() {
  swal({
    title: 'crosswithfriends.com',
    icon: 'info',
    content: (
      <div className="swal-text swal-text--no-margin">
        <p>
          Cross with Friends is an online website for sharing crosswords and playing collaboratively with
          friends in real time. Join the&nbsp;
          <a href="https://discord.gg/RmjCV8EZ73" target="_blank" rel="noreferrer">
            community Discord
          </a>
          &nbsp;for more discussion.
        </p>
        <hr className="info--hr" />
        <p>
          Cross with Friends is open to contributions from developers of any level or experience. For more
          information or to report any issues, check out the project on&nbsp;
          <a href="https://github.com/ScaleOvenStove/crosswithfriends" target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </div>
    ),
  });
}

function darkModeIcon(darkModePreference) {
  if (darkModePreference === '1') return <FaMoon />;
  if (darkModePreference === '2') return <FaDesktop />;
  return <FaSun />;
}

function darkModeLabel(darkModePreference) {
  if (darkModePreference === '1') return 'Dark Mode: On';
  if (darkModePreference === '2') return 'Dark Mode: System';
  return 'Dark Mode: Off';
}

function UserMenu() {
  const {isAuthenticated, user, handleLogout} = useContext(AuthContext);
  const {darkModePreference, toggleMolesterMoons} = useContext(GlobalContext);
  const [open, setOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [open]);

  const handleToggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const handleOpenLogin = useCallback(() => {
    setOpen(false);
    setShowLogin(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setShowLogin(false);
  }, []);

  const handleShowAbout = useCallback(() => {
    setOpen(false);
    showInfo();
  }, []);

  const handleLogoutClick = useCallback(() => {
    setOpen(false);
    handleLogout();
  }, [handleLogout]);

  const handleToggleDarkMode = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        toggleMolesterMoons();
      }
    },
    [toggleMolesterMoons]
  );

  const handleButtonKeyDown = useCallback(
    (handler) => (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handler();
      }
    },
    []
  );

  return (
    <div className="nav--user-menu" ref={menuRef}>
      <div
        className="nav--user-menu--trigger"
        role="button"
        tabIndex={0}
        onClick={handleToggleOpen}
        onKeyDown={handleButtonKeyDown(handleToggleOpen)}
      >
        <FaUserCircle size={20} />
      </div>
      {open && (
        <div className="nav--user-menu--dropdown">
          {isAuthenticated && (
            <>
              <div className="nav--user-menu--header">{user.displayName}</div>
              <Link to="/profile" className="nav--user-menu--item" onClick={handleCloseMenu}>
                Your Profile &amp; Stats
              </Link>
              <Link to="/account" className="nav--user-menu--item" onClick={handleCloseMenu}>
                Settings
              </Link>
            </>
          )}
          {!isAuthenticated && (
            <div
              className="nav--user-menu--item"
              role="button"
              tabIndex={0}
              onClick={handleOpenLogin}
              onKeyDown={handleButtonKeyDown(handleOpenLogin)}
            >
              Sign Up / Log In
            </div>
          )}
          <div
            className="nav--user-menu--item nav--user-menu--dark-mode"
            role="button"
            tabIndex={0}
            onClick={toggleMolesterMoons}
            onKeyDown={handleToggleDarkMode}
          >
            <span className="nav--user-menu--dark-mode-icon">{darkModeIcon(darkModePreference)}</span>
            {darkModeLabel(darkModePreference)}
          </div>
          <a
            className="nav--user-menu--item"
            href="https://ko-fi.com/crosswithfriends"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCloseMenu}
          >
            Support CWF
          </a>
          <div
            className="nav--user-menu--item"
            role="button"
            tabIndex={0}
            onClick={handleShowAbout}
            onKeyDown={handleButtonKeyDown(handleShowAbout)}
          >
            About
          </div>
          <Link to="/help" className="nav--user-menu--item" onClick={handleCloseMenu}>
            Help &amp; FAQ
          </Link>
          {isAuthenticated && (
            <>
              <div className="nav--user-menu--divider" />
              <div
                className="nav--user-menu--item"
                role="button"
                tabIndex={0}
                onClick={handleLogoutClick}
                onKeyDown={handleButtonKeyDown(handleLogoutClick)}
              >
                Log out
              </div>
            </>
          )}
        </div>
      )}
      <LoginModal open={showLogin} onClose={handleCloseLogin} />
    </div>
  );
}

export default function Nav({hidden, mobile, linkStyle, divRef}) {
  if (hidden) return null;
  const fencing = window.location.href.includes('fencing');
  return (
    <div className={classnames('nav', {mobile})} ref={divRef}>
      <div className="nav--left" style={linkStyle}>
        <Link to={fencing ? '/fencing' : '/'}>Cross with Friends</Link>
      </div>
      <div className="nav--right">
        <UserMenu />
      </div>
    </div>
  );
}
