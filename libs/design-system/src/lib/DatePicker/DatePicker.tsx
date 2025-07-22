'use client';

import { Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '../Button/Button';
import { Calendar } from '../Calendar/Calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover/Popover';
import { cn } from '@lib-utils';
import { useEffect, useState } from 'react';

const YEAR_RANGE = 10;

export function DatePicker({
  className,
  date,
  onSelect,
}: {
  className?: string;
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
}) {
  const today = new Date();
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth();
  const thisDate = today.getDate();

  const [open, setOpen] = useState(false);
  const [nextDate, setDate] = useState<Date | undefined>(date);

  useEffect(() => {
    if (date) {
      setDate(date);
    }
  }, [date]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!nextDate}
          className={cn(
            'data-[empty=true]:text-muted-foreground justify-start text-left font-normal',
            className,
          )}
        >
          <CalendarIcon className="mb-0.5 me-1" />
          {nextDate ? nextDate.toLocaleDateString() : <span>Select date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          defaultMonth={nextDate || today}
          selected={nextDate}
          startMonth={new Date(thisYear - YEAR_RANGE, thisMonth, thisDate)}
          endMonth={new Date(thisYear + YEAR_RANGE, thisMonth, thisDate)}
          onSelect={(date) => {
            setDate(date);
            setOpen(false);
            onSelect?.(date);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
