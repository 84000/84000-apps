'use client';

import { useCallback, useEffect, useState } from 'react';
import { SocialLogin } from './SocialLogin';
import { Button, H4, MainLogo, Separator } from '@design-system';
import { EmailLogin } from './EmailLogin';
import { LoginVariation } from './types';

const EMAIL_AUTH_ENABLED = false;

const HEADER = {
  create: 'Create an account',
  login: 'Sign In',
};

const WELCOME_LINES = {
  create: [
    'Let’s get started. Fill in the details below to create your workspace in 84000 Scholar’s Room.',
  ],
  login: ['Welcome Back!', "Sign into the 84000's Scholar's Room."],
};

const FOOTER_TEXT = {
  create: 'Already have an account?',
  login: 'Don’t have an account?',
};

const LINK_TEXT = {
  create: 'Sign in',
  login: 'Create one',
};

export const Login = () => {
  const [variation, setVariation] = useState<LoginVariation>('login');
  const [header, setHeader] = useState<string>(HEADER.login);
  const [welcomeLines, setWelcomeLines] = useState<string[]>(
    WELCOME_LINES.login,
  );
  const [footerText, setFooterText] = useState<string>(FOOTER_TEXT.login);
  const [linkText, setLinkText] = useState<string>(LINK_TEXT.login);

  useEffect(() => {
    setHeader(HEADER[variation]);
    setWelcomeLines(WELCOME_LINES[variation]);
    setFooterText(FOOTER_TEXT[variation]);
    setLinkText(LINK_TEXT[variation]);
  }, [variation]);

  const toggleVariation = useCallback(() => {
    setVariation((prev) => (prev === 'login' ? 'create' : 'login'));
  }, []);

  return (
    <div className="h-full w-full">
      <div className="absolute w-full p-4 hidden md:flex gap-2">
        <MainLogo width={140} />
        <span className="my-auto w-[5rem] text-tiny leading-3 text-navy">
          {"Bringing the Buddha's Words to Life"}
        </span>
      </div>
      <div className="w-full md:h-full p-8 max-w-[25rem] m-auto">
        <div className="flex flex-col items-center justify-center w-full h-full">
          <div className="md:hidden mb-2">
            <MainLogo width={112} />
          </div>
          <H4 className="font-sans font-bold text-center">{header}</H4>
          {welcomeLines.map((line, index) => (
            <p
              key={index}
              className="text-center text-sm font-light text-muted-foreground"
            >
              {line}
            </p>
          ))}
          <SocialLogin className="w-full" />
          {EMAIL_AUTH_ENABLED && (
            <>
              <div className="w-full flex items-center justify-center gap-2">
                <Separator className="flex-1" />
                <span className="text-sm uppercase font-light text-muted-foreground">
                  or
                </span>
                <Separator className="flex-1" />
              </div>
              <EmailLogin variation={variation} />
            </>
          )}
          <div className="flex items-center justify-center gap-2 text-sm py-2">
            <span className="text-muted-foreground">{footerText}</span>
            <Button
              variant="link"
              onClick={toggleVariation}
              className="text-brick font-semibold px-0"
            >
              {linkText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
