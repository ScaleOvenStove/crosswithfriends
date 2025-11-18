import React from 'react';
import {usePrevious} from 'react-use';

const RerenderBoundary: React.FC<{name: string; hash: string}> = (props) => {
  const prevChildren = React.useRef<React.ReactNode>(props.children);
  const prevHash = usePrevious(props.hash);
  const [children, setChildren] = React.useState<React.ReactNode>(props.children);

  React.useEffect(() => {
    if (prevHash !== props.hash) {
      prevChildren.current = props.children;
      setChildren(props.children);
    }
  }, [prevHash, props.hash, props.children]);

  return children;
};

export default RerenderBoundary;
