import { cn } from '@lib-utils';

export const LINK_STYLE =
  'text-slate underline decoration-slate underline-offset-[3px] transition-colors cursor-pointer';

export const HERO_STYLE =
  'font-serif mt-8 scroll-m-20 pb-8 text-8xl lg:text-9xl';
export function Hero({
  children,
  className,
  ...props
}: React.ComponentProps<'h1'>) {
  return (
    <h1 className={cn(HERO_STYLE, className)} {...props}>
      {children}
    </h1>
  );
}

export const HEADLINE_STYLE =
  'font-serif mt-8 scroll-m-20 pb-8 text-7xl lg:text-8xl';
export function Headline({
  children,
  className,
  ...props
}: React.ComponentProps<'h1'>) {
  return (
    <h1 className={cn(HEADLINE_STYLE, className)} {...props}>
      {children}
    </h1>
  );
}

export const TITLE_STYLE =
  'font-serif mt-8 scroll-m-20 pb-8 text-6xl lg:text-7xl';
export function Section({
  children,
  className,
  ...props
}: React.ComponentProps<'h1'>) {
  return (
    <h1 className={cn(TITLE_STYLE, className)} {...props}>
      {children}
    </h1>
  );
}

export const H1_STYLE = 'font-serif mt-8 scroll-m-20 pb-8 text-5xl lg:text-6xl';
export function H1({
  children,
  className,
  ...props
}: React.ComponentProps<'h1'>) {
  return (
    <h1 className={cn(H1_STYLE, className)} {...props}>
      {children}
    </h1>
  );
}

export const H2_STYLE = 'mt-8 scroll-m-20 pb-6 text-4xl lg:text-5xl';
export function H2({
  children,
  className,
  ...props
}: React.ComponentProps<'h2'>) {
  return (
    <h2 className={cn(H2_STYLE, className)} {...props}>
      {children}
    </h2>
  );
}

export const H3_STYLE = 'mt-6 scroll-m-20 pb-4 text-3xl lg:text-4xl';
export function H3({
  children,
  className,
  ...props
}: React.ComponentProps<'h3'>) {
  return (
    <h3 className={cn(H3_STYLE, className)} {...props}>
      {children}
    </h3>
  );
}

export const H4_STYLE =
  'mt-4 scroll-m-20 pb-2 text-2xl font-semibold lg:text-3xl text-navy';
export function H4({
  children,
  className,
  ...props
}: React.ComponentProps<'h4'>) {
  return (
    <h4 className={cn(H4_STYLE, className)} {...props}>
      {children}
    </h4>
  );
}

export const H5_STYLE = 'mt-2 scroll-m-20 pb-1 font-semibold lg:text-lg';
export function H5({
  children,
  className,
  ...props
}: React.ComponentProps<'h5'>) {
  return (
    <h5 className={cn(H5_STYLE, className)} {...props}>
      {children}
    </h5>
  );
}

export const P_STYLE = 'leading-6';
export function P({
  children,
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p className={cn(P_STYLE, className)} {...props}>
      {children}
    </p>
  );
}

export function Lead({
  children,
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p className={cn('text-xl text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}

export function LgText({
  children,
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('font-serif text-lg font-semibold', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SmText({
  children,
  className,
  ...props
}: React.ComponentProps<'small'>) {
  return (
    <small
      className={cn('text-sm font-medium leading-none', className)}
      {...props}
    >
      {children}
    </small>
  );
}

export function MutedText({
  children,
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}

export function A({
  children,
  className,
  ...props
}: React.ComponentProps<'a'>) {
  return (
    <a className={cn(LINK_STYLE, className)} {...props}>
      {children}
    </a>
  );
}

export const BLOCKQUOTE_STYLE = 'mt-6 border-l-2 border-l-border pl-6 italic';
export function Blockquote({
  children,
  className,
  ...props
}: React.ComponentProps<'blockquote'>) {
  return (
    <blockquote className={cn(BLOCKQUOTE_STYLE, className)} {...props}>
      {children}
    </blockquote>
  );
}

export const CODE_STYLE =
  'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold';
export function Code({
  children,
  className,
  ...props
}: React.ComponentProps<'code'>) {
  return (
    <code className={cn(CODE_STYLE, className)} {...props}>
      {children}
    </code>
  );
}

export const OL_STYLE = 'my-6 ml-6 list-decimal [&>li]:mt-2';
export function Ol({
  children,
  className,
  ...props
}: React.ComponentProps<'ol'>) {
  return (
    <ul className={cn(OL_STYLE, className)} {...props}>
      {children}
    </ul>
  );
}

export const UL_STYLE = 'my-6 ml-6 list-disc [&>li]:mt-2';
export function Ul({
  children,
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul className={cn(UL_STYLE, className)} {...props}>
      {children}
    </ul>
  );
}

export function Li({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li className={className} {...props}>
      {children}
    </li>
  );
}

export function HtmlTable({
  children,
  className,
  ...props
}: React.ComponentProps<'table'>) {
  return (
    <table className={cn('w-full', className)} {...props}>
      {children}
    </table>
  );
}

export function Thead({
  children,
  className,
  ...props
}: React.ComponentProps<'thead'>) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}

export function Tbody({
  children,
  className,
  ...props
}: React.ComponentProps<'tbody'>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export function Th({
  children,
  className,
  ...props
}: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'border border-border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  className,
  ...props
}: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'm-0 border-t border-t-border p-0 even:bg-muted',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  ...props
}: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn(
        'border border-border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
