import './css/powerups.css';
import React, {useEffect, useState} from 'react';
import {Box, Stack} from '@mui/material';

import _ from 'lodash';
import Emoji from './Emoji';
import powerups, {hasExpired, inUse, timeLeft} from '@crosswithfriends/shared/lib/powerups';
import type {Powerup} from '../../types/battle';

interface Props {
  powerups: Powerup[];
  handleUsePowerup: (powerup: Powerup) => void;
}

const Powerups: React.FC<Props> = ({powerups: powerupsList, handleUsePowerup}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Force re-render every 500ms to update timer display
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const renderPowerup = (powerup: Powerup, count: number): JSX.Element | undefined => {
    if (hasExpired(powerup)) {
      return undefined;
    }
    const {type} = powerup;
    const {icon, name} = powerups[type];
    const inuse = inUse(powerup);
    const className = `powerups--emoji ${inuse ? 'powerups--in-use' : 'powerups--unused'}`;
    const onClick = inuse ? undefined : () => handleUsePowerup(powerup);

    const secsLeft = timeLeft(powerup);
    const format = (x: number) => x.toString().padStart(2, '0');
    const timeMins = format(Math.floor(secsLeft / 60));
    const timeSecs = format(secsLeft % 60);

    return (
      <Stack
        key={type}
        direction="column"
        className="powerups--powerup"
        onClick={onClick}
        sx={{alignItems: 'center'}}
      >
        <Box className="powerups--label">{name}</Box>
        <Box className={className} sx={{display: 'flex'}}>
          <Stack direction="column">
            <Emoji emoji={icon} big className="powerups--eemoji" />
            <div className="powerups--info" style={{opacity: inuse ? 1 : 0}}>
              {timeMins}:{timeSecs}
            </div>
          </Stack>
          {count > 1 && <div className="powerups--count">{count}</div>}
        </Box>
      </Stack>
    );
  };

  return (
    <Box className="powerups--main" sx={{display: 'flex'}}>
      <Box className="powerups--header" sx={{display: 'flex'}}>
        POWERUPS
      </Box>
      {_.values(_.groupBy(powerupsList, 'type'))
        .map((powerupGroup) => powerupGroup.filter((powerup: Powerup) => !hasExpired(powerup)))
        .map(
          (powerupGroup: Powerup[]) =>
            // only render the first powerup of a given type
            powerupGroup.length > 0 && renderPowerup(powerupGroup[0], powerupGroup.length)
        )}
    </Box>
  );
};

export default Powerups;
