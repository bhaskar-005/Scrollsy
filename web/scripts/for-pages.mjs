import { rmSync } from 'node:fs';

/**
 * Takes the Worker's own build artifacts back out of the folder Cloudflare
 * Pages serves.
 *
 * The adapter writes `wrangler.json` for `wrangler deploy` and lists it in
 * `.assetsignore`, which is a Workers file. Pages does not read it, so without
 * this the config is served to anyone who asks for `/wrangler.json`, and it
 * carries the absolute path of the machine that built it.
 *
 * `.wrangler/deploy/config.json` points Wrangler at that same file, so it has
 * to go too, or every later `wrangler` command in this folder stops on a
 * redirect to something that is no longer there. Both are rebuilt by the next
 * `astro build`, so nothing is lost by removing them here.
 *
 * Runs as `postbuild`, so it happens whether the build was started here or by
 * Cloudflare building the repo itself.
 */
const workerOnly = [
  'dist/client/wrangler.json',
  'dist/client/.assetsignore',
  '.wrangler/deploy/config.json',
];

for (const file of workerOnly) {
  rmSync(file, { force: true });
}
