import { cn } from '@lib-utils';
import { H2, H4 } from '../Typography/Typography';

// NOTE: Avoid being clever here. passing in an explicit list of colors ensures
// they are rendered at build time, making them available dynamically elsewhere
export const PaletteColor = ({
  label,
  colors,
  labelColor,
}: {
  label: string;
  labelColor?: string;
  colors: string[];
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className={cn('font-medium', labelColor)}>{label}</div>
      <div className="flex gap-2">
        {colors.map((c) => (
          <div className={cn('size-16 rounded border', c)} key={c} />
        ))}
      </div>
    </div>
  );
};

export const SingleColor = ({
  color,
  label,
  labelColor,
}: {
  color: string;
  label: string;
  labelColor?: string;
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className={cn('font-medium', labelColor)}>{label}</div>
      <div className="flex gap-2">
        <div className={cn('size-16 rounded border', color)} />
      </div>
    </div>
  );
};

export const Palette = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <H2>Brand Colors</H2>
        <div className="flex flex-wrap gap-4">
          <PaletteColor
            label="navy"
            labelColor="text-navy"
            colors={[
              'bg-navy',
              'bg-navy-25',
              'bg-navy-50',
              'bg-navy-100',
              'bg-navy-200',
              'bg-navy-300',
              'bg-navy-400',
              'bg-navy-500',
              'bg-navy-600',
              'bg-navy-700',
              'bg-navy-800',
              'bg-navy-900',
              'bg-navy-950',
            ]}
          />
          <PaletteColor
            label="brick"
            labelColor="text-brick"
            colors={[
              'bg-brick',
              'bg-brick-25',
              'bg-brick-50',
              'bg-brick-100',
              'bg-brick-200',
              'bg-brick-300',
              'bg-brick-400',
              'bg-brick-500',
              'bg-brick-600',
              'bg-brick-700',
              'bg-brick-800',
              'bg-brick-900',
              'bg-brick-950',
            ]}
          />
          <PaletteColor
            label="ochre"
            labelColor="text-ochre"
            colors={[
              'bg-ochre',
              'bg-ochre-25',
              'bg-ochre-50',
              'bg-ochre-100',
              'bg-ochre-200',
              'bg-ochre-300',
              'bg-ochre-400',
              'bg-ochre-500',
              'bg-ochre-600',
              'bg-ochre-700',
              'bg-ochre-800',
              'bg-ochre-900',
              'bg-ochre-950',
            ]}
          />
          <PaletteColor
            label="emerald"
            labelColor="text-emerald"
            colors={[
              'bg-emerald',
              'bg-emerald-25',
              'bg-emerald-50',
              'bg-emerald-100',
              'bg-emerald-200',
              'bg-emerald-300',
              'bg-emerald-400',
              'bg-emerald-500',
              'bg-emerald-600',
              'bg-emerald-700',
              'bg-emerald-800',
              'bg-emerald-900',
              'bg-emerald-950',
            ]}
          />
          <PaletteColor
            label="slate"
            labelColor="text-slate"
            colors={[
              'bg-slate',
              'bg-slate-25',
              'bg-slate-50',
              'bg-slate-100',
              'bg-slate-200',
              'bg-slate-300',
              'bg-slate-400',
              'bg-slate-500',
              'bg-slate-600',
              'bg-slate-700',
              'bg-slate-800',
              'bg-slate-900',
              'bg-slate-950',
            ]}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <H2>Base Colors</H2>
        <div className="flex flex-wrap gap-4">
          <PaletteColor
            label="primary"
            colors={[
              'bg-primary',
              'bg-primary/80',
              'bg-primary/60',
              'bg-primary/40',
              'bg-primary/20',
            ]}
          />
          <PaletteColor
            label="secondary"
            colors={[
              'bg-secondary',
              'bg-secondary/80',
              'bg-secondary/60',
              'bg-secondary/40',
              'bg-secondary/20',
            ]}
          />
          <PaletteColor
            label="accent"
            colors={[
              'bg-accent',
              'bg-accent/80',
              'bg-accent/60',
              'bg-accent/40',
              'bg-accent/20',
            ]}
          />
          <PaletteColor
            label="accent-foreground"
            colors={[
              'bg-accent-foreground',
              'bg-accent-foreground/80',
              'bg-accent-foreground/60',
              'bg-accent-foreground/40',
              'bg-accent-foreground/20',
            ]}
          />
          <PaletteColor
            label="muted"
            colors={[
              'bg-muted',
              'bg-muted/80',
              'bg-muted/60',
              'bg-muted/40',
              'bg-muted/20',
            ]}
          />
          <PaletteColor
            label="muted-foreground"
            colors={[
              'bg-muted-foreground',
              'bg-muted-foreground/80',
              'bg-muted-foreground/60',
              'bg-muted-foreground/40',
              'bg-muted-foreground/20',
            ]}
          />
          <PaletteColor
            label="foreground"
            colors={[
              'bg-foreground',
              'bg-foreground/80',
              'bg-foreground/60',
              'bg-foreground/40',
              'bg-foreground/20',
            ]}
          />
          <PaletteColor
            label="background"
            colors={[
              'bg-background',
              'bg-background/80',
              'bg-background/60',
              'bg-background/40',
              'bg-background/20',
            ]}
          />
          <PaletteColor
            label="border"
            colors={[
              'bg-border',
              'bg-border/80',
              'bg-border/60',
              'bg-border/40',
              'bg-border/20',
            ]}
          />
          <PaletteColor
            label="ring"
            colors={[
              'bg-ring',
              'bg-ring/80',
              'bg-ring/60',
              'bg-ring/40',
              'bg-ring/20',
            ]}
          />
          <PaletteColor
            label="destructive"
            colors={[
              'bg-destructive',
              'bg-destructive/80',
              'bg-destructive/60',
              'bg-destructive/40',
              'bg-destructive/20',
            ]}
          />
          <PaletteColor
            label="destructive-foreground"
            colors={[
              'bg-destructive-foreground',
              'bg-destructive-foreground/80',
              'bg-destructive-foreground/60',
              'bg-destructive-foreground/40',
              'bg-destructive-foreground/20',
            ]}
          />
          <PaletteColor
            label="success"
            colors={[
              'bg-success',
              'bg-success/80',
              'bg-success/60',
              'bg-success/40',
              'bg-success/20',
            ]}
          />
          <PaletteColor
            label="success-foreground"
            colors={[
              'bg-success-foreground',
              'bg-success-foreground/80',
              'bg-success-foreground/60',
              'bg-success-foreground/40',
              'bg-success-foreground/20',
            ]}
          />
          <PaletteColor
            label="warning"
            colors={[
              'bg-warning',
              'bg-warning/80',
              'bg-warning/60',
              'bg-warning/40',
              'bg-warning/20',
            ]}
          />
          <PaletteColor
            label="warning-foreground"
            colors={[
              'bg-warning-foreground',
              'bg-warning-foreground/80',
              'bg-warning-foreground/60',
              'bg-warning-foreground/40',
              'bg-warning-foreground/20',
            ]}
          />
          <PaletteColor
            label="error"
            colors={[
              'bg-error',
              'bg-error/80',
              'bg-error/60',
              'bg-error/40',
              'bg-error/20',
            ]}
          />
          <PaletteColor
            label="error-foreground"
            colors={[
              'bg-error-foreground',
              'bg-error-foreground/80',
              'bg-error-foreground/60',
              'bg-error-foreground/40',
              'bg-error-foreground/20',
            ]}
          />
          <PaletteColor
            label="input"
            colors={[
              'bg-input',
              'bg-input/80',
              'bg-input/60',
              'bg-input/40',
              'bg-input/20',
            ]}
          />
          <PaletteColor
            label="gray"
            colors={[
              'bg-gray',
              'bg-gray/80',
              'bg-gray/60',
              'bg-gray/40',
              'bg-gray/20',
            ]}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <H2>Component Colors</H2>
        <H4>Card</H4>
        <div className="flex gap-2">
          <SingleColor label="card" color="bg-card" />
          <SingleColor label="card-foreground" color="bg-card-foreground" />
        </div>
        <H4>Popover</H4>
        <div className="flex gap-2">
          <SingleColor label="popover" color="bg-popover" />
          <SingleColor
            label="popover-foreground"
            color="bg-popover-foreground"
          />
        </div>
        <H4>Sidebar</H4>
        <div className="flex grid lg:grid-cols-3 grid-cols-2 gap-2">
          <SingleColor label="sidebar" color="bg-sidebar" />
          <SingleColor
            label="sidebar-foreground"
            color="bg-sidebar-foreground"
          />
          <SingleColor
            label="sidebar-background"
            color="bg-sidebar-background"
          />
          <SingleColor label="sidebar-primary" color="bg-sidebar-primary" />
          <SingleColor
            label="sidebar-primary-foreground"
            color="bg-sidebar-primary-foreground"
          />
          <SingleColor label="sidebar-accent" color="bg-sidebar-accent" />
          <SingleColor
            label="sidebar-accent-foreground"
            color="bg-sidebar-accent-foreground"
          />
          <SingleColor label="sidebar-border" color="bg-sidebar-border" />
          <SingleColor label="sidebar-ring" color="bg-sidebar-ring" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <H2>Chart Colors</H2>
        <div className="flex flex-wrap gap-4">
          <PaletteColor
            label="chart-1"
            colors={[
              'bg-chart-1',
              'bg-chart-1/80',
              'bg-chart-1/60',
              'bg-chart-1/40',
              'bg-chart-1/20',
            ]}
          />
          <PaletteColor
            label="chart-2"
            colors={[
              'bg-chart-2',
              'bg-chart-2/80',
              'bg-chart-2/60',
              'bg-chart-2/40',
              'bg-chart-2/20',
            ]}
          />
          <PaletteColor
            label="chart-3"
            colors={[
              'bg-chart-3',
              'bg-chart-3/80',
              'bg-chart-3/60',
              'bg-chart-3/40',
              'bg-chart-3/20',
            ]}
          />
          <PaletteColor
            label="chart-4"
            colors={[
              'bg-chart-4',
              'bg-chart-4/80',
              'bg-chart-4/60',
              'bg-chart-4/40',
              'bg-chart-4/20',
            ]}
          />
          <PaletteColor
            label="chart-5"
            colors={[
              'bg-chart-5',
              'bg-chart-5/80',
              'bg-chart-5/60',
              'bg-chart-5/40',
              'bg-chart-5/20',
            ]}
          />
        </div>
      </div>
    </div>
  );
};
