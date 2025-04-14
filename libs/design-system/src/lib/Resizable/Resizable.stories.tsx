import { Meta, StoryObj } from '@storybook/react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from './Resizable';

const meta: Meta<typeof ResizablePanelGroup> = {
  title: 'Layout/Resizable',
  component: ResizablePanelGroup,
  tags: ['autodocs'],
};

type ResizableStoryProps = {
  withHandle: boolean;
  collapsible: boolean;
  collapsedSize: number;
  minSize: number;
  defaultSize: number;
  maxSize: number;
  direction: 'horizontal' | 'vertical';
};

type Story = StoryObj<ResizableStoryProps>;

export const Default: Story = {
  args: {
    withHandle: false,
    collapsible: false,
    collapsedSize: 4,
    minSize: 10,
    defaultSize: 25,
    maxSize: 50,
    direction: 'horizontal',
  },
  argTypes: {
    withHandle: { control: 'boolean' },
    collapsible: { control: 'boolean' },
    collapsedSize: { control: 'number' },
    minSize: { control: 'number' },
    defaultSize: { control: 'number' },
    maxSize: { control: 'number' },
    direction: { control: 'radio', options: ['horizontal', 'vertical'] },
  },
  render: ({
    withHandle,
    collapsible,
    collapsedSize,
    minSize,
    defaultSize,
    maxSize,
    direction,
  }) => (
    <ResizablePanelGroup
      direction={direction}
      className="min-h-[200px] rounded-md border"
    >
      <ResizablePanel
        collapsible={collapsible}
        collapsedSize={collapsedSize}
        minSize={minSize}
        defaultSize={defaultSize}
        maxSize={maxSize}
      >
        <div className="text-center p-4">Col 1</div>
      </ResizablePanel>
      <ResizableHandle withHandle={withHandle} />
      <ResizablePanel minSize={20}>
        <div className="text-center p-4">Col 2</div>
      </ResizablePanel>
      <ResizableHandle withHandle={withHandle} />
      <ResizablePanel
        collapsible={collapsible}
        collapsedSize={collapsedSize}
        minSize={minSize}
        defaultSize={defaultSize}
        maxSize={maxSize}
      >
        <div className="text-center p-4">Col 3</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export default meta;
