'use client';

import {
  ChangeEvent,
  ComponentProps,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '@lib-utils';
import { useDebounce } from 'use-debounce';

export enum DebounceLevel {
  NONE = 0,
  LOW = 10,
  MEDIUM = 250,
  HIGH = 500,
  VERY_HIGH = 1000,
}

const Input = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'> & { delay?: DebounceLevel }
>(
  (
    { value, className, type, onChange, delay = DebounceLevel.NONE, ...props },
    ref,
  ) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [debouncedValue] = useDebounce(inputValue, delay);
    const prevValueRef = useRef(value);

    useEffect(() => {
      if (value !== prevValueRef.current) {
        setInputValue(value || '');
        prevValueRef.current = value;
      }
    }, [value]);

    useEffect(() => {
      if (debouncedValue !== value) {
        const syntheticEvent = {
          target: { value: debouncedValue },
          currentTarget: { value: debouncedValue },
        } as ChangeEvent<HTMLInputElement>;

        onChange?.(syntheticEvent);
        prevValueRef.current = debouncedValue;
      }
    }, [debouncedValue, onChange, value]);

    return (
      <input
        type={type}
        value={inputValue}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        onChange={(e) => {
          setInputValue(e.target.value);
        }}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
