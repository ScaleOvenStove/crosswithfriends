import {parseRawUrls} from '../common';

// Hand-picked emoji from various external hosts. URLs here are
// inherently fragile (search-thumb proxies, image hosts that die,
// http URLs that hit mixed-content blocks on https pages); the safest
// long-term move for any new entry is to self-host the asset under
// public/emojis/. Dropped entries that 404'd or pointed at non-image
// pages: rilakkuma (http stickpng → mixed-content),
// rilakkuma_and_friends (Google proxy 403),
// pawn / bishop (Google search-results / nounproject term pages),
// queen (Google search-thumb proxy, rotates), and steven / dark_moon
// (tinypic.com is dead).
export default parseRawUrls({
  rilakkuma1: 'https://i.pinimg.com/originals/1b/c3/3b/1bc33bdfd0ec831221b6ba454419001c.png',
  knight: 'https://static.thenounproject.com/png/337860-200.png',
  rook: 'https://static.thenounproject.com/png/1553132-200.png',
  king: 'https://image.spreadshirtmedia.com/image-server/v1/mp/designs/12774644,width=178,height=178/king-chess-pieces-king.png',
  surprised_pikachu: 'https://emojis.slackmojis.com/emojis/images/1541014354/4885/surprised_pikachu.jpg',
});
