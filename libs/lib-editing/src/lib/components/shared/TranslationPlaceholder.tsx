import { Lead, LotusPond } from '@eightyfourthousand/design-system';
import { TranslationState } from './types';

const MESSAGES: Record<Exclude<TranslationState, 'content'>, string> = {
  unpublished: 'This translation is not yet published. Check again soon.',
  empty: 'No translation content...',
};

export const TranslationPlaceholder = ({
  state,
}: {
  state: TranslationState;
}) => {
  if (state === 'content') {
    return null;
  }

  return (
    <div className="w-full max-w-readable mx-auto mt-24 text-center">
      <Lead className="italic">{MESSAGES[state]}</Lead>
      <div className="w-full pt-16 pb-6">
        <LotusPond className="mx-auto w-96" />
      </div>
    </div>
  );
};
