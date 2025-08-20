'use client';

import { GlossaryPageItem } from '@data-access';
import { Li, Ul } from '@design-system';
import { useEffect, useState } from 'react';

export const GlossaryVariants = ({ detail }: { detail: GlossaryPageItem }) => {
  const [variants, setVariants] = useState<
    { language: string; variant: string; className: string }[]
  >([]);

  useEffect(() => {
    const variants = [];
    if (detail.english.length) {
      variants.push({
        language: 'English',
        variant: detail.english.join(', '),
        className: '',
      });
    }
    if (detail.sanskrit.length) {
      variants.push({
        language: 'Sanskrit',
        variant: detail.sanskrit.join(', '),
        className: 'italic',
      });
    }
    if (detail.tibetan.length) {
      variants.push({
        language: 'Tibetan',
        variant: detail.tibetan.join(', '),
        className: 'italic',
      });
    }
    if (detail.chinese.length) {
      variants.push({
        language: 'Chinese',
        variant: detail.chinese.join(', '),
        className: '',
      });
    }
    if (detail.pali.length) {
      variants.push({
        language: 'Pali',
        variant: detail.pali.join(', '),
        className: 'italic',
      });
    }
    setVariants(variants);
  }, [detail]);

  if (!variants.length) {
    return null;
  }

  return (
    <div>
      <Ul>
        {variants.map(({ language, variant, className }, index) => (
          <Li key={index}>
            <span className="font-semibold">{language}</span>
            <span className="px-2 text-brick">→</span>
            <span className={className}>{variant}</span>
          </Li>
        ))}
      </Ul>
    </div>
  );
};
