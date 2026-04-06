import { cn } from '@eightyfourthousand/lib-utils';
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
            ]}
          />
          <PaletteColor
            label="brick"
            labelColor="text-brick"
            colors={[
              'bg-brick',
            ]}
          />
          <PaletteColor
            label="ochre"
            labelColor="text-ochre"
            colors={[
              'bg-ochre',
            ]}
          />
          <PaletteColor
            label="emerald"
            labelColor="text-emerald"
            colors={[
              'bg-emerald',
            ]}
          />
          <PaletteColor
            label="slate"
            labelColor="text-slate"
            colors={[
              'bg-slate',
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
            ]}
          />
          <PaletteColor
            label="secondary"
            colors={[
              'bg-secondary',
            ]}
          />
          <PaletteColor
            label="accent"
            colors={[
              'bg-accent',
            ]}
          />
          <PaletteColor
            label="accent-foreground"
            colors={[
              'bg-accent-foreground',
            ]}
          />
          <PaletteColor
            label="muted"
            colors={[
              'bg-muted',
            ]}
          />
          <PaletteColor
            label="muted-foreground"
            colors={[
              'bg-muted-foreground',
            ]}
          />
          <PaletteColor
            label="foreground"
            colors={[
              'bg-foreground',
            ]}
          />
          <PaletteColor
            label="background"
            colors={[
              'bg-background',
            ]}
          />
          <PaletteColor
            label="border"
            colors={[
              'bg-border',
            ]}
          />
          <PaletteColor
            label="ring"
            colors={[
              'bg-ring',
            ]}
          />
          <PaletteColor
            label="destructive"
            colors={[
              'bg-destructive',
            ]}
          />
          <PaletteColor
            label="destructive-foreground"
            colors={[
              'bg-destructive-foreground',
            ]}
          />
          <PaletteColor
            label="success"
            colors={[
              'bg-success',
            ]}
          />
          <PaletteColor
            label="success-foreground"
            colors={[
              'bg-success-foreground',
            ]}
          />
          <PaletteColor
            label="warning"
            colors={[
              'bg-warning',
            ]}
          />
          <PaletteColor
            label="warning-foreground"
            colors={[
              'bg-warning-foreground',
            ]}
          />
          <PaletteColor
            label="error"
            colors={[
              'bg-error',
            ]}
          />
          <PaletteColor
            label="error-foreground"
            colors={[
              'bg-error-foreground',
            ]}
          />
          <PaletteColor
            label="input"
            colors={[
              'bg-input',
            ]}
          />
          <PaletteColor
            label="gray"
            colors={[
              'bg-gray',
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
        <div className="grid lg:grid-cols-3 grid-cols-2 gap-2">
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
    </div>
  );
};
