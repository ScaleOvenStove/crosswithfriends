import {isLinkExpanderBot} from './server/utils/link_preview_util';

/**
 * Link Preview API URL
 * This URL is used for redirecting link expander bots to the link preview endpoint.
 * Configure via LINK_PREVIEW_API_URL environment variable if deploying to different hosts.
 * Note: Vercel Edge Middleware has limited environment variable access, so this is
 * typically set at build time or via Vercel environment configuration.
 */
const LINK_PREVIEW_API_URL =
  process.env.LINK_PREVIEW_API_URL || 'https://downforacross-com.onrender.com/api/link_preview';

function isAsset(url: URL): boolean {
  return /\.(png|jpe?g|gif|css|js|svg|ico|map|json)$/i.test(url.pathname);
}

function isPlayUrl(url: URL): boolean {
  const split = url.pathname.split('/');
  return split.length >= 3 && split[2] === 'play';
}

function isGameUrl(url: URL): boolean {
  const split = url.pathname.split('/');
  return split.length >= 3 && split[2] === 'game';
}

export default function middleware(req: Request): Response {
  const url = new URL(req.url);

  if (
    isAsset(url) ||
    (!isPlayUrl(url) && !isGameUrl(url)) ||
    !isLinkExpanderBot(req.headers.get('user-agent') as string)
  ) {
    return new Response(null, {
      headers: {'x-middleware-next': '1'},
    });
  }

  console.log('crawler detected', req.headers.get('user-agent'));
  console.log(`returning link preview from ${LINK_PREVIEW_API_URL}?url=${url}`);
  // crawled by link expander bot, so redirect to link preview endpoint for this game URL
  return new Response(null, {
    status: 307,
    headers: {
      Location: `${LINK_PREVIEW_API_URL}?url=${url}`,
    },
  });
}
