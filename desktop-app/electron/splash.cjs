const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow } = require('electron');

const SPLASH_MESSAGES = [
  'Initializing secure terminal...',
  'Connecting services...',
  'Restoring session...',
  'Loading cashier dashboard...',
  'Syncing pending transactions...'
];

function getBrandingAssetPath(fileName) {
  const appRoot = path.join(__dirname, '..');
  const distAsset = path.join(appRoot, 'dist', 'branding', fileName);
  const publicAsset = path.join(appRoot, 'public', 'branding', fileName);

  return fs.existsSync(distAsset) ? distAsset : publicAsset;
}

function createSplashWindow({ appName }) {
  const splashWindow = new BrowserWindow({
    width: 460,
    height: 340,
    center: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: true,
    title: appName,
    backgroundColor: '#f8fafc',
    icon: getBrandingAssetPath('icon-placeholder.png'),
    webPreferences: {
      contextIsolation: true,
      devTools: false,
      nodeIntegration: false,
      sandbox: true
    }
  });

  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(renderSplashHtml({
      appName,
      logoUrl: pathToFileURL(getBrandingAssetPath('logo-placeholder.png')).href
    }))}`
  );

  return splashWindow;
}

function startSplashSequence(splashWindow, messages = SPLASH_MESSAGES) {
  let index = 0;
  let timer = null;
  let isStopped = false;
  let resolveComplete;

  const complete = new Promise((resolve) => {
    resolveComplete = resolve;
  });

  function setStatus(message) {
    if (!message || isStopped || !splashWindow || splashWindow.isDestroyed()) {
      return;
    }

    splashWindow.webContents
      .executeJavaScript(`window.setSplashStatus(${JSON.stringify(message)})`)
      .catch(() => {});
  }

  function tick() {
    setStatus(messages[index]);
    index += 1;

    if (index >= messages.length) {
      timer = setTimeout(() => resolveComplete(), 520);
      return;
    }

    timer = setTimeout(tick, 620);
  }

  if (splashWindow.webContents.isLoading()) {
    splashWindow.webContents.once('did-finish-load', tick);
  } else {
    setImmediate(tick);
  }

  return {
    complete,
    setStatus,
    stop() {
      isStopped = true;
      clearTimeout(timer);
      resolveComplete();
    }
  };
}

function renderSplashHtml({ appName, logoUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appName)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        align-items: center;
        background:
          radial-gradient(circle at 20% 20%, rgba(5, 150, 105, 0.12), transparent 32%),
          linear-gradient(180deg, #f8fafc 0%, #eef6f2 100%);
        color: #0f172a;
        display: flex;
        height: 100vh;
        justify-content: center;
        margin: 0;
        overflow: hidden;
        user-select: none;
      }

      main {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 28px;
        text-align: center;
        width: 100%;
      }

      img {
        height: 76px;
        max-width: 310px;
        object-fit: contain;
      }

      h1 {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0;
        line-height: 1.2;
        margin: 0;
      }

      .spinner {
        animation: spin 780ms linear infinite;
        border: 3px solid rgba(5, 150, 105, 0.16);
        border-top-color: #059669;
        border-radius: 999px;
        height: 38px;
        width: 38px;
      }

      .status {
        color: #475569;
        font-size: 13px;
        font-weight: 500;
        min-height: 18px;
      }

      .rail {
        background: rgba(15, 23, 42, 0.08);
        border-radius: 999px;
        height: 4px;
        overflow: hidden;
        width: 220px;
      }

      .bar {
        animation: load 2.8s ease-in-out infinite;
        background: linear-gradient(90deg, #059669, #2563eb);
        border-radius: inherit;
        height: 100%;
        width: 42%;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes load {
        0% {
          transform: translateX(-110%);
        }
        55% {
          transform: translateX(85%);
        }
        100% {
          transform: translateX(260%);
        }
      }
    </style>
  </head>
  <body>
    <main aria-live="polite">
      <img alt="" src="${logoUrl}" />
      <h1>${escapeHtml(appName)}</h1>
      <div class="spinner" aria-hidden="true"></div>
      <div id="status" class="status">${escapeHtml(SPLASH_MESSAGES[0])}</div>
      <div class="rail" aria-hidden="true"><div class="bar"></div></div>
    </main>
    <script>
      window.setSplashStatus = function setSplashStatus(message) {
        document.getElementById('status').textContent = message;
      };
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

module.exports = {
  SPLASH_MESSAGES,
  createSplashWindow,
  getBrandingAssetPath,
  startSplashSequence
};
