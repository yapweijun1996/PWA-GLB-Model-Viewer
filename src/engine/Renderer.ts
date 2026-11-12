import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject } from './ResourceManager';

export interface GeometryStats {
  vertices: number;
  triangles: number;
  meshes: number;
  materials: number;
}
export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000);
  readonly controls: OrbitControls;
  readonly grid = new THREE.GridHelper(10, 20, 0x8294a6, 0xc6cdd4);
  readonly axes = new THREE.AxesHelper(2);
  readonly keyLight = new THREE.DirectionalLight(0xffffff, 3);
  readonly fillLight = new THREE.HemisphereLight(0xe2eeff, 0x53545f, 2);
  model?: GLTF;
  private mixer?: THREE.AnimationMixer;
  private action?: THREE.AnimationAction;
  private selection?: THREE.BoxHelper;
  private environment: THREE.WebGLRenderTarget;
  private observer: ResizeObserver;
  private previous = performance.now();
  private frames = 0;
  private lastStats = performance.now();
  private down = { x: 0, y: 0 };
  private disposed = false;
  onSelect: (object?: THREE.Object3D) => void = () => {};
  onStats: (text: string) => void = () => {};
  onContextLost: () => void = () => {};
  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D viewport. Arrow keys orbit, plus and minus zoom, F fits the model. Use Scene Explorer for model selection.',
    );
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.contextLost,
    );
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.camera.position.set(5, 3, 6);
    this.controls.update();
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    disposeObject(room);
    pmrem.dispose();
    this.scene.background = new THREE.Color('#e9edef');
    this.keyLight.position.set(3, 5, 4);
    this.scene.add(this.keyLight, this.fillLight, this.grid, this.axes);
    this.axes.visible = false;
    this.grid.visible = false;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.addEventListener('keydown', this.keyDown);
    this.renderer.setAnimationLoop(this.frame);
  }
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.renderer.setAnimationLoop(null);
    this.onContextLost();
  };
  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(Math.max(width, 1), Math.max(height, 1));
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
  private frame = () => {
    if (this.disposed) return;
    const now = performance.now();
    const delta = Math.min((now - this.previous) / 1000, 0.1);
    this.previous = now;
    if (!document.hidden) {
      this.mixer?.update(delta);
      this.controls.update();
      this.selection?.update();
      this.renderer.render(this.scene, this.camera);
      this.frames++;
    }
    if (now - this.lastStats > 1000) {
      const info = this.renderer.info;
      this.onStats(
        `${Math.round((this.frames * 1000) / (now - this.lastStats))} FPS · ${info.render.calls} draw calls · ${info.memory.geometries} geometries · ${info.memory.textures} textures`,
      );
      this.frames = 0;
      this.lastStats = now;
    }
  };
  private pointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };
  private pointerUp = (e: PointerEvent) => {
    if (
      !this.model ||
      Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5
    )
      return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    this.select(
      ray
        .intersectObject(this.model.scene, true)
        .find((hit) => (hit.object as THREE.Mesh).isMesh)?.object,
    );
  };
  private keyDown = (e: KeyboardEvent) => {
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (e.key === '+' || e.key === '=') this.zoom(0.8);
    else if (e.key === '-') this.zoom(1.25);
    else if (e.key.toLowerCase() === 'f') this.fit();
    else if (e.key === 'Escape') this.select();
    else if (e.key.startsWith('Arrow')) {
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (e.key === 'ArrowLeft') spherical.theta -= 0.1;
      if (e.key === 'ArrowRight') spherical.theta += 0.1;
      if (e.key === 'ArrowUp') spherical.phi -= 0.1;
      if (e.key === 'ArrowDown') spherical.phi += 0.1;
      spherical.makeSafe();
      this.camera.position
        .copy(this.controls.target)
        .add(new THREE.Vector3().setFromSpherical(spherical));
      this.controls.update();
    } else return;
    e.preventDefault();
  };
  setModel(model: GLTF) {
    this.clear();
    this.model = model;
    this.scene.add(model.scene);
    this.mixer = new THREE.AnimationMixer(model.scene);
    this.fit();
  }
  fit() {
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model.scene);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.01);
    const vertical = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.15;
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(
        new THREE.Vector3(1, 0.65, 1.3).normalize().multiplyScalar(distance),
      );
    this.camera.near = Math.max(radius / 1000, 0.00001);
    this.camera.far = distance * 100;
    this.controls.minDistance = radius * 0.05;
    this.controls.maxDistance = distance * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.grid.position.set(center.x, box.min.y - radius * 0.001, center.z);
    this.grid.scale.setScalar(radius / 3);
    this.axes.position.copy(box.min);
    this.axes.scale.setScalar(radius / 2);
  }
  zoom(factor: number) {
    const offset = this.camera.position
      .clone()
      .sub(this.controls.target)
      .multiplyScalar(factor);
    offset.clampLength(this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  select(object?: THREE.Object3D) {
    if (this.selection) {
      this.selection.removeFromParent();
      this.selection.geometry.dispose();
      (this.selection.material as THREE.Material).dispose();
      this.selection = undefined;
    }
    if (object) {
      this.selection = new THREE.BoxHelper(object, 0x2563eb);
      this.scene.add(this.selection);
    }
    this.onSelect(object);
  }
  wireframe(value: boolean) {
    this.model?.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh)
        (Array.isArray(m.material) ? m.material : [m.material]).forEach(
          (mat) => {
            if ('wireframe' in mat) mat.wireframe = value;
          },
        );
    });
  }
  lighting(preset: string, intensity: number) {
    this.keyLight.intensity = intensity * (preset === 'Soft' ? 1 : 2);
    this.fillLight.intensity = intensity;
    this.scene.environmentIntensity =
      intensity * (preset === 'Neutral' ? 0.6 : 1);
  }
  background(color: string) {
    this.scene.background = new THREE.Color(color);
  }
  play(index: number) {
    this.action?.stop();
    const clip = this.model?.animations[index];
    if (clip && this.mixer) {
      this.action = this.mixer.clipAction(clip);
      this.action.reset().play();
    }
  }
  pause(value: boolean) {
    if (this.action) this.action.paused = value;
  }
  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
  stats(): GeometryStats {
    let vertices = 0,
      triangles = 0,
      meshes = 0;
    const materials = new Set<THREE.Material>();
    this.model?.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      const count = m.geometry.attributes.position?.count ?? 0;
      vertices += count;
      triangles += (m.geometry.index?.count ?? count) / 3;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) =>
        materials.add(mat),
      );
    });
    return {
      vertices,
      triangles: Math.floor(triangles),
      meshes,
      materials: materials.size,
    };
  }
  clear() {
    this.select();
    this.action?.stop();
    this.action = undefined;
    if (this.model) {
      this.mixer?.stopAllAction();
      this.mixer?.uncacheRoot(this.model.scene);
      disposeObject(this.model.scene);
    }
    this.model = undefined;
    this.mixer = undefined;
    this.renderer.renderLists.dispose();
  }
  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.clear();
    this.observer.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener(
      'pointerdown',
      this.pointerDown,
    );
    this.renderer.domElement.removeEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.removeEventListener('keydown', this.keyDown);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.contextLost,
    );
    disposeObject(this.grid);
    disposeObject(this.axes);
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
