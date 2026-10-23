import Comment from '../models/Comment.js';
import { AppError } from '../errors.js';
import { authenticate, checkOwner } from '../middleware.js';

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } },
};

const commentBody = {
  type: 'object',
  required: ['text'],
  additionalProperties: false,
  properties: { text: { type: 'string', minLength: 1, maxLength: 500 } },
};

async function findComment(id) {
  const comment = await Comment.findById(id).populate('author', 'username');
  if (!comment) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Kommentaren hittades inte');
  return comment;
}

export default async function commentRoutes(fastify) {
  fastify.get('/:id', { schema: { params: idParam } }, async (request, reply) => {
    return reply.code(200).send({ data: await findComment(request.params.id) });
  });

  fastify.put(
    '/:id',
    { schema: { params: idParam, body: commentBody }, preHandler: authenticate },
    async (request, reply) => {
      const comment = await findComment(request.params.id);
      checkOwner(comment, request, 'Du får bara ändra dina egna kommentarer');

      comment.text = request.body.text;
      await comment.save();

      return reply.code(200).send({ data: comment });
    }
  );

  fastify.delete(
    '/:id',
    { schema: { params: idParam }, preHandler: authenticate },
    async (request, reply) => {
      const comment = await findComment(request.params.id);
      checkOwner(comment, request, 'Du får bara ta bort dina egna kommentarer');
      await comment.deleteOne();

      return reply.code(204).send();
    }
  );
}
