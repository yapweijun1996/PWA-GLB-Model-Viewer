import { Store } from './AppState';
import { checkFiles, entryPath } from '../loaders/DependencyResolver';
import { validate, type ValidationReport } from '../loaders/ModelValidator';
import {
  listModels,
  saveModel,
  deleteModel,
  type SavedModel,
} from '../storage/ModelLibrary';
import type { Viewer } from '../engine/Renderer';
import type { Object3D, Mesh, Material } from 'three';

export function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}
const button = (id: string, action: () => void) =>
  element(id).addEventListener('click', action);
const text = (id: string, value: string) => {
  element(id).textContent = value;
};
export class AppController {
  readonly store = new Store();
  viewer?: Viewer;
  private currentFiles: File[] = [];
  private lastFiles: File[] = [];
  private report?: ValidationReport;
  private playing = false;
  private busy = false;
  private noticeTimer = 0;
  constructor() {
    this.store.subscribe((state) => {
      const working = ['Validating', 'Loading', 'Disposing'].includes(
        state.phase,
      );
      element('busy').hidden = !working;
      text('busy-text', `${state.phase} model…`);
      element('viewport').setAttribute('aria-busy', String(working));
      element('error').hidden = state.phase !== 'Error';
      text('error-text', state.error);
      text(
        'status',
        state.phase === 'Ready'
          ? 'Ready · WebGL2'
          : state.phase === 'Idle'
            ? 'Ready to open a model'
            : state.phase === 'Error'
              ? 'Import failed · choose files or retry'
              : `${state.phase}…`,
      );
      for (const id of [
        'fit',
        'zoom-in',
        'zoom-out',
        'screenshot',
        'reset',
        'save',
      ])
        (element(id) as HTMLButtonElement).disabled = state.phase !== 'Ready';
      for (const id of ['open', 'empty-open', 'sample', 'folder', 'retry'])
        (element(id) as HTMLButtonElement).disabled = working;
    });
    for (const id of ['open', 'empty-open', 'error-open'])
      button(id, () => element<HTMLInputElement>('files').click());
    button('folder', () => element<HTMLInputElement>('directory').click());
    for (const id of ['files', 'directory'])
      element<HTMLInputElement>(id).addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement;
        void this.open(Array.from(input.files ?? []));
        input.value = '';
      });
    button('sample', () => void this.sample());
    button('retry', () => void this.open(this.lastFiles));
    button('dismiss-error', () =>
      this.store.set({
        phase: this.viewer?.model ? 'Ready' : 'Idle',
        error: '',
      }),
    );
    button('fit', () => this.viewer?.fit());
    button('zoom-in', () => this.viewer?.zoom(0.8));
    button('zoom-out', () => this.viewer?.zoom(1.25));
    button('reset', () => this.clear());
    button('screenshot', () =>
      this.download(this.viewer!.screenshot(), 'glb-studio.png'),
    );
    button('save', () => void this.save());
    for (const id of ['grid', 'axes', 'wireframe'])
      element<HTMLInputElement>(id).addEventListener('change', () =>
        this.applyDisplay(),
      );
    for (const id of ['lighting', 'intensity', 'background'])
      element(id).addEventListener('input', () => this.applyDisplay());
    element('animation').addEventListener('change', () => {
      this.playing = true;
      this.viewer?.play(Number(element<HTMLSelectElement>('animation').value));
      text('play', 'Pause');
    });
    button('play', () => {
      if (!this.playing) {
        if (element('play').textContent === 'Play')
          this.viewer?.play(
            Number(element<HTMLSelectElement>('animation').value),
          );
        this.viewer?.pause(false);
      } else this.viewer?.pause(true);
      this.playing = !this.playing;
      text('play', this.playing ? 'Pause' : 'Resume');
    });
    button('stop', () => {
      this.viewer?.play(Number(element<HTMLSelectElement>('animation').value));
      this.playing = true;
      text('play', 'Pause');
    });
    button(
      'fullscreen',
      () =>
        void (
          document.fullscreenElement
            ? document.exitFullscreen()
            : element('viewport').requestFullscreen()
        ).catch(() =>
          this.notice('Fullscreen is unavailable in this browser.'),
        ),
    );
    for (const name of ['explorer', 'inspector'])
      button(`${name}-toggle`, () => {
        const open = element(name).classList.toggle('open');
        element(`${name}-toggle`).setAttribute('aria-expanded', String(open));
        const other = name === 'explorer' ? 'inspector' : 'explorer';
        element(other).classList.remove('open');
        element(`${other}-toggle`).setAttribute('aria-expanded', 'false');
        if (open)
          element(name)
            .querySelector<HTMLElement>('button,select,input,summary')
            ?.focus();
      });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape')
        for (const name of ['explorer', 'inspector']) {
          if (element(name).classList.contains('open')) {
            element(name).classList.remove('open');
            element(`${name}-toggle`).setAttribute('aria-expanded', 'false');
            element(`${name}-toggle`).focus();
          }
        }
    });
    const drop = element('viewport');
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      document.body.classList.add('dragging');
    });
    drop.addEventListener('dragleave', () =>
      document.body.classList.remove('dragging'),
    );
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      document.body.classList.remove('dragging');
      void this.open(Array.from(e.dataTransfer?.files ?? []));
    });
    void this.library();
  }
  notice(message: string) {
    text('notice', message);
    element('notice').hidden = false;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      element('notice').hidden = true;
    }, 6000);
  }
  private async engine() {
    if (this.viewer) return this.viewer;
    const { Viewer } = await import('../engine/Renderer');
    this.viewer = new Viewer(element('viewport'));
    this.viewer.onSelect = (object) => this.selection(object);
    this.viewer.onStats = (message) => text('performance', message);
    this.viewer.onContextLost = () => {
      this.store.set({
        phase: 'Error',
        error:
          'The graphics context was lost. Reload the app and re-import your model.',
      });
    };
    return this.viewer;
  }
  async open(files: File[]) {
    if (this.busy || !files.length) return;
    this.busy = true;
    this.lastFiles = files;
    this.store.set({ phase: 'Validating', error: '' });
    try {
      const fileMap = checkFiles(files),
        entry = entryPath(fileMap);
      const buffers = new Map(
        await Promise.all(
          [...fileMap].map(
            async ([path, file]) => [path, await file.arrayBuffer()] as const,
          ),
        ),
      );
      const report = await validate(entry, buffers);
      this.store.set({ phase: 'Loading' });
      const viewer = await this.engine();
      const { loadModel } = await import('../loaders/ModelLoader');
      const model = await loadModel(entry, buffers);
      viewer.setModel(model);
      this.currentFiles = files;
      this.report = report;
      text('model-name', entry.split('/').pop()!);
      text('model-format', /\.glb$/i.test(entry) ? 'GLB 2.0' : 'glTF 2.0');
      element('empty').hidden = true;
      element('viewport-label').hidden = false;
      this.tree();
      this.geometry();
      this.animations();
      this.applyDisplay();
      text(
        'validation',
        `Khronos glTF Validator · ${report.issues.numErrors} errors · ${report.issues.numWarnings} warnings`,
      );
      text(
        'validation-details',
        report.issues.messages
          .map((m) => `${m.code}: ${m.message}`)
          .join('\n') || 'No issues found.',
      );
      this.store.set({ phase: 'Ready', name: entry });
      this.notice(
        `Opened ${entry.split('/').pop()}. Files stay on this device.`,
      );
    } catch (error) {
      this.store.set({
        phase: 'Error',
        error: error instanceof Error ? error.message : 'Unable to load model.',
      });
    } finally {
      this.busy = false;
    }
  }
  async sample() {
    if (this.busy) return;
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}models/studio-rover.glb`,
      );
      if (!response.ok)
        throw new Error(
          'The sample is unavailable. Please import a local model.',
        );
      await this.open([new File([await response.blob()], 'studio-rover.glb')]);
    } catch (error) {
      this.notice(String(error));
    }
  }
  clear() {
    this.store.set({ phase: 'Disposing' });
    this.viewer?.clear();
    this.currentFiles = [];
    this.lastFiles = [];
    this.report = undefined;
    element('empty').hidden = false;
    element('viewport-label').hidden = true;
    element('tree').replaceChildren();
    element('scene-empty').hidden = false;
    text('model-name', 'Untitled scene');
    text('model-format', 'LOCAL VIEWER');
    this.geometry();
    this.animations();
    this.selection();
    text('validation', 'Import a model to run Khronos glTF validation.');
    text('validation-details', '');
    this.store.set({ phase: 'Idle', name: '', error: '' });
  }
  private tree() {
    const root = this.viewer!.model!.scene;
    const tree = element('tree');
    tree.replaceChildren();
    element('scene-empty').hidden = true;
    const visit = (object: Object3D, depth: number) => {
      const item = document.createElement('button');
      item.className = 'node';
      item.style.setProperty('--depth', String(Math.min(depth, 8)));
      item.textContent = `${(object as Mesh).isMesh ? '◇' : '▾'} ${object.name || object.type}`;
      item.dataset.uuid = object.uuid;
      item.setAttribute('aria-pressed', 'false');
      item.addEventListener('click', () => this.viewer?.select(object));
      tree.append(item);
      object.children.forEach((child) => visit(child, depth + 1));
    };
    visit(root, 0);
  }
  private geometry() {
    const stats = this.viewer?.model ? this.viewer.stats() : undefined;
    const dl = element('geometry');
    dl.replaceChildren();
    for (const key of [
      'vertices',
      'triangles',
      'meshes',
      'materials',
    ] as const) {
      const dt = document.createElement('dt'),
        dd = document.createElement('dd');
      dt.textContent = key[0].toUpperCase() + key.slice(1);
      dd.textContent = stats ? stats[key].toLocaleString() : '—';
      dl.append(dt, dd);
    }
  }
  private selection(object?: Object3D) {
    text(
      'selection',
      object
        ? object.name || object.type
        : 'Select a mesh in the scene or viewport.',
    );
    element('tree')
      .querySelectorAll<HTMLElement>('[data-uuid]')
      .forEach((item) =>
        item.setAttribute(
          'aria-pressed',
          String(item.dataset.uuid === object?.uuid),
        ),
      );
    const dl = element('material');
    dl.replaceChildren();
    const mesh = object as Mesh | undefined;
    const materials: Material[] = mesh?.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : [];
    for (const material of materials) {
      const values: [string, string][] = [
        ['Name', material.name || 'Unnamed'],
        ['Type', material.type],
        ['Opacity', material.opacity.toFixed(2)],
      ];
      for (const key of ['roughness', 'metalness'] as const)
        if (key in material) values.push([key, String((material as any)[key])]);
      if ('color' in material)
        values.push(['Color', `#${(material as any).color.getHexString()}`]);
      for (const [label, value] of values) {
        const dt = document.createElement('dt'),
          dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        dl.append(dt, dd);
      }
    }
  }
  private animations() {
    this.playing = false;
    text('play', 'Play');
    const select = element<HTMLSelectElement>('animation');
    select.replaceChildren();
    const clips = this.viewer?.model?.animations ?? [];
    if (!clips.length) select.add(new Option('No animations', ''));
    clips.forEach((clip, index) =>
      select.add(new Option(clip.name || `Clip ${index + 1}`, String(index))),
    );
    select.disabled = !clips.length;
    (element('play') as HTMLButtonElement).disabled = !clips.length;
    (element('stop') as HTMLButtonElement).disabled = !clips.length;
  }
  private applyDisplay() {
    if (!this.viewer) return;
    this.viewer.grid.visible = element<HTMLInputElement>('grid').checked;
    this.viewer.axes.visible = element<HTMLInputElement>('axes').checked;
    this.viewer.wireframe(element<HTMLInputElement>('wireframe').checked);
    this.viewer.background(element<HTMLSelectElement>('background').value);
    const intensity = Number(element<HTMLInputElement>('intensity').value);
    text('intensity-value', intensity.toFixed(1));
    this.viewer.lighting(
      element<HTMLSelectElement>('lighting').value,
      intensity,
    );
  }
  private async save() {
    try {
      await saveModel(this.store.value.name, this.currentFiles);
      this.notice(
        'Model saved on this device. Keep your original files as a backup.',
      );
      await this.library();
    } catch (error) {
      this.notice(String(error));
    }
  }
  private async library() {
    try {
      const models = await listModels();
      const root = element('recent');
      root.replaceChildren();
      for (const model of models) {
        const card = document.createElement('div');
        card.className = 'saved-card';
        const label = document.createElement('p');
        label.textContent = model.name;
        const actions = document.createElement('div');
        actions.className = 'saved-actions';
        for (const [name, action] of [
          ['Open', () => void this.open(model.files)],
          ['Export', () => void this.export(model)],
          [
            'Remove',
            () =>
              void deleteModel(model.id)
                .then(() => this.library())
                .catch((error) => this.notice(String(error))),
          ],
        ] as const) {
          const control = document.createElement('button');
          control.textContent = name;
          control.addEventListener('click', action);
          actions.append(control);
        }
        card.append(label, actions);
        root.append(card);
      }
    } catch (error) {
      text('recent', String(error));
    }
  }
  private async export(model: SavedModel) {
    try {
      let blob: Blob, name: string;
      if (model.files.length === 1) {
        blob = model.files[0];
        name = model.files[0].name;
      } else {
        const { zipSync } = await import('fflate');
        const files: Record<string, Uint8Array> = Object.create(null);
        for (const file of model.files)
          files[file.name] = new Uint8Array(await file.arrayBuffer());
        blob = new Blob([zipSync(files) as Uint8Array<ArrayBuffer>]);
        name = 'model-files.zip';
      }
      const url = URL.createObjectURL(blob);
      this.download(url, name);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      this.notice(`Export failed: ${String(error)}`);
    }
  }
  private download(url: string, name: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }
}
