import { SupabaseClient } from '@supabase/supabase-js';

export const getUser = async ({ client }: { client: SupabaseClient }) => {
  console.log('trying to get user');
  const { data, error } = await client.auth.getUser();
  if (error) {
    console.error(`Failed to get user data: ${error}`);
    return null;
  }

  console.log(data);

  const { id, email, user_metadata: metadata } = data.user;
  const { name, picture } = metadata;
  if (id && email) {
    return {
      id,
      email,
      username: email,
      name,
      avatar: picture,
    };
  }

  return null;
};

export const loginWithGoogle = async ({
  client,
}: {
  client: SupabaseClient;
}) => {
  await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo:
        process.env.OAUTH_REDIRECT_URL || 'http://localhost:3000/auth/callback',
    },
  });
};
