import React from 'react';

import type {ToolbarActions} from './useToolbarActions';

export const FencingToolbar: React.FC<{toolbarActions: ToolbarActions}> = (props) => {
  const handleRevealCell = (e: React.MouseEvent) => {
    e.preventDefault();
    props.toolbarActions.revealCell();
  };

  return (
    <div>
      <button onMouseDown={handleRevealCell} type="button">
        Reveal Cell
      </button>
    </div>
  );
};
