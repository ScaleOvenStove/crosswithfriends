import './css/Popup.css';
import React, {useState, ReactNode} from 'react';

/**
 * A popup menu component that displays a button and toggles visibility of its children.
 *
 * @example
 * ```tsx
 * <Popup icon="fa-cog" label="Settings" onBlur={handleBlur}>
 *   <MenuItems />
 * </Popup>
 * ```
 */
interface Props {
  icon?: string;
  label?: string;
  onBlur: () => void;
  children?: ReactNode;
}

const Popup: React.FC<Props> = ({icon, label, onBlur, children}) => {
  const [active, setActive] = useState(false);

  const handleClick = (): void => {
    setActive((prev) => !prev);
  };

  const handleBlur = (): void => {
    setActive(false);
    onBlur();
  };

  return (
    <div className={`${active ? 'active ' : ''}popup-menu`} onBlur={handleBlur}>
      <button
        tabIndex={-1}
        className={`popup-menu--button fa ${icon ? icon : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={handleClick}
      >
        {label ? label : ''}
      </button>
      <div className="popup-menu--content">{children}</div>
    </div>
  );
};

export default Popup;
