import { CanonNode, createBrowserClient, getCanonTree } from '@data-access';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@design-system';
import { cn } from '@lib-utils';

export const Sidebar = async () => {
  const client = createBrowserClient();
  const canon = await getCanonTree({ client });

  console.dir(canon, { depth: null });

  const CanonAccordion = ({
    canon,
    depth = 0,
  }: {
    canon: CanonNode;
    depth?: number;
  }) => {
    const className = `pl-${depth * 2}`;
    return (
      <Accordion type="single" collapsible className={cn('w-full', className)}>
        <AccordionItem value={canon.uuid}>
          <AccordionTrigger className={cn('text-lg font-semibold')}>
            {canon.label}
          </AccordionTrigger>
          <AccordionContent className={cn(className)}>
            {canon.children && canon.children.length > 0 ? (
              canon.children.map((child) => (
                <CanonAccordion
                  key={child.uuid}
                  canon={child}
                  depth={depth + 1}
                />
              ))
            ) : (
              <div className="p-2 text-sm text-gray-500">No sub-items</div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Canon Tree</h2>
      {canon?.children.map((node) => (
        <CanonAccordion key={node.uuid} canon={node} />
      ))}
    </div>
  );
};
