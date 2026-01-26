import type { BodyItemType } from '@data-access';

/**
 * Map GraphQL PassageType enum to database passage types
 */
export const PASSAGE_TYPE_MAP: Record<string, BodyItemType> = {
  ABBREVIATIONS: 'abbreviations',
  ABBREVIATIONS_HEADER: 'abbreviationsHeader',
  ACKNOWLEDGMENT: 'acknowledgment',
  ACKNOWLEDGMENT_HEADER: 'acknowledgmentHeader',
  APPENDIX: 'appendix',
  APPENDIX_HEADER: 'appendixHeader',
  COLOPHON: 'colophon',
  COLOPHON_HEADER: 'colophonHeader',
  ENDNOTES: 'endnotes',
  ENDNOTES_HEADER: 'endnotesHeader',
  HOMAGE: 'homage',
  HOMAGE_HEADER: 'homageHeader',
  INTRODUCTION: 'introduction',
  INTRODUCTION_HEADER: 'introductionHeader',
  PRELUDE: 'prelude',
  PRELUDE_HEADER: 'preludeHeader',
  PROLOGUE: 'prologue',
  PROLOGUE_HEADER: 'prologueHeader',
  SUMMARY: 'summary',
  SUMMARY_HEADER: 'summaryHeader',
  TRANSLATION: 'translation',
  TRANSLATION_HEADER: 'translationHeader',
  UNKNOWN: 'unknown',
};

/**
 * Map database passage types to GraphQL enum values
 */
export const PASSAGE_TYPE_TO_ENUM: Record<BodyItemType, string> = {
  abbreviations: 'ABBREVIATIONS',
  abbreviationsHeader: 'ABBREVIATIONS_HEADER',
  acknowledgment: 'ACKNOWLEDGMENT',
  acknowledgmentHeader: 'ACKNOWLEDGMENT_HEADER',
  appendix: 'APPENDIX',
  appendixHeader: 'APPENDIX_HEADER',
  colophon: 'COLOPHON',
  colophonHeader: 'COLOPHON_HEADER',
  endnotes: 'ENDNOTES',
  endnotesHeader: 'ENDNOTES_HEADER',
  homage: 'HOMAGE',
  homageHeader: 'HOMAGE_HEADER',
  introduction: 'INTRODUCTION',
  introductionHeader: 'INTRODUCTION_HEADER',
  prelude: 'PRELUDE',
  preludeHeader: 'PRELUDE_HEADER',
  prologue: 'PROLOGUE',
  prologueHeader: 'PROLOGUE_HEADER',
  summary: 'SUMMARY',
  summaryHeader: 'SUMMARY_HEADER',
  translation: 'TRANSLATION',
  translationHeader: 'TRANSLATION_HEADER',
  unknown: 'UNKNOWN',
};

/**
 * Map database passage types (camelCase) to database format
 */
export const PASSAGE_TYPE_TO_DB: Record<string, string> = {
  ABBREVIATIONS: 'abbreviations',
  ABBREVIATIONS_HEADER: 'abbreviationsHeader',
  ACKNOWLEDGMENT: 'acknowledgment',
  ACKNOWLEDGMENT_HEADER: 'acknowledgmentHeader',
  APPENDIX: 'appendix',
  APPENDIX_HEADER: 'appendixHeader',
  COLOPHON: 'colophon',
  COLOPHON_HEADER: 'colophonHeader',
  ENDNOTES: 'endnotes',
  ENDNOTES_HEADER: 'endnotesHeader',
  HOMAGE: 'homage',
  HOMAGE_HEADER: 'homageHeader',
  INTRODUCTION: 'introduction',
  INTRODUCTION_HEADER: 'introductionHeader',
  PRELUDE: 'prelude',
  PRELUDE_HEADER: 'preludeHeader',
  PROLOGUE: 'prologue',
  PROLOGUE_HEADER: 'prologueHeader',
  SUMMARY: 'summary',
  SUMMARY_HEADER: 'summaryHeader',
  TRANSLATION: 'translation',
  TRANSLATION_HEADER: 'translationHeader',
  UNKNOWN: 'unknown',
};
