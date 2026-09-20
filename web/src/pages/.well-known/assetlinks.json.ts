/**
 * Android App Links. Lets an `https://.../invite/<code>` link open the app
 * directly, skipping the browser, once the app declares this domain in
 * app.json. Lists nothing until the signing key fingerprints are configured,
 * which leaves links opening this site as normal.
 *
 * Built as a file rather than answered per request, because Cloudflare Pages
 * serves files and nothing else. The fingerprints are read from the Worker
 * config at build time, so changing them means building again.
 */
import { env } from 'cloudflare:workers';

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
