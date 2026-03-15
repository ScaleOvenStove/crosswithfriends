import type {Request, Response, NextFunction} from 'express';
import path from 'path';
import fs from 'fs';
import {getGameInfo} from '../model/game';
import {getPuzzleInfo} from '../model/puzzle';
import {islinkExpanderBot, isFBMessengerCrawler} from '../../utils/link_preview_util';
import {InfoJson} from '../../src/shared/types';

/** Regex matching game/puzzle paths that should get dynamic OG tags */
const GAME_PATH_RE = /^\/(?:beta\/)?game\/([^/]+)$/;
const PLAY_PATH_RE = /^\/beta\/play\/([^/]+)$/;

/** Base URL for canonical URLs and OG image references. Falls back to production. */
const BASE_URL = process.env.FRONTEND_URL || 'https://crosswithfriends.com';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildOgHtml(info: InfoJson, canonicalUrl: string, ua: string): string {
  const title = escapeHtml(info.title || 'Cross with Friends');
  const author = info.author ? escapeHtml(info.author) : '';
  let description = 'Solve crossword puzzles together with friends in real time.';
  if (info.description) {
    description = escapeHtml(info.description);
  } else if (author) {
    description = `A crossword puzzle by ${author}`;
  }

  // Messenger only supports title + thumbnail, so combine fields
  const titleContent = isFBMessengerCrawler(ua)
    ? [info.title, info.author, info.description].filter(Boolean).map(escapeHtml).join(' | ')
    : title;

  const oembedUrl = author ? `${BASE_URL}/api/oembed?author=${encodeURIComponent(info.author)}` : '';
  const imageUrl = `${BASE_URL}/pwa-512x512.png`;

  return `<!doctype html>
<html prefix="og: https://ogp.me/ns/website#">
  <head>
    <title>${titleContent}</title>
    <meta property="og:title" content="${titleContent}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:site_name" content="Cross with Friends" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${titleContent}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="theme-color" content="#6aa9f4" />
    ${oembedUrl ? `<link type="application/json+oembed" href="${escapeHtml(oembedUrl)}" />` : ''}
  </head>
  <body></body>
</html>`;
}

/**
 * Cache for the SPA index.html content.
 * When Render rewrites game/puzzle paths to the backend, non-bot requests
 * need to receive the SPA shell so the React app boots normally.
 *
 * Tries local files first (for SERVE_STATIC / dev), then fetches from FRONTEND_URL.
 */
let spaHtmlCache: string | null = null;

function loadLocalSpaHtml(): string | null {
  const buildIndex = path.join(__dirname, '..', '..', 'build', 'index.html');
  if (fs.existsSync(buildIndex)) {
    return fs.readFileSync(buildIndex, 'utf-8');
  }
  const srcIndex = path.join(__dirname, '..', '..', 'index.html');
  if (fs.existsSync(srcIndex)) {
    return fs.readFileSync(srcIndex, 'utf-8');
  }
  return null;
}

async function getSpaHtml(): Promise<string | null> {
  if (spaHtmlCache) return spaHtmlCache;

  // Try local files first
  const local = loadLocalSpaHtml();
  if (local) {
    spaHtmlCache = local;
    return spaHtmlCache;
  }

  // Fetch from the frontend origin (Render static site)
  if (BASE_URL) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        spaHtmlCache = await res.text();
        return spaHtmlCache;
      }
    } catch (err) {
      console.error('[OG Tags] Failed to fetch SPA HTML from', BASE_URL, err);
    }
  }

  return null;
}

/**
 * Middleware that intercepts game/puzzle URLs.
 * - Link-expanding bots get HTML with dynamic OG meta tags.
 * - Regular browsers get the SPA index.html so the React app boots normally.
 *   (Only relevant when Render rewrites route these paths to the backend.)
 */
export function ogTagsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const gameMatch = req.path.match(GAME_PATH_RE);
  const playMatch = req.path.match(PLAY_PATH_RE);

  if (!gameMatch && !playMatch) {
    next();
    return;
  }

  const ua = req.headers['user-agent'] || '';

  // Bot request — serve dynamic OG tags
  if (islinkExpanderBot(ua)) {
    if (gameMatch) {
      handleGameOg(gameMatch[1], res, ua);
      return;
    }
    if (playMatch) {
      handlePuzzleOg(playMatch[1], res, ua);
      return;
    }
  }

  // Non-bot request — serve the SPA shell if available (for Render rewrite setup)
  // When SERVE_STATIC is set, Express static middleware handles this instead, so skip.
  if (!process.env.SERVE_STATIC) {
    getSpaHtml().then((html) => {
      if (html) {
        res.send(html);
      } else {
        next();
      }
    });
    return;
  }

  next();
}

async function handleGameOg(gid: string, res: Response, ua: string) {
  try {
    const info = (await getGameInfo(gid)) as InfoJson;
    if (!info) {
      res.status(404).send('Game not found');
      return;
    }
    const canonicalUrl = `${BASE_URL}/game/${gid}`;
    res.send(buildOgHtml(info, canonicalUrl, ua));
  } catch (err) {
    console.error(`[OG Tags] Error fetching game info for ${gid}:`, err);
    res.status(500).send('Error');
  }
}

async function handlePuzzleOg(pid: string, res: Response, ua: string) {
  try {
    const info = (await getPuzzleInfo(pid)) as InfoJson | null;
    if (!info) {
      res.status(404).send('Puzzle not found');
      return;
    }
    const canonicalUrl = `${BASE_URL}/beta/play/${pid}`;
    res.send(buildOgHtml(info, canonicalUrl, ua));
  } catch (err) {
    console.error(`[OG Tags] Error fetching puzzle info for ${pid}:`, err);
    res.status(500).send('Error');
  }
}
