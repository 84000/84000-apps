import { Meta, StoryObj } from '@storybook/react';

import { passageComponentForType } from './Passage';
import { BodyItemType } from '@data-access';

const Passages = ({ passage }: { passage: string }) => {
  const keys = Object.keys(passageComponentForType).filter(
    (key) => key !== 'unknown',
  );
  return (
    <>
      {keys.map((key) => {
        const Component = passageComponentForType[key as BodyItemType];
        return (
          <Component key={key}>
            {key}: {passage}
          </Component>
        );
      })}
    </>
  );
};

const meta: Meta<typeof Passages> = {
  title: 'Translation/Body/Passages',
  component: Passages,
  args: {
    passage: 'A sentence of translation passage content.',
  },
  argTypes: {
    passage: {
      control: 'text',
    },
  },
};

export const Default: StoryObj<typeof Passages> = {};

export default meta;
