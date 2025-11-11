/* eslint react/no-unescaped-entities: "warn" */
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';

import {Box, Stack} from '@mui/material';
import _ from 'lodash';
import Emoji from '../common/Emoji';

const Kbd = ({children}: {children: React.ReactNode}) => <kbd>{children}</kbd>;

interface EmojiPickerProps {
  pattern?: string;
  matches: string[];
  disableKeyListener?: boolean;
  onConfirm: (emoji: string | null) => void;
  onEscape: () => void;
  onSelectEmoji?: (emoji: string) => void;
}

export interface EmojiPickerRef {
  handleKeyDown: (e: KeyboardEvent) => void;
}

const EmojiPicker = forwardRef<EmojiPickerRef, EmojiPickerProps>(
  ({pattern, matches, disableKeyListener, onConfirm, onEscape, onSelectEmoji}, ref) => {
    const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
    const emojiRefs = useRef<Record<string, React.RefObject<HTMLSpanElement>>>({});
    const listContainer = useRef<HTMLDivElement>(null);

    // Replicate getDerivedStateFromProps logic
    useEffect(() => {
      if (!selectedEmoji || matches.indexOf(selectedEmoji) === -1) {
        setSelectedEmoji(matches[0] || null);
      }
    }, [matches, selectedEmoji]);

    useImperativeHandle(ref, () => ({
      handleKeyDown: (e: KeyboardEvent) => {
        handleKeyDown(e as any);
      },
    }));

    const getDomPosition = useCallback((emoji: string) => {
      const ref = emojiRefs.current[emoji];
      if (!ref || !ref.current) return null;
      const el = ref.current;
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        cx: rect.x + rect.width / 2,
        cy: rect.y + rect.height / 2,
      };
    }, []);

    const scrollEmojiIntoView = useCallback((emoji: string) => {
      // HACK: hardcoding container's padding here
      const padding = 5;
      const ref = emojiRefs.current[emoji];
      if (!ref?.current || !listContainer.current) return;
      const span = ref.current;
      const top = span.offsetTop;
      const bottom = top + span.offsetHeight;
      const container = listContainer.current;
      const containerHeight = container.getBoundingClientRect().height - 2 * padding;
      const scrollTop = container.scrollTop;
      const scrollBottom = container.scrollTop + containerHeight;

      if (scrollTop > top) {
        container.scrollTop = top - padding;
      } else if (scrollBottom < bottom) {
        container.scrollTop = bottom - containerHeight + padding;
      }
    }, []);

    const selectEmoji = useCallback(
      (emoji: string) => {
        setSelectedEmoji(emoji);
        if (onSelectEmoji) {
          onSelectEmoji(emoji);
        }
      },
      [onSelectEmoji]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        onConfirm(selectedEmoji);
        e.preventDefault();
        e.stopPropagation();
      },
      [onConfirm, selectedEmoji]
    );

    const handleMouseEnterSpan = useCallback(
      (e: React.MouseEvent) => {
        const emoji = (e.target as HTMLElement).getAttribute('data-emoji');
        if (emoji) {
          selectEmoji(emoji);
        }
      },
      [selectEmoji]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent | React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          onEscape();
          return;
        }
        if (!selectedEmoji || !matches.length) return;
        const key = e.key;
        const shiftKey = e.shiftKey;

        const next = () => {
          const offset = shiftKey ? matches.length - 1 : 1;
          const idx = matches.indexOf(selectedEmoji);
          const nextEmoji = matches[(idx + offset) % matches.length];
          selectEmoji(nextEmoji);
          scrollEmojiIntoView(nextEmoji);
        };

        // sx, sy should be -1, 0, or 1
        const move = (sx: number, sy: number) => () => {
          const pos = getDomPosition(selectedEmoji);
          if (!pos) return;
          const {cx, cy} = pos;
          // beware, this code is a bit hacky :)
          const bestMatch = _.orderBy(
            matches
              .filter((emoji) => emoji !== selectedEmoji)
              .map((emoji) => {
                const p = getDomPosition(emoji);
                if (!p) return null;
                let dx = p.cx - cx;
                let dy = p.cy - cy;
                let pagex = 0;
                let pagey = 0;
                if (sx) {
                  dy = Math.abs(dy);
                  dx *= sx;
                  if (dx <= 0) pagex = 1;
                } else if (sy) {
                  dy *= sy;
                  if (dy <= 0) pagey = 1;
                  // check if it's contained within
                  if (p.left <= cx && cx <= p.right) {
                    dx = 0;
                  } else if (dx < 0) {
                    // hack: prefer left when moving up/down
                    dx = -dx * 0.5;
                  }
                }
                return {
                  emoji,
                  pagey,
                  dy,
                  pagex,
                  dx,
                };
              })
              .filter((item): item is NonNullable<typeof item> => item !== null),
            ['pagey', 'dy', 'pagex', 'dx']
          )[0];
          if (bestMatch) {
            selectEmoji(bestMatch.emoji);
            scrollEmojiIntoView(bestMatch.emoji);
          }
        };

        const confirm = () => {
          onConfirm(selectedEmoji);
        };

        const actions: Record<string, (shiftKey?: boolean) => void> = {
          Tab: next,
          ArrowLeft: move(-1, 0),
          ArrowRight: move(1, 0),
          ArrowUp: move(0, -1),
          ArrowDown: move(0, 1),
          Enter: confirm,
        };

        if (actions[key]) {
          actions[key](shiftKey);
          e.preventDefault();
          e.stopPropagation();
        }
      },
      [selectedEmoji, matches, onEscape, onConfirm, selectEmoji, scrollEmojiIntoView, getDomPosition]
    );

    useEffect(() => {
      if (disableKeyListener) return;
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [disableKeyListener, handleKeyDown]);

    const renderHeader = () => {
      const headerStyle = {
        justifyContent: 'space-between',
        backgroundColor: 'beige',
        borderBottom: '1px solid #333333',
        padding: 5,
        fontSize: '50%',
      };
      const patternStyle = {fontWeight: 'bold'};
      const hintStyle = {marginLeft: 20};
      return (
        <Box sx={headerStyle}>
          <span>
            <span style={patternStyle}>"{`:${pattern}`}"</span>
          </span>
          <span>
            <span style={hintStyle}>
              <Kbd>tab</Kbd> or
              <Kbd>↑↓</Kbd> to navigate
            </span>
            <span style={hintStyle}>
              <Kbd>↩</Kbd> to select
            </span>
            <span style={hintStyle}>
              <Kbd>esc</Kbd> to dismiss
            </span>
          </span>
        </Box>
      );
    };

    const renderEmoji = useCallback(
      (emoji: string) => {
        const isSelected = selectedEmoji === emoji;
        const style = {
          backgroundColor: isSelected ? '#6AA9F4' : 'white',
          color: isSelected ? 'white' : 'inherit',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 13,
          marginRight: 20,
        };

        const textStyle = {
          fontSize: '70%',
          marginLeft: 5,
        };

        if (!emojiRefs.current[emoji]) {
          emojiRefs.current[emoji] = React.createRef<HTMLSpanElement>();
        }
        return (
          <span
            style={style}
            ref={emojiRefs.current[emoji]}
            key={emoji}
            data-emoji={emoji}
            onMouseMove={handleMouseEnterSpan}
          >
            <Emoji emoji={emoji} />
            <span style={textStyle}>{`:${emoji}:`}</span>
          </span>
        );
      },
      [selectedEmoji, handleMouseEnterSpan]
    );

    const renderMatches = () => {
      const containerStyle = {
        display: 'flex', // we don't use flex-view so that we can access the dom el
        flexWrap: 'wrap',
        padding: 5,
        overflow: 'scroll',
        maxHeight: 200,
        position: 'relative',
      };
      return (
        <div style={containerStyle} ref={listContainer}>
          {matches.map((emoji) => renderEmoji(emoji))}
        </div>
      );
    };

    return (
      <Stack
        direction="column"
        sx={{backgroundColor: 'white', color: 'var(--main-gray-1)'}}
        onMouseDown={handleMouseDown}
      >
        {renderHeader()}
        {renderMatches()}
      </Stack>
    );
  }
);

EmojiPicker.displayName = 'EmojiPicker';

export default EmojiPicker;
