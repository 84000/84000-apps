# AGENTS.md

Agent coding guidelines for the 84000-apps monorepo.

## Build, Test, and Lint Commands

### Development

```bash
# Run an app in dev mode
npx nx dev web-main          # Main app (Scholar's Room)
npx nx dev web-editor        # Editor app
npx nx dev web-reader        # Reader app
npx nx dev web-docs          # Documentation

# Build for production
npx nx build web-main        # Build specific app
npx nx build <project-name>  # Build any project

# Run multiple targets
npx nx run-many -t build lint -p web-main design-system
```

### Testing

```bash
# Run tests for a project
npx nx test <project-name>

# Run tests for a specific file
npx nx test <project-name> --testFile=<filename>

# Run tests for specific projects
npx nx run-many -t test -p lib-utils design-system

# Watch mode
npx nx test <project-name> --watch
```

### Linting

```bash
# Lint a specific project
npx nx lint <project-name>

# Lint CSS files
npm run lint:css             # Lint all CSS
npm run lint:css:fix         # Auto-fix CSS issues

# Lint multiple projects
npx nx run-many -t lint -p web-main lib-user
```

### Storybook

```bash
# Run Storybook for design system
npx nx storybook design-system
```

## Architecture

This is an **Nx monorepo** with Next.js apps and shared libraries.

### Key Principle

- **Code belongs in `libs/`, not `apps/`**
- Apps should be thin orchestration layers
- All reusable logic goes into libraries

### Path Aliases

Import libraries using TypeScript path aliases (defined in `tsconfig.base.json`):

```typescript
import { Button, Dialog } from '@design-system';
import { createBrowserClient } from '@data-access';
import { createServerClient } from '@data-access/ssr';
import { useProfile } from '@lib-user';
import { cn } from '@lib-utils';
```

### Server-Side Imports

Many libraries export `/ssr` versions for server components:

- `@data-access/ssr`
- `@lib-user/ssr`
- `@lib-canon/ssr`
- `@lib-glossary/ssr`
- `@lib-explore/ssr`
- `@lib-instr/ssr`

## Code Style Guidelines

### TypeScript

#### Imports

- Use path aliases, not relative imports for libraries
- Group imports: React/Next, third-party, local components, utils
- Use named exports, avoid default exports in libraries

```typescript
// Good
import { Button } from '@design-system';
import { cn } from '@lib-utils';

// Avoid
import { Button } from '../../../libs/design-system/src/lib/Button';
```

#### Types

- Define interfaces for props with `interface` keyword
- Use `type` for unions, intersections, and utility types
- Export types alongside components
- Use TypeScript strict mode - no implicit `any`

```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
```

#### Naming Conventions

- **Components**: PascalCase (`ProfileDropdown`, `Button`)
- **Files**: Match component name (`Button.tsx`, `ProfileDropdown.tsx`)
- **Functions/variables**: camelCase (`getSession`, `hasPermission`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Types/Interfaces**: PascalCase (`UserClaims`, `GlossaryTermDTO`)

### React/Next.js

#### Client Components

- Add `'use client'` directive at the top when needed
- Use for interactivity, hooks, event handlers

```typescript
'use client';

import { useState } from 'react';
```

#### Component Structure

- Use `React.forwardRef` for components that need refs
- Set `displayName` for debugging
- Destructure props in function parameters

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  // implementation
});
Button.displayName = 'Button';
```

#### Async Server Components

- Use async/await for data fetching in server components
- Handle errors gracefully

```typescript
export async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### Styling

#### Tailwind CSS

- Use Tailwind utility classes
- Use `cn()` helper from `@lib-utils` to merge classes
- Follow Tailwind CSS 4 conventions

```typescript
import { cn } from '@lib-utils';

<div className={cn('flex items-center', className)} />
```

#### Class Variance Authority (CVA)

- Use CVA for component variants
- Define variants object with defaults

```typescript
const buttonVariants = cva('base-classes', {
  variants: {
    variant: { default: '...', destructive: '...' },
    size: { default: '...', sm: '...', lg: '...' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
```

### Error Handling

#### Logging

- Use `console.error()` for errors
- Use `console.warn()` for warnings
- Use `console.info()` for info messages
- Include context in error messages

```typescript
if (error) {
  console.error(`Failed to fetch user profile: ${error.message}`);
  return null;
}
```

#### Async Functions

- Always handle errors from async operations
- Return null or empty arrays on error (with logging)
- Don't throw unless in exceptional circumstances

```typescript
export const getUser = async ({ client }: { client: DataClient }) => {
  const { data, error } = await client.from('users').select();
  if (error) {
    console.error(`Failed to fetch user: ${error.message}`);
    return null;
  }
  return data;
};
```

### Formatting

#### Prettier

- Single quotes (configured in `.prettierrc`)
- 2-space indentation (default)
- Trailing commas (default)
- Let Prettier handle formatting

#### File Structure

```typescript
// 1. Imports
import { ... } from '...';

// 2. Types/Interfaces
export interface Props { ... }

// 3. Constants
const CONSTANT = '...';

// 4. Component/Function
export const Component = () => { ... };
```

## Best Practices

1. **DRY**: Extract reusable logic into `libs/lib-utils` or appropriate library
2. **Single Responsibility**: One component/function does one thing well
3. **Composition**: Build complex UIs from small, reusable components
4. **Type Safety**: Leverage TypeScript, avoid `any`
5. **Performance**: Use React best practices (memoization, proper deps)
6. **Accessibility**: Use Radix UI primitives which are accessible by default
7. **Testing**: Write tests in `*.spec.ts` or `*.test.tsx` files (when they exist)

## Common Patterns

### Data Fetching (Server-Side)

```typescript
import { createServerClient } from '@data-access/ssr';

const client = createServerClient();
const data = await fetchData({ client });
```

### Data Fetching (Client-Side)

```typescript
'use client';
import { createBrowserClient } from '@data-access';

const client = createBrowserClient();
```

### Design System Components

- Built with Radix UI primitives
- Styled with Tailwind
- Variants managed with CVA
- Full TypeScript support
