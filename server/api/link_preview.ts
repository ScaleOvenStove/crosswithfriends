import type {InfoJson} from '@crosswithfriends/shared/types';
import type {FastifyReply, FastifyRequest} from 'fastify';

import '../types/fastify.js';
import {config} from '../config/index.js';
import type {AppInstance} from '../types/fastify.js';
import {escapeHtml, escapeHtmlAttribute} from '../utils/htmlEscape.js';
import {isFBMessengerCrawler, isLinkExpanderBot} from '../utils/link_preview_util.js';
import {logRequest} from '../utils/sanitizedLogger.js';
import {isString} from '../utils/typeGuards.js';

import {createHttpError} from './errors.js';
import {ErrorResponseSchema} from './schemas.js';

interface LinkPreviewQuery {
  url: string;
}

// Allowed URL schemes - only http/https are allowed for preview URLs
const ALLOWED_SCHEMES = ['http:', 'https:'];

// Check if we're in a non-production environment (development or test)
const isNonProduction = config.server.isDevelopment || config.server.isTest;

// Allowed domains for link preview (configurable via environment)
// In production, this should be restricted to your actual domains
const ALLOWED_DOMAINS = [
  'downforacross.com',
  'www.downforacross.com',
  'foracross.com',
  'www.foracross.com',
  'api.foracross.com',
  'crosswithfriends.com',
  'www.crosswithfriends.com',
  // Allow localhost, local IPs, and example.com in non-production
  ...(isNonProduction ? ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'example.com'] : []),
];

/**
 * Validates a URL for link preview to prevent SSRF attacks
 * @param urlString - The URL string to validate
 * @returns The validated URL object
 * @throws HttpError if validation fails
 */
function validatePreviewUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw createHttpError('Invalid URL format', 400);
  }

  // Validate URL scheme
  if (!ALLOWED_SCHEMES.includes(url.protocol)) {
    throw createHttpError(`Invalid URL scheme: ${url.protocol}. Only http and https are allowed.`, 400);
  }

  // Validate domain
  const hostname = url.hostname.toLowerCase();

  // Check for IP addresses that could be used for SSRF
  // Block private/internal IP ranges in production
  if (!isNonProduction) {
    // Block IPv4 private ranges
    if (
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      hostname === 'localhost' ||
      hostname === '0.0.0.0'
    ) {
      throw createHttpError('URLs pointing to internal networks are not allowed', 400);
    }

    // Block IPv6 private/link-local addresses
    if (
      hostname.startsWith('[') ||
      hostname.includes('::1') ||
      /^fe80:/i.test(hostname) ||
      /^fc00:/i.test(hostname) ||
      /^fd/i.test(hostname)
    ) {
      throw createHttpError('URLs pointing to internal networks are not allowed', 400);
    }
  }

  // Validate against allowed domains
  const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => {
    // Allow exact match or subdomain match
    return (
      hostname === domain ||
      hostname.endsWith('.' + domain) ||
      // For localhost with port, strip the port
      (isNonProduction && hostname.split(':')[0] === domain)
    );
  });

  if (!isAllowedDomain) {
    throw createHttpError(`Domain not allowed for link preview: ${hostname}`, 400);
  }

  return url;
}

// eslint-disable-next-line require-await
async function linkPreviewRouter(fastify: AppInstance): Promise<void> {
  const getOptions = {
    schema: {
      operationId: 'getLinkPreview',
      tags: ['Link Preview'],
      summary: 'Get link preview',
      description: 'Generates Open Graph metadata for social media link previews',
      querystring: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {type: 'string', description: 'URL to generate preview for'},
        },
      },
      response: {
        200: {
          type: 'string',
          description: 'HTML with Open Graph metadata',
        },
        302: {
          type: 'null',
          description: 'Redirect for non-bot user agents',
        },
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  };

  fastify.get<{Querystring: LinkPreviewQuery}>(
    '/',
    getOptions,
    async (request: FastifyRequest<{Querystring: LinkPreviewQuery}>, reply: FastifyReply): Promise<void> => {
      logRequest(request);

      // Validate URL scheme and domain to prevent SSRF
      const url = validatePreviewUrl(request.query.url);

      let info: InfoJson | null = null;
      const pathParts = url.pathname.split('/');
      if (pathParts[1] === 'game') {
        const gid = pathParts[2];
        if (!gid) {
          throw createHttpError('Invalid URL path: missing game ID', 400);
        }
        info = await fastify.repositories.game.getInfo(gid);
      } else if (pathParts[1] === 'play') {
        const pid = pathParts[2];
        if (!pid) {
          throw createHttpError('Invalid URL path: missing puzzle ID', 400);
        }
        info = await fastify.services.puzzle.getPuzzleInfo(pid);
      } else {
        throw createHttpError('Invalid URL path', 400);
      }

      if (!info || Object.keys(info).length === 0) {
        throw createHttpError('Game or puzzle not found', 404);
      }

      const uaHeader = request.headers['user-agent'];
      const ua = isString(uaHeader) ? uaHeader : undefined;

      if (!isLinkExpanderBot(ua)) {
        // In case a human accesses this endpoint
        reply.code(302).header('Location', url.href).send();
        return;
      }

      // OGP doesn't support an author property, so we need to delegate to the oEmbed endpoint
      // Construct oembed URL - default to https (protocol detection not critical for oembed link)
      const host = request.headers.host || '';
      const author = info.author || '';
      // Use https as default - oembed links work with either protocol
      const protocol = 'https';
      const oembedEndpointUrl = `${protocol}://${host}/api/oembed?author=${encodeURIComponent(author)}`;

      // Messenger only supports title + thumbnail, so cram everything into the title property if Messenger
      const titlePropContent = isFBMessengerCrawler(ua)
        ? [info.title, info.author, info.description].filter(Boolean).join(' | ')
        : info.title || '';

      // Escape all user-controlled data to prevent XSS
      const safeTitle = escapeHtml(titlePropContent || '');
      const safeDescription = escapeHtml(info.description || '');
      const safeUrl = escapeHtmlAttribute(url.href || '');
      const safeOembedUrl = escapeHtmlAttribute(oembedEndpointUrl);

      // https://ogp.me
      reply.type('text/html').send(String.raw`
        <html prefix="og: https://ogp.me/ns/website#">
            <head>
                <title>${safeTitle}</title>
                <meta property="og:title" content="${safeTitle}" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${safeUrl}" />
                <meta property="og:description" content="${safeDescription}" />
                <meta property="og:site_name" content="${escapeHtmlAttribute(config.urls.siteName)}" />
                <link type="application/json+oembed" href="${safeOembedUrl}" />
                <meta name="theme-color" content="#6aa9f4">
            </head>
        </html>
    `);
    }
  );
}

export default linkPreviewRouter;
