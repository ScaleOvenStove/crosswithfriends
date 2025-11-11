import React from 'react';
import {Box} from '@mui/material';

const MobileNav: React.FC = () => {
  const style: React.CSSProperties = {
    position: 'absolute',
    top: '0',
    left: '0',
  };
  return <Box sx={style} />;
};

export default MobileNav;
