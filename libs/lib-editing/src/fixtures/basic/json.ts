import { TranslationEditorContent } from '../../lib/components';
import { EditorType } from '../types';

export const type: EditorType = 'translation';

export const content: TranslationEditorContent = [
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
          level: 2,
          class: 'section-title',
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
        type: 'trailer',
        attrs: {
          uuid: 'some-uuid-for-trailer',
        },
        content: [
          {
            type: 'text',
            text: 'Homage to all the buddhas and bodhisattvas!',
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  notes: [
                    {
                      endNote: 'some-uuid-2',
                    },
                  ],
                },
              },
            ],
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
          start: 0,
          end: 640,
          uuid: 'f5faeec0-ad74-4c36-aab7-a1f492694460',
        },
        content: [
          {
            type: 'text',
            text: 'Of the other sūtras in this set, ',
            attrs: {
              start: 0,
              end: 33,
            },
          },
          {
            type: 'text',
            text: 'The Sūtra Teaching the Four Factors ',
            attrs: {
              start: 33,
              end: 69,
            },
            marks: [
              {
                type: 'italic',
                attrs: {
                  uuid: '6e26360d-627d-4a9e-91e6-a81e2b38432a',
                  lang: 'en',
                  type: 'inlineTitle',
                },
              },
            ],
          },
          {
            type: 'text',
            text: '(Toh 249)',
            attrs: {
              start: 69,
              end: 78,
            },
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  notes: [
                    {
                      endNote: '2cb57e37-0798-4d57-81ae-eb25b4822a16',
                      uuid: '1b1d26bc-4f47-44c3-a6e0-f2ff94f38116',
                      start: 78,
                      end: 78,
                      location: 'end',
                    },
                  ],
                },
              },
            ],
          },
          {
            type: 'text',
            text: ' is concerned with the four factors necessary for the practice of confession, while ',
            attrs: {
              start: 78,
              end: 162,
            },
          },
          {
            type: 'text',
            text: 'The Four Factors ',
            attrs: {
              start: 162,
              end: 179,
            },
            marks: [
              {
                type: 'italic',
                attrs: {
                  uuid: '159a9e7f-d8fb-46ae-8a2c-7ea20a831291',
                  lang: 'en',
                  type: 'inlineTitle',
                },
              },
            ],
          },
          {
            type: 'text',
            text: '(Toh 250)',
            attrs: {
              start: 179,
              end: 188,
            },
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  notes: [
                    {
                      endNote: '24ee6eb1-a9ce-4447-b1f4-b38fb8e4a426',
                      uuid: '30d3420e-b3f8-4b41-97e7-94242c6ad9a2',
                      start: 188,
                      end: 188,
                      location: 'end',
                    },
                  ],
                },
              },
            ],
          },
          {
            type: 'text',
            text: ' identifies four beliefs that a wise son of a good family should not accept as true. Two further works, ',
            attrs: {
              start: 188,
              end: 292,
            },
          },
          {
            type: 'text',
            text: 'The Accomplishment of the Sets of Four Qualities: The Bodhisattvas’ Prātimokṣa ',
            attrs: {
              start: 292,
              end: 371,
            },
            marks: [
              {
                type: 'italic',
                attrs: {
                  uuid: '4681e4c3-f07f-49c2-b061-9fec15722cb2',
                  lang: 'en',
                  type: 'inlineTitle',
                },
              },
            ],
          },
          {
            type: 'text',
            text: '(Toh 248)',
            attrs: {
              start: 371,
              end: 380,
            },
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  notes: [
                    {
                      endNote: '5c383b48-6d8b-4976-b8bd-1bab3f5a16d4',
                      uuid: 'badbdb97-b3e8-4dca-b31c-0a28c8432e6f',
                      start: 380,
                      end: 380,
                      location: 'end',
                    },
                  ],
                },
              },
            ],
          },
          {
            type: 'text',
            text: ' and ',
            attrs: {
              start: 380,
              end: 385,
            },
          },
          {
            type: 'text',
            text: 'The Fourfold Accomplishment ',
            attrs: {
              start: 385,
              end: 413,
            },
            marks: [
              {
                type: 'italic',
                attrs: {
                  uuid: 'e085cc9f-637c-4c8c-bcb1-f62d6d47c3f3',
                  lang: 'en',
                  type: 'inlineTitle',
                },
              },
            ],
          },
          {
            type: 'text',
            text: '(Toh 252)',
            attrs: {
              start: 413,
              end: 422,
            },
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  notes: [
                    {
                      endNote: 'd4bb4496-9915-45e9-9b41-6f4744056d34',
                      uuid: '54c51c32-4597-4174-9e23-184521c456e3',
                      start: 422,
                      end: 422,
                      location: 'end',
                    },
                  ],
                },
              },
            ],
          },
          {
            type: 'text',
            text: ' also concern themselves with “sets of four” (',
            attrs: {
              start: 422,
              end: 468,
            },
          },
          {
            type: 'text',
            text: 'catuṣka',
            attrs: {
              start: 468,
              end: 475,
            },
            marks: [
              {
                type: 'italic',
                attrs: {
                  start: 468,
                  end: 475,
                  uuid: '66346061-42b1-46ae-844d-a04f5bb9378b',
                  type: 'span',
                  lang: 'Sa-Ltn',
                  textStyle: 'foreign',
                },
              },
            ],
          },
          {
            type: 'text',
            text: ', ',
            attrs: {
              start: 475,
              end: 477,
            },
          },
          {
            type: 'text',
            text: 'bzhi pa',
            attrs: {
              start: 477,
              end: 484,
            },
            marks: [
              {
                type: 'italic',
                attrs: {
                  start: 477,
                  end: 484,
                  uuid: '108a6129-2c82-4b66-8b61-8f1fd21b4986',
                  type: 'span',
                  lang: 'Bo-Ltn',
                  textStyle: 'foreign',
                },
              },
            ],
          },
          {
            type: 'text',
            text: '), thereby forming a larger group of five sūtras in the Degé Kangyur that lay out key elements of the practice of the path in discrete sets of four factors.',
            attrs: {
              start: 484,
              end: 640,
            },
          },
        ],
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
];
