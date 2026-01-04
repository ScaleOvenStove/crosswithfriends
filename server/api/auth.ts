/**
 * Authentication API Routes
 *
 * Provides endpoints for token generation and validation.
 * Uses @fastify/jwt for JWT token management.
 */

import {config} from '../config/index.js';
import type {AppInstance} from '../types/fastify.js';
import {
  generateSecureUserId,
  isValidUserIdFormat,
  TOKEN_EXPIRY_SECONDS,
  type JwtPayload,
} from '../utils/auth.js';
import {isFirebaseAdminInitialized, verifyFirebaseToken} from '../utils/firebaseAdmin.js';

import {createHttpError} from './errors.js';
import type {
  CreateTokenRequest,
  CreateTokenResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
} from './generated/index.js';
import {ErrorResponseSchema} from './schemas.js';

// eslint-disable-next-line require-await
async function authRouter(fastify: AppInstance): Promise<void> {
  // Create a new authentication token
  const createTokenOptions = {
    schema: {
      operationId: 'createToken',
      tags: ['Authentication'],
      summary: 'Create authentication token',
      description:
        'Creates a new JWT authentication token for a user. If userId is not provided, a new secure user ID is generated.',
      body: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'Optional user ID. If not provided, a new one is generated.',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['token', 'userId', 'expiresAt'],
          properties: {
            token: {type: 'string', description: 'JWT authentication token'},
            userId: {type: 'string', description: 'The user ID associated with this token'},
            expiresAt: {type: 'number', description: 'Token expiration timestamp (ms)'},
          },
        },
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Body: CreateTokenRequest; Reply: CreateTokenResponse}>(
    '/token',
    createTokenOptions,
    // eslint-disable-next-line require-await
    async (request: any, _reply: any) => {
      request.log.debug({body: request.body ? Object.keys(request.body) : []}, 'Creating auth token');

      let userId = request.body?.userId;

      // Validate userId if provided
      if (userId) {
        if (!isValidUserIdFormat(userId)) {
          throw createHttpError(
            'Invalid userId format. Must be alphanumeric with hyphens/underscores, 1-200 characters.',
            400
          );
        }
        userId = userId.trim();
      } else {
        // Generate a new secure user ID
        userId = generateSecureUserId();
      }

      // Create JWT payload
      const payload: JwtPayload = {userId};

      // Sign token using @fastify/jwt
      const token = fastify.jwt.sign(payload);

      // Calculate expiration (JWT exp is in seconds, convert to ms for response)
      const now = Date.now();
      const expiresAt = now + TOKEN_EXPIRY_SECONDS * 1000;

      return {
        token,
        userId,
        expiresAt,
      };
    }
  );

  // Exchange Firebase ID token for backend JWT
  const firebaseTokenOptions = {
    schema: {
      operationId: 'exchangeFirebaseToken',
      tags: ['Authentication'],
      summary: 'Exchange Firebase ID token for backend JWT',
      description:
        'Verifies a Firebase ID token and returns a backend JWT token. The Firebase UID is used as the userId in the backend JWT.',
      body: {
        type: 'object',
        required: ['firebaseToken'],
        properties: {
          firebaseToken: {
            type: 'string',
            description: 'Firebase ID token from the frontend',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['token', 'userId', 'expiresAt'],
          properties: {
            token: {type: 'string', description: 'Backend JWT authentication token'},
            userId: {type: 'string', description: 'The Firebase UID used as userId'},
            expiresAt: {type: 'number', description: 'Token expiration timestamp (ms)'},
          },
        },
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        503: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Body: {firebaseToken: string}; Reply: CreateTokenResponse}>(
    '/firebase-token',
    firebaseTokenOptions,
    async (request: any, _reply: any) => {
      request.log.debug('Exchanging Firebase token for backend JWT');

      const {firebaseToken} = request.body;

      if (!firebaseToken || typeof firebaseToken !== 'string' || !firebaseToken.trim()) {
        throw createHttpError('Firebase token is required', 400);
      }

      // Check if Firebase Admin is initialized or if we're in development mode
      const isDevelopment = config.server.isDevelopment && !config.auth.requireAuth;
      if (!isFirebaseAdminInitialized() && !isDevelopment) {
        throw createHttpError(
          'Firebase Admin is not initialized. Set FIREBASE_CREDENTIALS_PATH or enable development mode (REQUIRE_AUTH=false).',
          503
        );
      }

      // Verify Firebase token
      const firebaseUser = await verifyFirebaseToken(firebaseToken.trim());
      if (!firebaseUser) {
        throw createHttpError('Invalid or expired Firebase token', 401);
      }

      // Use Firebase UID as userId
      const userId = firebaseUser.uid;

      // Validate UID format (Firebase UIDs are typically alphanumeric, but we'll be lenient)
      if (!isValidUserIdFormat(userId)) {
        // Firebase UIDs might not match our format, so we'll sanitize them
        // Replace any invalid characters with underscores
        const sanitizedUserId = userId.replace(/[^\w-]/g, '_');
        if (!isValidUserIdFormat(sanitizedUserId)) {
          throw createHttpError('Invalid Firebase UID format', 400);
        }
        // Use sanitized version
        const payload: JwtPayload = {userId: sanitizedUserId};
        const token = fastify.jwt.sign(payload);
        const now = Date.now();
        const expiresAt = now + TOKEN_EXPIRY_SECONDS * 1000;

        return {
          token,
          userId: sanitizedUserId,
          expiresAt,
        };
      }

      // Create JWT payload with Firebase UID
      const payload: JwtPayload = {userId};

      // Sign token using @fastify/jwt
      const token = fastify.jwt.sign(payload);

      // Calculate expiration (JWT exp is in seconds, convert to ms for response)
      const now = Date.now();
      const expiresAt = now + TOKEN_EXPIRY_SECONDS * 1000;

      request.log.debug({userId, email: firebaseUser.email}, 'Firebase token exchanged successfully');

      return {
        token,
        userId,
        expiresAt,
      };
    }
  );

  // Validate an existing token
  const validateTokenOptions = {
    schema: {
      operationId: 'validateToken',
      tags: ['Authentication'],
      summary: 'Validate authentication token',
      description: 'Validates a JWT token and returns its payload if valid.',
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: {type: 'string', description: 'The token to validate'},
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['valid'],
          properties: {
            valid: {type: 'boolean', description: 'Whether the token is valid'},
            userId: {type: 'string', description: 'User ID from token (if valid)'},
            expiresAt: {type: 'number', description: 'Token expiration (if valid)'},
          },
        },
        400: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Body: ValidateTokenRequest; Reply: ValidateTokenResponse}>(
    '/validate',
    validateTokenOptions,
    (request: any, _reply: any) => {
      request.log.debug('Validating auth token');

      const {token} = request.body;

      if (!token || typeof token !== 'string') {
        throw createHttpError('Token is required', 400);
      }

      try {
        // Verify token using @fastify/jwt
        const decoded = fastify.jwt.verify<JwtPayload>(token.trim());

        if (!decoded.userId) {
          return {valid: false};
        }

        // Convert JWT exp (seconds) to ms
        const expiresAt = decoded.exp ? decoded.exp * 1000 : undefined;

        return {
          valid: true,
          userId: decoded.userId,
          expiresAt,
        };
      } catch {
        // Token verification failed (expired, invalid signature, etc.)
        return {valid: false};
      }
    }
  );

  // Get current user info from token in Authorization header
  const meOptions = {
    schema: {
      operationId: 'getCurrentUser',
      tags: ['Authentication'],
      summary: 'Get current user',
      description:
        'Returns information about the currently authenticated user based on the Authorization header.',
      response: {
        200: {
          type: 'object',
          required: ['userId', 'expiresAt'],
          properties: {
            userId: {type: 'string', description: 'Current user ID'},
            expiresAt: {type: 'number', description: 'Token expiration timestamp'},
          },
        },
        401: ErrorResponseSchema,
      },
    },
  };

  fastify.get<{Reply: {userId: string; expiresAt: number}}>(
    '/me',
    meOptions,
    async (request: any, _reply: any) => {
      request.log.debug('Getting current user');

      try {
        // Verify JWT from Authorization header using @fastify/jwt
        await request.jwtVerify();

        // Access decoded payload via request.user (set by @fastify/jwt)
        const user = request.user as JwtPayload;

        if (!user.userId) {
          throw createHttpError('Invalid token payload', 401);
        }

        // Convert JWT exp (seconds) to ms
        const expiresAt = user.exp ? user.exp * 1000 : Date.now() + TOKEN_EXPIRY_SECONDS * 1000;

        return {
          userId: user.userId,
          expiresAt,
        };
      } catch (error) {
        // jwtVerify throws on invalid/missing token
        if (error instanceof Error && error.message.includes('Authorization')) {
          throw createHttpError('Authorization header required', 401);
        }
        throw createHttpError('Invalid or expired token', 401);
      }
    }
  );
}

export default authRouter;
