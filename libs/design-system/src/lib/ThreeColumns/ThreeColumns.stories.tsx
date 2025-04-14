import { Meta, StoryObj } from '@storybook/react';
import { ThreeColumns } from './ThreeColumns';
import { Title } from '../Translation/Title/Title';
import { P } from '../Typography/Typography';

const meta: Meta<typeof ThreeColumns> = {
  title: 'Layout/ThreeColumns',
  component: ThreeColumns,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof ThreeColumns>;

export const Default: Story = {
  render: (_props) => (
    <div className="w-full rounded-md border min-h-[400px]">
      <ThreeColumns>
        <div className="h-[400px]">
          <Title language={'en'}>Main column content</Title>
          <P>
            {`Lorem Ipsum is simply dummy text of the printing and typesetting
          industry. Lorem Ipsum has been the industry's standard dummy text ever
          since the 1500s`}
          </P>
        </div>
      </ThreeColumns>
    </div>
  ),
};

export default meta;
