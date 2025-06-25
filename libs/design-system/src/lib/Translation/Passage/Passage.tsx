import { BodyItemType } from '@data-access';
import { H3, P } from '../../Typography/Typography';
import { ElementType } from 'react';

export const AcknowledgmentPassage = P;
export const IntroductionPassage = P;
export const SummaryPassage = P;
export const TranslationPassage = P;

export const AcknowledgmentHeader = H3;
export const SummaryHeader = H3;
export const TranslationHeader = H3;

export const passageComponentForType: { [key in BodyItemType]: ElementType } = {
  acknowledgment: AcknowledgmentPassage,
  acknowledgmentHeader: AcknowledgmentHeader,
  endnote: P,
  introduction: IntroductionPassage,
  summary: SummaryPassage,
  summaryHeader: SummaryHeader,
  toc: P,
  translation: TranslationPassage,
  translationHeader: TranslationHeader,
  unknown: P,
};
