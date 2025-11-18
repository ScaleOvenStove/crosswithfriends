import {Box, Stack} from '@mui/material';
import clsx from 'clsx';
import React from 'react';
import {Link} from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const swal = withReactContent(Swal);

export const WelcomeVariantsControl: React.FC<{
  fencing?: boolean;
}> = (props) => {
  const showFencingInfo = () => {
    swal.fire({
      title: 'crosswithfriends.com/fencing',
      icon: 'info',
      html: (
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
      <Box component="span" sx={{fontSize: '200%', color: 'text.primary', fontWeight: 600}}>
        Variants
      </Box>
      <Link to="/">
        <Box
          component="span"
          className={clsx({
            selected: !props.fencing,
          })}
          sx={{
            color: 'text.secondary',
            '&.selected': {
              color: 'primary.main',
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
              color: 'text.secondary',
              '&.selected': {
                color: 'primary.main',
              },
            }}
          >
            Fencing
          </Box>
        </Link>
        <span
          className="nav--info"
          onClick={showFencingInfo}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              showFencingInfo();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Show fencing information"
        >
          <i className="fa fa-info-circle" />
        </span>
      </Box>
    </Stack>
  );
};
