'use client';

import { FormEvent, useState } from 'react';
import { Button, Input, Label } from '@eightyfourthousand/design-system';
import { LoginAction, LoginVariation } from './types';
import { useSession } from './SessionContext';

const BUTTON_TEXT = {
  create: 'Sign Up',
  login: 'Sign In',
};

export const EmailLogin = ({ variation }: { variation: LoginVariation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { signUpWithEmail, loginWithEmail, resetPassword } = useSession();

  const handleSubmit = async (action: LoginAction) => {
    setError(null);
    setPending(true);
    try {
      switch (action) {
        case 'create':
          await signUpWithEmail(email, password);
          break;
        case 'login':
          await loginWithEmail(email, password);
          break;
        case 'forgot-password':
          await resetPassword(email);
          break;
        default:
          console.error('Unknown action:', action);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  // The submit handler belongs on the form: a button carries no onSubmit, so
  // hanging it there let the native submit reload the page instead.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(variation);
  };

  return (
    <form className="w-full flex flex-col items-center pt-2" onSubmit={onSubmit}>
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
            className="cursor-pointer accent-accent"
            defaultChecked
          />
          Keep me signed in
        </Label>
        {/* Without type="button" this submits the form, since Button renders a
            bare <button>, which defaults to type="submit" inside one. */}
        <Button
          type="button"
          onClick={() => handleSubmit('forgot-password')}
          variant="link"
          className="pe-0 font-light underline text-muted-foreground text-sm"
        >
          Forgot password?
        </Button>
      </div>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive pb-1">
          {error}
        </p>
      )}
      <div className="w-full p-0.5 my-2 rounded-full bg-gradient-to-b from-accent/50 to-accent">
        <Button
          type="submit"
          disabled={pending}
          variant="ghost"
          className="w-full rounded-full bg-gradient-to-b from-accent/80 to-accent text-secondary font-light hover:text-secondary hover:from-accent hover:to-accent/80 transition-colors"
        >
          {BUTTON_TEXT[variation]}
        </Button>
      </div>
    </form>
  );
};
