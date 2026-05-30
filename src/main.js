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
  let appMode = 'LAUNCHER'; // 'LAUNCHER' | 'CHRONOBEE' | 'DECRYPTOR' | 'INTERCEPTOR' | 'CLIMBER'
  let launcherSelection = 0; // 0 = ChronoBee, 1 = Grid Decryptor, 2 = Neon Interceptor, 3 = Doodle Climber

  // --- DOODLE CLIMBER (NEON CLIMBER PLATFORMER) ---
  let climberScore = 0;
  let climberHighScore = 0;
  let climberX = 120;
  let climberY = 150;
  let climberVx = 0;
  let climberVy = 0;
  let climberState = 'START'; // 'PLAYING' | 'GAMEOVER'
  let climberPlatforms = [];
  let climberMonsters = [];
  let climberBullets = [];
  let climberParticles = [];
  let climberJetpackTimer = 0; // if > 0, player has fly rocket boost!
  let climberLastShootTime = 0;

  // --- GRID DECRYPTOR (LOGICAL PUZZLE SYSTEM) ---
  let decryptorGrid = [];
  let cursorRow = 2;
  let cursorCol = 2;
  let decryptorTimer = 45;
  let decryptorScore = 0;
  let decryptorLevel = 1;
  let decryptorState = 'START'; // 'PLAYING' | 'GAMEOVER'
  let lastDecryptTimeTick = 0;

  // --- NEON INTERCEPTOR (RETRO ACTION SHOOTER) ---
  let interceptorShipX = 120;
  let interceptorShipY = 240;
  let interceptorLevel = 1;
  let interceptorScore = 0;
  let interceptorShield = 100;
  let interceptorBullets = [];
  let interceptorEnemies = [];
  let interceptorExplosions = [];
  let interceptorShootCooldown = 0;
  let interceptorState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
  let interceptorEnemiesDefeated = 0;
  let interceptorLastSpawnTime = 0;

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

    if (appMode === 'INTERCEPTOR') {
      if (player && player.body) {
        player.body.velocity.y = 0;
        player.body.gravity.y = 0;
        player.visible = false;
      }
      updateInterceptor();
      return;
    }

    if (appMode === 'CLIMBER') {
      if (player && player.body) {
        player.body.velocity.y = 0;
        player.body.gravity.y = 0;
        player.visible = false;
      }
      updateClimber();
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

    if (appMode === 'INTERCEPTOR') {
      renderInterceptor(ctx);
      return;
    }

    if (appMode === 'CLIMBER') {
      renderClimber(ctx);
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
    } else if (launcherSelection === 1) {
      initDecryptorGame();
    } else if (launcherSelection === 2) {
      initInterceptorGame();
    } else if (launcherSelection === 3) {
      initClimberGame();
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

  // --- NEON INTERCEPTOR CUSTOM SHOOTER ENGINE ---

  function initInterceptorGame() {
    appMode = 'INTERCEPTOR';
    interceptorState = 'PLAYING';
    interceptorScore = 0;
    interceptorShield = 100;
    interceptorLevel = 1;
    interceptorEnemiesDefeated = 0;
    interceptorLastSpawnTime = Date.now();
    interceptorShipX = 120;
    interceptorShipY = 240;
    interceptorBullets = [];
    interceptorEnemies = [];
    interceptorExplosions = [];
    interceptorShootCooldown = 0;
    
    if (lblSoftLeft) lblSoftLeft.textContent = 'MENU';
    if (lblSoftRight) lblSoftRight.textContent = 'SOUND ON';
  }

  function updateInterceptor() {
    if (interceptorState !== 'PLAYING') return;

    if (interceptorShootCooldown > 0) {
      interceptorShootCooldown--;
    }

    // Spawn kinetic enemies
    const now = Date.now();
    const spawnInterval = Math.max(350, 1500 - (interceptorLevel * 140));
    if (now - interceptorLastSpawnTime >= spawnInterval) {
      interceptorLastSpawnTime = now;
      
      const typeRand = game.rnd.frac();
      let type = 'DRIFTER'; // Cyan
      let color = 'CYAN';
      let hp = 1;
      let speed = game.rnd.realInRange(0.9, 1.5) + (interceptorLevel * 0.12);
      
      if (typeRand > 0.70) {
        type = 'SWARMER'; // Magenta
        color = 'MAGENTA';
        hp = 1;
        speed = game.rnd.realInRange(1.6, 2.4) + (interceptorLevel * 0.15);
      } else if (typeRand > 0.40) {
        type = 'TANK'; // Yellow
        color = 'YELLOW';
        hp = 2;
        speed = game.rnd.realInRange(0.5, 0.9) + (interceptorLevel * 0.08);
      }
      
      interceptorEnemies.push({
        x: game.rnd.between(20, 220),
        y: -10,
        type: type,
        color: color,
        hp: hp,
        maxHp: hp,
        speed: speed,
        pulseOffset: game.rnd.frac() * 20,
        width: 14,
        height: 14
      });
    }

    // Process bullet positions
    for (let i = interceptorBullets.length - 1; i >= 0; i--) {
      const b = interceptorBullets[i];
      b.y -= 6;
      if (b.y < -12) {
        interceptorBullets.splice(i, 1);
      }
    }

    // Process enemy behaviors and collisions
    for (let i = interceptorEnemies.length - 1; i >= 0; i--) {
      const e = interceptorEnemies[i];
      
      if (e.type === 'SWARMER') {
        e.y += e.speed;
        e.x += Math.sin((frameCount + e.pulseOffset) * 0.08) * 2;
        e.x = Math.max(15, Math.min(225, e.x));
      } else {
        e.y += e.speed;
      }

      // Check bullet collision
      for (let j = interceptorBullets.length - 1; j >= 0; j--) {
        const b = interceptorBullets[j];
        const distBullet = Math.hypot(e.x - b.x, e.y - b.y);
        if (distBullet < 12) {
          e.hp--;
          createInterceptorSparks(b.x, b.y, e.color, 6);
          interceptorBullets.splice(j, 1);
          playSound('phase');
          
          if (e.hp <= 0) {
            createInterceptorSparks(e.x, e.y, e.color, 18);
            interceptorEnemies.splice(i, 1);
            interceptorScore += e.type === 'TANK' ? 30 : 15;
            interceptorEnemiesDefeated++;
            playSound('pickup');
            
            if (interceptorEnemiesDefeated % 10 === 0) {
              interceptorLevel++;
              playSound('boost');
              createInterceptorSparks(120, 150, 'GREEN', 35);
            }
            break;
          }
        }
      }

      // Screen exit penalty
      if (e.y > 310) {
        interceptorShield = Math.max(0, interceptorShield - 15);
        interceptorEnemies.splice(i, 1);
        playSound('damage');
        if (interceptorShield <= 0) {
          handleInterceptorGameOver();
        }
        continue;
      }

      // Direct collision check
      const distShip = Math.hypot(e.x - interceptorShipX, e.y - interceptorShipY);
      if (distShip < 18) {
        interceptorShield = Math.max(0, interceptorShield - 25);
        createInterceptorSparks(e.x, e.y, e.color, 20);
        interceptorEnemies.splice(i, 1);
        playSound('damage');
        if (interceptorShield <= 0) {
          handleInterceptorGameOver();
        }
      }
    }

    // Process custom particles updates
    for (let i = interceptorExplosions.length - 1; i >= 0; i--) {
      const p = interceptorExplosions[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        interceptorExplosions.splice(i, 1);
      }
    }
  }

  function handleInterceptorGameOver() {
    interceptorState = 'GAMEOVER';
    playSound('gameover');
    submitHighScore(interceptorScore);
  }

  function createInterceptorSparks(x, y, colorStr, count) {
    const cols = {
      'CYAN': '#00f0ff',
      'MAGENTA': '#f43f5e',
      'YELLOW': '#eab308',
      'GREEN': '#22c55e',
      'WHITE': '#ffffff'
    };
    const colHex = cols[colorStr] || '#00f0ff';
    for (let i = 0; i < count; i++) {
      const angle = game.rnd.realInRange(0, Math.PI * 2);
      const speed = game.rnd.realInRange(1, 4.5);
      interceptorExplosions.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colHex,
        life: game.rnd.integerInRange(15, 30)
      });
    }
  }

  function fireInterceptorBullet() {
    if (interceptorShootCooldown > 0 || interceptorState !== 'PLAYING') return;
    interceptorShootCooldown = 10; // Rate of fire
    
    interceptorBullets.push({ x: interceptorShipX - 5, y: interceptorShipY - 8 });
    interceptorBullets.push({ x: interceptorShipX + 5, y: interceptorShipY - 8 });
    
    playSound('jump');
    createInterceptorSparks(interceptorShipX, interceptorShipY - 10, 'WHITE', 2);
  }

  function renderInterceptor(ctx) {
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, 240, 300);

    // Top status HUD
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, 240, 38);
    ctx.strokeStyle = '#1a2333';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 38, 240, 1);

    // Score and Level details
    ctx.textAlign = 'left';
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`SCORE: ${interceptorScore}`, 8, 16);
    ctx.fillText(`LVL: ${interceptorLevel}`, 8, 28);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`SHIELD: ${interceptorShield}%`, 232, 16);

    // Backing health meter track
    ctx.fillStyle = '#311010';
    ctx.fillRect(110, 21, 120, 5);
    ctx.fillStyle = interceptorShield > 35 ? '#00f0ff' : '#f43f5e';
    ctx.fillRect(110, 21, Math.floor(120 * (interceptorShield / 100)), 5);

    // Draw horizontal grid horizon in parallax
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 40; y < 300; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(240, y);
      ctx.stroke();
    }
    for (let x = 0; x <= 240; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, 300);
      ctx.stroke();
    }

    // Draw custom bursts
    interceptorExplosions.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    });

    // Draw bullets
    interceptorBullets.forEach(b => {
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 0.5, b.y - 3, 1, 6);
    });

    // Draw enemies with stylish wireframe features
    interceptorEnemies.forEach(e => {
      const col = e.color === 'CYAN' ? '#00f0ff' : (e.color === 'MAGENTA' ? '#f43f5e' : '#eab308');
      
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = e.hp > 1 ? '#ffffff' : col;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
      ctx.fill();

      if (e.type === 'TANK') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(e.x - 8, e.y - 8, 16, 16);
      } else if (e.type === 'SWARMER') {
        ctx.beginPath();
        ctx.moveTo(e.x - 9, e.y);
        ctx.lineTo(e.x + 9, e.y);
        ctx.moveTo(e.x, e.y - 4);
        ctx.lineTo(e.x, e.y + 4);
        ctx.stroke();
      }
    });

    // Draw Player Ship (vector futuristic jet delta pattern)
    if (interceptorState === 'PLAYING') {
      const sx = interceptorShipX;
      const sy = interceptorShipY;

      ctx.fillStyle = frameCount % 2 === 0 ? '#f97316' : '#eab308';
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy + 8);
      ctx.lineTo(sx, sy + 13 + (game.rnd.frac() * 3));
      ctx.lineTo(sx + 4, sy + 8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 9);
      ctx.lineTo(sx - 8, sy + 8);
      ctx.lineTo(sx + 8, sy + 8);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx - 4, sy + 5);
      ctx.lineTo(sx + 4, sy + 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(sx - 8, sy + 2, 2, 4);
      ctx.fillRect(sx + 6, sy + 2, 2, 4);
    }

    if (interceptorState === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(5, 7, 15, 0.95)';
      ctx.fillRect(0, 0, 240, 300);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('SHIELD CORE CRITICAL', 120, 85);
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px monospace';
      ctx.fillText('NEON INTERCEPTOR BREACHED', 120, 105);

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 36px system-ui';
      ctx.fillText(`${interceptorScore}`, 120, 160);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText('ROGUE PLASMA DEFEATED SECURELY', 120, 178);

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.fillText('PRESS CENTER OR OK TO TRY AGAIN', 120, 222);
      ctx.fillText('PRESS [F1] / MENU TO EXIT TO MENU', 120, 236);
    }
  }

  // --- DOODLE CLIMBER CUSTOM ARCADE PLATFORMER ---

  function initClimberGame() {
    appMode = 'CLIMBER';
    climberState = 'PLAYING';
    climberScore = 0;
    climberX = 120;
    climberY = 180;
    climberVx = 0;
    climberVy = -6.5; // Starts with an elegant initial bounce
    climberPlatforms = [];
    climberMonsters = [];
    climberBullets = [];
    climberParticles = [];
    climberJetpackTimer = 0;
    climberLastShootTime = 0;

    // Direct solid starting landing platform underneath the player
    climberPlatforms.push({
      x: 120,
      y: 220,
      type: 'NORMAL',
      width: 44,
      height: 5,
      broken: false,
      vx: 0,
      hasSpring: false,
      hasJetpack: false,
      springUsed: false,
      jetpackUsed: false
    });

    // Generate upward ladders
    let nextY = 180;
    for (let i = 0; i < 7; i++) {
      nextY -= game.rnd.between(35, 52);
      generateClimberPlatform(nextY);
    }

    if (lblSoftLeft) lblSoftLeft.textContent = 'MENU';
    if (lblSoftRight) lblSoftRight.textContent = 'SOUND ON';
  }

  function generateClimberPlatform(targetY) {
    const rx = game.rnd.between(30, 210);
    const randType = game.rnd.frac();
    let type = 'NORMAL';
    let vx = 0;

    if (climberScore > 1800 && randType > 0.8) {
      type = 'MOVING';
      vx = (game.rnd.frac() > 0.5 ? 1 : -1) * (0.8 + game.rnd.frac() * 0.8);
    } else if (climberScore > 700 && randType > 0.55 && randType <= 0.8) {
      type = 'SHATTER';
    } else if (randType > 0.88) {
      type = 'BOOST';
    }

    let hasSpring = false;
    let hasJetpack = false;
    if (type === 'BOOST') {
      if (game.rnd.frac() > 0.75 && climberScore > 1200) {
        hasJetpack = true;
      } else {
        hasSpring = true;
      }
    }

    climberPlatforms.push({
      x: rx,
      y: targetY,
      type: type,
      width: 32,
      height: 5,
      broken: false,
      vx: vx,
      hasSpring: hasSpring,
      hasJetpack: hasJetpack,
      springUsed: false,
      jetpackUsed: false
    });
  }

  function spawnClimberMonster(targetY) {
    if (climberScore < 600) return;
    if (game.rnd.frac() > 0.3) return; // 30% chance of spawning custom monster bugs

    const rx = game.rnd.between(40, 200);
    climberMonsters.push({
      x: rx,
      y: targetY,
      vx: (game.rnd.frac() > 0.5 ? 1 : -1) * (0.5 + game.rnd.frac() * 0.5),
      width: 14,
      height: 14,
      color: game.rnd.frac() > 0.5 ? '#f43f5e' : '#f97316'
    });
  }

  function createClimberSparks(x, y, colorStr, count) {
    for (let i = 0; i < count; i++) {
      const angle = game.rnd.realInRange(0, Math.PI * 2);
      const speed = game.rnd.realInRange(0.6, 3.2);
      climberParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colorStr,
        life: game.rnd.integerInRange(10, 24)
      });
    }
  }

  function fireClimberLaser() {
    if (climberState !== 'PLAYING') return;
    const now = Date.now();
    if (now - climberLastShootTime < 240) return; // limit bullet spamming rate
    climberLastShootTime = now;

    climberBullets.push({ x: climberX, y: climberY - 10 });
    playSound('phase');
    createClimberSparks(climberX, climberY - 12, '#ec4899', 3);
  }

  function updateClimber() {
    if (climberState !== 'PLAYING') return;

    if (climberJetpackTimer > 0) {
      climberJetpackTimer--;
      climberVy = -7.5;
      if (frameCount % 2 === 0) {
        // Rocket fuel particles
        createClimberSparks(climberX - 4, climberY + 12, '#f97316', 2);
        createClimberSparks(climberX + 4, climberY + 12, '#ea580c', 2);
        createClimberSparks(climberX, climberY + 14, '#eab308', 2);
      }
    } else {
      climberVy += 0.16; // Neon platformer low gravity
      if (climberVy > 7.5) climberVy = 7.5;
    }

    climberX += climberVx;
    climberVx *= 0.88; // drift damping friction

    // Screen border wrap-around standard logic
    if (climberX < -4) climberX = 244;
    if (climberX > 244) climberX = -4;

    climberY += climberVy;

    // Platform updates
    for (let i = 0; i < climberPlatforms.length; i++) {
      const p = climberPlatforms[i];
      if (p.type === 'MOVING' && !p.broken) {
        p.x += p.vx;
        if (p.x < 24 || p.x > 216) p.vx = -p.vx;
      }

      // Handle bouncy landing collisions (strictly when falling downwards)
      if (climberVy > 0 && climberJetpackTimer <= 0) {
        const platformLanded = (
          climberX > p.x - p.width / 2 - 8 &&
          climberX < p.x + p.width / 2 + 8 &&
          climberY + 12 >= p.y - 3 &&
          climberY + 12 <= p.y + 6
        );

        if (platformLanded && !p.broken) {
          if (p.type === 'SHATTER') {
            p.broken = true;
            playSound('damage');
            createClimberSparks(p.x, p.y, '#ec4899', 8);
          } else {
            // Check booster items on platform
            if (p.hasSpring && !p.springUsed) {
              p.springUsed = true;
              climberVy = -11.5;
              playSound('boost');
              createClimberSparks(p.x, p.y - 4, '#eab308', 12);
            } else if (p.hasJetpack && !p.jetpackUsed) {
              p.jetpackUsed = true;
              climberJetpackTimer = 160; // 160 frame cycle
              climberVy = -8;
              playSound('boost');
              createClimberSparks(p.x, p.y - 4, '#3b82f6', 22);
            } else {
              // Standard secure platform bounce
              climberVy = -6.2;
              playSound('jump');
              createClimberSparks(climberX, climberY + 12, '#22c55e', 4);
            }
          }
        }
      }
    }

    // Scrolling camera mechanism as the player leaps upwards past middle screen
    if (climberY < 130) {
      const scrollDiff = 130 - climberY;
      climberY = 130;
      climberScore += Math.floor(scrollDiff);

      // Push all systems downwards
      climberPlatforms.forEach(p => { p.y += scrollDiff; });
      climberMonsters.forEach(m => { m.y += scrollDiff; });
      climberBullets.forEach(b => { b.y += scrollDiff; });
      climberParticles.forEach(pt => { pt.y += scrollDiff; });
    }

    // Procedural replenishment & cleanup of platforms
    const survivingPlatforms = climberPlatforms.filter(p => p.y < 312);
    const lostCount = 8 - survivingPlatforms.length;
    climberPlatforms = survivingPlatforms;

    let topmostY = 300;
    climberPlatforms.forEach(p => {
      if (p.y < topmostY) topmostY = p.y;
    });

    for (let j = 0; j < lostCount; j++) {
      topmostY -= game.rnd.between(35, 52);
      generateClimberPlatform(topmostY);
      spawnClimberMonster(topmostY - 14);
    }

    // Monsters horizontal patrol update
    for (let k = climberMonsters.length - 1; k >= 0; k--) {
      const m = climberMonsters[k];
      m.x += m.vx;
      if (m.x < 15 || m.x > 225) m.vx = -m.vx;

      // Drop off bottom border
      if (m.y > 312) {
        climberMonsters.splice(k, 1);
        continue;
      }

      // Check collision with the bouncing player
      const deltaDist = Math.hypot(climberX - m.x, climberY - m.y);
      if (deltaDist < 16) {
        if (climberJetpackTimer > 0) {
          // Destined power jet destruction of hazard bugs!
          climberMonsters.splice(k, 1);
          playSound('pickup');
          createClimberSparks(m.x, m.y, '#f43f5e', 14);
        } else {
          // Lethal contact with hazard bug when not flying
          handleClimberGameOver();
          return;
        }
      }
    }

    // Bullets motion & collision with monsters
    for (let n = climberBullets.length - 1; n >= 0; n--) {
      const b = climberBullets[n];
      b.y -= 7.5;
      if (b.y < -10) {
        climberBullets.splice(n, 1);
        continue;
      }

      for (let mIdx = climberMonsters.length - 1; mIdx >= 0; mIdx--) {
        const mon = climberMonsters[mIdx];
        if (Math.hypot(b.x - mon.x, b.y - mon.y) < 14) {
          // Core hit! Destroy core bug
          climberMonsters.splice(mIdx, 1);
          climberBullets.splice(n, 1);
          climberScore += 100;
          playSound('pickup');
          createClimberSparks(mon.x, mon.y, '#f43f5e', 16);
          break;
        }
      }
    }

    // Update debris particles
    for (let xIdx = climberParticles.length - 1; xIdx >= 0; xIdx--) {
      const pt = climberParticles[xIdx];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      if (pt.life <= 0) {
        climberParticles.splice(xIdx, 1);
      }
    }

    // Defeat boundary
    if (climberY > 310) {
      handleClimberGameOver();
    }
  }

  function handleClimberGameOver() {
    climberState = 'GAMEOVER';
    playSound('gameover');
    if (climberScore > climberHighScore) {
      climberHighScore = climberScore;
    }
    submitHighScore(climberScore);
  }

  function renderClimber(ctx) {
    // Fill starry black cosmos horizon
    ctx.fillStyle = '#080710';
    ctx.fillRect(0, 0, 240, 300);

    // Decorative static binary vertical lines
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.04)';
    ctx.lineWidth = 1;
    for (let xl = 15; xl <= 225; xl += 20) {
      ctx.beginPath();
      ctx.moveTo(xl, 0);
      ctx.lineTo(xl, 300);
      ctx.stroke();
    }

    // Draw platforms
    climberPlatforms.forEach(p => {
      if (p.broken) return;

      const halfW = p.width / 2;
      let gradFill = ctx.createLinearGradient(p.x - halfW, p.y, p.x + halfW, p.y);

      // Color coding themes
      if (p.type === 'SHATTER') {
        gradFill.addColorStop(0, '#db2777');
        gradFill.addColorStop(1, '#f472b6');
      } else if (p.type === 'MOVING') {
        gradFill.addColorStop(0, '#0284c7');
        gradFill.addColorStop(1, '#38bdf8');
      } else if (p.type === 'BOOST') {
        gradFill.addColorStop(0, '#7c3aed');
        gradFill.addColorStop(1, '#a78bfa');
      } else {
        gradFill.addColorStop(0, '#16a34a');
        gradFill.addColorStop(1, '#4ade80');
      }

      // Rounded rect shape for high-quality capsule look
      ctx.fillStyle = gradFill;
      ctx.beginPath();
      ctx.roundRect(p.x - halfW, p.y - 2, p.width, 4, 2);
      ctx.fill();

      // Top edge high-contrast gloss line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - halfW + 1, p.y - 1.5);
      ctx.lineTo(p.x + halfW - 1, p.y - 1.5);
      ctx.stroke();

      // Submersion items indicators
      if (p.hasSpring && !p.springUsed) {
        // Yellow coiled spring drawing
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - 3, p.y - 6, 6, 4);
        ctx.fillRect(p.x - 3, p.y - 3, 6, 1);
      } else if (p.hasSpring && p.springUsed) {
        // Extended spring
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(p.x - 3, p.y - 9, 6, 7);
      }

      if (p.hasJetpack && !p.jetpackUsed) {
        // Flame color miniature booster tank
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(p.x - 4, p.y - 11, 8, 9);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(p.x - 2, p.y - 8, 4, 3);
      }
    });

    // Draw active custom particles
    climberParticles.forEach(pt => {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    });

    // Draw neon monster hazard bugs
    climberMonsters.forEach(m => {
      ctx.fillStyle = m.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Threat antennae draw
      ctx.strokeStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(m.x - 4, m.y - 5);
      ctx.lineTo(m.x - 7, m.y - 10);
      ctx.moveTo(m.x + 4, m.y - 5);
      ctx.lineTo(m.x + 7, m.y - 10);
      ctx.stroke();

      // Cyber angry red visor eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(m.x - 3, m.y - 2, 6, 1.5);
    });

    // Draw user lasers
    climberBullets.forEach(b => {
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(b.x - 1, b.y - 6, 2, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 0.5, b.y - 4, 1, 6);
    });

    // Draw the main player (Doodle Space Ranger Capsule)
    if (climberState === 'PLAYING') {
      const cx = climberX;
      const cy = climberY;

      // Draw jet plume or wings if using jetpack
      if (climberJetpackTimer > 0) {
        ctx.fillStyle = '#06b6d4';
        // Left thruster tank
        ctx.fillRect(cx - 10, cy - 1, 4, 10);
        // Right thruster tank
        ctx.fillRect(cx + 6, cy - 1, 4, 10);

        // Flame blasts
        ctx.fillStyle = frameCount % 2 === 0 ? '#f97316' : '#eab308';
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 9);
        ctx.lineTo(cx - 8, cy + 16 + game.rnd.frac() * 4);
        ctx.lineTo(cx - 6, cy + 9);
        ctx.moveTo(cx + 6, cy + 9);
        ctx.lineTo(cx + 8, cy + 16 + game.rnd.frac() * 4);
        ctx.lineTo(cx + 10, cy + 9);
        ctx.fill();
      }

      // Main head capsule body
      ctx.fillStyle = '#db2777';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      // Draw a neat arcade round-dome vector helmet
      ctx.arc(cx, cy, 7, Math.PI, 0, false);
      ctx.lineTo(cx + 7, cy + 8);
      ctx.lineTo(cx - 7, cy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cyber cyan visor screen (looking in velocity directions!)
      ctx.fillStyle = '#00f0ff';
      const lookOffset = climberVx > 1 ? 2 : (climberVx < -1 ? -2 : 0);
      ctx.beginPath();
      ctx.roundRect(cx - 4 + lookOffset, cy - 3, 8, 4, 1.5);
      ctx.fill();

      // Miniature cute legs
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 8);
      ctx.lineTo(cx - 4, cy + 11);
      ctx.moveTo(cx + 4, cy + 8);
      ctx.lineTo(cx + 4, cy + 11);
      ctx.stroke();
    }

    // Dashboard HUD overhead
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, 240, 28);
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 28, 240, 1);

    ctx.textAlign = 'left';
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#db2777';
    ctx.fillText(`ALTITUDE: ${climberScore}`, 8, 16);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`BEST: ${climberHighScore}`, 232, 16);

    // Jetpack remaining percentage display
    if (climberJetpackTimer > 0) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.fillRect(56, 18, 128, 4);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(56, 18, Math.floor(128 * (climberJetpackTimer / 160)), 4);
    }

    // GAME OVER Screen
    if (climberState === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(5, 4, 10, 0.96)';
      ctx.fillRect(0, 0, 240, 300);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('SYSTEM DESCENT DETECTED', 120, 85);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '8px monospace';
      ctx.fillText('DOODLE CLIMBER TERMINATION', 120, 101);

      ctx.fillStyle = '#ec4899';
      ctx.font = 'bold 36px system-ui';
      ctx.fillText(`${climberScore}`, 120, 155);
      ctx.font = '8px monospace';
      ctx.fillStyle = '#52525b';
      ctx.fillText('CHIP ALTITUDE RECORD SAVED SECURELY', 120, 172);

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.fillText('PRESS CENTER OR OK KEY TO RE-FLIGHT', 120, 222);
      ctx.fillText('PRESS [F1] / MENU TO EXIT TO MENU', 120, 236);
    }
  }

  function renderLauncher(ctx) {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, 240, 300);

    ctx.fillStyle = '#075e3e';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('KAIOS BOOT MATRIX SYSTEM v3...', 15, 18);
    ctx.fillText('DECRYPT CORE CONSOLE CHIP ON...', 15, 27);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 36, 220, 254);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 13px system-ui';
    ctx.fillText('SYSTEM CARTRIDGES', 120, 52);

    ctx.fillStyle = '#475569';
    ctx.font = '7px monospace';
    ctx.fillText('SELECT ACTIVE CARTRIDGE', 120, 62);

    // Cartridge 1: Chrono-Bee Selector
    const activeChrono = launcherSelection === 0;
    ctx.fillStyle = activeChrono ? 'rgba(0, 240, 255, 0.12)' : '#070b13';
    ctx.fillRect(18, 70, 204, 34);
    ctx.strokeStyle = activeChrono ? '#00f0ff' : '#1e293b';
    ctx.lineWidth = activeChrono ? 1.5 : 1;
    ctx.strokeRect(18, 70, 204, 34);

    ctx.textAlign = 'left';
    ctx.fillStyle = activeChrono ? '#ffffff' : '#9ca3af';
    ctx.font = 'bold 9px system-ui';
    ctx.fillText('1.  🐝 CHRONO-BEE GRID', 26, 84);
    ctx.fillStyle = '#526175';
    ctx.font = '7px monospace';
    ctx.fillText('Action Flapper. Phase Shift Laser matrix.', 26, 95);

    // Cartridge 2: Decryptor Cart selector
    const activeDecryptor = launcherSelection === 1;
    ctx.fillStyle = activeDecryptor ? 'rgba(16, 185, 129, 0.12)' : '#070b13';
    ctx.fillRect(18, 110, 204, 34);
    ctx.strokeStyle = activeDecryptor ? '#10b981' : '#1e293b';
    ctx.lineWidth = activeDecryptor ? 1.5 : 1;
    ctx.strokeRect(18, 110, 204, 34);

    ctx.textAlign = 'left';
    ctx.fillStyle = activeDecryptor ? '#ffffff' : '#9ca3af';
    ctx.font = 'bold 9px system-ui';
    ctx.fillText('2.  ⚡ GRID DECRYPTOR', 26, 124);
    ctx.fillStyle = '#526175';
    ctx.font = '7px monospace';
    ctx.fillText('Logical wire rotate connection puzzle.', 26, 135);

    // Cartridge 3: Neon Interceptor selector
    const activeInterceptor = launcherSelection === 2;
    ctx.fillStyle = activeInterceptor ? 'rgba(139, 92, 246, 0.12)' : '#070b13';
    ctx.fillRect(18, 150, 204, 34);
    ctx.strokeStyle = activeInterceptor ? '#8b5cf6' : '#1e293b';
    ctx.lineWidth = activeInterceptor ? 1.5 : 1;
    ctx.strokeRect(18, 150, 204, 34);

    ctx.textAlign = 'left';
    ctx.fillStyle = activeInterceptor ? '#ffffff' : '#9ca3af';
    ctx.font = 'bold 9px system-ui';
    ctx.fillText('3.  🚀 NEON INTERCEPTOR', 26, 164);
    ctx.fillStyle = '#526175';
    ctx.font = '7px monospace';
    ctx.fillText('Futuristic vertical shooter space action.', 26, 175);

    // Cartridge 4: Doodle Climber selector
    const activeClimber = launcherSelection === 3;
    ctx.fillStyle = activeClimber ? 'rgba(236, 72, 153, 0.12)' : '#070b13';
    ctx.fillRect(18, 190, 204, 34);
    ctx.strokeStyle = activeClimber ? '#ec4899' : '#1e293b';
    ctx.lineWidth = activeClimber ? 1.5 : 1;
    ctx.strokeRect(18, 190, 204, 34);

    ctx.textAlign = 'left';
    ctx.fillStyle = activeClimber ? '#ffffff' : '#9ca3af';
    ctx.font = 'bold 9px system-ui';
    ctx.fillText('4.  🧗 DOODLE CLIMBER', 26, 204);
    ctx.fillStyle = '#526175';
    ctx.font = '7px monospace';
    ctx.fillText('Infinite neon platform jumper & shoot.', 26, 215);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px sans-serif';
    ctx.fillText('USE ARROWS ▲/▼ TO HIGHLIGHT', 120, 252);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('PRESS CENTER OK TO UNLEASH', 120, 266);
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
          launcherSelection = (launcherSelection - 1 + 4) % 4;
          playSound('jump');
          break;
        case 'ArrowDown':
        case '8':
          launcherSelection = (launcherSelection + 1) % 4;
          playSound('jump');
          break;
        case '1':
          launcherSelection = 0;
          launchSelectedCart();
          break;
        case '3':
          launcherSelection = 2;
          launchSelectedCart();
          break;
        case '4':
          launcherSelection = 3;
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

    if (appMode === 'CLIMBER') {
      if (climberState === 'GAMEOVER') {
        if (key === 'SoftLeft') {
          appMode = 'LAUNCHER';
          if (lblSoftLeft) lblSoftLeft.textContent = 'LAUNCH';
          playSound('phase');
        } else if (key === 'Enter' || key === '5' || key === ' ' || key === '2' || key === 'ArrowUp') {
          initClimberGame();
        } else if (key === 'SoftRight') {
          handleMuteToggle();
        }
        return;
      }

      switch (key) {
        case 'ArrowLeft':
        case '4':
          climberVx = Math.max(-5.5, climberVx - 1.2);
          break;
        case 'ArrowRight':
        case '6':
          climberVx = Math.min(5.5, climberVx + 1.2);
          break;
        case 'ArrowUp':
        case '2':
        case 'Enter':
        case '5':
        case ' ':
          fireClimberLaser();
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

    if (appMode === 'INTERCEPTOR') {
      if (interceptorState === 'GAMEOVER') {
        if (key === 'SoftLeft') {
          appMode = 'LAUNCHER';
          if (lblSoftLeft) lblSoftLeft.textContent = 'LAUNCH';
          playSound('phase');
        } else if (key === 'Enter' || key === '5' || key === ' ' || key === 'SoftLeft') {
          initInterceptorGame();
        } else if (key === 'SoftRight') {
          handleMuteToggle();
        }
        return;
      }

      switch (key) {
        case 'ArrowUp':
        case '2':
          interceptorShipY = Math.max(50, interceptorShipY - 9);
          break;
        case 'ArrowDown':
        case '8':
          interceptorShipY = Math.min(275, interceptorShipY + 9);
          break;
        case 'ArrowLeft':
        case '4':
          interceptorShipX = Math.max(15, interceptorShipX - 9);
          break;
        case 'ArrowRight':
        case '6':
          interceptorShipX = Math.min(225, interceptorShipX + 9);
          break;
        case 'Enter':
        case '5':
        case ' ':
          fireInterceptorBullet();
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
