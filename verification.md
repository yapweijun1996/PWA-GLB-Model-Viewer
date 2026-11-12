# Verification evidence

## Scope

This document records executed checks, not product promises. Physical-device installation, native Safari, Android/iOS touch behavior, screen-reader use and calibrated device performance require access to those actual environments.

## Current results

- TypeScript typecheck: passed locally.
- Production build: passed locally; Three.js and model-loader code are dynamically imported.
- Unit tests: 29 passed, covering file boundaries, GLB structure, graph/geometry limits, unsupported resources and state notification.
- Runtime dependency audit: zero known vulnerabilities at the time of the local audit. The full development-tool audit reported 2 low and 4 moderate transitive findings in Workbox build dependencies; no high or critical findings. Runtime audit and toolchain audit have different scopes.
- Browser suite: 38 passed locally in 3.4 minutes on Windows, Chromium 158 with software WebGL, after isolating concurrent browser workloads. These include the original 36 scenarios plus embedded-texture and persistence-denial regressions.
- GitHub Actions Linux acceptance: typecheck, unit tests, build and all 38 browser cases passed for commit `e1c15c7`. Subsequent changes to the deployment workflow do not alter the application code.
- Browser smoke matrix: Chromium 158.0.8127.18, Edge 157.0.4341.46, Firefox 159.0 and Playwright WebKit 27.2 passed local GLB import, animation and glTF external-buffer import, with one canvas and no uncaught errors. WebKit automation is not native Safari acceptance.
- Responsive: loaded-model screenshots reviewed at desktop and 390 px; automated no-overflow and panel-access checks passed at 320, 390, 768 and 1440 px.
- Automated accessibility: no serious or critical axe violations in the loaded desktop workspace for the selected WCAG A/AA rule sets. This does not establish full WCAG conformance or replace screen-reader and real-device testing.
- Offline: cached launch, local GLB import and saved-model reopening passed. A real changed worker waited for the visible update action and then activated/reloaded successfully.
- Initial application entry: 8,595 gzip bytes (build measurement); engine and validator are lazy modules. Offline installation separately precaches approximately 1 MB of uncompressed assets. This is not a calibrated first-render network benchmark.
- Real-device/browser release matrix: not run.
- Device-calibrated render/FPS budgets: not run. Software WebGL results cannot establish desktop or mobile hardware FPS.

## Reproducible acceptance

`npm run test:e2e` defines 38 Chromium scenarios. It serves the actual production build and uses the normal file inputs and visible controls. Scenarios include GLB, glTF with an external buffer, embedded textures, errors and recovery, selection, materials, display/lighting, animations, camera input, PNG export, reset, repeated switching, IndexedDB persistence/export/removal, themes, 320/390/768/1440 px layouts, Khronos reports, offline imports/reopening and a real service-worker waiting/update cycle.

The update test temporarily appends a build marker to `dist/sw.js`, calls the browser registration's update discovery, then clicks the visible update button. It restores the artifact in a `finally` block. Build artifacts should always be regenerated before publishing.

Earlier runs exposed an update-controller classification bug and a brand accessible-name mismatch; both were corrected and rechecked. A separate run had a loading timeout while software-rendered browser workloads ran concurrently. The final suite ran without that parallel load; its loading wait is 30 seconds and overall case limit 90 seconds. These harness limits are not product performance claims. Prior attempt output is retained in ignored local verification files.

## Open release gates

Native Safari, Android Chrome and iOS Safari installation, physical touch/safe-area behavior, screen-reader operation, first UI render on a specified network, and sustained desktop/mobile FPS on fixed devices/models remain **NOT RUN**. CSS safe-area integration and responsive emulation are implemented, but do not close those physical-device gates. No physical device session is available in this workspace. The implemented viewer can be published for use and acceptance testing; full V1 release acceptance remains partial.
