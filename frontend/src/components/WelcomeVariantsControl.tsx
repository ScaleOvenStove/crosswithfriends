import {Box, Stack} from '@mui/material';
import React from 'react';
import {Link} from 'react-router-dom';
import clsx from 'clsx';
// @ts-ignore
import swal from '@sweetalert/with-react';

export const WelcomeVariantsControl: React.FC<{
  fencing?: boolean;
}> = (props) => {
  const showFencingInfo = () => {
    swal({
      title: 'crosswithfriends.com/fencing',
      icon: 'info',
      content: (
        <div className="swal-text swal-text--no-margin">
          <p>
            Fencing is a variant of Cross with Friends where you can race to complete a crossword against
            friends in real time.
            <br />
            <br />
            Quickly fill in cells correctly before the other team to unlock more clues and explore the grid.
            <br />
            <br />
            <span style={{fontSize: '75%', color: 'gray'}}>
              Join the&nbsp;
              <a href="https://discord.gg/RmjCV8EZ73" target="_blank" rel="noreferrer">
                community Discord
              </a>
              &nbsp;for more discussion.
            </span>
          </p>
        </div>
      ),
    });
  };
  return (
    <Stack
      direction="column"
      sx={{
        padding: '20px !important',
        '& a': {
          textDecoration: 'none',
        },
      }}
    >
      <Box component="span" sx={{fontSize: '200%'}}>
        Variants
      </Box>
      <Link to="/">
        <Box
          component="span"
          className={clsx({
            selected: !props.fencing,
          })}
          sx={{
            color: 'gray',
            '&.selected': {
              color: 'blue',
            },
          }}
        >
          Normal
        </Box>
      </Link>
      <Box component="span">
        <Link to="/fencing">
          <Box
            component="span"
            className={clsx({
              selected: !!props.fencing,
            })}
            sx={{
              color: 'gray',
              '&.selected': {
                color: 'blue',
              },
            }}
          >
            Fencing
          </Box>
        </Link>
        <span className="nav--info" onClick={showFencingInfo}>
          <i className="fa fa-info-circle" />
        </span>
      </Box>
    </Stack>
  );
};
