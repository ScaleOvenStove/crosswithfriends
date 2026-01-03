import type {AppInstance} from '../types/fastify.js';
import {logRequest} from '../utils/sanitizedLogger.js';

import {OEmbedResponseSchema} from './schemas.js';

interface OEmbedQuery {
  author: string;
}

interface OEmbedResponse {
  type: string;
  version: string;
  author_name: string;
}

// eslint-disable-next-line require-await
async function oEmbedRouter(fastify: AppInstance): Promise<void> {
  const getOptions = {
    schema: {
      operationId: 'getOembed',
      tags: ['Link Preview'],
      summary: 'Get oEmbed data',
      description: 'Returns oEmbed format metadata for link previews',
      querystring: {
        type: 'object',
        required: ['author'],
        properties: {
          author: {type: 'string', description: 'Author name'},
        },
      },
      response: {
        200: OEmbedResponseSchema,
      },
    },
  };

  fastify.get<{Querystring: OEmbedQuery; Reply: OEmbedResponse}>(
    '',
    getOptions,
    (request: any, _reply: any) => {
      logRequest(request);

      const author = request.query.author;

      // https://oembed.com/#section2.3
      return {
        type: 'link',
        version: '1.0',
        author_name: author,
      };
    }
  );
}

export default oEmbedRouter;
