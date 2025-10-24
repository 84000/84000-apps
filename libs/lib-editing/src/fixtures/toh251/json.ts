import { TranslationEditorContent } from '../../lib/components';
import { EditorType } from '../types';

export const type: EditorType = 'translation';

export const content: TranslationEditorContent = [
  {
    type: 'passage',
    attrs: {
      uuid: '0a812d07-8fcc-41b9-9af5-96ec9bce25d5',
      sort: 165,
      type: 'translationHeader',
      label: '1.',
    },
    content: [
      {
        type: 'heading',
        attrs: {
          level: 2,
          start: 0,
          end: 15,
          uuid: 'c4229046-ec92-4d1e-8bd2-ac9e860d0b64',
        },
        content: [
          {
            type: 'text',
            text: 'The Translation',
            attrs: {
              start: 0,
              end: 15,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: 'b7a07809-d6e0-427b-bfc6-50ea2acd8155',
      sort: 168,
      type: 'translation',
      label: '1.1',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 43,
          uuid: 'b7a07809-d6e0-427b-bfc6-50ea2acd8155',
        },
        content: [
          {
            type: 'text',
            text: 'Homage to all the buddhas and bodhisattvas!',
            attrs: {
              start: 0,
              end: 43,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: '2dda83c5-f367-4b13-96b0-14835d5bb2dd',
      sort: 170,
      type: 'translation',
      label: '1.2',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 262,
          uuid: '2dda83c5-f367-4b13-96b0-14835d5bb2dd',
          hasLeadingSpace: true,
        },
        content: [
          {
            type: 'text',
            text: 'Thus did I hear at one time. The Buddha was residing in ',
            attrs: {
              start: 0,
              end: 56,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'Śrāvastī',
            attrs: {
              start: 56,
              end: 64,
              uuid: '48b09ede-46cf-419a-9ec8-64c4a610b456',
              glossary: 'f2a07704-3c71-4f05-8e6a-5d326406fae2',
            },
            content: [
              {
                type: 'text',
                text: 'Śrāvastī',
              },
            ],
          },
          {
            type: 'text',
            text: ', in ',
            attrs: {
              start: 64,
              end: 69,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'Jeta’s Grove, Anāthapiṇḍada’s park',
            attrs: {
              start: 69,
              end: 103,
              uuid: '4ebf55f0-fddd-45e6-a9af-09997c6f96f5',
              glossary: '7fc58f66-5fbb-4973-8744-f6589f8aae97',
            },
            content: [
              {
                type: 'text',
                text: 'Jeta’s Grove, Anāthapiṇḍada’s park',
              },
            ],
          },
          {
            type: 'text',
            text: ', together with a great community of monks, consisting of 1,250 monks, and a great assembly of bodhisattvas. At that time, the Blessed One addressed the monks:',
            attrs: {
              start: 103,
              end: 262,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: 'df6f18e0-7db5-4b06-8a8a-fb3a31144f85',
      sort: 176,
      type: 'translation',
      label: '1.3',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 147,
          uuid: 'df6f18e0-7db5-4b06-8a8a-fb3a31144f85',
        },
        content: [
          {
            type: 'text',
            text: '“Monks, for as long as they live, bodhisattvas, ',
            attrs: {
              start: 0,
              end: 48,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'great beings',
            attrs: {
              start: 48,
              end: 60,
              uuid: '73776d26-6858-413b-9d62-5ffe18a59e4c',
              glossary: '1e6586e7-e5dd-49ef-8d6c-b97b66c6aa34',
            },
            content: [
              {
                type: 'text',
                text: 'great beings',
              },
            ],
          },
          {
            type: 'text',
            text: ', should not abandon four factors even at the cost of their lives. What are these four?',
            attrs: {
              start: 60,
              end: 147,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: '1350a8f8-cb5f-48d6-8d24-7152124b2ed9',
      sort: 181,
      type: 'translation',
      label: '1.4',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 138,
          uuid: '1350a8f8-cb5f-48d6-8d24-7152124b2ed9',
        },
        content: [
          {
            type: 'text',
            text: '“Monks, for as long as they live, bodhisattvas, ',
            attrs: {
              start: 0,
              end: 48,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'great beings',
            attrs: {
              start: 48,
              end: 60,
              uuid: '93fb08c3-dabb-45e3-b9d6-05d40fb8df92',
              glossary: '1e6586e7-e5dd-49ef-8d6c-b97b66c6aa34',
            },
            content: [
              {
                type: 'text',
                text: 'great beings',
              },
            ],
          },
          {
            type: 'text',
            text: ', should not abandon the ',
            attrs: {
              start: 60,
              end: 85,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'thought of awakening',
            attrs: {
              start: 85,
              end: 105,
              uuid: '7cb61bc2-cf3c-4b28-a026-56062c3febce',
              glossary: '445f17ca-164b-4c68-82a3-f9f3ee3595b6',
            },
            content: [
              {
                type: 'text',
                text: 'thought of awakening',
              },
            ],
          },
          {
            type: 'text',
            text: ' even at the cost of their lives.',
            attrs: {
              start: 105,
              end: 138,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: 'f1ed1290-9632-4bcf-8e9d-e6bf561e32a8',
      sort: 187,
      type: 'translation',
      label: '1.5',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 134,
          uuid: 'f1ed1290-9632-4bcf-8e9d-e6bf561e32a8',
        },
        content: [
          {
            type: 'text',
            text: '“Monks, for as long as they live, bodhisattvas, ',
            attrs: {
              start: 0,
              end: 48,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'great beings',
            attrs: {
              start: 48,
              end: 60,
              uuid: '1e14fa7b-adde-4991-8b26-3f4ff17ac243',
              glossary: '1e6586e7-e5dd-49ef-8d6c-b97b66c6aa34',
            },
            content: [
              {
                type: 'text',
                text: 'great beings',
              },
            ],
          },
          {
            type: 'text',
            text: ', should not abandon the ',
            attrs: {
              start: 60,
              end: 85,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'spiritual friend',
            attrs: {
              start: 85,
              end: 101,
              uuid: 'b720b5d4-3213-4638-b192-eb8e8dca8299',
              glossary: '4049f21f-fa6c-4180-80f5-0750c14162da',
            },
            content: [
              {
                type: 'text',
                text: 'spiritual friend',
              },
            ],
          },
          {
            type: 'text',
            text: ' even at the cost of their lives.',
            attrs: {
              start: 101,
              end: 134,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: '965340e9-4b95-4ab7-966d-059e25b094aa',
      sort: 193,
      type: 'translation',
      label: '1.6',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 136,
          uuid: '965340e9-4b95-4ab7-966d-059e25b094aa',
        },
        content: [
          {
            type: 'text',
            text: '“Monks, for as long as they live, bodhisattvas, ',
            attrs: {
              start: 0,
              end: 48,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'great beings',
            attrs: {
              start: 48,
              end: 60,
              uuid: '9be0ece5-da55-4d6d-934f-26149e9241ac',
              glossary: '1e6586e7-e5dd-49ef-8d6c-b97b66c6aa34',
            },
            content: [
              {
                type: 'text',
                text: 'great beings',
              },
            ],
          },
          {
            type: 'text',
            text: ', should not abandon ',
            attrs: {
              start: 60,
              end: 81,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'tolerance',
            attrs: {
              start: 81,
              end: 90,
              uuid: '247d0cd6-8f48-4e3d-8c70-ab5ddf7f1382',
              glossary: '3268038f-cca4-471a-94b3-13c62c85b7ca',
            },
            content: [
              {
                type: 'text',
                text: 'tolerance',
              },
            ],
          },
          {
            type: 'text',
            text: ' and ',
            attrs: {
              start: 90,
              end: 95,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'lenience',
            attrs: {
              start: 95,
              end: 103,
              uuid: 'bc10971b-913a-4a6b-b0cb-888310563c90',
              glossary: '4f7a6a56-6c00-43a0-b457-f3e741364a05',
            },
            content: [
              {
                type: 'text',
                text: 'lenience',
              },
            ],
          },
          {
            type: 'text',
            text: ' even at the cost of their lives.',
            attrs: {
              start: 103,
              end: 136,
            },
          },
          {
            type: 'endNoteLink',
            attrs: {
              start: 136,
              end: 136,
              endNote: '5433d5e2-c2f2-4a05-bc48-60dcb1109fbf',
              uuid: 'de90ce7e-9b47-4324-ae1c-b803ee1cd28e',
            },
            marks: [],
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: '06d427ec-46d0-4df1-9d48-08716f8710ec',
      sort: 202,
      type: 'translation',
      label: '1.7',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 140,
          uuid: '06d427ec-46d0-4df1-9d48-08716f8710ec',
        },
        content: [
          {
            type: 'text',
            text: '“Monks, for as long as they live, bodhisattvas, ',
            attrs: {
              start: 0,
              end: 48,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'great beings',
            attrs: {
              start: 48,
              end: 60,
              uuid: '85247b59-0ae2-4dc2-8f1d-fc7d43d18e04',
              glossary: '1e6586e7-e5dd-49ef-8d6c-b97b66c6aa34',
            },
            content: [
              {
                type: 'text',
                text: 'great beings',
              },
            ],
          },
          {
            type: 'text',
            text: ', should not abandon ',
            attrs: {
              start: 60,
              end: 81,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'dwelling in the wilderness',
            attrs: {
              start: 81,
              end: 107,
              uuid: '9f5020c2-2a3f-4faa-8d83-e953dfb0b255',
              glossary: 'c2d14c50-fccd-4438-bebc-6dfa4f77194e',
            },
            content: [
              {
                type: 'text',
                text: 'dwelling in the wilderness',
              },
            ],
          },
          {
            type: 'endNoteLink',
            attrs: {
              start: 107,
              end: 107,
              endNote: 'fb6c0152-67eb-4ef9-91bc-8fb6ea64e6f1',
              uuid: 'd5f88fe6-79d7-45ed-bf99-2cbfca3bc9f3',
            },
            marks: [],
          },
          {
            type: 'text',
            text: ' even at the cost of their lives.',
            attrs: {
              start: 107,
              end: 140,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: '7dea2dba-3580-4d45-8bb3-f9cea52a1991',
      sort: 209,
      type: 'translation',
      label: '1.8',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 133,
          uuid: '7dea2dba-3580-4d45-8bb3-f9cea52a1991',
        },
        content: [
          {
            type: 'text',
            text: '“Monks, for as long as they live, bodhisattvas, ',
            attrs: {
              start: 0,
              end: 48,
            },
          },
          {
            type: 'glossaryInstance',
            text: 'great beings',
            attrs: {
              start: 48,
              end: 60,
              uuid: 'f78b3d56-2441-426f-ae87-8285bb46c82a',
              glossary: '1e6586e7-e5dd-49ef-8d6c-b97b66c6aa34',
            },
            content: [
              {
                type: 'text',
                text: 'great beings',
              },
            ],
          },
          {
            type: 'text',
            text: ', should not abandon these four factors even at the cost of their lives.”',
            attrs: {
              start: 60,
              end: 133,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: 'd9096952-6a7d-4f87-93cf-a8c99a4c1ef3',
      sort: 213,
      type: 'translation',
      label: '1.9',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 120,
          uuid: 'd9096952-6a7d-4f87-93cf-a8c99a4c1ef3',
        },
        content: [
          {
            type: 'text',
            text: 'The Blessed One spoke these words, and once the Sugata had spoken in this way, he, the Teacher, also said the following:',
            attrs: {
              start: 0,
              end: 120,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      sort: 215,
      type: 'translation',
      label: '1.10',
    },
    content: [
      {
        type: 'lineGroup',
        attrs: {
          start: 0,
          end: 201,
          uuid: '7d2b05e7-c63f-40ea-8e6b-3ccefb83c603',
        },
        content: [
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: '“Let the wise conceive the thought of perfect awakening, ',
                attrs: {
                  start: 0,
                  end: 57,
                },
              },
            ],
            attrs: {
              start: 0,
              end: 57,
              uuid: '181a3584-20b8-4d6e-a0e5-c0ea733dbae6',
            },
          },
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: 'And not cast aside the thought of omniscience',
                attrs: {
                  start: 57,
                  end: 102,
                },
              },
              {
                type: 'endNoteLink',
                attrs: {
                  start: 102,
                  end: 102,
                  endNote: 'fb352874-9ae4-4658-97ea-ec944f2c6dfc',
                  uuid: 'bc5071aa-2099-4323-a353-6318e01de343',
                },
                marks: [],
              },
              {
                type: 'text',
                text: '; ',
                attrs: {
                  start: 102,
                  end: 104,
                },
              },
            ],
            attrs: {
              start: 57,
              end: 104,
              uuid: 'ca6b3880-1040-4920-b1ce-e80aa7e7bcd7',
            },
          },
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: 'Let them maintain the strength of ',
                attrs: {
                  start: 104,
                  end: 138,
                },
              },
              {
                type: 'glossaryInstance',
                text: 'tolerance',
                attrs: {
                  start: 138,
                  end: 147,
                  uuid: '79f4938e-df3c-40c8-a618-fa188a124517',
                  glossary: '3268038f-cca4-471a-94b3-13c62c85b7ca',
                },
                content: [
                  {
                    type: 'text',
                    text: 'tolerance',
                  },
                ],
              },
              {
                type: 'text',
                text: ' and ',
                attrs: {
                  start: 147,
                  end: 152,
                },
              },
              {
                type: 'glossaryInstance',
                text: 'lenience',
                attrs: {
                  start: 152,
                  end: 160,
                  uuid: 'dd65abe5-d658-40d9-820d-d9c427e40f5e',
                  glossary: '4f7a6a56-6c00-43a0-b457-f3e741364a05',
                },
                content: [
                  {
                    type: 'text',
                    text: 'lenience',
                  },
                ],
              },
              {
                type: 'text',
                text: ', ',
                attrs: {
                  start: 160,
                  end: 162,
                },
              },
            ],
            attrs: {
              start: 104,
              end: 162,
              uuid: '196aa179-8cea-4525-8a41-19eb0781312f',
            },
          },
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: 'And never forsake the ',
                attrs: {
                  start: 162,
                  end: 184,
                },
              },
              {
                type: 'glossaryInstance',
                text: 'spiritual friend',
                attrs: {
                  start: 184,
                  end: 200,
                  uuid: '83d1bcb5-15ed-492b-a401-d59e7a0c0ad3',
                  glossary: '4049f21f-fa6c-4180-80f5-0750c14162da',
                },
                content: [
                  {
                    type: 'text',
                    text: 'spiritual friend',
                  },
                ],
              },
              {
                type: 'text',
                text: '.',
                attrs: {
                  start: 200,
                  end: 201,
                },
              },
            ],
            attrs: {
              start: 162,
              end: 201,
              uuid: 'cf054120-9398-4855-8c62-3677041041d4',
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
      sort: 230,
      type: 'translation',
      label: '1.11',
    },
    content: [
      {
        type: 'lineGroup',
        attrs: {
          start: 0,
          end: 184,
          uuid: 'e9eec4aa-3a9f-435b-9111-4aa27a3deb11',
        },
        content: [
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: '“If the wise, like the king of beasts, abandon fear, ',
                attrs: {
                  start: 0,
                  end: 53,
                },
              },
            ],
            attrs: {
              start: 0,
              end: 53,
              uuid: '9b820bc7-def0-484e-bdd8-088d19e37b48',
            },
          },
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: 'Always remain ',
                attrs: {
                  start: 53,
                  end: 67,
                },
              },
              {
                type: 'glossaryInstance',
                text: 'dwelling in the wilderness',
                attrs: {
                  start: 67,
                  end: 93,
                  uuid: 'cc951a6e-3334-4f23-8727-8d1b9807e186',
                  glossary: 'c2d14c50-fccd-4438-bebc-6dfa4f77194e',
                },
                content: [
                  {
                    type: 'text',
                    text: 'dwelling in the wilderness',
                  },
                ],
              },
              {
                type: 'text',
                text: ', ',
                attrs: {
                  start: 93,
                  end: 95,
                },
              },
            ],
            attrs: {
              start: 53,
              end: 95,
              uuid: 'd65f874d-9d51-42f3-aa8d-60a200f566fd',
            },
          },
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: 'And constantly maintain these factors, ',
                attrs: {
                  start: 95,
                  end: 134,
                },
              },
            ],
            attrs: {
              start: 95,
              end: 134,
              uuid: '7defb520-391b-488f-8821-ab35d7fac408',
            },
          },
          {
            type: 'line',
            content: [
              {
                type: 'text',
                text: 'They will conquer the māras and attain awakening.”',
                attrs: {
                  start: 134,
                  end: 184,
                },
              },
            ],
            attrs: {
              start: 134,
              end: 184,
              uuid: 'e003cc18-27e1-4be5-b52d-ed4230eaf692',
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: '3c0a9671-d031-40fa-ae5b-def8887c4ded',
      sort: 241,
      type: 'translation',
      label: '1.12',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 149,
          uuid: '3c0a9671-d031-40fa-ae5b-def8887c4ded',
        },
        content: [
          {
            type: 'text',
            text: 'When the Blessed One had said this, the monks and bodhisattvas, together with the entire assembly, rejoiced and praised the words of the Blessed One.',
            attrs: {
              start: 0,
              end: 149,
            },
          },
        ],
      },
    ],
  },
  {
    type: 'passage',
    attrs: {
      uuid: 'de103c91-0bb2-4f90-9d98-c84718baecc9',
      sort: 243,
      type: 'translation',
      label: '1.13',
    },
    content: [
      {
        type: 'paragraph',
        attrs: {
          start: 0,
          end: 62,
          uuid: 'de103c91-0bb2-4f90-9d98-c84718baecc9',
          hasTrailer: true,
        },
        content: [
          {
            type: 'text',
            text: 'This concludes ',
            attrs: {
              start: 0,
              end: 15,
            },
          },
          {
            type: 'text',
            text: '“The Noble Mahāyāna Sūtra on the Four Factors.”',
            attrs: {
              start: 15,
              end: 62,
            },
            marks: [
              {
                type: 'italic',
              },
            ],
          },
        ],
      },
    ],
  },
];
