import { isStaticFeatureEnabled } from './static-features';

describe('isStaticFeatureEnabled', () => {
  const original = process.env.NEXT_PUBLIC_APPLICATION_NAME;
  const setApp = (name?: string) => {
    if (name === undefined) delete process.env.NEXT_PUBLIC_APPLICATION_NAME;
    else process.env.NEXT_PUBLIC_APPLICATION_NAME = name;
  };

  afterEach(() => setApp(original));

  describe('an allow-listed feature', () => {
    it('is on for an app it names', () => {
      setApp('scholars-room');
      expect(isStaticFeatureEnabled('glossary-attestations')).toBe(true);
    });

    it('is off for an app it does not name', () => {
      setApp('public-reading-room');
      expect(isStaticFeatureEnabled('glossary-attestations')).toBe(false);
    });

    it('is off when the app name is unset', () => {
      setApp(undefined);
      expect(isStaticFeatureEnabled('glossary-attestations')).toBe(false);
    });
  });

  describe('the restriction warning', () => {
    it.each(['studio', 'scholars-room'])(
      'is suppressed in the %s app',
      (app) => {
        setApp(app);
        expect(isStaticFeatureEnabled('show-restriction-warning')).toBe(false);
      },
    );

    it('is shown in the reader', () => {
      setApp('reader-embed');
      expect(isStaticFeatureEnabled('show-restriction-warning')).toBe(true);
    });

    // The reading room is the app that reported the bug, and it is the one
    // that may not set the variable at all. Failing open is the point.
    it('is shown when the app name is unset', () => {
      setApp(undefined);
      expect(isStaticFeatureEnabled('show-restriction-warning')).toBe(true);
    });
  });
});
