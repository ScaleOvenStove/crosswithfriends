import './css/nav.css';

import classnames from 'classnames';
import React from 'react';
import {Link} from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const swal = withReactContent(Swal);

import {useUser} from '../../hooks/useUser';

import {DarkModeToggle} from './DarkModeToggle';

interface LogInProps {
  style?: React.CSSProperties;
}

function LogIn({style}: LogInProps): JSX.Element | null {
  const user = useUser();
  if (!user.attached) {
    return null;
  }
  if (user.fb) {
    // for now return a simple "logged in"
    return (
      <div className="nav--right" style={style}>
        Logged in
      </div>
    );
    /*
    return (
      <div className='nav--right'>
        <Link to='/account'
          className='nav--right'>
          Account
        </Link>
      </div>
    );
    */
  }
  return (
    <div className="nav--right" style={style}>
      <div
        className="nav--login"
        onClick={() => {
          user.logIn();
        }}
      >
        Log in
      </div>
    </div>
  );
}

function showInfo(): void {
  swal.fire({
    title: 'crosswithfriends.com',
    icon: 'info',
    html: (
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

interface NavProps {
  hidden?: boolean;
  v2?: boolean;
  canLogin?: boolean;
  mobile?: boolean;
  linkStyle?: React.CSSProperties;
  divRef?: React.RefObject<HTMLDivElement>;
  composeEnabled?: boolean;
  textStyle?: React.CSSProperties;
}

export default function Nav({
  hidden,
  v2: _v2,
  canLogin,
  mobile,
  linkStyle,
  divRef,
  composeEnabled: _composeEnabled,
  textStyle,
}: NavProps): JSX.Element | null {
  if (hidden) return null; // no nav for mobile
  const fencing = window.location.href.includes('fencing');
  return (
    <div className={classnames('nav', {mobile})} ref={divRef}>
      <div className="nav--left" style={linkStyle || textStyle}>
        <Link to={fencing ? '/fencing' : '/'}>Cross with Friends</Link>
      </div>
      <div className="nav--right">
        <DarkModeToggle />
        {/* <div className="nav--right stats">
          <a href="/stats">Your stats</a>
        </div> */}
        <div className="nav--info" onClick={showInfo}>
          <i className="fa fa-info-circle" />
        </div>
        {canLogin && <LogIn />}
      </div>
    </div>
  );
}
