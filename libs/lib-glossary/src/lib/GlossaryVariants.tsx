'use client';

import { GlossaryPageItem } from '@data-access';
import { H4, H5, Li, Ul } from '@design-system';
import { useEffect, useState } from 'react';

export const GlossaryVariants = ({ detail }: { detail: GlossaryPageItem }) => {
  const [variants, setVariants] = useState<
    { language: string; variants: string[]; className: string }[]
  >([]);

  useEffect(() => {
    const variants = [];
    if (detail.english.length) {
      variants.push({
        language: 'English',
        variants: detail.english,
        className: 'capitalize',
      });
    }
    if (detail.sanskrit.length) {
      variants.push({
        language: 'Sanskrit',
        variants: detail.sanskrit,
        className: 'italic',
      });
    }
    if (detail.tibetan.length) {
      variants.push({
        language: 'Tibetan',
        variants: detail.tibetan,
        className: '',
      });
    }
    if (detail.chinese.length) {
      variants.push({
        language: 'Chinese',
        variants: detail.chinese,
        className: '',
      });
    }
    if (detail.pali.length) {
      variants.push({
        language: 'Pali',
        variants: detail.pali,
        className: 'italic',
      });
    }
    setVariants(variants);
  }, [detail]);

  if (!variants.length) {
    return null;
  }

  return (
    <>
      <H4 className="text-navy py-2">Name Variants</H4>
      {variants.map(({ language, variants: names, className }, index) => (
        <div key={index} className="py-0">
          <H5 className="text-navy py-0">{language}</H5>
          <Ul className="my-1 text-sm">
            {names.map((name, idx) => (
              <Li key={`${index}-${idx}`} className={className}>
                {name}
              </Li>
            ))}
          </Ul>
        </div>
      ))}
    </>
  );
};
