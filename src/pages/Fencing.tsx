import React from 'react';
import {useParams} from 'react-router';

import {Fencing} from '../components/Fencing/Fencing';

const FencingWrapper: React.FC = () => {
  const {gid} = useParams<'gid'>();

  return <Fencing gid={gid!} />;
};
export default FencingWrapper;
