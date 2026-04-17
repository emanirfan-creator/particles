import { DEFAULT_STATE } from './state';
import type { ParticleState } from './state';
import { createThreeScene } from './three-scene';
import { createP5Scene } from './p5-scene';
import { buildPanel } from './panel';
import type { Scene } from './three-scene';

const host = document.getElementById('stage') as HTMLDivElement;
if (!host) throw new Error('#stage element missing');

const state: ParticleState = {
  ...DEFAULT_STATE,
  cursor: { ...DEFAULT_STATE.cursor },
};

let scene: Scene = mountScene();

function mountScene(): Scene {
  host.innerHTML = '';
  return state.mode === '3d'
    ? createThreeScene(host, state)
    : createP5Scene(host, state);
}

const panel = buildPanel(state, (key) => {
  if (key === 'mode') {
    scene.dispose();
    scene = mountScene();
  } else {
    scene.update(state, key);
  }
});

window.addEventListener('resize', () => {
  scene.resize(host.clientWidth, host.clientHeight);
});

void panel;
