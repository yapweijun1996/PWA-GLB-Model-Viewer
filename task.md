# PWA GLB Model Viewer — V1 Tasks

## Objective and status

Build GLB Studio as a lightweight, cross-platform, offline-capable 3D model viewer that can be reused in other web projects. The viewer is implemented and local automated acceptance has passed. Physical-device and calibrated performance acceptance remain open. See [verification.md](verification.md) for the evidence and limits.

V1 focuses on opening, viewing, rotating, zooming and inspecting models, including their built-in animations. It is not a 3D editor or game engine.

## Implementation

- [x] Establish a TypeScript, Vite and Three.js foundation with modular UI, viewer lifecycle and tests.
- [x] Build the responsive layout: desktop explorer, canvas and inspector; collapsible tablet panels; mobile canvas and bottom-sheet inspector. Support safe areas and touch.
- [x] Import local GLB files and glTF files with their local dependencies. Keep files on the device; reject unauthorized remote resources and unsafe paths.
- [x] Enforce a 100 MB initial import limit and bounded resource counts, parsing depth and expanded data size. Validate headers, structure, buffers and dependency paths; use a worker for separable validation. Provide clear errors and recovery.
- [x] Implement orbit, zoom, pan, camera auto-fit, keyboard and touch controls.
- [x] Add scene tree navigation, mesh selection and highlighting, geometry statistics, lighting presets, grid, axes, wireframe and background themes.
- [x] Play embedded animations, with accessible playback controls.
- [x] Implement loading states and correctly dispose of geometry, materials, textures and object URLs when changing or clearing a model.
- [x] Provide an installable offline PWA: cache the application shell, preserve user-selected models in IndexedDB, and offer user-controlled updates. Explain storage limitations and allow re-import or export.
- [x] Add screenshot export, recent local models, a read-only material inspector, a model validation report and performance statistics.
- [x] Define shared design tokens, light/dark/system themes, visible keyboard focus, reduced-motion support and accessible alternatives to canvas interaction.
- [x] Document the reusable viewer interface, local development, deployment, offline behavior and supported model limitations.

## Verification and release gates

Only executed checks may be marked complete. The original 36 E2E scenarios are defined, with two additional regression cases for embedded textures and persistence denial. Automated checks do not replace physical-device acceptance.

- [x] TypeScript typecheck; unit and integration tests.
- [x] Define and pass 36 E2E cases, including import, inspection, animation, errors, disposal and offline update flows. Final suite: 38 passed, including two additional regressions.
- [x] Security negative tests for malformed models, missing dependencies, external URLs, traversal, oversized inputs and resource exhaustion. ZIP import is not implemented.
- [ ] Responsive and accessibility checks at 320, 390, 768 and 1440 px; target WCAG 2.2 AA.
- [x] Verify offline launch, local import and saved-model reopening after the initial online visit; verify update notification and activation.
- [ ] Test Chrome, Edge, Firefox and Safari, plus Android Chrome and iOS Safari on real devices. Record install, storage and touch behavior separately from viewport emulation.
- [ ] Measure performance using documented devices, browsers, test models, network and duration. Targets: compressed initial JS ≤ 250 KB, first UI render ≤ 2 s, desktop ≥ 50 FPS, mobile ≥ 30 FPS, one canvas and one WebGL context; repeated model switches must not continuously increase GPU resources.
- [ ] Resolve critical and high issues and record all failures, exceptions and unrun checks before release.

## Suggested sequence

Foundation → local model loading and validation → viewer controls → inspection and animation → offline PWA → security and regression testing → release.
