/**
 * Android App Links. Lets an `https://.../invite/<code>` link open the app
 * directly, skipping the browser, once the app declares this domain in
 * app.json. Lists nothing until the signing key fingerprints are configured,
 * which leaves links opening this site as normal.
 */
import { env } from 'cloudflare:workers';

export const prerender = false;

export function GET() {
  const fingerprints = env.ANDROID_SHA256_FINGERPRINTS.split(',')
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);

  const statements =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: env.ANDROID_PACKAGE,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];

  return new Response(JSON.stringify(statements), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
