import { buildPrompt, importJSON } from './export';
import { notifyChange } from './state';
import type { ParticleState, ShapeId } from './state';
import { shapesForMode } from './shapes';
import './panel.css';

export type PanelEmit = (key: keyof ParticleState | 'resetView') => void;

interface PanelHandle {
  refresh(): void;
}

export function buildPanel(state: ParticleState, onFieldChange: PanelEmit): PanelHandle {
  const root = document.createElement('div');
  root.id = 'panel';
  root.dataset.open = 'true';

  // Tab strip: visible on the right edge — drag to reposition, tap to open/close
  const tab = document.createElement('div');
  tab.className = 'panel-tab';
  const tabGrip = document.createElement('div');
  tabGrip.className = 'panel-tab-grip';
  for (let i = 0; i < 3; i++) tabGrip.appendChild(document.createElement('span'));
  const tabLabel = document.createElement('span');
  tabLabel.className = 'panel-tab-label';
  tabLabel.textContent = 'Controls';
  tab.appendChild(tabGrip);
  tab.appendChild(tabLabel);

  // Content wrapper
  const content = document.createElement('div');
  content.className = 'panel-content';

  const header = document.createElement('header');
  header.className = 'drag-handle';
  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = 'Controls';
  const close = document.createElement('button');
  close.className = 'close';
  close.innerHTML = '×';
  close.title = 'Close panel';
  header.appendChild(title);
  header.appendChild(close);

  const body = document.createElement('div');
  body.className = 'body';

  content.appendChild(header);
  content.appendChild(body);
  root.appendChild(tab);
  root.appendChild(content);
  document.body.appendChild(root);

  // ---- Refresh wiring (re-renders body when conditional sections change) ----
  const refreshHooks: Array<() => void> = [];
  const refresh = () => refreshHooks.forEach((fn) => fn());

  const emit = (key: keyof ParticleState) => {
    notifyChange(state, key);
    onFieldChange(key);
    refresh();
  };

  // Reference holder for in-panel mutable inputs (e.g. spin slider for stop button).
  const motionRefs: { spin?: HTMLInputElement } = {};

  // Shared ref so shapeDropdown can trigger the SVG file picker synchronously.
  const svgPickRef: { trigger?: () => void } = {};

  // ---- Build sections ----
  body.appendChild(
    section('Scene', [
      dropdown({
        label: 'Dimension',
        tooltip: '2D canvas vs 3D space',
        value: state.mode,
        options: [
          { label: '3D space', value: '3d' },
          { label: '2D canvas', value: '2d' },
        ],
        onChange: (v) => {
          state.mode = v as ParticleState['mode'];
          // If current shape isn't valid in new mode, fall back to a sensible default.
          const valid = shapesForMode(state.mode);
          if (!valid.includes(state.shape)) {
            state.shape = state.mode === '3d' ? 'sphere' : 'circle';
          }
          emit('mode');
        },
      }),
      shapeDropdown(state, emit, refreshHooks, svgPickRef),
      conditionalText(state, emit, refreshHooks),
      conditionalSVGUpload(state, emit, refreshHooks, svgPickRef),
      slider({
        label: 'Particles',
        tooltip: 'How many particles are in the scene',
        value: state.count,
        min: 100,
        max: 60000,
        step: 100,
        onChange: (v) => {
          state.count = v;
          emit('count');
        },
      }),
      slider({
        label: 'Particle size',
        tooltip: 'Visual radius of each particle',
        value: state.size,
        min: 0.5,
        max: 20,
        step: 0.1,
        onChange: (v) => {
          state.size = v;
          emit('size');
        },
      }),
      slider({
        label: 'Scale',
        tooltip: 'How spread out the shape is',
        value: state.spread,
        min: 0.1,
        max: 3,
        step: 0.01,
        onChange: (v) => {
          state.spread = v;
          emit('spread');
        },
      }),
      conditionalGalaxyControls(state, emit, refreshHooks),
    ])
  );

  body.appendChild(
    section('Color', [
      dropdown({
        label: 'Color theme',
        tooltip: 'Pick a preset color scheme',
        value: state.palette,
        options: [
          { label: 'Plasma', value: 'plasma' },
          { label: 'Sunset', value: 'sunset' },
          { label: 'Ocean', value: 'ocean' },
          { label: 'Mono', value: 'mono' },
          { label: 'Rainbow shift', value: 'cycle' },
          { label: 'Cosmic', value: 'cosmic' },
          { label: 'Aurora', value: 'aurora' },
          { label: 'Ember', value: 'ember' },
          { label: 'Ice', value: 'ice' },
          { label: 'Custom (2 colors)', value: 'custom' },
        ],
        onChange: (v) => {
          state.palette = v as ParticleState['palette'];
          emit('palette');
        },
      }),
      dropdown({
        label: 'Color flow',
        tooltip:
          'How colors are distributed — across positions, by particle speed, or a single tone',
        value: state.gradientMode,
        options: [
          { label: 'Across the shape', value: 'position' },
          { label: 'By speed', value: 'velocity' },
          { label: 'Single tone', value: 'solid' },
        ],
        onChange: (v) => {
          state.gradientMode = v as ParticleState['gradientMode'];
          emit('gradientMode');
        },
      }),
      conditionalCustomColors(state, emit, refreshHooks),
    ])
  );

  body.appendChild(
    section('Motion', [
      slider({
        label: 'Spin',
        tooltip: 'Auto-rotate the scene. Set to 0 to stop.',
        value: state.rotation,
        min: -0.02,
        max: 0.02,
        step: 0.0005,
        format: (v) => v.toFixed(4),
        onChange: (v) => {
          state.rotation = v;
          emit('rotation');
        },
        ref: (el) => (motionRefs.spin = el),
      }),
      buttonRow([
        {
          label: '⏹  Stop spin',
          tooltip: 'Reset spin to 0',
          onClick: () => {
            state.rotation = 0;
            if (motionRefs.spin) motionRefs.spin.value = '0';
            emit('rotation');
          },
        },
        ...(state.mode === '3d'
          ? [
              {
                label: '⟳  Reset view',
                tooltip: 'Reset 3D camera and rotation',
                onClick: () => {
                  state.rotation = 0;
                  if (motionRefs.spin) motionRefs.spin.value = '0';
                  notifyChange(state, 'rotation');
                  onFieldChange('rotation');
                  onFieldChange('resetView');
                },
              },
            ]
          : []),
      ]),
      conditional2DMotion(state, emit, refreshHooks),
      conditionalFlowField(state, emit, refreshHooks),
    ])
  );

  body.appendChild(
    section(
      'Connections',
      [
        toggleControl({
          label: 'Network graph',
          tooltip: 'Draw lines between nearby particles',
          value: state.connections,
          onChange: (v) => {
            state.connections = v;
            emit('connections');
          },
        }),
        conditionalConnections(state, emit, refreshHooks),
      ],
      false
    )
  );

  body.appendChild(
    section(
      'Cursor interaction',
      [
        slider({
          label: 'Cursor push',
          tooltip: 'How strongly the cursor pushes particles away',
          value: state.cursor.repel,
          min: 0,
          max: 6,
          step: 0.1,
          onChange: (v) => {
            state.cursor.repel = v;
            emit('cursor');
          },
        }),
        slider({
          label: 'Cursor reach',
          tooltip: 'How far the cursor\'s influence extends',
          value: state.cursor.radius,
          min: 0,
          max: 300,
          step: 1,
          onChange: (v) => {
            state.cursor.radius = v;
            emit('cursor');
          },
        }),
      ],
      false
    )
  );

  body.appendChild(
    section(
      'Share',
      [
        buttonRow([
          {
            label: '📋  Copy for LLM',
            tooltip: 'Copy a prompt describing this scene to your clipboard',
            onClick: () => copyForLLM(state),
          },
        ]),
        buttonRow([
          {
            label: '📥  Import JSON…',
            tooltip: 'Paste a previously exported state',
            onClick: () => importAndApply(state, onFieldChange, refresh),
          },
        ]),
      ],
      false
    )
  );

  // ---- Drag behavior (vertical edge snap) + tap-to-toggle ----
  setupDrag(root, tab);

  // ---- Open / close ----
  close.addEventListener('click', () => setOpen(root, false));

  return { refresh };
}

/* -------------------- Conditional sections -------------------- */

function shapeDropdown(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>,
  svgPickRef: { trigger?: () => void }
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const render = () => {
    wrap.innerHTML = '';
    const opts = shapesForMode(state.mode).map((s) => ({
      label: prettyShapeName(s),
      value: s,
    }));
    const dd = dropdown({
      label: 'Shape',
      tooltip: 'The form the particles arrange into',
      value: state.shape,
      options: opts,
      onChange: (v) => {
        state.shape = v as ShapeId;
        emit('shape');
        if (v === 'svg' && !state.svgData) svgPickRef.trigger?.();
      },
    });
    wrap.appendChild(dd);
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

function conditionalText(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const render = () => {
    wrap.innerHTML = '';
    if (state.shape !== 'text') {
      wrap.dataset.hidden = 'true';
      return;
    }
    wrap.dataset.hidden = 'false';
    const ctrl = textInput({
      label: 'Text',
      tooltip: 'Particles will form this text',
      value: state.text,
      onChange: (v) => {
        state.text = v;
        emit('text');
      },
    });
    wrap.appendChild(ctrl);
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

function conditionalCustomColors(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>
): HTMLElement {
  const wrap = document.createElement('div');
  const render = () => {
    wrap.innerHTML = '';
    if (state.palette !== 'custom') return;
    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(
      colorInput({
        label: 'Start color',
        tooltip: 'Beginning of the gradient',
        value: state.colorA,
        onChange: (v) => {
          state.colorA = v;
          emit('colorA');
        },
      })
    );
    row.appendChild(
      colorInput({
        label: 'End color',
        tooltip: 'End of the gradient',
        value: state.colorB,
        onChange: (v) => {
          state.colorB = v;
          emit('colorB');
        },
      })
    );
    wrap.appendChild(row);
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

function conditional2DMotion(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '10px';
  const render = () => {
    wrap.innerHTML = '';
    if (state.mode !== '2d') return;
    wrap.appendChild(
      slider({
        label: 'Motion trail',
        tooltip: 'Particles leave a fading trail (2D only)',
        value: state.trail,
        min: 0,
        max: 0.99,
        step: 0.01,
        onChange: (v) => {
          state.trail = v;
          emit('trail');
        },
      })
    );
    wrap.appendChild(
      dropdown({
        label: 'Symmetry',
        tooltip: 'Kaleidoscope-style mirror repeats (2D only)',
        value: String(state.mirror),
        options: [
          { label: 'Off', value: '0' },
          { label: '2-fold', value: '2' },
          { label: '4-fold', value: '4' },
        ],
        onChange: (v) => {
          state.mirror = (Number(v) as 0 | 2 | 4) || 0;
          emit('mirror');
        },
      })
    );
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

function conditionalSVGUpload(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>,
  svgPickRef: { trigger?: () => void }
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';

  // Hoist the file input so it exists before the shape changes — this keeps it
  // within the user-gesture chain when trigger() is called synchronously from onChange.
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.svg,image/svg+xml';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  svgPickRef.trigger = () => fileInput.click();

  let fileBtn: HTMLButtonElement | null = null;
  let status: HTMLSpanElement | null = null;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        state.svgData = result;
        if (fileBtn) fileBtn.textContent = 'Change SVG…';
        if (status) status.textContent = file.name;
        emit('svgData');
      }
    };
    reader.readAsText(file);
  });

  const render = () => {
    wrap.innerHTML = '';
    if (state.shape !== 'svg') {
      wrap.dataset.hidden = 'true';
      return;
    }
    wrap.dataset.hidden = 'false';

    const lab = document.createElement('label');
    lab.title = 'Upload an SVG file — particles will trace its paths';
    lab.textContent = 'SVG file';

    fileBtn = document.createElement('button');
    fileBtn.className = 'action';
    fileBtn.style.width = '100%';
    fileBtn.style.marginTop = '4px';
    fileBtn.textContent = state.svgData ? 'Change SVG…' : 'Upload SVG…';
    fileBtn.addEventListener('click', () => fileInput.click());

    status = document.createElement('span');
    status.className = 'value';
    status.style.display = 'block';
    status.style.marginTop = '4px';
    status.style.fontSize = '11px';
    status.style.opacity = '0.6';
    status.textContent = state.svgData ? 'SVG loaded' : 'No file loaded';

    wrap.appendChild(lab);
    wrap.appendChild(fileBtn);
    wrap.appendChild(status);
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

function conditionalFlowField(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '10px';
  const render = () => {
    wrap.innerHTML = '';
    wrap.appendChild(
      toggleControl({
        label: 'Flow field',
        tooltip: 'Particles drift along a Perlin noise vector field',
        value: state.flowField,
        onChange: (v) => {
          state.flowField = v;
          emit('flowField');
        },
      })
    );
    if (!state.flowField) return;
    wrap.appendChild(
      slider({
        label: 'Noise scale',
        tooltip: 'Spatial frequency of the noise field',
        value: state.noiseScale,
        min: 0.001,
        max: 0.015,
        step: 0.001,
        format: (v) => v.toFixed(3),
        onChange: (v) => {
          state.noiseScale = v;
          emit('noiseScale');
        },
      })
    );
    wrap.appendChild(
      slider({
        label: 'Time speed',
        tooltip: 'How fast the noise field evolves',
        value: state.noiseSpeed,
        min: 0.001,
        max: 0.02,
        step: 0.001,
        format: (v) => v.toFixed(3),
        onChange: (v) => {
          state.noiseSpeed = v;
          emit('noiseSpeed');
        },
      })
    );
    wrap.appendChild(
      slider({
        label: 'Strength',
        tooltip: 'How strongly the flow field pushes particles',
        value: state.noiseStrength,
        min: 0,
        max: 5,
        step: 0.1,
        onChange: (v) => {
          state.noiseStrength = v;
          emit('noiseStrength');
        },
      })
    );
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

function conditionalGalaxyControls(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '10px';
  const render = () => {
    wrap.innerHTML = '';
    if (state.shape !== 'galaxy') return;
    wrap.appendChild(
      slider({
        label: 'Arms',
        tooltip: 'Number of spiral arms',
        value: state.galaxyArms,
        min: 1,
        max: 8,
        step: 1,
        onChange: (v) => {
          state.galaxyArms = v;
          emit('galaxyArms');
        },
      })
    );
    wrap.appendChild(
      slider({
        label: 'Spiral tightness',
        tooltip: 'How tightly the arms wind inward',
        value: state.galaxySpiral,
        min: 1,
        max: 12,
        step: 0.5,
        onChange: (v) => {
          state.galaxySpiral = v;
          emit('galaxySpiral');
        },
      })
    );
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

function conditionalConnections(
  state: ParticleState,
  emit: (k: keyof ParticleState) => void,
  refreshHooks: Array<() => void>
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '10px';
  const render = () => {
    wrap.innerHTML = '';
    if (!state.connections) return;
    wrap.appendChild(
      slider({
        label: 'Connect radius',
        tooltip: 'Maximum distance between connected particles',
        value: state.connectionRadius,
        min: 10,
        max: 300,
        step: 1,
        onChange: (v) => {
          state.connectionRadius = v;
          emit('connectionRadius');
        },
      })
    );
    wrap.appendChild(
      slider({
        label: 'Line opacity',
        tooltip: 'Opacity of connection lines',
        value: state.connectionOpacity,
        min: 0.05,
        max: 1,
        step: 0.05,
        onChange: (v) => {
          state.connectionOpacity = v;
          emit('connectionOpacity');
        },
      })
    );
  };
  render();
  refreshHooks.push(render);
  return wrap;
}

/* -------------------- Control primitives -------------------- */

function section(
  title: string,
  children: HTMLElement[],
  open = true
): HTMLDetailsElement {
  const det = document.createElement('details');
  if (open) det.open = true;
  const summary = document.createElement('summary');
  summary.textContent = title;
  det.appendChild(summary);
  const wrap = document.createElement('div');
  wrap.className = 'section-body';
  for (const child of children) wrap.appendChild(child);
  det.appendChild(wrap);
  return det;
}

interface SliderOpts {
  label: string;
  tooltip?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  ref?: (el: HTMLInputElement) => void;
}

function slider(o: SliderOpts): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const lab = document.createElement('label');
  if (o.tooltip) lab.title = o.tooltip;
  const lt = document.createElement('span');
  lt.textContent = o.label;
  const lv = document.createElement('span');
  lv.className = 'value';
  const fmt = o.format || ((v: number) => formatNum(v, o.step));
  lv.textContent = fmt(o.value);
  lab.appendChild(lt);
  lab.appendChild(lv);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(o.min);
  input.max = String(o.max);
  input.step = String(o.step);
  input.value = String(o.value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    lv.textContent = fmt(v);
    o.onChange(v);
  });
  wrap.appendChild(lab);
  wrap.appendChild(input);
  if (o.ref) o.ref(input);
  return wrap;
}

interface ToggleOpts {
  label: string;
  tooltip?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function toggleControl(o: ToggleOpts): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const lab = document.createElement('label');
  lab.className = 'toggle-row';
  if (o.tooltip) lab.title = o.tooltip;
  const lt = document.createElement('span');
  lt.textContent = o.label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = o.value;
  input.addEventListener('change', () => o.onChange(input.checked));
  lab.appendChild(lt);
  lab.appendChild(input);
  wrap.appendChild(lab);
  return wrap;
}

interface DropdownOpts {
  label: string;
  tooltip?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

function dropdown(o: DropdownOpts): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const lab = document.createElement('label');
  if (o.tooltip) lab.title = o.tooltip;
  lab.textContent = o.label;
  const sel = document.createElement('select');
  for (const opt of o.options) {
    const oel = document.createElement('option');
    oel.value = opt.value;
    oel.textContent = opt.label;
    if (opt.value === o.value) oel.selected = true;
    sel.appendChild(oel);
  }
  sel.addEventListener('change', () => o.onChange(sel.value));
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  return wrap;
}

interface TextOpts {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (v: string) => void;
}

function textInput(o: TextOpts): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const lab = document.createElement('label');
  if (o.tooltip) lab.title = o.tooltip;
  lab.textContent = o.label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = o.value;
  input.maxLength = 24;
  input.addEventListener('input', () => o.onChange(input.value));
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}

interface ColorOpts {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (v: string) => void;
}

function colorInput(o: ColorOpts): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const lab = document.createElement('label');
  if (o.tooltip) lab.title = o.tooltip;
  lab.textContent = o.label;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = o.value;
  input.addEventListener('input', () => o.onChange(input.value));
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}

interface ButtonOpts {
  label: string;
  tooltip?: string;
  onClick: () => void;
}

function buttonRow(buttons: ButtonOpts[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  const row = document.createElement('div');
  row.className = 'row';
  if (buttons.length === 1) row.style.gridTemplateColumns = '1fr';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = 'action';
    btn.textContent = b.label;
    if (b.tooltip) btn.title = b.tooltip;
    btn.addEventListener('click', b.onClick);
    row.appendChild(btn);
  }
  wrap.appendChild(row);
  return wrap;
}

/* -------------------- Drag (4-edge docking) -------------------- */

type Edge = 'left' | 'right' | 'top' | 'bottom';

function isVerticalEdge(e: Edge) {
  return e === 'left' || e === 'right';
}

function clampPos(_panel: HTMLElement, edge: Edge, pos: number): number {
  const margin = 16;
  // Ensure the tab (52px) is always visible — clamp so the start of the panel
  // is at least partially on-screen in both directions.
  const max = isVerticalEdge(edge)
    ? window.innerHeight - 52 - margin
    : window.innerWidth - 52 - margin;
  return Math.max(margin, Math.min(max, pos));
}

function applyEdge(panel: HTMLElement, edge: Edge, pos: number) {
  panel.dataset.edge = edge;
  panel.dataset.dragging = 'false';
  panel.style.setProperty('--panel-pos', `${pos}px`);
}

function loadPanelPos(): { edge: Edge; pos: number } {
  try {
    const s = JSON.parse(localStorage.getItem('panel-pos2') || 'null');
    if (s && (s.edge === 'left' || s.edge === 'right' || s.edge === 'top' || s.edge === 'bottom') && typeof s.pos === 'number') {
      return s;
    }
  } catch {}
  return { edge: 'right', pos: 80 };
}

function savePanelPos(edge: Edge, pos: number) {
  try { localStorage.setItem('panel-pos2', JSON.stringify({ edge, pos })); } catch {}
}

function setupDrag(panel: HTMLElement, tab: HTMLElement) {
  const SNAP_ZONE = 64;

  const saved = loadPanelPos();
  applyEdge(panel, saved.edge, saved.pos);

  let dragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let basePos = 0;
  let currentEdge: Edge = saved.edge;

  tab.addEventListener('pointerdown', (e) => {
    dragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    basePos = parseFloat(panel.style.getPropertyValue('--panel-pos')) || 80;
    panel.dataset.dragging = 'true';
    tab.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  tab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // Detect snap to a new edge based on pointer proximity to viewport edges
    let newEdge: Edge = currentEdge;
    if (e.clientX < SNAP_ZONE) newEdge = 'left';
    else if (e.clientX > W - SNAP_ZONE) newEdge = 'right';
    else if (e.clientY < SNAP_ZONE) newEdge = 'top';
    else if (e.clientY > H - SNAP_ZONE) newEdge = 'bottom';

    if (newEdge !== currentEdge) {
      currentEdge = newEdge;
      const newPos = isVerticalEdge(currentEdge) ? e.clientY : e.clientX;
      basePos = newPos;
      startX = e.clientX;
      startY = e.clientY;
      applyEdge(panel, currentEdge, clampPos(panel, currentEdge, newPos));
      return;
    }

    // Slide along current edge
    const delta = isVerticalEdge(currentEdge) ? dy : dx;
    const newPos = clampPos(panel, currentEdge, basePos + delta);
    panel.style.setProperty('--panel-pos', `${newPos}px`);
  });

  tab.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    panel.dataset.dragging = 'false';
    tab.releasePointerCapture(e.pointerId);

    if (!hasMoved) {
      const isOpen = panel.dataset.open !== 'false';
      setOpen(panel, !isOpen);
    }

    const pos = parseFloat(panel.style.getPropertyValue('--panel-pos')) || 80;
    savePanelPos(currentEdge, pos);
  });

  // Re-clamp position when viewport resizes so panel can't get stuck off-screen.
  window.addEventListener('resize', () => {
    const pos = parseFloat(panel.style.getPropertyValue('--panel-pos')) || 80;
    panel.style.setProperty('--panel-pos', `${clampPos(panel, currentEdge, pos)}px`);
  });
}

/* -------------------- Open / close -------------------- */

function setOpen(panel: HTMLElement, open: boolean) {
  panel.dataset.open = open ? 'true' : 'false';
}

/* -------------------- Helpers -------------------- */

function prettyShapeName(s: ShapeId): string {
  const map: Record<string, string> = {
    sphere: 'Sphere',
    cube: 'Cube',
    torus: 'Torus',
    helix: 'Helix',
    galaxy: 'Galaxy',
    wave: 'Wave',
    grid: 'Grid',
    cloud: 'Cloud',
    circle: 'Circle',
    heart: 'Heart',
    kaleidoscope: 'Kaleidoscope',
    text: 'Text…',
    aurora: 'Aurora',
    svg: 'SVG Import…',
  };
  return map[s] || s;
}

function formatNum(v: number, step: number): string {
  if (step >= 1) return String(Math.round(v));
  if (step >= 0.1) return v.toFixed(1);
  if (step >= 0.01) return v.toFixed(2);
  if (step >= 0.001) return v.toFixed(3);
  return v.toFixed(4);
}

async function copyForLLM(state: ParticleState) {
  const prompt = buildPrompt(state);
  try {
    await navigator.clipboard.writeText(prompt);
    toast('Copied prompt to clipboard');
  } catch {
    window.prompt('Copy the prompt below:', prompt);
  }
}

function importAndApply(
  state: ParticleState,
  onFieldChange: PanelEmit,
  refresh: () => void
) {
  const raw = window.prompt('Paste ParticleState JSON:');
  if (!raw) return;
  try {
    const next = importJSON(raw);
    Object.assign(state, next);
    state.cursor = { ...next.cursor };
    (
      [
        'mode',
        'count',
        'size',
        'spread',
        'shape',
        'text',
        'svgData',
        'palette',
        'gradientMode',
        'colorA',
        'colorB',
        'trail',
        'rotation',
        'mirror',
        'seed',
        'cursor',
        'flowField',
        'noiseScale',
        'noiseSpeed',
        'noiseStrength',
        'connections',
        'connectionRadius',
        'connectionOpacity',
      ] as (keyof ParticleState)[]
    ).forEach((k) => {
      notifyChange(state, k);
      onFieldChange(k);
    });
    refresh();
    toast('Imported');
  } catch (e) {
    toast((e as Error).message || 'Invalid JSON');
  }
}

function toast(msg: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 1600);
}

