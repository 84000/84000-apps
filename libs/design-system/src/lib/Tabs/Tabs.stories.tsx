import { Meta, StoryObj } from '@storybook/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

const meta: Meta<typeof Tabs> = {
  component: Tabs,
  title: 'Controls/Tabs',
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="imprint">
      <TabsList>
        <TabsTrigger value="acknowledments">Acknowledments</TabsTrigger>
        <TabsTrigger value="introduction">Introduction</TabsTrigger>
        <TabsTrigger value="imprint">Imprint</TabsTrigger>
      </TabsList>
      <TabsContent value="acknowledments">
        Acknowledgement content goes here.
      </TabsContent>
      <TabsContent value="introduction">
        Introduction content goes here.
      </TabsContent>
      <TabsContent value="imprint">
        Imprint content goes here.
      </TabsContent>
    </Tabs>
  ),
};

export default meta; 