import React from 'react';
import {useParams} from 'react-router-dom';

import {Fencing} from '../components/Fencing/Fencing';

const FencingWrapper: React.FC = () => {
  const params = useParams<{gid: string}>();
  const gid = params.gid || '';

  return <Fencing gid={gid} />;
};
export default FencingWrapper;
