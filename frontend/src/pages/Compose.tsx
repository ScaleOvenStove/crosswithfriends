import './css/compose.css';

import {Helmet} from 'react-helmet';
import _ from 'lodash';
import React, {useState, useRef, useEffect, useCallback} from 'react';
import {Box, Stack} from '@mui/material';
import redirect from '@crosswithfriends/shared/lib/redirect';
import actions from '../actions';

import Nav from '../components/common/Nav';
import {useUser} from '../hooks/useUser';
import {useCompositionStore} from '../store';

const Compose: React.FC = () => {
  const [compositions, setCompositions] = useState<Record<string, {title: string; author: string}>>({});
  const [limit, setLimit] = useState<number>(20);

  const user = useUser();
  const compositionStore = useCompositionStore();

  const handleAuth = useCallback((): void => {
    if (user.id) {
      user.listCompositions().then((comps) => {
        setCompositions(comps);
      });
    }
  }, [user]);

  const handleCreateClick = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    actions.getNextCid(async (cid: string) => {
      const path = `/composition/${cid}`;
      await compositionStore.initialize(path);
      redirect(`/composition/${cid}`);
    });
  }, [compositionStore]);

  useEffect(() => {
    const unsubscribe = user.onAuth(handleAuth);
    handleAuth();

    return () => {
      unsubscribe();
    };
  }, [handleAuth, user]);

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
