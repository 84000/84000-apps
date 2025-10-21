import { Meta, StoryObj } from '@storybook/nextjs';
import { LongTitles } from './LongTitles';

const meta: Meta<typeof LongTitles> = {
  title: 'Translation/Front Matter/LongTitles',
  component: LongTitles,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof LongTitles>;

export const Primary: Story = {
  args: {
    imprint: {
      toh: 'Toh 1-1',
      license: {
        link: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        name: 'CC BY-NC-ND',
        description:
          'This work is provided under the protection of a Creative Commons CC BY-NC-ND (Attribution - Non-commercial - No-derivatives) 3.0 copyright. It may be copied or printed for fair use, but only with full attribution, and not for commercial advantage or personal compensation. For full details, see the Creative Commons license.',
      },
      section: 'Chapters on Monastic Discipline',
      version: '1.37.20',
      uuid: '092e9a3c-12a6-4e1c-a05b-16835c0e62a8',
      longTitles: {
        bo: 'འདུལ་བ་གཞི་ལས། རབ་ཏུ་འབྱུང་བའི་གཞི།',
        en: '“The Chapter on Going Forth” from The Chapters on Monastic Discipline',
        'Bo-Ltn': '’dul ba gzhi las/ rab tu ’byung ba’i gzhi',
        'Sa-Ltn': 'Vinayavastu Pravrajyāvastu',
      },
      mainTitles: {
        bo: 'རབ་ཏུ་འབྱུང་བའི་གཞི།',
        en: 'The Chapter on Going Forth',
        'Bo-Ltn': 'rab tu ’byung ba’i gzhi',
        'Sa-Ltn': 'Pravrajyāvastu',
      },
      publishYear: '2018',
      tibetanAuthors:
        'Dharmākara, Palgyi Lhünpo, Paltsek, Sarvajñādeva, Vidyākaraprabha',
      sourceDescription: 'Degé Kangyur, vol. 1 (’dul ba, ka), folios 1.a–131.a',
      publisherStatement:
        '84000: Translating the Words of the Buddha is a global non-profit initiative to translate all the Buddha’s words into modern languages, and to make them available to everyone.',
      tibetanTranslators:
        'Dharmākara, Palgyi Lhünpo, Paltsek, Sarvajñādeva, Vidyākaraprabha',
    },
  },
  argTypes: {
    imprint: { control: false },
  },
};

export default meta;
