import { Meta, StoryObj } from '@storybook/nextjs';

import {
  A,
  Blockquote,
  Code,
  H1,
  H2,
  H3,
  H4,
  Headline,
  Hero,
  Lead,
  LgText,
  Li,
  MutedText,
  P,
  SmText,
  HtmlTable,
  Tbody,
  Td,
  Th,
  Thead,
  Section,
  Tr,
  Ul,
} from './Typography';

const meta: Meta = {
  title: 'Theme/Typography',
  tags: ['autodocs'],
};

type Story = StoryObj;

export const Primary: Story = {
  render: (_props) => (
    <div className="flex flex-col gap-2">
      <Hero>Hero Headline</Hero>
      <Headline>Page Header (Headline)</Headline>
      <Section>Section Title (Title)</Section>
      <H1>Subsection Title (H1)</H1>
      <H2>Feature Header (H2)</H2>
      <H3>The quick brown fox jumps over the lazy dog (H3)</H3>
      <H4>The quick brown fox jumps over the lazy dog (H4)</H4>
      <P>The quick brown fox jumps over the lazy dog (P)</P>
      <A href="#">The quick brown fox jumps over the lazy dog (A)</A>
      <Blockquote>
        The quick brown fox jumps over the lazy dog (Blockquote)
      </Blockquote>
      <Ul>
        <Li>The quick brown fox jumps over the lazy dog (Li)</Li>
      </Ul>
      <div className="pb-4 w-full overflow-y-auto">
        <HtmlTable>
          <Thead>
            <Tr>
              <Th>The quick brown fox (Th)</Th>
              <Th>jumps over the lazy dog (Th)</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>The quick brown fox (Td)</Td>
              <Td>jumps over the lazy dog (Td)</Td>
            </Tr>
            <Tr>
              <Td>The quick brown fox (Td)</Td>
              <Td>jumps over the lazy dog (Td)</Td>
            </Tr>
            <Tr>
              <Td>The quick brown fox (Td)</Td>
              <Td>jumps over the lazy dog (Td)</Td>
            </Tr>
          </Tbody>
        </HtmlTable>
      </div>
      <div>
        <Code>
          {'if (the) { quick brown fox jumps over the lazy dog; } (Code)'}
        </Code>
      </div>
      <Lead>The quick brown fox jumps over the lazy dog (Lead)</Lead>
      <LgText>The quick brown fox jumps over the lazy dog (LgText)</LgText>
      <SmText>The quick brown fox jumps over the lazy dog (SmText)</SmText>
      <MutedText>
        The quick brown fox jumps over the lazy dog (MutedText)
      </MutedText>
    </div>
  ),
};

export default meta;
