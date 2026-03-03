import React, {useCallback, useState} from 'react';
import {Link} from 'react-router';
import clsx from 'clsx';
import {MdInfoOutline} from 'react-icons/md';
import './css/welcomeVariantsControl.css';
import InfoDialog from './common/InfoDialog';

export const WelcomeVariantsControl: React.FC<{
  fencing?: boolean;
}> = (props) => {
  const [showInfo, setShowInfo] = useState(false);
  const handleShowInfo = useCallback(() => {
    setShowInfo(true);
  }, []);
  const handleInfoKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setShowInfo(true);
    }
  }, []);
  return (
    <div className="welcome-variants">
      <span className="welcome-variants--title">Variants</span>
      <Link to="/">
        <span
          className={clsx('welcome-variants--option', {
            selected: !props.fencing,
          })}
        >
          Normal
        </span>
      </Link>
      <span>
        <Link to="/fencing">
          <span
            className={clsx('welcome-variants--option', {
              selected: !!props.fencing,
            })}
          >
            Fencing
          </span>
        </Link>
        <span
          className="nav--info"
          onClick={handleShowInfo}
          onKeyDown={handleInfoKeyDown}
          role="button"
          tabIndex={0}
        >
          <i className="fa fa-info-circle" />
        </span>
      </span>
      <InfoDialog
        open={showInfo}
        onOpenChange={setShowInfo}
        title="crosswithfriends.com/fencing"
        icon={<MdInfoOutline />}
      >
        <p>
          Fencing is a variant of Cross with Friends where you can race to complete a crossword against
          friends in real time.
        </p>
        <p>
          Quickly fill in cells correctly before the other team to unlock more clues and explore the grid.
        </p>
        <p style={{fontSize: '75%', color: 'gray'}}>
          Join the&nbsp;
          <a href="https://discord.gg/RmjCV8EZ73" target="_blank" rel="noreferrer">
            community Discord
          </a>
          &nbsp;for more discussion.
        </p>
      </InfoDialog>
    </div>
  );
};
