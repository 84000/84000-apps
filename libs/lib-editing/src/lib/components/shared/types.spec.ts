import { locationForPassageType, sectionForPassageType } from './types';

describe('sectionForPassageType', () => {
  it.each([
    ['endnotesHeader', 'endnotes'],
    ['abbreviationsHeader', 'abbreviations'],
    ['introductionHeader', 'introduction'],
    ['translation ', 'translation'],
    ['translation', 'translation'],
    ['unknown', 'unknown'],
    [undefined, ''],
    [null, ''],
  ])('reads %p as section %p', (type, section) => {
    expect(sectionForPassageType(type)).toBe(section);
  });
});

describe('locationForPassageType', () => {
  it.each([
    ['endnotesHeader', 'right', 'endnotes'],
    ['abbreviationsHeader', 'right', 'abbreviations'],
    ['introductionHeader', 'main', 'front'],
    ['translation ', 'main', 'translation'],
    ['unknown', 'main', 'translation'],
    [undefined, 'main', 'translation'],
    [null, 'main', 'translation'],
  ])('places %p in %s/%s', (type, panel, tab) => {
    expect(locationForPassageType(type)).toEqual({ panel, tab });
  });
});
