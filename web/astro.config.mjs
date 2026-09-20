// @ts-check
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

/**
 * The Scrollsy website. Every page is static, because it is served by
 * Cloudflare Pages, which runs no server code. Anything that has to be looked
 * up is looked up in the browser instead, see `pages/join.astro`.
 *
 * `site` is the deployed origin. Without it the build has no origin to resolve
 * against and bakes `localhost` into every absolute URL, which is what a chat
 * fetches when it draws a link preview.
 */
export default defineConfig({
  site: 'https://scrollsy.pages.dev',
  adapter: cloudflare({
    // The site's only image is a plain static file, so nothing needs Cloudflare
    // Images, and without this the adapter provisions that binding anyway.
    imageService: 'passthrough',
  }),
  // No sessions anywhere on the site. Left on, the adapter provisions a KV
  // namespace on every deploy for nothing.
  session: false,
});
