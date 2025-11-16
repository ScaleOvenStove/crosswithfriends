import {Box} from '@mui/material';
import React from 'react';

const MobileNav: React.FC = () => {
  const style: React.CSSProperties = {
    position: 'absolute',
    top: '0',
    left: '0',
  };
  return <Box sx={style} />;
};

export default MobileNav;
