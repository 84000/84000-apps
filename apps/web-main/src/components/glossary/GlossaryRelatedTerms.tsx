import { GlossaryPageItem } from '@data-access';
import { Button, H4 } from '@design-system';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export const GlossaryRelatedTerms = ({
  detail,
}: {
  detail: GlossaryPageItem;
}) => {
  const [relatedEntities, setRelatedEntities] = useState<{
    [uuid: string]: string;
  }>({});
  const [relatedEntityUuids, setRelatedEntityUuids] = useState<string[]>([]);

  useEffect(() => {
    const authorityUuid = detail.authorityUuid;
    const related: { [uuid: string]: string } = {};
    detail.relatedEntities.forEach((entity) => {
      if (entity.sourceUuid !== authorityUuid) {
        related[entity.sourceUuid] = entity.sourceHeadword;
      }

      if (entity.targetUuid !== authorityUuid) {
        related[entity.targetUuid] = entity.targetHeadword;
      }
    });

    setRelatedEntities(related);
    setRelatedEntityUuids(Object.keys(related));
  }, [detail.relatedEntities, detail.authorityUuid]);

  if (!relatedEntityUuids.length) {
    return null;
  }

  return (
    <div>
      <H4 className="pb-8">Related</H4>
      <div className="flex flex-wrap gap-2">
        {relatedEntityUuids.map((uuid) => (
          <Button
            asChild
            key={uuid}
            variant="outline"
            size="sm"
            className="text-sm rounded-full"
          >
            <Link href={`/glossary/${uuid}`}>{relatedEntities[uuid]}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
};
