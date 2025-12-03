/**
 * Simple linkify utility to replace react-linkify
 * Automatically converts URLs in text to clickable links
 */

import React from 'react';

interface LinkifyProps {
  children?: React.ReactNode;
  componentDecorator?: (decoratedHref: string, decoratedText: string, key: number) => React.ReactNode;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export const Linkify: React.FC<LinkifyProps> = ({children, componentDecorator}) => {
  if (typeof children !== 'string') {
    return children ?? null;
  }

  const text = children;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const matches = Array.from(text.matchAll(URL_REGEX));

  if (matches.length === 0) {
    return text;
  }

  for (const match of matches) {
    const url = match[0];
    const index = match.index!;

    // Add text before the URL
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // Add the link
    if (componentDecorator) {
      const currentKey = key;
      key += 1;
      parts.push(componentDecorator(url, url, currentKey));
    } else {
      const currentKey = key;
      key += 1;
      parts.push(
        <a key={currentKey} href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      );
    }

    lastIndex = index + url.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

export default Linkify;
