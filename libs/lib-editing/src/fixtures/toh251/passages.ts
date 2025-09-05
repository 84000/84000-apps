import { PassageDTO } from '@data-access';
import { EditorType } from '../types';

export const type: EditorType = 'translation';

export const content: PassageDTO[] = [
  {
    sort: 165,
    type: 'translationHeader',
    uuid: '0a812d07-8fcc-41b9-9af5-96ec9bce25d5',
    label: '1.',
    xmlId: 'UT22084-066-009-section-1',
    parent: 'UT22084-066-009-section-1',
    content: 'The Translation',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 15, // NOTE: exclusive
        type: 'heading',
        uuid: 'c4229046-ec92-4d1e-8bd2-ac9e860d0b64',
        start: 0,
        content: [
          {
            'heading-level': 'h2',
          },
          {
            'heading-type': 'section-title',
          },
        ],
        passageUuid: '0a812d07-8fcc-41b9-9af5-96ec9bce25d5',
      },
    ],
  },
  {
    sort: 168,
    type: 'translation',
    uuid: 'b7a07809-d6e0-427b-bfc6-50ea2acd8155',
    label: '1.1',
    xmlId: 'UT22084-066-009-26',
    parent: 'UT22084-066-009-section-1',
    content: 'Homage to all the buddhas and bodhisattvas!',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [],
  },
  {
    sort: 170,
    type: 'translation',
    uuid: '2dda83c5-f367-4b13-96b0-14835d5bb2dd',
    label: '1.2',
    xmlId: 'UT22084-066-009-226',
    parent: 'UT22084-066-009-section-1',
    content:
      'Thus did I hear at one time. The Buddha was residing in Śrāvastī, in Jeta’s Grove, Anāthapiṇḍada’s park, together with a great community of monks, consisting of 1,250 monks, and a great assembly of bodhisattvas. At that time, the Blessed One addressed the monks:',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 0, // NOTE: inclusive (length 0)
        type: 'leading-space',
        uuid: 'c0e02497-7d8e-4150-9178-f13a2ad77d91',
        start: 0,
        content: [],
        passageUuid: '2dda83c5-f367-4b13-96b0-14835d5bb2dd',
      },
      {
        end: 63, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '48b09ede-46cf-419a-9ec8-64c4a610b456',
        start: 56,
        content: [
          {
            uuid: '55532312-84c3-4ab9-9220-58b7598c8440',
            glossary_xmlId: 'UT22084-066-009-72',
          },
        ],
        passageUuid: '2dda83c5-f367-4b13-96b0-14835d5bb2dd',
      },
      {
        end: 102, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '4ebf55f0-fddd-45e6-a9af-09997c6f96f5',
        start: 69,
        content: [
          {
            uuid: '86c17e77-82a6-4b77-bd21-3f012d36f1f5',
            glossary_xmlId: 'UT22084-066-009-284',
          },
        ],
        passageUuid: '2dda83c5-f367-4b13-96b0-14835d5bb2dd',
      },
    ],
  },
  {
    sort: 176,
    type: 'translation',
    uuid: 'df6f18e0-7db5-4b06-8a8a-fb3a31144f85',
    label: '1.3',
    xmlId: 'UT22084-066-009-30',
    parent: 'UT22084-066-009-section-1',
    content:
      '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon four factors even at the cost of their lives. What are these four?',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 147, // NOTE: inclusive
        type: 'quoted',
        uuid: '217f133b-e296-4782-bd37-9bb2de9798cd',
        start: 0,
        content: [
          {
            quote_xmlId: 'UT23703-113-010-249',
          },
          {
            'link-text-lookup': 'quotingTextShortcode',
          },
        ],
        passageUuid: 'df6f18e0-7db5-4b06-8a8a-fb3a31144f85',
      },
      {
        end: 125, // NOTE: inclusive
        type: 'quoted',
        uuid: '096b6b31-d7e7-45aa-89a5-eeddaa75944e',
        start: 8,
        content: [
          {
            quote_xmlId: 'UT23703-113-010-249',
          },
          {
            'link-text-lookup': 'quotingTextShortcode',
          },
        ],
        passageUuid: 'df6f18e0-7db5-4b06-8a8a-fb3a31144f85',
      },
      {
        end: 59, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '73776d26-6858-413b-9d62-5ffe18a59e4c',
        start: 48,
        content: [
          {
            uuid: 'a6c40c30-43ed-4634-9b0a-1d707dbc463f',
            glossary_xmlId: 'UT22084-066-009-69',
          },
        ],
        passageUuid: 'df6f18e0-7db5-4b06-8a8a-fb3a31144f85',
      },
    ],
  },
  {
    sort: 181,
    type: 'translation',
    uuid: '1350a8f8-cb5f-48d6-8d24-7152124b2ed9',
    label: '1.4',
    xmlId: 'UT22084-066-009-31',
    parent: 'UT22084-066-009-section-1',
    content:
      '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon the thought of awakening even at the cost of their lives.',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 59, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '93fb08c3-dabb-45e3-b9d6-05d40fb8df92',
        start: 48,
        content: [
          {
            uuid: 'a6c40c30-43ed-4634-9b0a-1d707dbc463f',
            glossary_xmlId: 'UT22084-066-009-69',
          },
        ],
        passageUuid: '1350a8f8-cb5f-48d6-8d24-7152124b2ed9',
      },
      {
        end: 104, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '7cb61bc2-cf3c-4b28-a026-56062c3febce',
        start: 85,
        content: [
          {
            uuid: '71c3e498-a282-46c2-a1b2-09bff483deac',
            glossary_xmlId: 'UT22084-066-009-64',
          },
        ],
        passageUuid: '1350a8f8-cb5f-48d6-8d24-7152124b2ed9',
      },
    ],
  },
  {
    sort: 187,
    type: 'translation',
    uuid: 'f1ed1290-9632-4bcf-8e9d-e6bf561e32a8',
    label: '1.5',
    xmlId: 'UT22084-066-009-32',
    parent: 'UT22084-066-009-section-1',
    content:
      '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon the spiritual friend even at the cost of their lives.',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 59, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '1e14fa7b-adde-4991-8b26-3f4ff17ac243',
        start: 48,
        content: [
          {
            uuid: 'a6c40c30-43ed-4634-9b0a-1d707dbc463f',
            glossary_xmlId: 'UT22084-066-009-69',
          },
        ],
        passageUuid: 'f1ed1290-9632-4bcf-8e9d-e6bf561e32a8',
      },
      {
        end: 100, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: 'b720b5d4-3213-4638-b192-eb8e8dca8299',
        start: 85,
        content: [
          {
            uuid: '9861c4ef-4f1e-4332-bb65-01b36e4285a7',
            glossary_xmlId: 'UT22084-066-009-68',
          },
        ],
        passageUuid: 'f1ed1290-9632-4bcf-8e9d-e6bf561e32a8',
      },
    ],
  },
  {
    sort: 193,
    type: 'translation',
    uuid: '965340e9-4b95-4ab7-966d-059e25b094aa',
    label: '1.6',
    xmlId: 'UT22084-066-009-33',
    parent: 'UT22084-066-009-section-1',
    content:
      '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon tolerance and lenience even at the cost of their lives.',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 59, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '9be0ece5-da55-4d6d-934f-26149e9241ac',
        start: 48,
        content: [
          {
            uuid: 'a6c40c30-43ed-4634-9b0a-1d707dbc463f',
            glossary_xmlId: 'UT22084-066-009-69',
          },
        ],
        passageUuid: '965340e9-4b95-4ab7-966d-059e25b094aa',
      },
      {
        end: 89, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: '247d0cd6-8f48-4e3d-8c70-ab5ddf7f1382',
        start: 81,
        content: [
          {
            uuid: '64a50fd8-0fd0-4a50-a5f8-c081ba5ef861',
            glossary_xmlId: 'UT22084-066-009-66',
          },
        ],
        passageUuid: '965340e9-4b95-4ab7-966d-059e25b094aa',
      },
      {
        end: 102, // NOTE: inclusive
        type: 'glossary-instance',
        uuid: 'bc10971b-913a-4a6b-b0cb-888310563c90',
        start: 95,
        content: [
          {
            uuid: 'c0488d9a-13cf-4890-bb99-957a44404c94',
            glossary_xmlId: 'UT22084-066-009-65',
          },
        ],
        passageUuid: '965340e9-4b95-4ab7-966d-059e25b094aa',
      },
      {
        end: 136, // NOTE: inclusive (length 0)
        type: 'end-note-link',
        uuid: 'de90ce7e-9b47-4324-ae1c-b803ee1cd28e',
        start: 136,
        content: [
          {
            uuid: '5433d5e2-c2f2-4a05-bc48-60dcb1109fbf',
            endnote_xmlId: 'UT22084-066-009-34',
          },
        ],
        passageUuid: '965340e9-4b95-4ab7-966d-059e25b094aa',
      },
    ],
  },
  {
    sort: 202,
    type: 'translation',
    uuid: '06d427ec-46d0-4df1-9d48-08716f8710ec',
    label: '1.7',
    xmlId: 'UT22084-066-009-35',
    parent: 'UT22084-066-009-section-1',
    content:
      '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon dwelling in the wilderness even at the cost of their lives.',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 59,
        type: 'glossary-instance',
        uuid: '85247b59-0ae2-4dc2-8f1d-fc7d43d18e04',
        start: 48,
        content: [
          {
            uuid: 'a6c40c30-43ed-4634-9b0a-1d707dbc463f',
            glossary_xmlId: 'UT22084-066-009-69',
          },
        ],
        passageUuid: '06d427ec-46d0-4df1-9d48-08716f8710ec',
      },
      {
        end: 106,
        type: 'glossary-instance',
        uuid: '9f5020c2-2a3f-4faa-8d83-e953dfb0b255',
        start: 81,
        content: [
          {
            uuid: '54ba640b-1d20-454d-bff4-14becefbc904',
            glossary_xmlId: 'UT22084-066-009-67',
          },
        ],
        passageUuid: '06d427ec-46d0-4df1-9d48-08716f8710ec',
      },
      {
        end: 107,
        type: 'end-note-link',
        uuid: 'd5f88fe6-79d7-45ed-bf99-2cbfca3bc9f3',
        start: 107,
        content: [
          {
            uuid: 'fb6c0152-67eb-4ef9-91bc-8fb6ea64e6f1',
            endnote_xmlId: 'UT22084-066-009-135',
          },
        ],
        passageUuid: '06d427ec-46d0-4df1-9d48-08716f8710ec',
      },
    ],
  },
  {
    sort: 209,
    type: 'translation',
    uuid: '7dea2dba-3580-4d45-8bb3-f9cea52a1991',
    label: '1.8',
    xmlId: 'UT22084-066-009-36',
    parent: 'UT22084-066-009-section-1',
    content:
      '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon these four factors even at the cost of their lives.”',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 59,
        type: 'glossary-instance',
        uuid: 'f78b3d56-2441-426f-ae87-8285bb46c82a',
        start: 48,
        content: [
          {
            uuid: 'a6c40c30-43ed-4634-9b0a-1d707dbc463f',
            glossary_xmlId: 'UT22084-066-009-69',
          },
        ],
        passageUuid: '7dea2dba-3580-4d45-8bb3-f9cea52a1991',
      },
    ],
  },
  {
    sort: 213,
    type: 'translation',
    uuid: 'd9096952-6a7d-4f87-93cf-a8c99a4c1ef3',
    label: '1.9',
    xmlId: 'UT22084-066-009-37',
    parent: 'UT22084-066-009-section-1',
    content:
      'The Blessed One spoke these words, and once the Sugata had spoken in this way, he, the Teacher, also said the following:',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: null,
  },
  {
    sort: 215,
    type: 'translation',
    uuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
    label: '1.10',
    xmlId: 'UT22084-066-009-38',
    parent: 'UT22084-066-009-section-1',
    content:
      '“Let the wise conceive the thought of perfect awakening, And not cast aside the thought of omniscience; Let them maintain the strength of tolerance and lenience, And never forsake the spiritual friend.',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 201, // NOTE: exclusive (length is 201)
        type: 'line-group',
        uuid: '7d2b05e7-c63f-40ea-8e6b-3ccefb83c603',
        start: 0,
        content: [],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 56, // NOTE: inclusive (excludes trailing space)
        type: 'line',
        uuid: '181a3584-20b8-4d6e-a0e5-c0ea733dbae6',
        start: 0,
        content: [],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 103, // NOTE: inclusive (excludes trailing space)
        type: 'line',
        uuid: 'ca6b3880-1040-4920-b1ce-e80aa7e7bcd7',
        start: 57,
        content: [],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 102,
        type: 'end-note-link',
        uuid: 'bc5071aa-2099-4323-a353-6318e01de343',
        start: 102,
        content: [
          {
            uuid: 'fb352874-9ae4-4658-97ea-ec944f2c6dfc',
            endnote_xmlId: 'UT22084-066-009-39',
          },
        ],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 161, // NOTE: inclusive (excludes trailing space)
        type: 'line',
        uuid: '196aa179-8cea-4525-8a41-19eb0781312f',
        start: 104,
        content: [],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 146,
        type: 'glossary-instance',
        uuid: '79f4938e-df3c-40c8-a618-fa188a124517',
        start: 138,
        content: [
          {
            uuid: '64a50fd8-0fd0-4a50-a5f8-c081ba5ef861',
            glossary_xmlId: 'UT22084-066-009-66',
          },
        ],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 159,
        type: 'glossary-instance',
        uuid: 'dd65abe5-d658-40d9-820d-d9c427e40f5e',
        start: 152,
        content: [
          {
            uuid: 'c0488d9a-13cf-4890-bb99-957a44404c94',
            glossary_xmlId: 'UT22084-066-009-65',
          },
        ],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 201, // NOTE: exclusive (no trailing space)
        type: 'line',
        uuid: 'cf054120-9398-4855-8c62-3677041041d4',
        start: 162,
        content: [],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
      {
        end: 199,
        type: 'glossary-instance',
        uuid: '83d1bcb5-15ed-492b-a401-d59e7a0c0ad3',
        start: 184,
        content: [
          {
            uuid: '9861c4ef-4f1e-4332-bb65-01b36e4285a7',
            glossary_xmlId: 'UT22084-066-009-68',
          },
        ],
        passageUuid: '7ece3672-4152-4d60-a0d5-cc623a8cfa6f',
      },
    ],
  },
  {
    sort: 230,
    type: 'translation',
    uuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
    label: '1.11',
    xmlId: 'UT22084-066-009-40',
    parent: 'UT22084-066-009-section-1',
    content:
      '“If the wise, like the king of beasts, abandon fear, Always remain dwelling in the wilderness, And constantly maintain these factors, They will conquer the māras and attain awakening.”',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 184, // NOTE: exclusive (length is 184)
        type: 'line-group',
        uuid: 'e9eec4aa-3a9f-435b-9111-4aa27a3deb11',
        start: 0,
        content: [],
        passageUuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
      },
      {
        end: 52, // NOTE: inclusive (excludes trailing space)
        type: 'line',
        uuid: '9b820bc7-def0-484e-bdd8-088d19e37b48',
        start: 0,
        content: [],
        passageUuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
      },
      {
        end: 94, // NOTE: inclusive (excludes trailing space)
        type: 'line',
        uuid: 'd65f874d-9d51-42f3-aa8d-60a200f566fd',
        start: 53,
        content: [],
        passageUuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
      },
      {
        end: 92,
        type: 'glossary-instance',
        uuid: 'cc951a6e-3334-4f23-8727-8d1b9807e186',
        start: 67,
        content: [
          {
            uuid: '54ba640b-1d20-454d-bff4-14becefbc904',
            glossary_xmlId: 'UT22084-066-009-67',
          },
        ],
        passageUuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
      },
      {
        end: 133, // NOTE: inclusive (excludes trailing space)
        type: 'line',
        uuid: '7defb520-391b-488f-8821-ab35d7fac408',
        start: 95,
        content: [],
        passageUuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
      },
      {
        end: 184, // NOTE: exclusive (no trailing space)
        type: 'line',
        uuid: 'e003cc18-27e1-4be5-b52d-ed4230eaf692',
        start: 134,
        content: [],
        passageUuid: 'ee947d31-48e1-4b37-a901-b999b24962f3',
      },
    ],
  },
  {
    sort: 241,
    type: 'translation',
    uuid: '3c0a9671-d031-40fa-ae5b-def8887c4ded',
    label: '1.12',
    xmlId: 'UT22084-066-009-41',
    parent: 'UT22084-066-009-section-1',
    content:
      'When the Blessed One had said this, the monks and bodhisattvas, together with the entire assembly, rejoiced and praised the words of the Blessed One.',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: null,
  },
  {
    sort: 243,
    type: 'translation',
    uuid: 'de103c91-0bb2-4f90-9d98-c84718baecc9',
    label: '1.13',
    xmlId: 'UT22084-066-009-42',
    parent: 'UT22084-066-009-section-1',
    content: 'This concludes “The Noble Mahāyāna Sūtra on the Four Factors.”',
    workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    annotations: [
      {
        end: 62,
        type: 'trailer',
        uuid: '76612414-df30-4c73-89fa-139e794a4a4d',
        start: 0,
        content: [],
        passageUuid: 'de103c91-0bb2-4f90-9d98-c84718baecc9',
      },
      {
        end: 62, // NOTE: exclusive
        type: 'inline-title',
        uuid: '895f43ec-7189-4273-b067-d557523723aa',
        start: 15,
        content: [
          {
            lang: 'en',
          },
        ],
        passageUuid: 'de103c91-0bb2-4f90-9d98-c84718baecc9',
      },
    ],
  },
];
