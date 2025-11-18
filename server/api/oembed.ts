import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

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
  fastify.get<{Querystring: OEmbedQuery; Reply: OEmbedResponse}>(
    '/',
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
