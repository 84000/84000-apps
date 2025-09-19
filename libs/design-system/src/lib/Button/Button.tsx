import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@lib-utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'rounded-full bg-gradient-to-b from-brick-400 to-brick-800 text-secondary font-light hover:text-secondary hover:from-brick-800 hover:to-brick-400 transition-colors',
        active:
          'rounded-full bg-sidebar-accent text-sidebar-accent-foreground font-bold',
        destructive:
          'rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'rounded-full hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        xs: 'h-6 px-2.5',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    if (!variant || variant === 'default') {
      return (
        <div className="size-fit p-0.5 my-2 rounded-full bg-gradient-to-b from-brick-200 to-brick-500">
          <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
