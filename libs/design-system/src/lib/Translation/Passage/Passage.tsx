import { BodyItemType } from '@data-access';
import { H3, P } from '../../Typography/Typography';
import { ElementType } from 'react';

export const AbbreviationHeader = H3;
export const AbbreviationPassage = P;
export const AcknowledgmentHeader = H3;
export const AcknowledgmentPassage = P;
export const AppendixHeader = H3;
export const AppendixPassage = P;
export const ColophonHeader = H3;
export const ColophonPassage = P;
export const EndNotesHeader = H3;
export const EndNotePassage = P;
export const HomageHeader = H3;
export const HomagePassage = P;
export const IntroductionHeader = H3;
export const IntroductionPassage = P;
export const PreludeHeader = H3;
export const PreludePassage = P;
export const PrologueHeader = H3;
export const ProloguePassage = P;
export const SummaryHeader = H3;
export const SummaryPassage = P;
export const TranslationHeader = H3;
export const TranslationPassage = P;
export const UnknownPassage = P;

export const passageComponentForType: { [key in BodyItemType]: ElementType } = {
  abbreviations: AbbreviationPassage,
  abbreviationHeader: AbbreviationHeader,
  appendix: AppendixPassage,
  appendixHeader: AppendixHeader,
  colophon: ColophonPassage,
  colophonHeader: ColophonHeader,
  acknowledgment: AcknowledgmentPassage,
  acknowledgmentHeader: AcknowledgmentHeader,
  endnote: P,
  endnotesHeader: EndNotesHeader,
  homage: HomagePassage,
  homageHeader: HomageHeader,
  introduction: IntroductionPassage,
  introductionHeader: IntroductionHeader,
  prelude: PreludePassage,
  preludeHeader: PreludeHeader,
  prologue: ProloguePassage,
  prologueHeader: PrologueHeader,
  summary: SummaryPassage,
  summaryHeader: SummaryHeader,
  toc: P,
  translation: TranslationPassage,
  translationHeader: TranslationHeader,
  unknown: UnknownPassage,
};
