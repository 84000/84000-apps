'use client';

import { Button, Input, Label } from '@design-system';
import Link from 'next/link';
import { LoginVariation } from './types';

const BUTTON_TEXT = {
  create: 'Sign Up',
  login: 'Log In',
};

type LoginAction = 'create' | 'login' | 'forgot-password';

export const EmailLogin = ({ variation }: { variation: LoginVariation }) => {
  const handleSubmit = (action: LoginAction) => {
    // TODO: Handle login or signup action
    console.log(`Email auth action: ${action}`);
  };

  return (
    <form className="w-full flex flex-col items-center pt-4">
      <Input
        type="email"
        placeholder="Email"
        className="w-full my-2"
        required
      />
      <Input
        type="password"
        placeholder="Password"
        className="w-full my-2"
        required
      />
      <div className="w-full flex items-center justify-between my-2">
        <Label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="cursor-pointer accent-brick"
            defaultChecked
          />
          Keep me signed in
        </Label>
        <Button
          asChild
          variant="link"
          className="pe-0 font-light underline text-muted-foreground text-sm"
        >
          <Link href="/auth/forgot-password">Forgot password?</Link>
        </Button>
      </div>
      <div className="w-full p-0.5 my-2 rounded-full bg-gradient-to-b from-brick-200 to-brick-500">
        <Button
          onSubmit={() => handleSubmit(variation)}
          type="submit"
          variant="ghost"
          className="w-full rounded-full bg-gradient-to-b from-brick-400 to-brick-800 text-secondary font-light hover:text-secondary hover:from-brick-800 hover:to-brick-400 transition-colors"
        >
          {BUTTON_TEXT[variation]}
        </Button>
      </div>
    </form>
  );
};
