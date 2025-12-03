import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

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
async function oEmbedRouter(fastify: FastifyInstance): Promise<void> {
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
    (request: FastifyRequest<{Querystring: OEmbedQuery}>, _reply: FastifyReply) => {
      request.log.debug({headers: request.headers, query: request.query}, 'got req');

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
