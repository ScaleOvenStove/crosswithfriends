import './css/editableSpan.css';
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';
import _ from 'lodash';
import Caret from '@crosswithfriends/shared/lib/caret';

interface Props {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onUnfocus?: () => void;
  hidden?: boolean;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  className?: string;
  key_?: string;
}

export interface EditableSpanRef {
  focus: () => void;
}

const EditableSpan = forwardRef<EditableSpanRef, Props>((props, ref) => {
  const spanRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const prevKeyRef = useRef<string | undefined>(props.key_);
  const caretStartRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (spanRef.current) {
        spanRef.current.focus();
      }
    },
  }));

  const displayValue = useMemo(() => {
    const {value = '(blank)'} = props;
    let result = value;
    const nbsp = String.fromCharCode(160);
    while (result.indexOf(' ') !== -1) {
      result = result.replace(' ', nbsp);
    }
    return result;
  }, [props.value]);

  const getText = useCallback((): string => {
    if (props.hidden) return '';
    if (!spanRef.current) return '';
    let result = spanRef.current.textContent || '';
    const nbsp = String.fromCharCode(160);
    while (result.indexOf(nbsp) !== -1) {
      result = result.replace(nbsp, ' ');
    }
    while (result.startsWith(' ')) result = result.substring(1);
    return result;
  }, [props.hidden]);

  const setText = useCallback(
    (val: string) => {
      if (props.hidden) return;
      if (getText() === val) return;
      // set text while retaining cursor position
      if (spanRef.current) {
        spanRef.current.innerHTML = val;
      }
    },
    [props.hidden, getText]
  );

  useEffect(() => {
    setText(displayValue);
  }, [displayValue, setText]);

  useEffect(() => {
    if (prevKeyRef.current !== props.key_ || !focused) {
      setText(displayValue);
      if (spanRef.current && focused) {
        const currentCaret = new Caret(spanRef.current.childNodes[0] as any);
        if (caretStartRef.current !== currentCaret.startPosition) {
          currentCaret.startPosition = caretStartRef.current;
        }
      }
    }
    prevKeyRef.current = props.key_;
  }, [props.key_, displayValue, focused, setText]);

  const handleFocus = useCallback((): void => {
    setFocused(true);
    if (spanRef.current) {
      const currentCaret = new Caret(spanRef.current.childNodes[0] as any);
      caretStartRef.current = currentCaret.startPosition;
    }
  }, []);

  const handleBlur = useCallback((): void => {
    setFocused(false);
    if (props.onBlur) {
      props.onBlur();
    }
  }, [props.onBlur]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Tab') {
        return;
      }
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === 'Escape') {
        props.onChange(getText());
        e.preventDefault();
        setTimeout(() => {
          if (props.onUnfocus) {
            props.onUnfocus();
          }
        }, 100);
      }
    },
    [props.onChange, props.onUnfocus, getText]
  );

  const handleKeyUp = useCallback(
    _.debounce(() => {
      props.onChange(getText());
    }, 500),
    [props.onChange, getText]
  );

  const {hidden, style, containerStyle, className} = props;
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
