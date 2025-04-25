import { H2 } from '../Typography/Typography';

export const Palette = () => {
  return (
    <div className="flex flex-col gap-4">
      <H2>Brand Colors</H2>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1 rounded">
          <div className="text-brick">brick</div>
          <div className="size-16 bg-brick rounded" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-ochre">ochre</div>
          <div className="size-16 bg-ochre rounded" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-emerald">emerald</div>
          <div className="size-16 bg-emerald rounded" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-navy">navy</div>
          <div className="size-16 bg-navy rounded" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-gray">gray</div>
          <div className="size-16 bg-gray rounded" />
        </div>
      </div>
    </div>
  );
};
