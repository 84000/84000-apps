import { Meta, StoryObj } from '@storybook/react';

import { TranslationPassage, TranslationHeader } from './Passage';

const Passages = ({ header, passage }: { header: string; passage: string }) => {
  return (
    <>
      <TranslationHeader>{header}</TranslationHeader>
      <TranslationPassage>{passage}</TranslationPassage>
    </>
  );
};

const meta: Meta<typeof Passages> = {
  title: 'Translation/Body/Passages',
  component: Passages,
  args: {
    header: 'Header Content',
    passage: 'A sentence of translation passage content.',
  },
  argTypes: {
    header: {
      control: 'text',
    },
    passage: {
      control: 'text',
    },
  },
};

export const Passage: StoryObj<typeof TranslationPassage> = {};

export default meta;
