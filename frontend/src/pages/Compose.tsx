import './css/compose.css';

import {Helmet} from 'react-helmet';
import _ from 'lodash';
import React, {useState, useRef, useEffect, useCallback} from 'react';
import {Box, Stack} from '@mui/material';
import redirect from '@crosswithfriends/shared/lib/redirect';
import actions from '../actions';

import Nav from '../components/common/Nav';
import {getUser, CompositionModel} from '../store';
import User from '../store/user';

const Compose: React.FC = () => {
  const [compositions, setCompositions] = useState<Record<string, {title: string; author: string}>>({});
  const [limit, setLimit] = useState<number>(20);

  const userRef = useRef<User | null>(null);

  const handleAuth = useCallback((): void => {
    if (userRef.current) {
      userRef.current.listCompositions().then((comps) => {
        setCompositions(comps);
      });
    }
  }, []);

  const handleCreateClick = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    actions.getNextCid((cid: string) => {
      const composition = new CompositionModel(`/composition/${cid}`);
      composition.initialize().then(() => {
        redirect(`/composition/${cid}`);
      });
    });
  }, []);

  useEffect(() => {
    const user = getUser();
    userRef.current = user;
    user.onAuth(handleAuth);
    handleAuth();

    return () => {
      if (userRef.current) {
        userRef.current.offAuth(handleAuth);
      }
    };
  }, [handleAuth]);

  const linkToComposition = useCallback(
    (cid: string, {title, author}: {title: string; author: string}): JSX.Element => {
      return (
        <span key={cid}>
          <a href={`/composition/${cid}/`}>{cid}</a>: {title} by {author}
        </span>
      );
    },
    []
  );

  return (
    <Stack direction="column" className="compositions">
      <Nav v2 composeEnabled />
      <Helmet>
        <title>Cross with Friends: Compose</title>
      </Helmet>
      <Box sx={{flexShrink: 0, display: 'flex', justifyContent: 'center'}}>
        Limit: {limit}
        &nbsp;
        <button
          onClick={() => {
            setLimit(limit + 10);
          }}
        >
          +
        </button>
        &nbsp;
        <button
          onClick={() => {
            setLimit(limit + 50);
          }}
        >
          ++
        </button>
      </Box>
      <Stack
        direction="column"
        sx={{
          paddingLeft: 3.75,
          paddingTop: 2.5,
          paddingBottom: 2.5,
        }}
      >
        <h3>Compositions</h3>
        <Stack direction="column">
          {_.keys(compositions).length === 0 && 'Nothing found'}
          {_.keys(compositions).map((cid) => (
            <div key={cid}>{linkToComposition(cid, compositions[cid])}</div>
          ))}
        </Stack>
        <br />
        <div>
          <button onClick={handleCreateClick}>New</button>
        </div>
      </Stack>
    </Stack>
  );
};

export default Compose;
