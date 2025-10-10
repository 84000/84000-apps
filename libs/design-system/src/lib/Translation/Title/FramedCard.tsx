import { cn } from '@lib-utils';
import { ReactNode, SVGProps } from 'react';

export const OrnamentBG = ({ className }: SVGProps<SVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="38"
      height="20"
      viewBox="0 0 38 20"
      fill="none"
      className={className}
    >
      <path d="M0 0C0 11.04 8.512 20 19 20C29.488 20 38 11.04 38 0H0Z" />
    </svg>
  );
};

export const Ornament = ({ className }: SVGProps<SVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="36"
      height="19"
      viewBox="0 0 36 19"
      className={className}
    >
      <path d="M21.8 11.28C22.332 11.12 22.864 10.88 23.32 10.56V8H24.84V6.4H23.32V4.8H30.084C28.488 9.2 24.84 12.48 20.28 13.36V1.6H33.884C33.124 10.16 26.284 16.8 18 16.8C9.71602 16.8 2.87602 10.16 2.11602 1.6H15.72V13.36C11.236 12.48 7.51202 9.2 5.91602 4.8H12.68V6.4H11.16V8H12.68V10.64C13.136 10.88 13.668 11.12 14.2 11.36V3.2H3.86402C5.23202 9.76 10.628 14.8 17.24 15.12V0H0.52002C0.52002 10.16 8.34802 18.4 18 18.4C27.652 18.4 35.48 10.16 35.48 0H18.76V15.12C25.372 14.72 30.768 9.76 32.136 3.2H21.8V11.28Z" />
    </svg>
  );
};

export const FramedCard = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const borderColor = `border-navy-50`;
  const bgColor = `bg-navy-25/40`;
  const ornamentTint = `fill-navy-50`;
  const ornamentBgTint = `fill-white/75`;

  const cornerSize = 2;
  const size = `size-${cornerSize}`;
  const height = `height-${cornerSize}`;
  const width = `width-${cornerSize}`;
  const border = `border border-5 ${borderColor} border-double`;

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-0',
        className,
      )}
    >
      <div className={cn(size, 'relative')}>
        <div
          className={cn(
            border,
            'absolute top-1.25 start-1.25 border-t-transparent border-s-transparent z-2',
          )}
        />
      </div>
      <div
        className={cn(
          height,
          border,
          bgColor,
          'relative border-b-transparent rounded-t-md',
        )}
      >
        <div className="absolute -top-1.25 h-0 w-full overflow-visible">
          <OrnamentBG className={cn('mx-auto', ornamentBgTint)} />
        </div>
        <div className="absolute -top-1.25 h-0 w-full overflow-visible">
          <Ornament className={cn('mx-auto', ornamentTint)} />
        </div>
      </div>
      <div className={cn(size, 'relative')}>
        <div
          className={cn(
            border,
            'absolute top-1.25 end-0.75 border-t-transparent border-e-transparent z-2',
          )}
        />
      </div>
      <div
        className={cn(
          width,
          border,
          bgColor,
          'border-e-transparent rounded-s-md border-double',
        )}
      ></div>
      <div className={cn('fit-content', bgColor)}>{children}</div>
      <div
        className={cn(
          width,
          border,
          bgColor,
          'border-s-transparent rounded-e-md',
        )}
      ></div>
      <div className={cn(size, 'relative')}>
        <div
          className={cn(
            border,
            'absolute bottom-0.75 start-1.25 border-b-transparent border-s-transparent z-2',
          )}
        />
      </div>
      <div
        className={cn(
          height,
          border,
          bgColor,
          'border-t-transparent rounded-b-md',
        )}
      ></div>
      <div className={cn(size, 'relative')}>
        <div
          className={cn(
            border,
            'absolute bottom-0.75 end-0.75 border-b-transparent border-e-transparent z-2',
          )}
        />
      </div>
    </div>
  );
};
