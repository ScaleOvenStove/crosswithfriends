import './css/nav.css';

import {Link} from 'react-router-dom';
import ReactDOMServer from 'react-dom/server';
import React, {useContext} from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import classnames from 'classnames';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const swal = withReactContent(Swal);
import GlobalContext from '@crosswithfriends/shared/lib/GlobalContext';
import {useUser} from '../../hooks/useUser';

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

function darkModePreferenceText(darkModePreference: string): string {
  switch (darkModePreference) {
    case '1':
      return 'On';
    case '2':
      return 'System default';
    case '0':
    default:
      return 'Off';
  }
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
  v2,
  canLogin,
  mobile,
  linkStyle,
  divRef,
  composeEnabled,
  textStyle,
}: NavProps): JSX.Element | null {
  const {darkModePreference, toggleMolesterMoons} = useContext(GlobalContext);
  if (hidden) return null; // no nav for mobile
  const fencing = window.location.href.includes('fencing');
  return (
    <div className={classnames('nav', {mobile})} ref={divRef}>
      <div className="nav--left" style={linkStyle || textStyle}>
        <Link to={fencing ? '/fencing' : '/'}>Cross with Friends</Link>
      </div>
      <div className="nav--right">
        <div
          className="molester-moon"
          style={darkModePreference !== '0' ? {opacity: 1} : {}}
          onClick={toggleMolesterMoons}
        >
          Dark Mode (beta): {darkModePreferenceText(darkModePreference)}
        </div>
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
