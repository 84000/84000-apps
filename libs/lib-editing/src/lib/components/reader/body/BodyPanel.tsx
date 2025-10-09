'use client';

import { TranslationReader } from '../TranslationReader';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Titles,
} from '@design-system';
import { TranslationEditorContent } from '../../editor';
import { Title } from '@data-access';

export const BodyPanel = ({
  titles,
  body,
}: {
  titles: Title[];
  body: TranslationEditorContent;
}) => {
  return (
    <Tabs
      defaultValue="translation"
      className="px-8 pb-[var(--header-height)] max-w-6xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-2 mx-auto -mt-10 z-10">
        <TabsTrigger value="translation">Translation</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
      </TabsList>
      <TabsContent value="translation">
        <div className="w-full">
          <div className="ms-12">
            <Titles titles={titles} />
          </div>
          <TranslationReader content={body} />
        </div>
      </TabsContent>
      <TabsContent value="source">Source text coming soon...</TabsContent>
      <TabsContent value="compare">
        Language comparison coming soon...
      </TabsContent>
    </Tabs>
  );
};
