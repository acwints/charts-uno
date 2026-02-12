import { TwitterApi } from 'twitter-api-v2';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { config } from './config.js';
import { updateState } from './storage.js';

const CALLBACK_PORT = 3000;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'] as const;

async function setup(): Promise<void> {
  if (!config.twitter.clientId || !config.twitter.clientSecret) {
    console.error('Error: TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set in your .env');
    process.exit(1);
  }

  const client = new TwitterApi({
    clientId: config.twitter.clientId,
    clientSecret: config.twitter.clientSecret,
  });

  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(CALLBACK_URL, {
    scope: [...SCOPES],
  });

  console.log('\n=== Twitter OAuth 2.0 Setup ===\n');
  console.log('Open this URL in your browser to authorize the bot:\n');
  console.log(url);
  console.log('\nWaiting for callback...\n');

  return new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url || '', `http://localhost:${CALLBACK_PORT}`);

        if (requestUrl.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = requestUrl.searchParams.get('code');
        const returnedState = requestUrl.searchParams.get('state');

        if (!code) {
          res.writeHead(400);
          res.end('Missing authorization code');
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400);
          res.end('State mismatch');
          return;
        }

        console.log('Received callback, exchanging code for tokens...');

        const {
          client: loggedClient,
          accessToken,
          refreshToken,
          expiresIn,
        } = await client.loginWithOAuth2({
          code,
          codeVerifier,
          redirectUri: CALLBACK_URL,
        });

        await updateState({
          oauth2: {
            accessToken,
            refreshToken: refreshToken || '',
            expiresAt: Date.now() + expiresIn * 1000,
            scope: [...SCOPES],
          },
        });

        // Verify the tokens work
        const me = await loggedClient.v2.me();

        console.log(`\nAuthenticated as @${me.data.username} (${me.data.id})`);
        console.log('Tokens saved successfully!');
        console.log('\nYou can now start the bot with: pnpm dev');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end([
          '<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">',
          '<div style="text-align:center">',
          '<h1>Authorization Successful</h1>',
          `<p>Authenticated as @${me.data.username}</p>`,
          '<p>You can close this window and return to the terminal.</p>',
          '</div></body></html>',
        ].join(''));

        server.close();
        resolve();
      } catch (error) {
        console.error('Error during OAuth callback:', error);
        res.writeHead(500);
        res.end('Internal server error');
        server.close();
        reject(error);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      console.log(`Callback server listening on port ${CALLBACK_PORT}`);
    });
  });
}

setup().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
