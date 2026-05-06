/**
 * strip-icc.mjs — Remove ICC color profiles from all PNGs/JPGs in raw-assets/.
 *
 * Run before assets:pack when adding new artwork exported from Photoshop or Figma,
 * as those tools embed ICC profiles that break WebP conversion in some browsers.
 *
 *   pnpm run assets:strip
 */

import { createRequire } from 'module';
import { readdirSync, statSync, renameSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

// sharp is a transitive dep — resolve it from the pnpm store directly.
// We use the newer version (0.34.x) which ships with @assetpack/core's pipeline.
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', 'node_modules', '.pnpm', 'sharp@0.34.5', 'node_modules', 'sharp', 'package.json'));
const sharp = require('sharp');

const EXTS = new Set(['.png', '.jpg', '.jpeg']);
const ROOT = './raw-assets';

async function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      await walk(full);
    } else if (EXTS.has(extname(name).toLowerCase())) {
      const tmp = full + '.tmp';
      await sharp(full).withMetadata(false).toFile(tmp);
      renameSync(tmp, full);
      console.log('stripped:', full);
    }
  }
}

walk(ROOT)
  .then(() => console.log('Done — all ICC profiles removed.'))
  .catch((err) => { console.error(err); process.exit(1); });
