# GLB Studio

A local-first GLB / glTF 2.0 viewer built with TypeScript, Three.js and Vite. The responsive workspace includes a scene explorer, mesh selection, geometry and material inspection, lighting controls, animation playback, PNG screenshots and an optional device library.

## Use

Open **Open model** and choose one `.glb`, or one `.gltf` with its buffers and images. Use **Open folder** when dependencies are in subdirectories. A folder must contain exactly one model. The original studio sample is included. Drag to orbit, scroll/pinch to zoom, and right-drag/two-finger drag to pan. Focus the canvas for arrow-key orbit, `+` / `-` zoom, `F` fit and `Escape` deselection. Scene Explorer offers button-based selection without pointing at the canvas.

Models are processed on the device and are not uploaded. **Save current model** explicitly stores the original files in IndexedDB. Saved models can be reopened, exported or removed. Browser storage is not a backup and may be cleared or denied, especially in private browsing. Save originals elsewhere. Multi-file exports are ZIP archives; extract them before re-importing.

## Development

Use Node.js 24 or newer:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The project base is `/PWA-GLB-Model-Viewer/`. `npm run preview` serves the production build. The Playwright suite uses its own preview port 5187. GitHub Actions builds and publishes `dist` after successful typechecking and unit tests on pushes to `main`. Revert the release commit and push to restore a previous release through the same workflow.

## Offline and updates

After the first online production visit, Workbox caches the application shell, lazy engine/validator modules, icons and the sample. Local imports and saved-library models work offline. Models are kept separately in IndexedDB; GPU objects exist only in memory. Development mode does not register a service worker.

An installed update waits for **Update now**. Save or export an active model first: reloading clears the in-memory scene. The update action displays progress and reloads after activation. Cache cleanup is limited to this application's Workbox namespace and service-worker scope. Installation support and browser quota behavior vary; iOS users install using Safari's Add to Home Screen.

## Boundaries and safety

- One model per import; at most 256 files and 100 MB total.
- JSON at most 8 MB and 64 nesting levels; scene graphs at most 2,000 nodes and 64 levels.
- At most 1,000 meshes and 128 images; estimated geometry allocation at most 256 MB.
- PNG, JPEG and WebP textures, at most 4096 px on either axis and 32 megapixels total.
- Worker-based Khronos glTF Validator, with bounded issue output and a 30-second timeout. Errors prevent loading; warnings are visible in the report.
- Relative dependencies must resolve within the selected package. Absolute, network, drive, parent-directory and malformed paths are rejected. Remote model URLs and ZIP import are intentionally unsupported. No decompression or remote decoder is invoked.
- Draco, Meshopt and KTX2/Basis-required models are rejected with an export hint. Export an uncompressed glTF 2.0 package. Not every glTF extension is supported.
- The library is limited to 10 saved models / 200 MB in addition to browser quotas. Complex models can still exceed a device's capability within these limits; reduce geometry or texture sizes if loading fails.
- A single renderer/context is reused. Model replacement disposes geometry, materials, textures, skeletons, animation bindings and selection helpers. Dependency blob URLs are revoked after loading.

## Reuse

`src/engine/Renderer.ts` exports `Viewer`, independent of the application shell. Instantiate it with a sized container and call `setModel(gltf)`, `fit()`, `select(object)`, `play(index)`, `clear()` and `dispose()`. Use `onSelect`, `onStats` and `onContextLost` to connect a host UI. `dispose()` is required when unmounting. Geometry counts describe rendered mesh instances, not unique shared vertices. Memory telemetry reports GPU geometry/texture object counts, not byte-accurate GPU or browser heap usage.

For local untrusted files, retain the complete application boundary: `checkFiles` → `entryPath` → `validate` → `loadModel` → `Viewer.setModel`. Do not bypass validation when embedding this viewer in a mall, gallery or product page. Hosts own their theme and service worker; they should register only their own PWA shell.

The sample and icons are original procedural assets. Regenerate them with `node scripts/generate-sample.mjs` and `python scripts/generate-icons.py` (Pillow required for icon generation only).

See [task.md](task.md) for acceptance status and [verification.md](verification.md) for tested scope and remaining release gates.
