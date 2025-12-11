import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScrollArea } from './ScrollArea';

const meta: Meta = {
  title: 'Core/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
};

type StoryProps = {
  text: string;
  className: string;
};

type Story = StoryObj<StoryProps>;

export const Primary: Story = {
  args: {
    text: "Jokester began sneaking into the castle in the middle of the night and leaving jokes all over the place: under the king's pillow, in his soup, even in the royal toilet. The king was furious, but he couldn't seem to stop Jokester. And then, one day, the people of the kingdom discovered that the jokes left by Jokester were so funny that they couldn't help but laugh. And once they started laughing, they couldn't stop.",
    className: 'h-[200px] w-[200px] rounded-md border p-4',
  },
  render: ({ text, className }) => (
    <ScrollArea className={className}>{text}</ScrollArea>
  ),
};

export default meta;
