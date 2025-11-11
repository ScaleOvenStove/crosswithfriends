import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import _ from 'lodash';

import type {InfoJson} from '@shared/types';
import {getGameInfo} from '../model/game.js';
import {isLinkExpanderBot, isFBMessengerCrawler} from '../utils/link_preview_util.js';
import {getPuzzleInfo} from '../model/puzzle.js';
import {createHttpError} from './errors.js';

interface LinkPreviewQuery {
  url: string;
}

async function linkPreviewRouter(fastify: FastifyInstance) {
  fastify.get<{Querystring: LinkPreviewQuery}>(
    '/',
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

      if (_.isEmpty(info)) {
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
