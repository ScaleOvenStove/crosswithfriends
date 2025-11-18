import './css/Popup.css';
import React, {useState, useRef, useEffect, ReactNode, useCallback} from 'react';

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
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((): void => {
    setActive((prev) => !prev);
  }, []);

  const handleBlur = useCallback((): void => {
    setActive(false);
    onBlur();
  }, [onBlur]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Position popup to stay on screen
  useEffect(() => {
    if (active && buttonRef.current && contentRef.current) {
      // Use requestAnimationFrame to ensure content is rendered before measuring
      requestAnimationFrame(() => {
        if (!buttonRef.current || !contentRef.current) return;

        const buttonRect = buttonRef.current.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Reset positioning
        contentRef.current.style.right = '';
        contentRef.current.style.left = '';
        contentRef.current.style.top = '';
        contentRef.current.style.bottom = '';
        contentRef.current.style.transform = '';

        // Position below button by default
        const top = buttonRect.bottom + 4;
        contentRef.current.style.top = `${top}px`;

        // Check if popup would go off right edge
        const rightEdge = buttonRect.right;
        const contentWidth = contentRect.width || 400; // fallback width
        if (rightEdge > viewportWidth - contentWidth - 8) {
          // Position from right edge
          contentRef.current.style.right = '8px';
          contentRef.current.style.left = 'auto';
        } else {
          // Position from left edge of button
          contentRef.current.style.left = `${buttonRect.left}px`;
          contentRef.current.style.right = 'auto';
        }

        // Check if popup would go off bottom edge
        const estimatedHeight = contentRect.height || 400; // fallback height
        if (top + estimatedHeight > viewportHeight - 8) {
          // Position above button instead
          const bottom = viewportHeight - buttonRect.top + 4;
          contentRef.current.style.top = 'auto';
          contentRef.current.style.bottom = `${bottom}px`;
        }
      });
    }
  }, [active]);

  return (
    <div ref={popupRef} className={`${active ? 'active ' : ''}popup-menu`} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        tabIndex={-1}
        className={`popup-menu--button fa ${icon ? icon : ''}`}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {label ? label : ''}
      </button>
      <div ref={contentRef} className="popup-menu--content">
        {children}
      </div>
    </div>
  );
};

export default Popup;
