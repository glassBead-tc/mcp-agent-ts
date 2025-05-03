# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test Commands
- Build: `npm run build`
- Lint: `npm run lint`
- Test all: `npm test`
- Test single file: `npx jest path/to/test.test.ts`
- Start server: `npm run server`
- Start client: `npm run client`

## Code Style Guidelines
- TypeScript strict mode is enforced
- Use ES modules (import/export)
- Naming: camelCase for variables/functions, PascalCase for classes/interfaces
- Imports: group by external/internal, alphabetize when possible
- Error handling: use try/catch with proper logging
- Types: explicit return types, avoid `any` when possible
- Async: use async/await pattern, properly handle Promise rejections
- Documentation: JSDoc style comments for classes, interfaces, and public methods
- Testing: Jest for unit tests with descriptive test names