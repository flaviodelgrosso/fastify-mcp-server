# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.0](https://github.com/flaviodelgrosso/fastify-mcp-server/compare/v0.7.2...v1.0.0) (2026-08-21)

### Major Changes (BREAKING CHANGES)

- implement full spec alignment to MCP spec 2026-07-28 ([a379cf3](https://github.com/flaviodelgrosso/fastify-mcp-server/commit/a379cf346841e2bbf87b0ebb073507ee84443bb9))

## 0.7.2

### Patch Changes

- 2a80f7c: fix: use redis client instead of options to session and event stores

## 0.7.1

### Patch Changes

- ecf1780: fix: make bearer auth option required and export `OAuth2AuthorizationOptions` type

## 0.7.0

### Minor Changes

- 14ed3d5: feat: add customizable transport options

## 0.6.0

### Minor Changes

- 39f9d58: add customizable SessionStore and Redis support

## 0.5.0

### Minor Changes

- 7243961: refactor authorization options into a single nested object and modularize route registration

## 0.4.1

### Patch Changes

- c20b906f: change bearer check on onRequest lifecycle instead of preHandler

## 0.4.0

### Minor Changes

- 021d566: add support for Well-Known OAuth Metadata routes

## 0.3.0

### Minor Changes

- e22e99c: enhance bearer token middleware with error handling options

## 0.2.1

### Patch Changes

- 9170ae7: remove unused `@fastify/middie` library dependency

## 0.2.0

### Minor Changes

- da7b5b2: added support to access token verification middleware

## 0.1.0

- first release
