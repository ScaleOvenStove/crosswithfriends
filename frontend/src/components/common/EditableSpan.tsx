import './css/editableSpan.css';
import Caret from '@crosswithfriends/shared/lib/caret';
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';

type DebouncedFunc<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number = 0): DebouncedFunc<T> => {
  let timeout: NodeJS.Timeout;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
};

interface Props {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onUnfocus?: () => void;
  hidden?: boolean;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  className?: string;
  keyProp?: string;
}

export type EditableSpanRef = {
  focus: () => void;
};

const EditableSpan = forwardRef<EditableSpanRef, Props>((props, ref) => {
  const spanRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const prevKeyRef = useRef<string | undefined>(props.keyProp);
  const caretStartRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (spanRef.current) {
        spanRef.current.focus();
      }
    },
  }));

  const {value: propValue, hidden, onChange, onBlur, onUnfocus, keyProp} = props;

  const displayValue = useMemo(() => {
    const value = propValue ?? '(blank)';
    let result = value;
    const nbsp = String.fromCharCode(160);
    while (result.indexOf(' ') !== -1) {
      result = result.replace(' ', nbsp);
    }
    return result;
  }, [propValue]);

  const getText = useCallback((): string => {
    if (hidden) return '';
    if (!spanRef.current) return '';
    let result = spanRef.current.textContent || '';
    const nbsp = String.fromCharCode(160);
    while (result.indexOf(nbsp) !== -1) {
      result = result.replace(nbsp, ' ');
    }
    while (result.startsWith(' ')) result = result.substring(1);
    return result;
  }, [hidden]);

  const setText = useCallback(
    (val: string) => {
      if (hidden) return;
      if (getText() === val) return;
      // set text while retaining cursor position
      if (spanRef.current) {
        spanRef.current.innerHTML = val;
      }
    },
    [hidden, getText]
  );

  useEffect(() => {
    setText(displayValue);
  }, [displayValue, setText]);

  useEffect(() => {
    if (prevKeyRef.current !== keyProp || !focused) {
      setText(displayValue);
      if (spanRef.current && focused) {
        const firstChild = spanRef.current.childNodes[0];
        if (firstChild) {
          const currentCaret = new Caret(firstChild as Node);
          if (caretStartRef.current !== currentCaret.startPosition) {
            currentCaret.startPosition = caretStartRef.current;
          }
        }
      }
    }
    prevKeyRef.current = keyProp;
  }, [keyProp, displayValue, focused, setText]);

  const handleFocus = useCallback((): void => {
    setFocused(true);
    if (spanRef.current) {
      const firstChild = spanRef.current.childNodes[0];
      if (firstChild) {
        const currentCaret = new Caret(firstChild as Node);
        caretStartRef.current = currentCaret.startPosition;
      }
    }
  }, []);

  const handleBlur = useCallback((): void => {
    setFocused(false);
    if (onBlur) {
      onBlur();
    }
  }, [onBlur]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Tab') {
        return;
      }
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === 'Escape') {
        onChange(getText());
        e.preventDefault();
        setTimeout(() => {
          if (onUnfocus) {
            onUnfocus();
          }
        }, 100);
      }
    },
    [onChange, onUnfocus, getText]
  );

  const debouncedHandleKeyUpRef = useRef<DebouncedFunc<() => void>>();

  useEffect(() => {
    debouncedHandleKeyUpRef.current = debounce(() => {
      if (hidden || !spanRef.current) return;
      let result = spanRef.current.textContent || '';
      const nbsp = String.fromCharCode(160);
      while (result.indexOf(nbsp) !== -1) {
        result = result.replace(nbsp, ' ');
      }
      while (result.startsWith(' ')) result = result.substring(1);
      onChange(result);
    }, 500);

    return () => {
      debouncedHandleKeyUpRef.current?.cancel();
    };
  }, [onChange, hidden]);

  const handleKeyUp = useCallback(() => {
    debouncedHandleKeyUpRef.current?.();
  }, []);

  const {style, containerStyle, className} = props;
  if (hidden) return null;

  return (
    <div
      style={{
        display: 'inline-block',
        border: '1px solid #DDDDDD',
        position: 'relative',
        ...containerStyle,
      }}
    >
      <div
        style={style}
        className={`editable-span ${className || ''}`}
        ref={spanRef}
        contentEditable
        role="textbox"
        aria-label="Editable text"
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      />
    </div>
  );
});

EditableSpan.displayName = 'EditableSpan';

export default EditableSpan;
