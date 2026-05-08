import { compose } from './composition';
import { enableMobileFullscreen } from './utils/mobileFullscreen';

async function boot() {
  enableMobileFullscreen();
  const host = document.getElementById('pixi');
  const hudHost = document.getElementById('hud');
  if (!host || !hudHost) throw new Error('[main] #pixi or #hud missing in index.html');
  const app = await compose({ host, hudHost });
  await app.start();
}

boot().catch((err) => {
  console.error('[main] boot failed', err);
});
