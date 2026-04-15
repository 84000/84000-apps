# AGENTS.md

Agent coding guidelines for the 84000-apps monorepo.

## Architecture

This is an **Nx monorepo** with Next.js apps and shared libraries. Use 
`npx nx ...` to run commands from the repo root.

### Key Principle

- **Code belongs in `libs/`, not `apps/`**
- Apps should be thin orchestration layers
- All reusable logic goes into libraries

### Path Aliases

Import libraries using TypeScript path aliases (defined in `tsconfig.base.json`):

```typescript
import { Button, Dialog } from '@eightyfourthousand/design-system';
import { createBrowserClient } from '@eightyfourthousand/data-access';
import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { useProfile } from '@lib-user';
import { cn } from '@eightyfourthousand/lib-utils';
```

## Code Style Guidelines

### TypeScript

#### Imports

- Use path aliases, not relative imports for libraries
- Group imports: React/Next, third-party, local components, utils
- Use named exports, avoid default exports in libraries

```typescript
// Good
import { Button } from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';

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

### Styling

#### Tailwind CSS

- Use Tailwind utility classes
- Use `cn()` helper from `@eightyfourthousand/lib-utils` to merge classes
- Follow Tailwind CSS 4 conventions

```typescript
import { cn } from '@eightyfourthousand/lib-utils';

<div className={cn('flex items-center', className)} />
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

## Best Practices

1. **DRY**: Extract reusable logic into `libs/lib-utils` or appropriate library
2. **Single Responsibility**: One component/function does one thing well
3. **Composition**: Build complex UIs from small, reusable components
4. **Type Safety**: Leverage TypeScript, avoid `any`
5. **Performance**: Use React best practices (memoization, proper deps)
6. **Accessibility**: Use Radix UI primitives which are accessible by default
7. **Testing**: Write tests in `*.spec.ts` or `*.test.tsx` files (when they exist)

### Design System Components

Use them before building custom components. They are:

- Built with Radix UI primitives
- Styled with Tailwind
- Variants managed with CVA
- Full TypeScript support
