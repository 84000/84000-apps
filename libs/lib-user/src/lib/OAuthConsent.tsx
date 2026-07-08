'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  createBrowserClient,
  getUser,
  loginWithGoogle,
} from '@eightyfourthousand/data-access';
import {
  Button,
  GoogleLogo,
  H4,
  MainLogo,
} from '@eightyfourthousand/design-system';

type ConsentState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'redirecting' }
  | {
      status: 'consent';
      clientName: string;
      email: string;
      scopes: string[];
    };

export const OAuthConsent = () => {
  const searchParams = useSearchParams();
  const authorizationId = searchParams.get('authorization_id');
  const [client] = useState(createBrowserClient());
  const [state, setState] = useState<ConsentState>({ status: 'loading' });

  useEffect(() => {
    (async () => {
      if (!authorizationId) {
        setState({
          status: 'error',
          message:
            'Missing authorization request. Retry from the connecting app.',
        });
        return;
      }

      const user = await getUser({ client });
      if (!user) {
        setState({ status: 'signed-out' });
        return;
      }

      const { data, error } =
        await client.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) {
        console.error('Failed to fetch authorization details:', error);
        setState({
          status: 'error',
          message:
            'This authorization request is invalid or has expired. Retry from the connecting app.',
        });
        return;
      }

      if ('redirect_url' in data) {
        setState({ status: 'redirecting' });
        window.location.assign(data.redirect_url);
        return;
      }

      setState({
        status: 'consent',
        clientName: data.client.name,
        email: data.user.email,
        scopes: data.scope ? data.scope.split(' ') : [],
      });
    })();
  }, [authorizationId, client]);

  const signIn = useCallback(() => {
    const next = encodeURIComponent(
      `${window.location.pathname}${window.location.search}`,
    );
    loginWithGoogle({
      client,
      redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
    });
  }, [client]);

  const decide = useCallback(
    async (approve: boolean) => {
      if (!authorizationId) {
        return;
      }
      setState({ status: 'redirecting' });
      const action = approve
        ? client.auth.oauth.approveAuthorization
        : client.auth.oauth.denyAuthorization;
      const { data, error } = await action.call(
        client.auth.oauth,
        authorizationId,
        { skipBrowserRedirect: true },
      );
      if (error || !data) {
        console.error('Failed to submit consent decision:', error);
        setState({
          status: 'error',
          message: 'Something went wrong. Retry from the connecting app.',
        });
        return;
      }
      window.location.assign(data.redirect_url);
    },
    [authorizationId, client],
  );

  return (
    <div className="w-full max-w-100 m-auto p-8 flex flex-col items-center gap-4 text-center bg-background rounded-lg border border-border shadow-sm">
      <MainLogo width={140} />
      {state.status === 'loading' && (
        <p className="text-sm text-muted-foreground">
          Loading authorization request…
        </p>
      )}
      {state.status === 'redirecting' && (
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      )}
      {state.status === 'error' && (
        <>
          <H4 className="font-sans font-bold">Authorization Failed</H4>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </>
      )}
      {state.status === 'signed-out' && (
        <>
          <H4 className="font-sans font-bold">Sign In to Continue</H4>
          <p className="text-sm text-muted-foreground">
            An application is requesting access to 84000 Studio. Sign in to
            review the request.
          </p>
          <div
            onClick={signIn}
            className="px-4 py-2 border-border border flex gap-3 items-center rounded-full text-sm justify-center cursor-pointer"
          >
            <GoogleLogo />
            <span>Sign in with Google</span>
          </div>
        </>
      )}
      {state.status === 'consent' && (
        <>
          <H4 className="font-sans font-bold">Authorize {state.clientName}</H4>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">{state.clientName}</span> wants to
            access 84000 Studio as{' '}
            <span className="font-semibold">{state.email}</span>
            {state.scopes.length ? ` with: ${state.scopes.join(', ')}` : ''}.
          </p>
          <div className="flex gap-2 w-full justify-center">
            <Button variant="outline" onClick={() => decide(false)}>
              Deny
            </Button>
            <Button onClick={() => decide(true)}>Approve</Button>
          </div>
        </>
      )}
    </div>
  );
};
