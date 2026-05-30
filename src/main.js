// ChronoBee: KaiOS Quantum Energy Grid - Powered by Phaser 2 CE

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements for metadata and synchronization
  const statusBarTime = document.getElementById('statusBarTime');
  const muteStatusIcon = document.getElementById('muteStatusIcon');
  const lblSoftLeft = document.getElementById('lblSoftLeft');
  const lblSoftRight = document.getElementById('lblSoftRight');
  const leaderboardList = document.getElementById('leaderboardList');
  const syncStatus = document.getElementById('syncStatus');

  // Interactive hardware button pad triggers
  const keypadButtons = document.querySelectorAll('.key-action');

  // Stats Counters
  const statJumps = document.getElementById('statJumps');
  const statPhases = document.getElementById('statPhases');
  const statCombo = document.getElementById('statCombo');
  const statShieldsCollected = document.getElementById('statShieldsCollected');

  let sessionJumps = 0;
  let sessionPhases = 0;
  let maxCombo = 1;
  let shieldsCollectedCount = 0;

  // Audio System (Self-contained Oscillator Synthesizer on the Web Audio API context)
  let isMuted = false;
  let audioCtx = null;

  const cachedWavs = {};

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playOscillatorSound(type) {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'jump') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.12);
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'phase') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.15);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'boost') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.setValueAtTime(900, now + 0.05);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'damage') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.1);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'pickup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.06);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        osc.frequency.setValueAtTime(1046.50, now + 0.18);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'gameover') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.6);
        gainNode.gain.setValueAtTime(0.18, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    } catch (e) {
      console.warn('Audio synthesis engine block error:', e);
    }
  }

  function playSound(type) {
    if (isMuted) return;

    // Load with dynamic offline / relative path context suited for KaiOS device packaging
    const soundPath = `audio/${type}.wav`;
    
    // Attempt standard Audio elements which consume pre-compiled WAV sound effects efficiently
    try {
      if (!cachedWavs[type]) {
        cachedWavs[type] = new Audio(soundPath);
        // Force preload
        cachedWavs[type].load();
      }
      
      const audioObj = cachedWavs[type];
      audioObj.currentTime = 0;
      
      const playPromise = audioObj.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Playback block (e.g. user interaction required) or file error -> fallback
          console.warn(`Local WAV track path loading failed for type: ${type}. Using fallback synth.`, err);
          playOscillatorSound(type);
        });
      }
    } catch (error) {
      console.warn(`HTML5 Audio controller failed to play ${type}. Falling back to live synth:`, error);
      playOscillatorSound(type);
    }
  }

  // Live status updater
  function updateTime() {
    const d = new Date();
    let hours = d.getHours();
    let minutes = d.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    if (statusBarTime) statusBarTime.textContent = `${hours}:${minutes}`;
  }
  updateTime();
  setInterval(updateTime, 30000);

  // Score Sync Logic
  async function loadLeaderboard() {
    try {
      const res = await fetch('/api/scores');
      if (res.ok) {
        const scores = await res.json();
        renderScores(scores);
        if (syncStatus) {
          syncStatus.textContent = 'SYNCED';
          syncStatus.className = 'text-green glow-text';
        }
      }
    } catch (err) {
      console.warn('Backend server connection down:', err);
      if (syncStatus) {
        syncStatus.textContent = 'LOCAL ONLY';
        syncStatus.className = 'text-orange';
      }
      const local = [
        { name: 'KAI_MASTER', score: 1250 },
        { name: 'LOCAL_HERO', score: 620 },
        { name: 'OFFLINE_BEE', score: 210 }
      ];
      renderScores(local);
    }
  }

  function renderScores(scores) {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    if (!scores || scores.length === 0) {
      leaderboardList.innerHTML = `<li>No logs registered.</li>`;
      return;
    }
    scores.forEach((item, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>#${index + 1} ${item.name}</span>
        <span class="score-val">${item.score}</span>
      `;
      leaderboardList.appendChild(li);
    });
  }

  async function submitHighScore(playerScore) {
    if (playerScore <= 0) return;
    try {
      if (syncStatus) syncStatus.textContent = 'SENDING...';
      const promptName = prompt('Enter validation name (3-5 chars):', 'BEE') || 'BEE';
      const name = promptName.toUpperCase().substring(0, 5);

      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: playerScore })
      });
      if (res.ok) {
        const data = await res.json();
        renderScores(data.scores);
        if (syncStatus) {
          syncStatus.textContent = 'SYNCED';
          syncStatus.className = 'text-green glow-text';
        }
      }
    } catch (err) {
      console.warn('Submit high score failed:', err);
      if (syncStatus) {
        syncStatus.textContent = 'SAVE ERROR';
        syncStatus.className = 'text-orange';
      }
    }
  }

  loadLeaderboard();

  // --- PHASER 2 CE GAME ENGINE INITIALIZATION ---
  // Create 240x300 Phaser screen corresponding strictly to KAI-PAD viewport size
  const game = new Phaser.Game(240, 300, Phaser.CANVAS, 'gameCanvas', {
    preload: preload,
    create: create,
    update: update,
    render: render
  });

  // Phaser Variables
  let player;
  let beeBmd;
  let starfield = [];
  let lasers = [];
  let pickups = [];
  let particles = [];
  
  // --- MULTI-GAME CARTRIDGES SELECT SYSTEM ---
  let appMode = 'LAUNCHER'; // 'LAUNCHER' | 'CHRONOBEE' | 'DECRYPTOR'
  let launcherSelection = 0; // 0 = ChronoBee, 1 = Grid Decryptor

  // --- GRID DECRYPTOR (LOGICAL PUZZLE SYSTEM) ---
  let decryptorGrid = [];
  let cursorRow = 2;
  let cursorCol = 2;
  let decryptorTimer = 45;
  let decryptorScore = 0;
  let decryptorLevel = 1;
  let decryptorState = 'START'; // 'PLAYING' | 'GAMEOVER'
  let lastDecryptTimeTick = 0;

  const baseShapePorts = {
    0: [0, 2], // │ Vertical
    1: [1, 3], // ─ Horizontal
    2: [0, 1], // └ North-East Bend
    3: [1, 2], // ┌ East-South Bend
    4: [2, 3], // ┐ South-West Bend
    5: [3, 0], // ┘ West-North Bend
    6: [0, 1, 2, 3] // ┼ Cross
  };

  let currentGameState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
  let score = 0;
  let combo = 1;
  let gameSpeed = 1.35;
  let frameCount = 0;

  let shieldLevel = 100;
  let phaseColor = 'CYAN'; // 'CYAN' | 'MAGENTA'
  let isDoubleSpeedDashing = 0;
  let dashCooldownTimer = 0;
  let isInvincible = 0;
  let isGravityInverted = false;
  let gravityInvertedTimer = 0;

  function preload() {
    // Enable performance optimizations and strict pixel scales
    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;
  }

  function create() {
    // Start standard Phaser Arcade physics engines
    game.physics.startSystem(Phaser.Physics.ARCADE);

    // Dynamic Procedural Particle and texture generation
    beeBmd = game.add.bitmapData(24, 24);
    updateBeeTexture();

    // Spawn Phaser dynamic sprites
    player = game.add.sprite(45, 120, beeBmd);
    player.anchor.set(0.5);
    game.physics.arcade.enable(player);
    player.body.gravity.y = 800; // Phaser Arcade relative gravity weight
    player.body.collideWorldBounds = true;

    // Build the quantum background space debris stars
    starfield = [];
    for (let i = 0; i < 22; i++) {
      starfield.push({
        x: game.rnd.between(0, 240),
        y: game.rnd.between(0, 300),
        speed: game.rnd.realInRange(0.15, 0.55),
        size: game.rnd.realInRange(0.5, 2),
        color: game.rnd.pick(['#1e293b', '#334155', '#475569'])
      });
    }

    // Connect softkeys layout resets
    if (lblSoftLeft) lblSoftLeft.textContent = 'LAUNCH';
    if (lblSoftRight) lblSoftRight.textContent = 'SOUND ON';

    resetLogic();
    appMode = 'LAUNCHER';
    if (player) player.visible = false;
  }

  function update() {
    frameCount++;

    // Scroll stars
    const currentFrameSpeed = isDoubleSpeedDashing > 0 ? gameSpeed * 2.8 : gameSpeed;
    starfield.forEach(star => {
      star.x -= star.speed * (isDoubleSpeedDashing > 0 ? 3 : 1);
      if (star.x < 0) {
        star.x = 240;
        star.y = game.rnd.between(0, 300);
      }
    });

    if (appMode === 'LAUNCHER') {
      if (player && player.body) {
        player.body.velocity.y = 0;
        player.body.gravity.y = 0;
        player.visible = false;
      }
      return;
    }

    if (appMode === 'DECRYPTOR') {
      if (player && player.body) {
        player.body.velocity.y = 0;
        player.body.gravity.y = 0;
        player.visible = false;
      }
      updateDecryptor();
      return;
    }

    if (player) player.visible = true;

    if (currentGameState !== 'PLAYING') {
      if (player && player.body) {
        player.body.velocity.y = 0;
        player.body.gravity.y = 0;
      }
      return;
    }

    if (!player || !player.body) return;

    // Dynamic physical gravity reversal shifts
    if (isGravityInverted) {
      player.body.gravity.y = -800;
      if (gravityInvertedTimer > 0) {
        gravityInvertedTimer--;
        if (gravityInvertedTimer <= 0) {
          isGravityInverted = false;
          playSound('phase');
          addNewSparks(player.x, player.y, '#ffffff', 10);
        }
      }
    } else {
      player.body.gravity.y = 800;
    }

    // Shield ceiling floor scrapes friction reductions
    if (player.y - 10 <= 0 || player.y + 10 >= 300) {
      shieldLevel -= 0.6;
      if (frameCount % 12 === 0) playSound('damage');
    }

    // Active power modifiers counters
    if (isDoubleSpeedDashing > 0) {
      isDoubleSpeedDashing--;
      player.body.velocity.y *= 0.8; // Stabilize height drift
    }
    if (dashCooldownTimer > 0) {
      dashCooldownTimer--;
    }
    if (isInvincible > 0) {
      isInvincible--;
    }

    // Spawn new barriers on timing shifts which shrink as combo climbs higher
    const spawnRate = Math.max(50, 95 - Math.floor(score * 1.3));
    if (frameCount % Math.floor(spawnRate) === 0) {
      spawnLaserGate();
      if (game.rnd.realInRange(0, 1) > 0.6) {
        spawnQuantumCell();
      }
    }

    // Update active lasers positions
    for (let i = lasers.length - 1; i >= 0; i--) {
      const laser = lasers[i];
      laser.x -= currentFrameSpeed;

      // Floating up and down wave oscillators
      if (laser.floatingRangeY > 0) {
        const offset = Math.sin(frameCount * 0.04) * laser.floatingRangeY;
        laser.topHeight = laser.initialTopHeight + offset;
        laser.bottomHeight = 300 - 72 - laser.topHeight; // Keeps gap at 72px strictly
      }

      // Physics Intersections Checks
      const isOverlappingX = (player.x + 8 > laser.x && player.x - 8 < laser.x + laser.width);
      if (isOverlappingX) {
        const collidesTop = (player.y - 7 < laser.topHeight);
        const collidesBottom = (player.y + 7 > 300 - laser.bottomHeight);

        if (collidesTop || collidesBottom) {
          if (phaseColor === laser.color) {
            // MATCH QUANTUM PHASE: Brushing the matched color lasers awards combo points
            if (frameCount % 6 === 0) {
              addNewSparks(player.x, player.y, getHex(phaseColor), 3);
              score += 1;
              combo++;
              maxCombo = Math.max(maxCombo, combo);
              if (statCombo) statCombo.textContent = `${combo}x`;
            }
          } else {
            // MISMATCH ENGINES DAMAGE
            if (isInvincible <= 0 && isDoubleSpeedDashing === 0) {
              shieldLevel -= 2.5;
              addNewSparks(player.x, player.y, '#ff3333', 3);
              if (frameCount % 8 === 0) playSound('damage');
            }
          }
        }
      }

      // Match safe portal gate pass scores
      if (!laser.passed && laser.x + laser.width < player.x) {
        laser.passed = true;
        if (shieldLevel > 0) {
          score += 5;
          combo++;
          maxCombo = Math.max(maxCombo, combo);
          if (statCombo) statCombo.textContent = `${combo}x`;
          addNewSparks(laser.x + laser.width / 2, 140, '#22c55e', 5);
        }
        if (score % 25 === 0) {
          gameSpeed += 0.12;
        }
      }

      // Purge out of bounds elements
      if (laser.x + laser.width < -30) {
        lasers.splice(i, 1);
      }
    }

    // Refuel cells pick encounters
    for (let i = pickups.length - 1; i >= 0; i--) {
      const cell = pickups[i];
      cell.x -= currentFrameSpeed;
      cell.wiggle += 0.08;

      // Distance matching checks
      const dx = player.x - cell.x;
      const dy = player.y - cell.y;
      const range = Math.sqrt(dx * dx + dy * dy);

      if (range < 14) {
        playSound('pickup');
        if (cell.type === 'BATTERY') {
          shieldLevel = Math.min(100, shieldLevel + 25);
          shieldsCollectedCount++;
          if (statShieldsCollected) statShieldsCollected.textContent = shieldsCollectedCount;
          addNewSparks(cell.x, cell.y, '#10b981', 12);
        } else if (cell.type === 'BOOSTER') {
          isInvincible = 120; // 2 seconds high color shield
          shieldLevel = Math.min(100, shieldLevel + 10);
          addNewSparks(cell.x, cell.y, '#f59e0b', 16);
        } else if (cell.type === 'INVERTER') {
          isGravityInverted = !isGravityInverted;
          gravityInvertedTimer = 360; // Inverted core mechanics
          addNewSparks(cell.x, cell.y, '#a855f7', 15);
        }
        pickups.splice(i, 1);
      } else if (cell.x < -30) {
        pickups.splice(i, 1);
      }
    }

    // Star flappers wing anim updates
    if (frameCount % 3 === 0) {
      updateBeeTexture();
    }

    // Particles updates
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.age -= p.decay;
      if (p.age <= 0) {
        particles.splice(i, 1);
      }
    }

    // Check reactor shutdown critical triggers
    if (shieldLevel <= 0) {
      shieldLevel = 0;
      currentGameState = 'GAMEOVER';
      if (lblSoftLeft) lblSoftLeft.textContent = 'MENU';
      playSound('gameover');
      submitHighScore(score);
    }
  }

  function render() {
    // Override standard camera clears for customized vector aesthetics inside Phaser 2 CE CANVAS draw
    const ctx = game.canvas.getContext('2d');
    
    // Clear display buffer
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, 240, 300);

    // 1. Draw star background
    starfield.forEach(star => {
      ctx.fillStyle = star.color;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    if (appMode === 'LAUNCHER') {
      renderLauncher(ctx);
      return;
    }

    if (appMode === 'DECRYPTOR') {
      renderDecryptor(ctx);
      return;
    }

    // 2. Render lasers barriers dynamically
    lasers.forEach(laser => {
      const col = getHex(laser.color);
      
      // Top Anchor Base Solid Bezel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(laser.x - 3, 0, laser.width + 6, 8);
      
      // Hanging Plasma rod Top
      ctx.fillStyle = col;
      ctx.fillRect(laser.x, 8, laser.width, laser.topHeight - 8);
      ctx.fillStyle = '#ffffff'; // Light center filament
      ctx.fillRect(laser.x + 5, 8, 4, laser.topHeight - 8);

      // Bottom anchor node
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(laser.x - 3, 300 - 8, laser.width + 6, 8);

      // Bottom glowing rod
      ctx.fillStyle = col;
      ctx.fillRect(laser.x, 300 - laser.bottomHeight, laser.width, laser.bottomHeight - 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(laser.x + 5, 300 - laser.bottomHeight, 4, laser.bottomHeight - 8);
    });

    // 3. Render floating fuel capsules
    pickups.forEach(cell => {
      const scale = 1 + Math.sin(cell.wiggle) * 0.16;
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, 6 * scale, 0, Math.PI * 2);
      
      let coreCol = '#10b981';
      if (cell.type === 'BOOSTER') coreCol = '#eab308';
      if (cell.type === 'INVERTER') coreCol = '#a855f7';

      ctx.fillStyle = coreCol;
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Icon overlay indicators
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const char = cell.type === 'BATTERY' ? 'B' : cell.type === 'BOOSTER' ? '🌟' : '🌀';
      ctx.fillText(char, cell.x, cell.y);
    });

    // 4. Render energy particles
    particles.forEach(p => {
      ctx.fillStyle = p.col;
      ctx.globalAlpha = p.age;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    // 5. Draw the Bee Glider Custom Graphics Node
    if (player) {
      ctx.save();
      ctx.translate(player.x, player.y);
      
      // Aura ring visualizes energy shielding
      ctx.strokeStyle = getHex(phaseColor);
      ctx.lineWidth = isDoubleSpeedDashing > 0 ? 3.5 : 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();

      // Invincibility shield effect flashes
      if (isInvincible > 0 && frameCount % 4 < 2) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = getHex(phaseColor);
      }

      // Bee robotic body matrix sphere
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Eye display panel
      ctx.fillStyle = '#050b14';
      ctx.fillRect(2, -3, 3, 2.5);

      // Exhaust glow trails
      ctx.fillStyle = phaseColor === 'CYAN' ? getHex('MAGENTA') : getHex('CYAN');
      ctx.fillRect(-9, -1, 3, 2);

      // Custom Wings Flapper Logic lines matching flight
      const flapping = Math.sin(frameCount * 0.4) * 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-1, -2);
      ctx.lineTo(-5, -10 + flapping);
      ctx.stroke();

      // Arrow indicator for inverse flight layout
      if (isGravityInverted) {
        ctx.fillStyle = '#a855f7';
        ctx.font = '7px sans-serif';
        ctx.fillText('▼', 0, 15);
      }
      ctx.restore();
    }

    // 6. Draw scoring heads-up display inside the Phaser Viewport
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`CORE: ${score}`, 10, 18);

    // HP Core Shield lines
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(170, 10, 60, 6);
    
    let shieldCol = '#10b981';
    if (shieldLevel < 33) shieldCol = '#ef4444';
    else if (shieldLevel < 66) shieldCol = '#f59e0b';
    ctx.fillStyle = shieldCol;
    ctx.fillRect(170, 10, Math.floor(60 * (shieldLevel / 100)), 6);

    // 7. Render UI overlays depending on engine phases
    if (currentGameState === 'START') {
      ctx.fillStyle = 'rgba(5, 11, 20, 0.88)';
      ctx.fillRect(0, 0, 240, 300);

      ctx.textAlign = 'center';
      ctx.fillStyle = getHex('CYAN');
      ctx.font = 'bold 16px system-ui';
      ctx.fillText('CHRONO-BEE', 120, 85);
      
      ctx.fillStyle = getHex('MAGENTA');
      ctx.font = 'bold 10px monospace';
      ctx.fillText('PHASER 2 CE ENGINE', 120, 105);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '8px sans-serif';
      ctx.fillText('MATCH ROBOT SHIELD COLORS TO PASS LASERS', 120, 140);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('PRESS CENTER OK KEY TO JUMP', 120, 185);
      ctx.fillText('CLICK KEYPAD FOR SHIELD PHASE/BOOSTS', 120, 200);

      const floaty = Math.sin(Date.now() * 0.005) * 6;
      ctx.fillStyle = getHex('CYAN');
      ctx.beginPath();
      ctx.arc(120, 230 + floaty, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (currentGameState === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(10, 5, 5, 0.9)';
      ctx.fillRect(0, 0, 240, 300);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 18px system-ui';
      ctx.fillText('CRITICAL FAIL', 120, 75);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px monospace';
      ctx.fillText('CORE MATRIX FLUID DRAINED', 120, 95);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`${score}`, 120, 138);
      ctx.font = '9px sans-serif';
      ctx.fillText('FINAL CHRONO DRIFT SCORE', 120, 152);

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.fillText('PRESS CENTER OR OK KEY TO RETRY', 120, 195);
      ctx.fillText('PRESS [F1] / MENU TO EXIT TO MENU', 120, 210);
    }
  }

  // --- CARTRIDGE GAME ENGINE MANAGERS ---

  function launchSelectedCart() {
    if (launcherSelection === 0) {
      appMode = 'CHRONOBEE';
      if (player) player.visible = true;
      resetLogic();
      currentGameState = 'START';
      if (lblSoftLeft) lblSoftLeft.textContent = 'MENU';
    } else {
      initDecryptorGame();
    }
    playSound('jump');
  }

  function initDecryptorGame() {
    appMode = 'DECRYPTOR';
    decryptorState = 'PLAYING';
    decryptorTimer = 45;
    decryptorScore = 0;
    decryptorLevel = 1;
    cursorRow = 2;
    cursorCol = 2;
    lastDecryptTimeTick = Date.now();
    
    if (lblSoftLeft) lblSoftLeft.textContent = 'MENU';
    if (lblSoftRight) lblSoftRight.textContent = 'SOUND ON';

    generateDecryptorBoard();
  }

  function generateDecryptorBoard() {
    decryptorGrid = [];
    const shapes = [0, 1, 2, 3, 4, 5, 6];
    const shapeWeights = [
      0.15, // 0: │
      0.15, // 1: ─
      0.15, // 2: └  
      0.15, // 3: ┌
      0.15, // 4: ┐
      0.15, // 5: ┘
      0.10  // 6: ┼
    ];

    for (let r = 0; r < 5; r++) {
      const rowArr = [];
      for (let c = 0; c < 5; c++) {
        let shape = 1;
        const rand = game.rnd.frac();
        let cumulative = 0;
        for (let s = 0; s < shapes.length; s++) {
          cumulative += shapeWeights[s];
          if (rand <= cumulative) {
            shape = shapes[s];
            break;
          }
        }

        const rot = game.rnd.integerInRange(0, 3);
        rowArr.push({
          shape: shape,
          rotation: rot,
          connected: false
        });
      }
      decryptorGrid.push(rowArr);
    }

    runCircuitTrace();
  }

  function getActivePorts(shape, rotation) {
    const base = baseShapePorts[shape] || [];
    return base.map(p => (p + rotation) % 4);
  }

  function runCircuitTrace() {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        decryptorGrid[r][c].connected = false;
      }
    }

    const visited = Array(5).fill(null).map(() => Array(5).fill(false));
    const queue = [];

    const startCell = decryptorGrid[2][0];
    const startPorts = getActivePorts(startCell.shape, startCell.rotation);
    if (startPorts.includes(3)) {
      visited[2][0] = true;
      queue.push([2, 0]);
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      decryptorGrid[r][c].connected = true;

      const activePorts = getActivePorts(decryptorGrid[r][c].shape, decryptorGrid[r][c].rotation);
      activePorts.forEach(dir => {
        let nr = r;
        let nc = c;
        let oppDir = 0;

        if (dir === 0) { nr = r - 1; oppDir = 2; }
        else if (dir === 1) { nc = c + 1; oppDir = 3; }
        else if (dir === 2) { nr = r + 1; oppDir = 0; }
        else if (dir === 3) { nc = c - 1; oppDir = 1; }

        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
          if (!visited[nr][nc]) {
            const neighbor = decryptorGrid[nr][nc];
            const neighborPorts = getActivePorts(neighbor.shape, neighbor.rotation);
            if (neighborPorts.includes(oppDir)) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }
      });
    }

    const endCell = decryptorGrid[2][4];
    const endPorts = getActivePorts(endCell.shape, endCell.rotation);
    if (visited[2][4] && endPorts.includes(1)) {
      handleGridDecrypted();
    }
  }

  function handleGridDecrypted() {
    decryptorScore += 10;
    decryptorLevel++;
    decryptorTimer = Math.min(75, decryptorTimer + 15);
    playSound('pickup');
    
    // Add glowing neon sparks around solver sink
    addNewSparks(StartXCoordinate(4) + 19, StartYCoordinate(2) + 19, '#00f0ff', 15);

    generateDecryptorBoard();
  }

  function StartXCoordinate(col) {
    return 25 + col * 38;
  }

  function StartYCoordinate(row) {
    return 70 + row * 38;
  }

  function updateDecryptor() {
    if (decryptorState !== 'PLAYING') return;

    const now = Date.now();
    if (now - lastDecryptTimeTick >= 1000) {
      lastDecryptTimeTick = now;
      decryptorTimer--;
      if (decryptorTimer <= 0) {
         decryptorTimer = 0;
         decryptorState = 'GAMEOVER';
         playSound('gameover');
         submitHighScore(decryptorScore);
      } else if (decryptorTimer <= 5) {
         playSound('damage');
      }
    }
  }

  function renderLauncher(ctx) {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, 240, 300);

    ctx.fillStyle = '#075e3e';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('KAIOS BOOT MATRIX SYSTEM v3...', 15, 20);
    ctx.fillText('DECRYPT CORE CONSOLE CHIP ON...', 15, 30);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 42, 220, 248);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 15px system-ui';
    ctx.fillText('SYSTEM CARTRIDGES', 120, 68);

    ctx.fillStyle = '#475569';
    ctx.font = '8px monospace';
    ctx.fillText('SELECT ACTIVE MODULE', 120, 82);

    // Bee Cart ridge Selector
    const activeChrono = launcherSelection === 0;
    ctx.fillStyle = activeChrono ? 'rgba(0, 240, 255, 0.12)' : '#070b13';
    ctx.fillRect(20, 105, 200, 52);
    ctx.strokeStyle = activeChrono ? '#00f0ff' : '#1e293b';
    ctx.lineWidth = activeChrono ? 1.5 : 1;
    ctx.strokeRect(20, 105, 200, 52);

    ctx.textAlign = 'left';
    ctx.fillStyle = activeChrono ? '#ffffff' : '#9ca3af';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('1.  🐝 CHRONO-BEE GRID', 30, 126);
    ctx.fillStyle = '#64748b';
    ctx.font = '8px monospace';
    ctx.fillText('Velocity Flapper. Action Matrix.', 30, 142);

    // Decryptor Cart selector
    const activeDecryptor = launcherSelection === 1;
    ctx.fillStyle = activeDecryptor ? 'rgba(16, 185, 129, 0.12)' : '#070b13';
    ctx.fillRect(20, 175, 200, 52);
    ctx.strokeStyle = activeDecryptor ? '#10b981' : '#1e293b';
    ctx.lineWidth = activeDecryptor ? 1.5 : 1;
    ctx.strokeRect(20, 175, 200, 52);

    ctx.textAlign = 'left';
    ctx.fillStyle = activeDecryptor ? '#ffffff' : '#9ca3af';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('2.  ⚡ GRID DECRYPTOR', 30, 196);
    ctx.fillStyle = '#64748b';
    ctx.font = '8px monospace';
    ctx.fillText('Logical Connect. Path Hack Puzzle.', 30, 212);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px sans-serif';
    ctx.fillText('USE ARROWS ▲/▼ TO HIGHLIGHT', 120, 248);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('PRESS CENTER OK TO UNLEASH', 120, 262);
  }

  function renderDecryptor(ctx) {
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 240, 300);

    // Top status design
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, 240, 52);
    ctx.strokeStyle = '#1a2333';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 52, 240, 1);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`👾 BYPASS SCORES: ${decryptorScore}`, 10, 18);

    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'right';
    ctx.fillText(`⚡ TIMER: ${decryptorTimer}s`, 230, 18);

    // Progress bar link
    ctx.fillStyle = '#311010';
    ctx.fillRect(10, 26, 220, 4);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(10, 26, Math.floor(220 * (decryptorTimer / 75)), 4);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${decryptorLevel} - LINK RECTIFY ENCRYPT`, 120, 44);

    // Draw Source and Sink anchors
    const sY = StartYCoordinate(2) + 19;
    
    // Draw Source IN node
    ctx.save();
    ctx.translate(14, sY);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SRC', 0, -8);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    // Draw Sink OUT node
    ctx.save();
    ctx.translate(226, sY);
    const sinkConnected = decryptorGrid[2] && decryptorGrid[2][4] && decryptorGrid[2][4].connected && getActivePorts(decryptorGrid[2][4].shape, decryptorGrid[2][4].rotation).includes(1);
    ctx.fillStyle = sinkConnected ? '#00f0ff' : '#ef4444';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SINK', 0, -8);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    const startX = 25;
    const startY = 70;
    const size = 38;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cx = startX + c * size + size / 2;
        const cy = startY + r * size + size / 2;

        const cell = decryptorGrid[r][c];
        if (!cell) continue;

        // Cell backing
        ctx.fillStyle = '#060a12';
        ctx.fillRect(cx - size/2 + 2, cy - size/2 + 2, size - 4, size - 4);
        ctx.strokeStyle = '#131c2e';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - size/2 + 2, cy - size/2 + 2, size - 4, size - 4);

        const activePorts = getActivePorts(cell.shape, cell.rotation);
        const rLen = size / 2;
        const col = cell.connected ? '#00f0ff' : '#475569';
        const glowCol = cell.connected ? 'rgba(0, 240, 255, 0.4)' : 'rgba(71, 85, 105, 0.1)';

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Background glowing tracer
        ctx.strokeStyle = glowCol;
        ctx.lineWidth = 6;
        ctx.beginPath();
        activePorts.forEach(port => {
          let px = cx;
          let py = cy;
          if (port === 0) py -= rLen;
          else if (port === 1) px += rLen;
          else if (port === 2) py += rLen;
          else if (port === 3) px -= rLen;
          
          ctx.moveTo(cx, cy);
          ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Core visual cable
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        activePorts.forEach(port => {
          let px = cx;
          let py = cy;
          if (port === 0) py -= rLen;
          else if (port === 1) px += rLen;
          else if (port === 2) py += rLen;
          else if (port === 3) px -= rLen;
          
          ctx.moveTo(cx, cy);
          ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Inner light core filaments
        ctx.strokeStyle = cell.connected ? '#ffffff' : '#64748b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        activePorts.forEach(port => {
          let px = cx;
          let py = cy;
          if (port === 0) py -= rLen;
          else if (port === 1) px += rLen;
          else if (port === 2) py += rLen;
          else if (port === 3) px -= rLen;
          
          ctx.moveTo(cx, cy);
          ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Center visual core node
        ctx.fillStyle = cell.connected ? '#ffffff' : '#475569';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI*2);
        ctx.fill();

        // Navigation highlighter reticle
        if (r === cursorRow && c === cursorCol) {
          const blink = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
          ctx.strokeStyle = `rgba(0, 240, 255, ${0.4 + blink * 0.6})`;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cx - size/2 + 1, cy - size/2 + 1, size - 2, size - 2);

          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(cx - size/2, cy - size/2, 5, 2);
          ctx.fillRect(cx - size/2, cy - size/2, 2, 5);

          ctx.fillRect(cx + size/2 - 5, cy - size/2, 5, 2);
          ctx.fillRect(cx + size/2 - 2, cy - size/2, 2, 5);

          ctx.fillRect(cx - size/2, cy + size/2 - 2, 5, 2);
          ctx.fillRect(cx - size/2, cy + size/2 - 5, 2, 5);

          ctx.fillRect(cx + size/2 - 5, cy + size/2 - 2, 5, 2);
          ctx.fillRect(cx + size/2 - 2, cy + size/2 - 5, 2, 5);
        }
      }
    }

    if (decryptorState === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(5, 7, 15, 0.94)';
      ctx.fillRect(0, 0, 240, 300);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('SECURITY OVERRUN!', 120, 85);
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px monospace';
      ctx.fillText('GRID BYPASS SWEEP TRIGGERED', 120, 105);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 36px system-ui';
      ctx.fillText(`${decryptorScore}`, 120, 160);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText('CORES RECTIFIED SECURELY', 120, 178);

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.fillText('PRESS [F1] OR TOUCH LEFT SOFTKEY', 120, 222);
      ctx.fillText('TO RETURN TO THE SYSTEM RETRO MENU', 120, 236);
    }
  }

  // Generate dynamic procedural lasers barriers
  function spawnLaserGate() {
    const gap = 72; // Passing gap size
    const minHeight = 35;
    const maxHeight = 300 - gap - minHeight;
    const topHeight = game.rnd.between(minHeight, maxHeight);
    const bottomHeight = 300 - gap - topHeight;

    const color = game.rnd.pick(['CYAN', 'MAGENTA']);

    lasers.push({
      x: 250,
      width: 14,
      topHeight: topHeight,
      bottomHeight: bottomHeight,
      color: color,
      passed: false,
      floatingRangeY: game.rnd.frac() > 0.6 ? 14 : 0, // Floating lasers dynamic movement frequency
      initialTopHeight: topHeight
    });
  }

  // Generate floating power capacitors
  function spawnQuantumCell() {
    const types = ['BATTERY', 'BOOSTER', 'INVERTER'];
    const selectedType = game.rnd.pick(types);
    pickups.push({
      x: 290,
      y: game.rnd.between(45, 235),
      type: selectedType,
      wiggle: 0
    });
  }

  // Neon custom Sparks vector generator
  function addNewSparks(x, y, col, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: game.rnd.realInRange(-2.5, 2.5),
        vy: game.rnd.realInRange(-2.5, 2.5),
        age: 1.0,
        decay: game.rnd.realInRange(0.02, 0.05),
        col: col,
        size: game.rnd.integerInRange(1, 3)
      });
    }
  }

  // Utility renderer for colors matching
  function getHex(col) {
    if (col === 'CYAN') return '#00f0ff';
    if (col === 'MAGENTA') return '#ff007f';
    return '#f59e0b'; // Gold
  }

  // Regenerate bee graphic texture
  function updateBeeTexture() {
    beeBmd.clear();
    const col = getHex(phaseColor);
    beeBmd.ctx.fillStyle = col;
    beeBmd.ctx.beginPath();
    beeBmd.ctx.arc(12, 12, 7, 0, Math.PI * 2);
    beeBmd.ctx.fill();
  }

  // State Resets
  function resetLogic() {
    score = 0;
    combo = 1;
    gameSpeed = 1.35;
    frameCount = 0;

    shieldLevel = 100;
    phaseColor = 'CYAN';
    isDoubleSpeedDashing = 0;
    dashCooldownTimer = 0;
    isInvincible = 0;
    isGravityInverted = false;
    gravityInvertedTimer = 0;

    lasers = [];
    pickups = [];
    particles = [];

    if (player) {
      player.x = 45;
      player.y = 120;
      if (player.body) {
        player.body.velocity.y = 0;
      }
    }

    if (lblSoftLeft) lblSoftLeft.textContent = 'MENU';
    if (syncStatus) {
      syncStatus.textContent = 'ONLINE';
      syncStatus.className = 'text-green glow-text';
    }
  }

  function launchGame() {
    if (!player) return;
    resetLogic();
    currentGameState = 'PLAYING';
    playSound('jump');
    sessionJumps++;
    if (statJumps) statJumps.textContent = sessionJumps;
    updateBeeTexture();
  }

  // --- KAI-PAD ACTION EVENTS & CONTROLLER MAPS ---

  function performFlap() {
    if (!player || !player.body) return;
    if (currentGameState === 'START' || currentGameState === 'GAMEOVER') {
      launchGame();
      return;
    }

    const currentFlapVelocity = isGravityInverted ? 140 : -140;
    player.body.velocity.y = currentFlapVelocity;
    playSound('jump');
    sessionJumps++;
    if (statJumps) statJumps.textContent = sessionJumps;

    // Spark clouds
    addNewSparks(player.x - 5, player.y, getHex(phaseColor), 3);
  }

  function performDive() {
    if (!player || !player.body) return;
    if (currentGameState !== 'PLAYING') return;
    const currentDiveVelocity = isGravityInverted ? -120 : 160;
    player.body.velocity.y = currentDiveVelocity;
    playSound('damage');
    addNewSparks(player.x, player.y - 4, '#ffffff', 2);
  }

  function performPhaseShift() {
    if (!player || !player.body) return;
    if (currentGameState !== 'PLAYING') return;
    phaseColor = phaseColor === 'CYAN' ? 'MAGENTA' : 'CYAN';
    playSound('phase');
    sessionPhases++;
    if (statPhases) statPhases.textContent = sessionPhases;

    // Pulse sparks
    addNewSparks(player.x, player.y, getHex(phaseColor), 10);
    updateBeeTexture();
  }

  function performDash() {
    if (!player || !player.body) return;
    if (currentGameState !== 'PLAYING') return;
    if (dashCooldownTimer > 0) return;

    isDoubleSpeedDashing = 13;
    dashCooldownTimer = 150;
    playSound('boost');

    // Trail fire
    addNewSparks(player.x, player.y, getHex(phaseColor), 15);
  }

  function handleMuteToggle() {
    isMuted = !isMuted;
    if (isMuted) {
      if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
      }
      if (muteStatusIcon) muteStatusIcon.textContent = '🔊 SOUND OFF';
      if (lblSoftRight) lblSoftRight.textContent = 'SOUND OFF';
    } else {
      initAudio();
      if (muteStatusIcon) muteStatusIcon.textContent = '🔊 100%';
      if (lblSoftRight) lblSoftRight.textContent = 'SOUND ON';
    }
  }

  function routeKeys(key) {
    if (appMode === 'LAUNCHER') {
      switch (key) {
        case 'ArrowUp':
        case '2':
          launcherSelection = 0;
          playSound('jump');
          break;
        case 'ArrowDown':
        case '8':
          launcherSelection = 1;
          playSound('jump');
          break;
        case '1':
          launcherSelection = 0;
          launchSelectedCart();
          break;
        case '2':
          launcherSelection = 1;
          launchSelectedCart();
          break;
        case 'Enter':
        case '5':
        case ' ':
        case 'SoftLeft':
          launchSelectedCart();
          break;
        case 'SoftRight':
          handleMuteToggle();
          break;
        default:
          break;
      }
      return;
    }

    if (appMode === 'DECRYPTOR') {
      if (decryptorState === 'GAMEOVER') {
        if (key === 'SoftLeft' || key === 'Enter' || key === '5' || key === ' ') {
          appMode = 'LAUNCHER';
          if (lblSoftLeft) lblSoftLeft.textContent = 'LAUNCH';
          playSound('phase');
        } else if (key === 'SoftRight') {
          handleMuteToggle();
        }
        return;
      }

      switch (key) {
        case 'ArrowUp':
        case '2':
          if (cursorRow > 0) {
            cursorRow--;
            playSound('jump');
          }
          break;
        case 'ArrowDown':
        case '8':
          if (cursorRow < 4) {
            cursorRow++;
            playSound('jump');
          }
          break;
        case 'ArrowLeft':
        case '4':
          if (cursorCol > 0) {
            cursorCol--;
            playSound('jump');
          }
          break;
        case 'ArrowRight':
        case '6':
          if (cursorCol < 4) {
            cursorCol++;
            playSound('jump');
          }
          break;
        case 'Enter':
        case '5':
        case ' ':
          if (decryptorGrid[cursorRow] && decryptorGrid[cursorRow][cursorCol]) {
            const cell = decryptorGrid[cursorRow][cursorCol];
            cell.rotation = (cell.rotation + 1) % 4;
            playSound('phase');
            addNewSparks(
              StartXCoordinate(cursorCol) + 19,
              StartYCoordinate(cursorRow) + 19,
              cell.connected ? '#00f0ff' : '#64748b',
              5
            );
            runCircuitTrace();
          }
          break;
        case 'SoftLeft':
          appMode = 'LAUNCHER';
          if (lblSoftLeft) lblSoftLeft.textContent = 'LAUNCH';
          playSound('phase');
          break;
        case 'SoftRight':
          handleMuteToggle();
          break;
        default:
          break;
      }
      return;
    }

    // --- CHRONOBEE MODE ROUTING ---
    if (appMode === 'CHRONOBEE') {
      switch (key) {
        case 'Enter':
        case 'Space':
        case ' ':
        case '5':
        case '2':
        case 'ArrowUp':
          performFlap();
          break;
        case 'ArrowDown':
        case '8':
          performDive();
          break;
        case 'ArrowLeft':
        case '4':
          performPhaseShift();
          break;
        case 'ArrowRight':
        case '6':
          performDash();
          break;
        case 'SoftLeft':
          appMode = 'LAUNCHER';
          if (lblSoftLeft) lblSoftLeft.textContent = 'LAUNCH';
          if (player) player.visible = false;
          playSound('phase');
          break;
        case 'SoftRight':
          handleMuteToggle();
          break;
        default:
          playSound('damage');
          break;
      }
    }
  }

  // Key Event listener
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
      e.preventDefault();
    }

    let mapped = e.key;
    if (e.key === 'F1' || e.key === 'Control') {
      mapped = 'SoftLeft';
      e.preventDefault();
    } else if (e.key === 'F2' || e.key === 'Alt') {
      mapped = 'SoftRight';
      e.preventDefault();
    }

    let btnNode = null;
    if (mapped === 'ArrowUp') btnNode = document.getElementById('btnDpadUp');
    else if (mapped === 'ArrowDown') btnNode = document.getElementById('btnDpadDown');
    else if (mapped === 'ArrowLeft') btnNode = document.getElementById('btnDpadLeft');
    else if (mapped === 'ArrowRight') btnNode = document.getElementById('btnDpadRight');
    else if (mapped === 'Enter' || mapped === ' ') btnNode = document.getElementById('btnDpadCenter');
    else {
      btnNode = document.querySelector(`.key-action[data-key="${mapped}"]`);
    }

    if (btnNode) {
      btnNode.classList.add('active-press');
      setTimeout(() => btnNode.classList.remove('active-press'), 120);
    }

    routeKeys(mapped);
  });

  // Physical mouse controller setups
  keypadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-key');
      routeKeys(target);
    });
  });
});
