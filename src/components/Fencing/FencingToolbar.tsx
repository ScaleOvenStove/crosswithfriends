import React, {useCallback} from 'react';
import {ToolbarActions} from './useToolbarActions';

export const FencingToolbar: React.FC<{toolbarActions: ToolbarActions}> = (props) => {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      props.toolbarActions.revealCell();
    },
    [props.toolbarActions]
  );

  return (
    <div>
      <button onMouseDown={handleMouseDown}>Reveal Cell</button>
    </div>
  );
};
