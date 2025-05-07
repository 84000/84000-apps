'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

const CollapsibleIcon = () => (
  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
);

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleIcon };
