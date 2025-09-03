import { EditorType } from '../types';

export const type: EditorType = 'translation';

export const content = {
  type: 'translation',
  content: [
    {
      attrs: {
        uuid: '54a251d8-e074-4516-973b-b353bfe385ed',
        class: 'passage',
        type: 'translationHeader',
        sort: 136,
        label: '1.',
      },
      type: 'passage',
      content: [
        {
          attrs: {
            level: 1,
          },
          type: 'heading',
          content: [
            {
              type: 'text',
              text: 'The Translation',
            },
          ],
        },
      ],
    },
    {
      attrs: {
        uuid: '31a821e6-9a69-4950-a32d-52645ef0fbe5',
        class: 'passage',
        type: 'translation',
        sort: 141,
        label: '1.1',
      },
      type: 'passage',
      content: [
        {
          type: 'paragraph',
          attrs: {
            hasTrailer: true,
          },
          content: [
            {
              type: 'text',
              text: 'Homage to all the buddhas and bodhisattvas!',
            },
            {
              type: 'endNoteLink',
              attrs: {
                endNote: 'some-uuid-2',
              },
            },
          ],
        },
      ],
    },
    {
      attrs: {
        uuid: '09d19c19-a9da-450b-be90-c517f106469b',
        class: 'passage',
        type: 'translation',
        sort: 146,
        label: '1.2',
      },
      type: 'passage',
      content: [
        {
          type: 'paragraph',
          attrs: {
            hasLeadingSpace: true,
          },
          content: [
            {
              type: 'text',
              text: 'Thus did I hear at one time. The Buddha was residing in Śrāvastī, in Jeta’s Grove, Anāthapiṇḍada’s park, together with a great community of monks, consisting of 1,250 monks, and a great assembly of bodhisattvas. At that time, the Blessed One addressed the monks:',
            },
            {
              type: 'endNoteLink',
              attrs: {
                endNote: 'some-uuid',
              },
            },
            {
              type: 'endNoteLink',
              attrs: {
                endNote: 'some-uuid-2',
              },
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: {
            hasLeadingSpace: true,
          },
          content: [
            {
              type: 'text',
              text: '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon four factors even at the cost of their lives. What are these four?',
            },
          ],
        },
        {
          type: 'lineGroup',
          content: [
            {
              type: 'line',
              content: [
                {
                  type: 'text',
                  text: 'kiṃcij jīrṇe tu pāṣāṇe khapattraṃ sakalaṃ graset.',
                },
              ],
            },
            {
              type: 'line',
              content: [
                {
                  type: 'text',
                  text: 'āśīviṣaṃ ca bhūtāni sarvāṇi na viśeṣayet.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      attrs: {
        uuid: 'b1c8f0d2-3c4e-4a5b-9d6f-7e8f9a0b1c2d',
        class: 'passage',
        type: 'abbreviationHeader',
        sort: 150,
        label: 'ab.',
      },
      type: 'passage',
      content: [
        {
          type: 'heading',
          attrs: {
            level: 3,
          },
          content: [
            {
              type: 'text',
              text: 'Abbreviations',
            },
          ],
        },
      ],
    },
    {
      attrs: {
        uuid: 'b1c8f0d2-3c4e-4a5b-9d6f-7e8f9a0b1c2d',
        class: 'passage',
        type: 'abbreviation',
        sort: 151,
      },
      type: 'passage',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'abbreviation',
                  content: [
                    {
                      type: 'text',
                      text: 'C',
                    },
                  ],
                },
                {
                  type: 'hasAbbreviation',
                  content: [
                    {
                      type: 'text',
                      text: 'Choné Kangyur',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
