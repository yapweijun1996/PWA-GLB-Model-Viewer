export const shell = `
<div class="studio">
  <header class="topbar">
    <a class="brand" href="./"><span class="brand-icon" aria-hidden="true">⬡</span> GLB Studio <span class="badge">Viewer</span></a>
    <div class="header-actions">
      <span id="connection" class="connection">Local & private</span>
      <button id="install" hidden>Install app</button>
      <button id="open" class="primary">Open model</button>
      <button id="fullscreen" aria-label="Toggle fullscreen" title="Fullscreen">⛶</button>
    </div>
  </header>
  <nav class="panel-tabs" aria-label="Viewer panels"><button id="explorer-toggle" aria-expanded="false" aria-controls="explorer">Scene Explorer</button><button id="inspector-toggle" aria-expanded="false" aria-controls="inspector">Inspector</button></nav>
  <main class="workspace">
    <aside id="explorer" class="panel explorer" aria-label="Scene Explorer">
      <div class="panel-title"><h2>Scene Explorer</h2><span class="eyebrow">SCENE</span></div>
      <p id="scene-empty" class="muted">Your scene starts here.</p><div id="tree" class="scene-tree" aria-label="Scene nodes"></div>
      <section class="library"><h2>Model Library</h2><p class="muted">Saved on this device</p><button id="save" class="wide" disabled>Save current model</button><div id="recent"></div><p class="fine">Browser storage can be cleared. Keep your original files as a backup.</p></section>
      <section class="import-help"><h2>Bring your own model</h2><p class="muted">GLB or glTF + dependencies.<br>Up to 100 MB per import.</p><button id="folder">Open folder</button><p class="fine">Select a folder containing one model. Files stay on your device.</p></section>
    </aside>
    <section class="stage" aria-label="Model viewer">
      <div class="stage-heading"><span id="model-name">Untitled scene</span><span class="eyebrow" id="model-format">LOCAL VIEWER</span></div>
      <div id="viewport" class="viewport" aria-busy="false">
        <div id="empty" class="empty-state"><div class="empty-cube">⬡</div><p class="eyebrow">A NEW PERSPECTIVE</p><h1>Every detail.<br>Every angle.</h1><p>Explore your 3D models in a private,<br>distraction-free workspace.</p><button id="empty-open" class="primary">Open a model</button><button id="sample" class="text-button">Try the studio sample →</button><p class="fine">Drag & drop files here · GLB / glTF</p></div>
        <div id="busy" class="busy" hidden><div class="spinner"></div><p id="busy-text">Preparing model…</p></div>
        <div id="error" class="error-card" role="alert" hidden><h2>We couldn’t open this model</h2><p id="error-text"></p><div><button id="retry">Retry</button><button id="error-open" class="primary">Choose files</button><button id="dismiss-error">Dismiss</button></div></div>
        <span class="viewport-label" id="viewport-label" hidden>PERSPECTIVE</span>
      </div>
      <div class="viewport-toolbar" role="toolbar" aria-label="Camera tools"><button id="fit" disabled title="Fit model (F)">Fit view</button><button id="zoom-in" disabled aria-label="Zoom in">＋</button><button id="zoom-out" disabled aria-label="Zoom out">−</button><span class="toolbar-divider"></span><button id="screenshot" disabled title="Download screenshot">PNG ↓</button><button id="reset" disabled>Clear</button></div>
      <p class="controls-hint">Drag to orbit <span>·</span> Scroll / pinch to zoom <span>·</span> Right-drag / two fingers to pan</p>
    </section>
    <aside id="inspector" class="panel inspector" aria-label="Inspector">
      <div class="panel-title"><h2>Inspector</h2><span class="eyebrow">DETAILS</span></div>
      <section><h3>Geometry</h3><dl id="geometry"><dt>Vertices</dt><dd>—</dd><dt>Triangles</dt><dd>—</dd><dt>Meshes</dt><dd>—</dd><dt>Materials</dt><dd>—</dd></dl></section>
      <section><h3>Selection</h3><p id="selection" class="muted">Select a mesh in the scene or viewport.</p><dl id="material"></dl></section>
      <section><h3>Lighting</h3><label>Preset<select id="lighting"><option>Studio</option><option>Soft</option><option>Neutral</option></select></label><label>Intensity <output id="intensity-value">1.5</output><input id="intensity" type="range" min="0" max="4" step="0.1" value="1.5"></label></section>
      <section><h3>Display</h3><label class="check"><input id="grid" type="checkbox"> Grid</label><label class="check"><input id="axes" type="checkbox"> Axes</label><label class="check"><input id="wireframe" type="checkbox"> Wireframe</label><label>Background<select id="background"><option value="#e9edef">Mist</option><option value="#202733">Slate</option><option value="#ffffff">White</option><option value="#000000">Black</option></select></label></section>
      <section><h3>Animation</h3><label>Clip<select id="animation" disabled><option>No animations</option></select></label><button id="play" disabled>Play</button><button id="stop" disabled>Restart</button></section>
      <section><h3>Appearance</h3><label>Theme<select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></section>
      <section><details><summary>Validation report</summary><p id="validation" class="muted">Import a model to run Khronos glTF validation.</p><pre id="validation-details"></pre></details></section>
    </aside>
  </main>
  <footer><span><i id="status-dot"></i><span id="status" role="status">Ready to open a model</span></span><span id="performance">WebGL2 · Engine loads on demand</span></footer>
</div>
<input id="files" type="file" accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2" multiple hidden>
<input id="directory" type="file" webkitdirectory multiple hidden>
<div id="notice" class="notice" role="status" hidden></div>
<div id="update-prompt" class="update-prompt" hidden><p>New version available. Save or export your current model before updating.</p><button id="update-now" class="primary">Update now</button><button id="update-later">Later</button></div>
`;
