import _ from 'lodash';
import defaultPack from './emojiPacks/default';
import custom from './emojiPacks/custom';
import partyParrot from './emojiPacks/partyParrot';
import yoyo from './emojiPacks/yoyo';

// spread in reverse-order of priority, in case of name collisions.
// The pricklyPear pack was dropped — every URL pointed at the legacy
// downforacross S3 bucket which is no longer reachable, so every
// emoji in the pack rendered as a broken-image placeholder. See
// issue #538 for re-sourcing the pack from the original Facebook
// Messenger sticker set.
const allEmojiData = {
  ...defaultPack,
  ...partyParrot,
  ...yoyo,
  ...custom,
};
const allEmojis = _.keys(allEmojiData);
const getScore = (emoji, pattern) => {
  if (emoji === pattern) return 60;
  if (emoji.startsWith(pattern)) return 50;
  const idx = emoji.indexOf(pattern);
  if (idx !== -1) {
    const prevChar = emoji[idx - 1];
    if (prevChar === '_') return 40;
    if (prevChar === '-') return 30;
    return 10;
  }
  return 0;
};

export const findMatches = (pattern) =>
  _.orderBy(
    allEmojis
      .map((emoji, i) => ({
        emoji,
        score: getScore(emoji, pattern),
        index: i,
      }))
      .filter(({score}) => score > 0),
    ['score', 'index'],
    ['desc', 'desc']
  ).map(({emoji}) => emoji);

export const get = (emoji) => allEmojiData[emoji];
