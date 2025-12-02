import { RefObject, useEffect } from 'react';
import { useNavigation } from '../NavigationProvider';

export const useGlossaryInstanceListener = ({
  ref,
}: {
  ref: RefObject<HTMLDivElement | null>;
}) => {
  const { updatePanel } = useNavigation();

  useEffect(() => {
    const div = ref.current;
    if (!div) {
      return;
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if the clicked element or any parent is a glossary instance
      const glossarySpan = target.closest(
        'span[type="glossaryInstance"]',
      ) as HTMLSpanElement;

      if (glossarySpan) {
        const glossaryUuid = glossarySpan.getAttribute('glossary');
        if (glossaryUuid) {
          updatePanel({
            name: 'right',
            state: { open: true, tab: 'glossary', hash: glossaryUuid },
          });
        }
      }
    };

    div.addEventListener('click', handleClick);

    return () => {
      div.removeEventListener('click', handleClick);
    };
  }, [ref, updatePanel]);
};
