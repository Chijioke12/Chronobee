// ChronoBee: KaiOS Full-Screen Production Compiler Script
import fs from 'fs';
import path from 'path';
import http from 'https';
import babel from '@babel/core';

const __dirname = path.resolve();

const distDir = path.join(__dirname, 'dist');
const distSrcDir = path.join(distDir, 'src');
const distIconsDir = path.join(distDir, 'icons');
const distAudioDir = path.join(distDir, 'audio');

// Recreate clean dist directories
function clearDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

console.log('Compiling standalone KaiOS Production Build...');
clearDir(distDir);
fs.mkdirSync(distSrcDir, { recursive: true });
fs.mkdirSync(distIconsDir, { recursive: true });
fs.mkdirSync(distAudioDir, { recursive: true });

// Helper to fetch Phaser library from CDN for offline playability within packed application package
function downloadFile(url, dest, callback) {
  const file = fs.createWriteStream(dest);
  http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(callback);
    });
  }).on('error', function(err) {
    fs.unlinkSync(dest);
    if (callback) callback(err.message);
  });
}

// 1. DOWNLOAD SECURE OFFLINE PHASER COPY
const phaserCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/phaser-ce/2.20.0/phaser.min.js';
const phaserDestPath = path.join(distSrcDir, 'phaser.min.js');

console.log('Fetching CDN Phaser CE into offline-playable package assets...');
downloadFile(phaserCdnUrl, phaserDestPath, (err) => {
  if (err) {
    console.error('Phaser fallback caching failed:', err);
    // Write an empty/stub file or fallback to CDN linkage
  } else {
    console.log('Phaser stored successfully in local package assets.');
  }

  // 2. CONVERT INDEX.HTML INTO COMPACT FULL-SCREEN PHONE EXPERIENCE (Hiding Simulator Frame)
  console.log('Assembling clean full-screen layout without desktop emulator borders...');
  const cleanIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>ChronoBee</title>
    <!-- Serviced locally inside packed app for full offline support on KaiOS hardware -->
    <script src="src/phaser.min.js"></script>
    <link rel="stylesheet" href="src/index.css" />
    <style>
      /* Standalone full-screen override styles for physical phone screens */
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: #050b14;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .standalone-viewport {
        width: 240px;
        height: 320px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        background: #000;
      }

      /* CRT Overlays inside full screen */
      .scanlines {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          rgba(18, 16, 16, 0) 50%, 
          rgba(0, 0, 0, 0.15) 50%
        );
        background-size: 100% 3px;
        z-index: 20;
        pointer-events: none;
      }

      .vignette {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.7);
        z-index: 21;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div class="standalone-viewport">
      <!-- Play area 240x300 (With no custom status bar, softkeys take 20px = 320px Total height) -->
      <div class="canvas-container" style="height: 320px; overflow: hidden;">
        <div id="gameCanvas" style="width: 240px; height: 300px; overflow: hidden;"></div>
        
        <!-- Softkey Footer indicators -->
        <div class="softkey-indicators">
          <span id="lblSoftLeft">RESTART</span>
          <span class="softkey-center-indicator">OK (JUMP)</span>
          <span id="lblSoftRight">SOUND ON</span>
        </div>
      </div>

      <div class="scanlines"></div>
      <div class="vignette"></div>
    </div>

    <!-- Main Game Logic -->
    <script src="src/main.js"></script>
  </body>
</html>
`;

  fs.writeFileSync(path.join(distDir, 'index.html'), cleanIndexHtml);

  // 3. COPY APPLICATION SCRIPTS & STYLES (Stripping the modular import paths & Transpiling with Babel for Firefox 48 compatibility)
  let mainJsContent = fs.readFileSync(path.join(__dirname, 'src', 'main.js'), 'utf-8');
  // KaiOS packaged apps don't support ES module structures by default unless bundled, so we serve as a standard script.
  // We remove any dynamic imports / browser modules which aren't in vanilla scope.
  // Any module imports are stripped or replaced
  mainJsContent = mainJsContent.replace("import './index.css';", "");

  console.log('Transpiling main.js with Babel to target Firefox 48...');
  try {
    const babelResult = babel.transformSync(mainJsContent, {
      presets: [
        ['@babel/preset-env', {
          targets: {
            firefox: '48'
          }
        }]
      ]
    });
    fs.writeFileSync(path.join(distSrcDir, 'main.js'), babelResult.code);
    console.log('Successfully transpiled main.js for Firefox 48.');
  } catch (err) {
    console.error('Babel transpilation failed, writing fallback un-transpiled code:', err);
    fs.writeFileSync(path.join(distSrcDir, 'main.js'), mainJsContent);
  }

  // Copy CSS styles
  const cssContent = fs.readFileSync(path.join(__dirname, 'src', 'index.css'), 'utf-8');
  fs.writeFileSync(path.join(distSrcDir, 'index.css'), cssContent);

  // 4. COPY GENERATED AUDIO & ICONS
  if (fs.existsSync(path.join(__dirname, 'audio'))) {
    const audioFiles = fs.readdirSync(path.join(__dirname, 'audio'));
    audioFiles.forEach(file => {
      fs.copyFileSync(path.join(__dirname, 'audio', file), path.join(distAudioDir, file));
    });
  }

  if (fs.existsSync(path.join(__dirname, 'icons'))) {
    const iconFiles = fs.readdirSync(path.join(__dirname, 'icons'));
    iconFiles.forEach(file => {
      fs.copyFileSync(path.join(__dirname, 'icons', file), path.join(distIconsDir, file));
    });
  }

  // 5. DEPLOY WEBAPP MANIFEST FILE
  const manifestContent = {
    "name": "ChronoBee",
    "description": "Navigate the quantum grid field. Escape security barriers utilizing color shields and hyper boosters on a fully compatible retro KaiOS setup.",
    "launch_path": "/index.html",
    "icons": {
      "56": "/icons/icon-56.png",
      "112": "/icons/icon-112.png",
      "128": "/icons/icon-128.png",
      "512": "/icons/icon-512.png"
    },
    "developer": {
      "name": "KaiOSphere Games",
      "url": "https://github.com/umachijioke7/chrono-bee"
    },
    "locales": {
      "en-US": {
        "name": "ChronoBee",
        "subtitle": "Chrono-Phase Grid Glider",
        "description": "Escape the quantum energy grid utilizing color phase-shifting."
      }
    },
    "default_locale": "en-US",
    "type": "web",
    "theme_color": "#0d121c",
    "fullscreen": "true"
  };

  fs.writeFileSync(path.join(distDir, 'manifest.webapp'), JSON.stringify(manifestContent, null, 2));
  console.log('Packed App manifest.webapp written successfully.');

  console.log('KaiOS Standalone App compiled successfully inside /dist/ folder.');
});
