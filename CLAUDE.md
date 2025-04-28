# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test/Lint Commands
- Build: `npm run build`
- Lint: `npm run lint`
- Test all tests: `npm test`
- Test a single test file: `npx jest path/to/test-file.test.ts`
- Run server: `npm run server`
- Run client: `npm run client`

## Code Style Guidelines
- **Imports**: Use ES modules import style. Group imports by internal/external dependencies.
- **TypeScript**: Use strict type checking. All functions should have explicit return types.
- **Naming**: Use PascalCase for classes, camelCase for variables/functions. Interfaces should not be prefixed with 'I'.
- **Classes**: Prefer static `create()` factory methods for async initialization instead of constructors.
- **Error Handling**: Use typed exceptions from `core/exceptions.ts` and proper try/catch blocks.
- **Module Structure**: Export public APIs through index.ts files to maintain clean imports.
- **Testing**: Use Jest for testing. Mock external dependencies appropriately.
- **Comments**: Document public APIs with JSDoc style comments. No inline comments unless complexity requires explanation.