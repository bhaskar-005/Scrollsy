// @ts-check
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

/**
 * The Scrollsy website. Pages are static by default, so the landing page ships
 * as plain files from Cloudflare's edge. Only routes that must look something
 * up per request opt out with `export const prerender = false`: the invite page
 * and Android's App Links file.
 */
export default defineConfig({
  adapter: cloudflare({
    // The site's only image is a plain static file, so nothing needs Cloudflare
    // Images, and without this the adapter provisions that binding anyway.
    imageService: 'passthrough',
  }),
  // No sessions anywhere on the site. Left on, the adapter provisions a KV
  // namespace on every deploy for nothing.
  session: false,
});
