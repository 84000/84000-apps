'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { Button } from '@design-system';
import { usePathname } from 'next/navigation';

type FeaturebaseMessage = {
  target: 'FeaturebaseWidget';
  data: {
    action: 'openFeedbackWidget';
    setBoard?: string;
  };
};

export const FeedbackButton = () => {
  const organization = process.env.NEXT_PUBLIC_FEATUREBASE_ORG;
  const defaultBoard = process.env.NEXT_PUBLIC_FEATUREBASE_BOARD;

  const pathname = usePathname();

  useEffect(() => {
    if (!organization) {
      console.warn(
        'Featurebase organization is not set. Please set NEXT_PUBLIC_FEATUREBASE_ORG in your environment variables.',
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;

    if (typeof win.Featurebase !== 'function') {
      win.Featurebase = function () {
        // eslint-disable-next-line prefer-rest-params
        (win.Featurebase.q = win.Featurebase.q || []).push(arguments);
      };
    }

    win.Featurebase('initialize_feedback_widget', {
      organization,
      locale: 'en',
      theme: 'light',
      metadata: null,
    });
  }, [organization, defaultBoard, pathname]);

  return (
    <>
      <Script src="https://do.featurebase.app/js/sdk.js" id="featurebase-sdk" />
      <Button
        className="my-auto mx-2"
        variant="outline"
        onClick={() => {
          const msg: FeaturebaseMessage = {
            target: 'FeaturebaseWidget',
            data: {
              action: 'openFeedbackWidget',
              setBoard: 'default',
            },
          };

          if (pathname.includes('publications')) {
            msg.data.setBoard = defaultBoard;
          }
          window.postMessage(msg);
        }}
      >
        Feedback
      </Button>
    </>
  );
};
