import { Meta, StoryObj } from '@storybook/react';

import { TranslationPassage, passageComponentForType } from './Passage';
import { BodyItemType } from '@data-access';

const meta: Meta<typeof TranslationPassage> = {
  title: 'Translation/Body/Passages',
  component: TranslationPassage,
  tags: ['autodocs'],
};

type StoryProps = {
  passage: string;
};

export const Default: StoryObj<StoryProps> = {
  args: {
    passage: 'A sentence of translation passage content.',
  },
  argTypes: {
    passage: {
      control: 'text',
    },
  },
  render: ({ passage }) => {
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
  },
};

export default meta;
