import React from 'react';
import * as emojiLib from '@crosswithfriends/shared/lib/emoji';

interface Props {
  emoji: string;
  big?: boolean;
  className?: string;
}

const Emoji: React.FC<Props> = ({emoji, big, className}) => {
  const data = emojiLib.get(emoji);
  if (!data) return null;

  const size = big ? 60 : 22;
  const imgStyle: React.CSSProperties = {
    verticalAlign: 'middle',
    border: 0,
    top: 0,
    left: 0,
    height: size,
    // position: 'absolute',
  };
  const spanStyle: React.CSSProperties = {
    position: 'relative',
    height: size,
    fontSize: `${(size / 22) * 100}%`,
    display: 'inline-block',
    textAlign: 'center',
  };
  if (data.url) {
    return (
      <span title={emoji} style={spanStyle} className={className}>
        <img style={imgStyle} src={data.url} alt={emoji} />
      </span>
    );
  }

  // otherwise, expect a web-friendly str
  return (
    <span style={spanStyle} title={emoji} className={className}>
      {data}
    </span>
  );
};

export default Emoji;
