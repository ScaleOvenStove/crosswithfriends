import type {InfoJson} from '@crosswithfriends/shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {getGameInfo} from '../model/game.js';
import {getPuzzleInfo} from '../model/puzzle.js';
import {isFBMessengerCrawler, isLinkExpanderBot} from '../utils/link_preview_util.js';

import {createHttpError} from './errors.js';
import {ErrorResponseSchema} from './schemas.js';

interface LinkPreviewQuery {
  url: string;
}

// eslint-disable-next-line require-await
async function linkPreviewRouter(fastify: FastifyInstance): Promise<void> {
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
    async (request: FastifyRequest<{Querystring: LinkPreviewQuery}>, reply: FastifyReply) => {
      request.log.debug({headers: request.headers, query: request.query}, 'got req');

      let url: URL;
      try {
        url = new URL(request.query.url);
      } catch {
        throw createHttpError('Invalid URL', 400);
      }

      let info: InfoJson | null = null;
      const pathParts = url.pathname.split('/');
      if (pathParts[1] === 'game') {
        const gid = pathParts[2];
        if (!gid) {
          throw createHttpError('Invalid URL path: missing game ID', 400);
        }
        info = (await getGameInfo(gid)) as InfoJson;
      } else if (pathParts[1] === 'play') {
        const pid = pathParts[2];
        if (!pid) {
          throw createHttpError('Invalid URL path: missing puzzle ID', 400);
        }
        info = (await getPuzzleInfo(pid)) as InfoJson;
      } else {
        throw createHttpError('Invalid URL path', 400);
      }

      if (!info || Object.keys(info).length === 0) {
        throw createHttpError('Game or puzzle not found', 404);
      }

      const ua = request.headers['user-agent'] as string | undefined;

      if (!isLinkExpanderBot(ua)) {
        // In case a human accesses this endpoint
        return reply.code(302).header('Location', url.href).send();
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

      // Ensure all template variables are safe
      const safeTitle = titlePropContent || '';
      const safeDescription = info.description || '';
      const safeUrl = url.href || '';

      // https://ogp.me
      return reply.type('text/html').send(String.raw`
        <html prefix="og: https://ogp.me/ns/website#">
            <head>
                <title>${safeTitle}</title>
                <meta property="og:title" content="${safeTitle}" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${safeUrl}" />
                <meta property="og:description" content="${safeDescription}" />
                <meta property="og:site_name" content="downforacross.com" />
                <link type="application/json+oembed" href=${oembedEndpointUrl} />
                <meta name="theme-color" content="#6aa9f4">
            </head>
        </html>
    `);
    }
  );
}

export default linkPreviewRouter;
