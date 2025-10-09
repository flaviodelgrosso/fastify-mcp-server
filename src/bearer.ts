import {
  InsufficientScopeError,
  InvalidTokenError,
  OAuthError,
  ServerError
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

import type { BearerAuthMiddlewareOptions } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware that requires a valid Bearer token in the Authorization header.
 * This will validate the token with the auth provider and add the resulting auth info to the request object.
 * If resourceMetadataUrl is provided, it will be included in the WWW-Authenticate header for 401 responses as per the OAuth 2.0 Protected Resource Metadata spec.
 */
export function addBearerPreHandlerHook (app: FastifyInstance, options: BearerAuthMiddlewareOptions) {
  const { verifier, requiredScopes = [], resourceMetadataUrl } = options;

  app.addHook('onRequest', async (req, reply) => {
    try {
      const authInfo = await getAuthInfo(req, verifier, requiredScopes);
      Object.assign(req.raw, { auth: authInfo }); // Ensure raw request also has auth info
    } catch (error) {
      sendAuthError(error, reply, resourceMetadataUrl);
    }
  });
}

/**
 * Processes the authentication flow for a request
 */
async function getAuthInfo (
  req: FastifyRequest,
  verifier: BearerAuthMiddlewareOptions['verifier'],
  requiredScopes: BearerAuthMiddlewareOptions['requiredScopes'] = []
): Promise<AuthInfo> {
  const token = extractBearerToken(req.headers.authorization);
  const authInfo = await verifier.verifyAccessToken(token);

  validateRequiredScopes(authInfo, requiredScopes);
  validateTokenExpiration(authInfo);

  return authInfo;
}

/**
 * Extracts and validates the Bearer token from the Authorization header
 */
function extractBearerToken (authHeader: string | undefined): string {
  if (!authHeader) {
    throw new InvalidTokenError('Missing Authorization header');
  }

  const [type, token] = authHeader.split(' ');
  if (type.toLowerCase() !== 'bearer' || !token) {
    throw new InvalidTokenError("Invalid Authorization header format, expected 'Bearer TOKEN'");
  }

  return token;
}

/**
 * Validates that the auth info has all required scopes
 */
function validateRequiredScopes (authInfo: AuthInfo, requiredScopes: string[]): void {
  if (requiredScopes.length === 0) {
    return;
  }

  const hasAllScopes = requiredScopes.every((scope) => authInfo.scopes.includes(scope));
  if (!hasAllScopes) {
    throw new InsufficientScopeError('Insufficient scope');
  }
}

/**
 * Validates that the token has not expired
 */
function validateTokenExpiration (authInfo: AuthInfo): void {
  const isExpired = authInfo.expiresAt && authInfo.expiresAt < Date.now() / 1000;
  if (isExpired) {
    throw new InvalidTokenError('Token has expired');
  }
}

/**
 * Constructs the WWW-Authenticate header value
 */
function buildWwwAuthenticateHeader (
  error: InvalidTokenError | InsufficientScopeError,
  resourceMetadataUrl?: string
): string {
  const baseValue = `Bearer error="${error.errorCode}", error_description="${error.message}"`;
  return resourceMetadataUrl ? `${baseValue}, resource_metadata="${resourceMetadataUrl}"` : baseValue;
}

/**
 * Handles authentication errors and sends appropriate responses
 */
function sendAuthError (error: unknown, reply: FastifyReply, resourceMetadataUrl?: string) {
  if (error instanceof InvalidTokenError) {
    const wwwAuthValue = buildWwwAuthenticateHeader(error, resourceMetadataUrl);
    return reply.header('WWW-Authenticate', wwwAuthValue).status(401).send(error.toResponseObject());
  }

  if (error instanceof InsufficientScopeError) {
    const wwwAuthValue = buildWwwAuthenticateHeader(error, resourceMetadataUrl);
    return reply.header('WWW-Authenticate', wwwAuthValue).status(403).send(error.toResponseObject());
  }

  if (error instanceof ServerError) {
    return reply.status(500).send(error.toResponseObject());
  }

  if (error instanceof OAuthError) {
    return reply.status(400).send(error.toResponseObject());
  }

  // Handle unexpected errors
  const serverError = new ServerError('Internal Server Error');
  return reply.status(500).send(serverError.toResponseObject());
}
