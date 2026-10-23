import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import { AppError } from '../errors.js';
import { authenticate, checkOwner } from '../middleware.js';

const OBJECT_ID = '^[0-9a-fA-F]{24}$';

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: OBJECT_ID } },
};

const postBody = {
  type: 'object',
  required: ['title', 'content'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 120 },
    content: { type: 'string', minLength: 1, maxLength: 20000 },
  },
};

const commentBody = {
  type: 'object',
  required: ['text'],
  additionalProperties: false,
  properties: { text: { type: 'string', minLength: 1, maxLength: 500 } },
};

async function findPost(id) {
  const post = await Post.findById(id).populate('author', 'username');
  if (!post) throw new AppError(404, 'POST_NOT_FOUND', 'Inlägget hittades inte');
  return post;
}

export default async function postRoutes(fastify) {
  // Lista inlägg med paginering
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { page, limit } = request.query;

      const posts = await Post.find()
        .populate('author', 'username')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Post.countDocuments();

      return reply.code(200).send({ data: posts, meta: { total, page, perPage: limit } });
    }
  );

  fastify.get('/:id', { schema: { params: idParam } }, async (request, reply) => {
    return reply.code(200).send({ data: await findPost(request.params.id) });
  });

  fastify.post(
    '/',
    { schema: { body: postBody }, preHandler: authenticate },
    async (request, reply) => {
      const post = await Post.create({ ...request.body, author: request.user.id });
      await post.populate('author', 'username');
      return reply.code(201).send({ data: post });
    }
  );

  fastify.put(
    '/:id',
    { schema: { params: idParam, body: postBody }, preHandler: authenticate },
    async (request, reply) => {
      const post = await findPost(request.params.id);
      checkOwner(post, request, 'Du får bara ändra dina egna inlägg');

      post.title = request.body.title;
      post.content = request.body.content;
      await post.save();

      return reply.code(200).send({ data: post });
    }
  );

  fastify.delete(
    '/:id',
    { schema: { params: idParam }, preHandler: authenticate },
    async (request, reply) => {
      const post = await findPost(request.params.id);
      checkOwner(post, request, 'Du får bara ta bort dina egna inlägg');

      // MongoDB städar inte upp åt oss, så kommentarerna raderas här
      await Comment.deleteMany({ post: post._id });
      await post.deleteOne();

      return reply.code(204).send();
    }
  );

  // Kommentarer som hör till ett inlägg
  fastify.get('/:id/comments', { schema: { params: idParam } }, async (request, reply) => {
    await findPost(request.params.id);

    const comments = await Comment.find({ post: request.params.id })
      .populate('author', 'username')
      .sort({ createdAt: -1 });

    return reply.code(200).send({ data: comments });
  });

  fastify.post(
    '/:id/comments',
    { schema: { params: idParam, body: commentBody }, preHandler: authenticate },
    async (request, reply) => {
      await findPost(request.params.id);

      const comment = await Comment.create({
        text: request.body.text,
        post: request.params.id,
        author: request.user.id,
      });
      await comment.populate('author', 'username');

      return reply.code(201).send({ data: comment });
    }
  );
}
