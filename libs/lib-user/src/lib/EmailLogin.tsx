'use client';

import { useState } from 'react';
import { Button, Input, Label } from '@design-system';
import { LoginAction, LoginVariation } from './types';
import { useSession } from './SessionContext';

const BUTTON_TEXT = {
  create: 'Sign Up',
  login: 'Sign In',
};

export const EmailLogin = ({ variation }: { variation: LoginVariation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signUpWithEmail, loginWithEmail, resetPassword } = useSession();

  const handleSubmit = async (action: LoginAction) => {
    switch (action) {
      case 'create':
        signUpWithEmail(email, password);

        break;
      case 'login':
        loginWithEmail(email, password);
        break;
      case 'forgot-password':
        resetPassword(email);
        break;
      default:
        console.error('Unknown action:', action);
    }
  };

  return (
    <form className="w-full flex flex-col items-center pt-2">
      <Input
        type="email"
        placeholder="Email"
        className="w-full my-2"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        placeholder="Password"
        className="w-full my-2"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="w-full flex items-center justify-between mb-2">
        <Label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="cursor-pointer accent-brick"
            defaultChecked
          />
          Keep me signed in
        </Label>
        <Button
          onClick={() => handleSubmit('forgot-password')}
          variant="link"
          className="pe-0 font-light underline text-muted-foreground text-sm"
        >
          Forgot password?
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
