import { TOWER_TYPES, TARGETING_MODES } from '../data/towers.js';

export class UIManager {
  constructor(overlay) {
    this.overlay = overlay;
    this.selectedTowerType = null;
    this.selectedCard = null;
    this.selectedCards = new Set(); // queued cards for combat
    this.selectedTower = null; // placed tower for info panel

    // Callbacks
    this.onStartGame = null;
    this.onTowerSelect = null;
    this.onCardSelect = null;
    this.onUpgrade = null;
    this.onSell = null;
    this.onTargeting = null;
    this.onReady = null;

    this.currentScreen = 'menu';
    this.damageNumbers = [];
    this._lastCardIds = ''; // cache to avoid unnecessary card hand rebuilds
    this._playerReady = false;

    this._buildMainMenu();
  }

  _buildMainMenu() {
    this.overlay.innerHTML = `
      <div class="main-menu" id="main-menu">
        <div class="game-title">BUG SIEGE</div>
        <div class="game-subtitle">TOWER DEFENSE</div>
        <input type="text" class="nickname-input" id="nickname" placeholder="Enter your name..."
               value="${localStorage.getItem('bugsiege_name') || ''}" maxlength="16">
        <button class="menu-btn btn-play" id="btn-play">PLAY vs AI</button>
        <button class="menu-btn btn-how" id="btn-how">HOW TO PLAY</button>
      </div>
      <div class="how-to-play" id="how-to-play" style="display:none">
        <button class="close-btn" id="close-how">&times;</button>
        <h2>HOW TO PLAY</h2>
        <div class="how-section">
          <h3>Goal</h3>
          <p>Destroy the enemy base before they destroy yours! Each base has 100 HP.</p>
        </div>
        <div class="how-section">
          <h3>Build Phase</h3>
          <p>Place monster towers on your grid (left side) to defend against incoming bugs. Click a tower type in the left panel, then click a grid square to build. Press READY when done!</p>
        </div>
        <div class="how-section">
          <h3>Combat Phase</h3>
          <p>Select bug cards during the Build phase to queue them for attack. They auto-deploy to random lanes when combat starts!</p>
        </div>
        <div class="how-section">
          <h3>Towers</h3>
          <p>🟢 <b>Chomper</b> - Single target DPS<br>
             🔴 <b>Splorch</b> - Splash/AOE damage<br>
             🔵 <b>Freezlick</b> - Slows enemies<br>
             🟡 <b>Goldbug</b> - Generates gold<br>
             🟣 <b>Hexling</b> - Damage + debuffs</p>
        </div>
        <div class="how-section">
          <h3>Troops (Bug Cards)</h3>
          <p>🐜 <b>Ant</b> - Swarm (x5)<br>
             🪲 <b>Beetle</b> - Tank<br>
             🦗 <b>Cricket</b> - Fast runner<br>
             🦋 <b>Butterfly</b> - Flying<br>
             🐛 <b>Caterpillar</b> - Regenerates HP<br>
             🕷️ <b>Spider</b> - Shields allies</p>
        </div>
        <div class="how-section">
          <h3>Tips</h3>
          <p>- Build Goldbug early for economy advantage<br>
             - Upgrade towers at level 2 for specializations<br>
             - Save cards for a massive surprise push<br>
             - Mix tower types for synergy (slow + damage)<br>
             - Unplayed cards carry over to next round!</p>
        </div>
      </div>
      <div class="hud" id="hud">
        <div class="top-bar">
          <div class="hp-bar-container">
            <span class="hp-text" id="p1-hp-text">100</span>
            <div class="hp-bar"><div class="hp-bar-fill p1" id="p1-hp-bar" style="width:100%"></div></div>
            <span style="color:#6bcb77;font-weight:700">YOU</span>
          </div>
          <div class="round-info">
            <div class="round-number" id="round-num">Round 1</div>
            <span class="phase-label build" id="phase-label">BUILD</span>
            <div class="phase-timer" id="phase-timer">2:00</div>
          </div>
          <div class="hp-bar-container">
            <span style="color:#ff6b6b;font-weight:700">ENEMY</span>
            <div class="hp-bar"><div class="hp-bar-fill p2" id="p2-hp-bar" style="width:100%"></div></div>
            <span class="hp-text" id="p2-hp-text">100</span>
          </div>
        </div>

        <div class="tower-panel" id="tower-panel">
          ${Object.entries(TOWER_TYPES).map(([key, t]) => `
            <button class="tower-btn ${key}" data-type="${key}" title="${t.name}: ${t.description}">
              <span>${t.emoji}</span>
              <span class="cost">${t.cost}g</span>
            </button>
          `).join('')}
        </div>

        <div class="gold-display" id="gold-display">
          <div class="gold-amount" id="gold-amount">100</div>
          <div class="gold-income" id="gold-income">+2/s</div>
        </div>

        <div class="card-hand" id="card-hand"></div>

        <div class="spawn-selector" id="spawn-selector">
          <button class="spawn-btn" data-spawn="0">Path 1</button>
          <button class="spawn-btn" data-spawn="1">Path 2</button>
        </div>

        <div class="tower-info" id="tower-info">
          <h3 id="tower-info-name"></h3>
          <div class="stat-row"><span>Level</span><span class="stat-value" id="ti-level"></span></div>
          <div class="stat-row"><span>Damage</span><span class="stat-value" id="ti-damage"></span></div>
          <div class="stat-row"><span>Speed</span><span class="stat-value" id="ti-speed"></span></div>
          <div class="stat-row"><span>Range</span><span class="stat-value" id="ti-range"></span></div>
          <div class="stat-row"><span>Kills</span><span class="stat-value" id="ti-kills"></span></div>
          <div id="ti-upgrade-section"></div>
          <div class="targeting-buttons" id="ti-targeting">
            ${TARGETING_MODES.map(m => `<button class="targeting-btn" data-mode="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`).join('')}
          </div>
          <button class="action-btn btn-sell" id="ti-sell">Sell</button>
        </div>

        <div class="ready-btn-container" id="ready-container">
          <button class="ready-btn" id="ready-btn">READY</button>
          <div class="ready-status" id="ready-status">Place towers, then hit Ready!</div>
        </div>

        <div class="announcer" id="announcer"></div>

        <div class="emote-area">
          <button class="emote-btn-trigger" id="emote-trigger">😊</button>
          <div class="emote-picker" id="emote-picker">
            <button class="emote-option" data-emote="😂">😂 Laugh</button>
            <button class="emote-option" data-emote="💃">💃 Taunt</button>
            <button class="emote-option" data-emote="😢">😢 Cry</button>
            <button class="emote-option" data-emote="😱">😱 Shock</button>
            <button class="emote-option" data-emote="👏">👏 GG</button>
            <button class="emote-option" data-emote="💪">💪 Flex</button>
          </div>
        </div>
      </div>

      <div class="game-over" id="game-over">
        <h1 id="go-title"></h1>
        <div class="stats-panel" id="go-stats"></div>
        <button class="menu-btn btn-play" id="go-rematch">PLAY AGAIN</button>
        <button class="menu-btn btn-how" id="go-menu" style="margin-top:8px">MAIN MENU</button>
      </div>

      <div class="tooltip" id="tooltip"></div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Main menu
    document.getElementById('btn-play')?.addEventListener('click', () => {
      const name = document.getElementById('nickname').value.trim() || 'Player';
      localStorage.setItem('bugsiege_name', name);
      if (this.onStartGame) this.onStartGame(name);
    });

    document.getElementById('btn-how')?.addEventListener('click', () => {
      document.getElementById('how-to-play').style.display = 'block';
    });

    document.getElementById('close-how')?.addEventListener('click', () => {
      document.getElementById('how-to-play').style.display = 'none';
    });

    // Tower buttons
    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = btn.dataset.type;
        this.selectTowerType(type);
      });

      btn.addEventListener('mouseenter', () => {
        const type = btn.dataset.type;
        const def = TOWER_TYPES[type];
        this.showTooltip(btn, `<h4>${def.emoji} ${def.name} (${def.cost}g)</h4><p>${def.description}</p>`);
      });

      btn.addEventListener('mouseleave', () => this.hideTooltip());
    });

    // Spawn buttons
    document.querySelectorAll('.spawn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.spawn);
        if (this.onSpawnSelect) this.onSpawnSelect(idx);
        this.hideSpawnSelector();
      });
    });

    // Tower info actions
    document.getElementById('ti-sell')?.addEventListener('click', () => {
      if (this.selectedTower && this.onSell) {
        this.onSell(this.selectedTower.id);
        this.hideTowerInfo();
      }
    });

    document.querySelectorAll('.targeting-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (this.selectedTower && this.onTargeting) {
          this.onTargeting(this.selectedTower.id, mode);
        }
        // Update visual
        document.querySelectorAll('.targeting-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Ready button
    document.getElementById('ready-btn')?.addEventListener('click', () => {
      this._playerReady = !this._playerReady;
      const btn = document.getElementById('ready-btn');
      if (this._playerReady) {
        btn.textContent = 'WAITING...';
        btn.classList.add('is-ready');
      } else {
        btn.textContent = 'READY';
        btn.classList.remove('is-ready');
      }
      if (this.onReady) this.onReady(this._playerReady);
    });

    // Emote
    document.getElementById('emote-trigger')?.addEventListener('click', () => {
      document.getElementById('emote-picker').classList.toggle('active');
    });

    document.querySelectorAll('.emote-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showEmote(btn.dataset.emote);
        document.getElementById('emote-picker').classList.remove('active');
      });
    });

    // Game over
    document.getElementById('go-rematch')?.addEventListener('click', () => {
      this.hideGameOver();
      if (this.onStartGame) {
        const name = localStorage.getItem('bugsiege_name') || 'Player';
        this.onStartGame(name);
      }
    });

    document.getElementById('go-menu')?.addEventListener('click', () => {
      this.hideGameOver();
      this.showMainMenu();
    });
  }

  selectTowerType(type) {
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    if (this.selectedTowerType === type) {
      this.selectedTowerType = null;
      this.selectedCard = null;
    } else {
      this.selectedTowerType = type;
      this.selectedCard = null;
      const btn = document.querySelector(`.tower-btn[data-type="${type}"]`);
      if (btn) btn.classList.add('selected');
    }
    if (this.onTowerSelect) this.onTowerSelect(this.selectedTowerType);
  }

  deselectTower() {
    this.selectedTowerType = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
  }

  updateTowerButtons(gold) {
    document.querySelectorAll('.tower-btn').forEach(btn => {
      const type = btn.dataset.type;
      const def = TOWER_TYPES[type];
      if (gold < def.cost) {
        btn.classList.add('disabled');
      } else {
        btn.classList.remove('disabled');
      }
    });
  }

  // Card hand - only rebuild DOM when cards actually change
  updateCardHand(cards, forceRebuild = false) {
    const hand = document.getElementById('card-hand');
    if (!hand) return;

    // Build a signature of current card state to check if rebuild needed
    const cardSig = cards.map(c => `${c.id}:${c.rarity}`).join(',');
    const queuedSig = [...this.selectedCards].sort().join(',');
    if (!forceRebuild && cardSig === this._lastCardIds && queuedSig === this._lastQueuedSig) {
      return;
    }
    this._lastCardIds = cardSig;
    this._lastQueuedSig = queuedSig;

    hand.innerHTML = cards.map(card => `
      <div class="card ${card.rarity} ${card.carriedOver ? 'carried-over' : ''} ${this.selectedCards.has(card.id) ? 'queued' : ''}"
           data-card-id="${card.id}">
        <span class="rarity-tag" style="background:${card.isGolden ? '#ffd700' : 'transparent'}">${card.isGolden ? 'GOLD' : ''}</span>
        <span class="bug-icon">${card.emoji}</span>
        <span class="bug-name">${card.name}</span>
        <span class="bug-count">x${card.spawnCount}</span>
      </div>
    `).join('');

    // Bind card click
    hand.querySelectorAll('.card').forEach(el => {
      el.addEventListener('click', () => {
        const cardId = parseInt(el.dataset.cardId);
        this.toggleCard(cardId);
      });
    });
  }

  toggleCard(cardId) {
    // Toggle card in/out of queue
    if (this.selectedCards.has(cardId)) {
      this.selectedCards.delete(cardId);
    } else {
      this.selectedCards.add(cardId);
    }
    this.selectedTowerType = null;
    this.deselectTower();
    if (this.onCardSelect) this.onCardSelect(cardId);
    // Force visual rebuild
    this._lastQueuedSig = '';
  }

  getQueuedCards() {
    return [...this.selectedCards];
  }

  clearQueuedCards() {
    this.selectedCards.clear();
    this._lastQueuedSig = '';
  }

  showSpawnSelector() {
    const el = document.getElementById('spawn-selector');
    if (!el) return;
    // Show phase-appropriate message
    if (this._currentPhase === 'build' || this._currentPhase === 'roundEnd') {
      el.dataset.hint = 'combat';
    } else {
      el.dataset.hint = '';
    }
    el.classList.add('active');
  }

  hideSpawnSelector() {
    document.getElementById('spawn-selector')?.classList.remove('active');
  }

  updateSpawnButtons(pathCount) {
    const container = document.getElementById('spawn-selector');
    if (!container) return;
    this._pathCount = pathCount;
    this._rebuildSpawnButtons(container, pathCount);
  }

  _rebuildSpawnButtons(container, pathCount) {
    container.innerHTML = '';
    // Hint for non-combat phase
    const hint = document.createElement('div');
    hint.className = 'spawn-hint';
    hint.textContent = 'Play cards during Combat phase!';
    container.appendChild(hint);

    for (let i = 0; i < pathCount; i++) {
      const btn = document.createElement('button');
      btn.className = 'spawn-btn';
      btn.dataset.spawn = i;
      btn.textContent = pathCount === 1 ? 'Send Bugs!' : `Path ${i + 1}`;
      btn.addEventListener('click', () => {
        if (this.onSpawnSelect) this.onSpawnSelect(i);
        this.hideSpawnSelector();
      });
      container.appendChild(btn);
    }
  }

  // HUD updates
  updateHUD(data) {
    const p1Hp = document.getElementById('p1-hp-bar');
    const p2Hp = document.getElementById('p2-hp-bar');
    const p1Text = document.getElementById('p1-hp-text');
    const p2Text = document.getElementById('p2-hp-text');

    if (p1Hp) p1Hp.style.width = `${data.p1Hp}%`;
    if (p2Hp) p2Hp.style.width = `${data.p2Hp}%`;
    if (p1Text) p1Text.textContent = data.p1Hp;
    if (p2Text) p2Text.textContent = data.p2Hp;

    const roundNum = document.getElementById('round-num');
    if (roundNum) roundNum.textContent = `Round ${data.round}/15`;

    this._currentPhase = data.phase;

    const phaseLabel = document.getElementById('phase-label');
    if (phaseLabel) {
      phaseLabel.textContent = data.phase.toUpperCase();
      phaseLabel.className = `phase-label ${data.phase === 'build' ? 'build' : 'combat'}`;
    }

    const timer = document.getElementById('phase-timer');
    if (timer) {
      const mins = Math.floor(data.timer / 60);
      const secs = data.timer % 60;
      timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    const goldAmt = document.getElementById('gold-amount');
    const goldInc = document.getElementById('gold-income');
    if (goldAmt) goldAmt.textContent = `${data.gold}`;
    if (goldInc) goldInc.textContent = `+${data.income}/s`;

    // Show/hide ready button based on phase
    const readyContainer = document.getElementById('ready-container');
    if (readyContainer) {
      if (data.phase === 'build') {
        readyContainer.classList.add('active');
      } else {
        readyContainer.classList.remove('active');
      }
    }
  }

  // Update ready status text
  updateReadyStatus(playerReady, enemyReady) {
    const status = document.getElementById('ready-status');
    if (!status) return;
    if (playerReady && enemyReady) {
      status.textContent = 'Both ready! Starting...';
    } else if (playerReady) {
      status.textContent = 'Waiting for enemy...';
    } else if (enemyReady) {
      status.textContent = 'Enemy is ready!';
    } else {
      status.textContent = 'Place towers, then hit Ready!';
    }
  }

  // Reset ready button for new round
  resetReady() {
    this._playerReady = false;
    this.clearQueuedCards();
    const btn = document.getElementById('ready-btn');
    if (btn) {
      btn.textContent = 'READY';
      btn.classList.remove('is-ready');
    }
  }

  // Tower info panel
  showTowerInfo(tower) {
    this.selectedTower = tower;
    const panel = document.getElementById('tower-info');
    if (!panel) return;
    panel.classList.add('active');

    const def = TOWER_TYPES[tower.type];
    document.getElementById('tower-info-name').textContent = `${def.emoji} ${tower.branch ? def.upgrades[tower.branch].name : def.name}`;
    document.getElementById('ti-level').textContent = tower.level;
    document.getElementById('ti-damage').textContent = tower.damage.toFixed(1);
    document.getElementById('ti-speed').textContent = tower.attackSpeed.toFixed(1);
    document.getElementById('ti-range').textContent = tower.range.toFixed(1);
    document.getElementById('ti-kills').textContent = tower.kills;
    // Highlight active targeting mode
    document.querySelectorAll('.targeting-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === tower.targeting);
    });

    // Upgrade buttons
    const upgSection = document.getElementById('ti-upgrade-section');
    if (tower.level === 1) {
      upgSection.innerHTML = Object.entries(def.upgrades).map(([branch, upg]) => `
        <div class="upgrade-option" data-branch="${branch}">
          <button class="action-btn btn-upgrade" data-branch="${branch}">
            ${upg.name} (${upg.cost}g)
          </button>
          <div class="upgrade-desc">${upg.description}</div>
        </div>
      `).join('');

      upgSection.querySelectorAll('.btn-upgrade').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.onUpgrade) this.onUpgrade(tower.id, btn.dataset.branch);
        });
      });
    } else {
      upgSection.innerHTML = `<div style="font-size:12px;color:#6bcb77;margin-top:6px">MAX LEVEL</div>`;
    }

    // Sell price
    const sellBtn = document.getElementById('ti-sell');
    if (sellBtn) {
      const refund = Math.floor(tower.totalInvested * 0.6);
      sellBtn.textContent = `Sell (${refund}g)`;
    }
  }

  hideTowerInfo() {
    this.selectedTower = null;
    document.getElementById('tower-info')?.classList.remove('active');
  }

  // Announcer
  announce(text, color = '#ffd93d') {
    const el = document.getElementById('announcer');
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('show');
    void el.offsetWidth; // reflow
    el.classList.add('show');
  }

  // Floating damage number
  spawnDamageNumber(screenX, screenY, amount, type = 'normal') {
    const el = document.createElement('div');
    el.className = `damage-number ${type}`;
    el.textContent = type === 'gold' ? `+${amount}g` : `-${amount}`;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // Emote
  showEmote(emoji) {
    const el = document.createElement('div');
    el.className = 'emote-popup';
    el.textContent = emoji;
    el.style.right = '80px';
    el.style.bottom = '100px';
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // Tooltip
  showTooltip(anchor, html) {
    const tip = document.getElementById('tooltip');
    if (!tip) return;
    tip.innerHTML = html;
    tip.classList.add('active');
    const rect = anchor.getBoundingClientRect();
    tip.style.left = `${rect.right + 10}px`;
    tip.style.top = `${rect.top}px`;
  }

  hideTooltip() {
    document.getElementById('tooltip')?.classList.remove('active');
  }

  // Screen management
  showMainMenu() {
    this.currentScreen = 'menu';
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('hud').classList.remove('active');
    document.getElementById('game-over').classList.remove('active');
  }

  showHUD() {
    this.currentScreen = 'game';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud').classList.add('active');
    document.getElementById('game-over').classList.remove('active');
  }

  showGameOver(winner, stats, playerIdx = 0) {
    this.currentScreen = 'gameover';
    const go = document.getElementById('game-over');
    go.classList.add('active');

    const title = document.getElementById('go-title');
    if (winner === playerIdx) {
      title.textContent = 'VICTORY!';
      title.className = 'victory';
    } else {
      title.textContent = 'DEFEAT';
      title.className = 'defeat';
    }

    const statsPanel = document.getElementById('go-stats');
    statsPanel.innerHTML = `
      <div class="stat-row"><span class="label">Damage Dealt to Enemy</span><span class="value">${stats.baseDamageDealt[playerIdx]}</span></div>
      <div class="stat-row"><span class="label">Troops Sent</span><span class="value">${stats.troopsSent[playerIdx]}</span></div>
      <div class="stat-row"><span class="label">Enemy Troops Killed</span><span class="value">${stats.troopsKilled[playerIdx]}</span></div>
      <div class="stat-row"><span class="label">Towers Built</span><span class="value">${stats.towersBuilt[playerIdx]}</span></div>
      <div class="stat-row"><span class="label">Gold Earned</span><span class="value">${stats.goldEarned[playerIdx]}</span></div>
      <div class="stat-row"><span class="label">Gold Spent</span><span class="value">${stats.goldSpent[playerIdx]}</span></div>
    `;
  }

  hideGameOver() {
    document.getElementById('game-over').classList.remove('active');
  }
}
