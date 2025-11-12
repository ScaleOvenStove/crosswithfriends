import './css/ActionMenu.css';
import React, {useState, useRef, useEffect, useCallback} from 'react';

/**
 * A dropdown action menu component that displays a list of actions.
 * Closes when clicking outside the menu or when an action is selected.
 *
 * @example
 * ```tsx
 * <ActionMenu
 *   label="Actions"
 *   actions={{ "Save": handleSave, "Delete": handleDelete }}
 *   onBlur={handleBlur}
 * />
 * ```
 */
interface Props {
  label: string;
  actions: Record<string, () => void>;
  onBlur: () => void;
}

const ActionMenu: React.FC<Props> = ({label, actions, onBlur}) => {
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: PointerEvent): void => {
    if (containerRef.current && containerRef.current.contains(e.target as Node)) {
      // Don't close menu if clicking inside
      return;
    }
    setActive(false);
  }, []);

  useEffect(() => {
    if (active) {
      window.addEventListener('pointerdown', handlePointerDown);
    } else {
      window.removeEventListener('pointerdown', handlePointerDown);
    }
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [active, handlePointerDown]);

  const handleClick = useCallback((): void => {
    setActive((prev) => !prev);
  }, []);

  const handleBlur = useCallback((): void => {
    setActive(false);
    onBlur();
  }, [onBlur]);

  const handleAction = useCallback(
    (key: string) => {
      actions[key]();
      handleBlur();
    },
    [actions, handleBlur]
  );

  return (
    <div ref={containerRef} className={`${active ? 'active ' : ''}action-menu`}>
      <button
        tabIndex={-1}
        className="action-menu--button"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={handleClick}
      >
        {label}
      </button>
      <div className="action-menu--list">
        {Object.keys(actions).map((key, i) => (
          <div
            key={i}
            className="action-menu--list--action"
            tabIndex={-1}
            onPointerDown={(ev) => {
              ev.stopPropagation();
            }}
            onMouseDown={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              handleAction(key);
            }}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              handleAction(key);
            }}
            onTouchStart={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              handleAction(key);
            }}
          >
            <span> {key} </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionMenu;
