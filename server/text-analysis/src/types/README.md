# Types Directory

## Overview
Contains TypeScript type definitions and dependency injection configuration for the Text Analysis server.

## Files

### di.types.ts
- Tool constructor types
- Tool mapping definitions
- DI container type configurations

### symbols.ts
- Dependency injection symbols
- Service identifiers
- Tool identifiers

## Usage
Types are used throughout the application to ensure type safety and proper dependency injection configuration.

## Development
When adding new tools or services:
1. Define new symbols in `symbols.ts`
2. Add corresponding types in `di.types.ts`
3. Update TOOL_MAP if necessary
4. Ensure proper typing in the DI container
