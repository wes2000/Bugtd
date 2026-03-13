import * as THREE from 'three';
import { GameManager, GAME_STATES, PHASES } from './engine/GameManager.js';
import { MAPS } from './data/maps.js';
import { TOWER_TYPES } from './data/towers.js';
import { SceneSetup } from './rendering/SceneSetup.js';
import { MapRenderer } from './rendering/MapRenderer.js';
import { TowerRenderer } from './rendering/TowerRenderer.js';
import { TroopRenderer } from './rendering/TroopRenderer.js';
import { ParticleSystem } from './rendering/ParticleSystem.js';
import { UIManager } from './rendering/UIManager.js';
import { SFX, resumeAudio, startAmbient, stopAmbient, audioSettings, setSfxEnabled, setMusicEnabled } from './utils/audio.js';
import { PeerNetwork } from './network/PeerNetwork.js';

// ========== INITIALIZATION ==========
const canvas = document.getElementById('game-canvas');
const overlay = document.getElementById('ui-overlay');

const sceneSetup = new SceneSetup(canvas);
const scene = sceneSetup.getScene();
const camera = sceneSetup.getCamera();

const mapRenderer = new MapRenderer(scene);
const towerRenderer = new TowerRenderer(scene);
const troopRenderer = new TroopRenderer(scene);
const particles = new ParticleSystem(scene);
const ui = new UIManager(overlay);
const game = new GameManager();

let lastTime = 0;
let hoveredGrid = null;
let previewMesh = null;

// ========== MULTIPLAYER STATE ==========
let network = null;
let localPlayer = 0; // 0 = host/single, 1 = client
let isMultiplayer = false;
let stateSendTimer = 0;
const STATE_SEND_RATE = 1 / 15; // 15Hz

// ========== GAME CALLBACKS ==========
game.onPhaseChange = (phase) => {
  if (phase === PHASES.BUILD) {
    if (!isMultiplayer) {
      // AI builds during build phase (single player only)
      game.runAIBuildPhase();
    }
    syncTowerMeshes();
    ui.deselectTower();
    ui.hideTowerInfo();
    ui.resetReady();
  }
  if (phase === PHASES.COMBAT) {
    SFX.fight();
    // Deploy all queued cards automatically
    const queued = ui.getQueuedCards();
    if (queued.length > 0) {
      if (isMultiplayer && localPlayer === 1) {
        // Client: send queued cards to host
        network.send({ type: 'queueCards', cardIds: queued });
      } else {
        game.deployQueuedCardsForPlayer(localPlayer, queued);
      }
      SFX.cardPlay();
      ui.clearQueuedCards();
      ui.updateCardHand(game.getHandForPlayer(localPlayer), true);
    }
  }
};

game.onReadyChange = () => {
  ui.updateReadyStatus(game.isReady(localPlayer), game.isReady(1 - localPlayer));
};

game.onRoundChange = (round) => {
  SFX.roundStart();
  ui.updateCardHand(game.getHandForPlayer(localPlayer));
  ui.updateSpawnButtons(game.getMap().pathCount);
};

game.onAnnounce = (text) => {
  ui.announce(text);
};

game.onBaseHit = (targetPlayer, damage) => {
  SFX.baseDamage();
  const shakeAmt = Math.min(damage * 0.02, 0.5);
  camera.position.x += (Math.random() - 0.5) * shakeAmt;
  camera.position.z += (Math.random() - 0.5) * shakeAmt;
};

game.onGameOver = (winner, stats) => {
  // Host forwards game over to client
  if (isMultiplayer && network && network.isHost) {
    network.send({ type: 'gameOver', winner, stats });
  }
  if (winner === localPlayer) {
    SFX.victory();
    ui.announce('VICTORY!', '#6bcb77');
    const map = game.getMap();
    particles.emitConfetti(map.gridWidth, map.gridHeight / 2);
    particles.emitConfetti(map.gridWidth + 2, map.gridHeight / 2);
  } else {
    SFX.defeat();
    ui.announce('DEFEAT', '#ff6b6b');
  }
  setTimeout(() => {
    ui.showGameOver(winner, stats, localPlayer);
    stopAmbient();
  }, 2000);
};

game.onEvent = (evt) => {
  handleGameEvent(evt);
  // Host forwards events to client
  if (isMultiplayer && network && network.isHost) {
    network.send({ type: 'event', event: evt });
  }
};

function handleGameEvent(evt) {
  switch (evt.type) {
    case 'damage': {
      const screen = worldToScreen(evt.x, 0.5, evt.z);
      if (screen) ui.spawnDamageNumber(screen.x, screen.y, evt.amount, evt.isBig ? 'big' : 'normal');
      particles.emitDamage(evt.x, evt.z);
      break;
    }
    case 'kill': {
      particles.emitKill(evt.x, evt.z, evt.color);
      const screen = worldToScreen(evt.x, 0.8, evt.z);
      if (screen) ui.spawnDamageNumber(screen.x, screen.y, evt.bounty, 'gold');
      SFX.pop();
      break;
    }
    case 'gold': {
      if (evt.player === localPlayer) {
        particles.emitGold(evt.x, evt.z);
        SFX.coin();
      }
      break;
    }
    case 'tower_attack': {
      towerRenderer.triggerAttackAnim(evt.towerId);
      if (evt.towerType === 'chomper') SFX.chomp();
      else if (evt.towerType === 'splorch') SFX.splat();
      else if (evt.towerType === 'freezlick') SFX.freeze();
      else if (evt.towerType === 'hexling') SFX.hex();
      break;
    }
    case 'base_damage': {
      const map = game.getMap();
      if (map) {
        const screen = evt.player === 0
          ? worldToScreen(0.5, 1, map.gridHeight / 2)
          : worldToScreen(map.gridWidth * 2 + 1.5, 1, map.gridHeight / 2);
        if (screen) ui.spawnDamageNumber(screen.x, screen.y, evt.amount, 'base');
      }
      break;
    }
    case 'stun': {
      particles.emitBurst(evt.x, 0.5, evt.z, 0x88ccff, 5);
      break;
    }
    case 'bug_fight': {
      particles.emitBurst(evt.x, 0.3, evt.z, 0xff8800, 3);
      break;
    }
  }
}

// ========== COMMON SETUP ==========
function setupGame(mapKey) {
  resumeAudio();
  startAmbient();

  towerRenderer.towerMeshes.forEach((mesh) => scene.remove(mesh));
  towerRenderer.towerMeshes.clear();
  troopRenderer.clear();
  particles.clear();
  mapRenderer.clear();

  const map = MAPS[mapKey] || game.getMap();
  mapRenderer.setCurrentMap(map);
  mapRenderer.buildMap(map);
  sceneSetup.setCameraForMap(map);

  ui.hideLobby();
  ui.showHUD();
  ui.updateCardHand(game.getHandForPlayer(localPlayer));
  ui.updateSpawnButtons(map.pathCount);
}

// ========== UI CALLBACKS ==========
ui.onStartGame = (name) => {
  localPlayer = 0;
  isMultiplayer = false;
  game.isMultiplayer = false;
  game.isNetworkClient = false;
  game.startGame();
  setupGame(game.getMapKey());
};

ui.onHostGame = async (name) => {
  try {
    network = new PeerNetwork();
    const code = await network.host();
    const joinUrl = network.getJoinUrl(code);
    ui.showHostLobby(code, joinUrl);

    network.onConnect = () => {
      ui.updateLobbyStatus('host', 'Opponent connected! Starting...');
      setTimeout(() => {
        localPlayer = 0;
        isMultiplayer = true;
        game.isMultiplayer = true;
        game.isNetworkClient = false;
        game.startGame();
        // Send game start to client
        network.send({ type: 'gameStart', mapKey: game.getMapKey() });
        setupGame(game.getMapKey());
      }, 1000);
    };

    network.onDisconnect = () => {
      if (isMultiplayer) {
        ui.announce('Opponent disconnected!', '#ff6b6b');
        isMultiplayer = false;
        game.isMultiplayer = false;
      }
    };

    network.onMessage = (msg) => handleHostMessage(msg);
    network.onError = (err) => {
      ui.updateLobbyStatus('host', `Error: ${err}`);
    };
  } catch (err) {
    ui.updateLobbyStatus('host', `Failed to host: ${err.message}`);
  }
};

ui.onJoinGame = async (name, code) => {
  try {
    network = new PeerNetwork();
    ui.updateLobbyStatus('join', 'Connecting...');
    await network.join(code);
    ui.updateLobbyStatus('join', 'Connected! Waiting for host to start...');

    network.onMessage = (msg) => handleClientMessage(msg);

    network.onDisconnect = () => {
      if (isMultiplayer) {
        ui.announce('Host disconnected!', '#ff6b6b');
        isMultiplayer = false;
        game.isMultiplayer = false;
      }
    };

    network.onError = (err) => {
      ui.updateLobbyStatus('join', `Error: ${err}`);
    };
  } catch (err) {
    ui.updateLobbyStatus('join', `Failed to join: ${err.message}`);
  }
};

ui.onCancelLobby = () => {
  if (network) {
    network.disconnect();
    network = null;
  }
  isMultiplayer = false;
};

ui.onReady = (isReady) => {
  if (isMultiplayer && localPlayer === 1) {
    network.send({ type: 'ready', isReady });
  } else {
    if (isReady) game.playerReady(localPlayer);
    else game.playerUnready(localPlayer);
  }
  ui.updateReadyStatus(game.isReady(localPlayer), game.isReady(1 - localPlayer));
};

ui.onTowerSelect = (type) => {
  if (previewMesh) { scene.remove(previewMesh); previewMesh = null; }
  ui.hideTowerInfo();
  towerRenderer.rangeIndicators.forEach((_, id) => towerRenderer.removeRangeIndicator(id));
};

ui.onCardSelect = (cardId) => {
  ui.updateCardHand(game.getHandForPlayer(localPlayer), true);
};

ui.onUpgrade = (towerId, branch) => {
  if (isMultiplayer && localPlayer === 1) {
    network.send({ type: 'upgradeTower', towerId, branch });
    return;
  }
  const tower = game.upgradeTowerForPlayer(localPlayer, towerId, branch);
  if (tower) {
    SFX.build();
    const pos = mapRenderer.gridToWorld(tower.gridX, tower.gridY, localPlayer);
    towerRenderer.removeTower(towerId);
    towerRenderer.createTowerMesh(tower, pos.x, pos.z);
    ui.showTowerInfo(tower);
  }
};

ui.onSell = (towerId) => {
  if (isMultiplayer && localPlayer === 1) {
    network.send({ type: 'sellTower', towerId });
    return;
  }
  const tower = game.towers.getTower(towerId);
  if (!tower) return;
  const refund = game.sellTowerForPlayer(localPlayer, towerId);
  if (refund > 0) {
    SFX.sell();
    towerRenderer.removeTower(towerId);
    towerRenderer.removeRangeIndicator(towerId);
  }
};

ui.onTargeting = (towerId, mode) => {
  if (isMultiplayer && localPlayer === 1) {
    network.send({ type: 'setTargeting', towerId, mode });
    return;
  }
  game.towers.setTargeting(towerId, mode);
};

ui.onSettingsChange = (setting, enabled) => {
  if (setting === 'sfx') setSfxEnabled(enabled);
  if (setting === 'music') setMusicEnabled(enabled);
};

ui.syncSettings(audioSettings.sfxEnabled, audioSettings.musicEnabled);

// ========== NETWORK MESSAGE HANDLERS ==========
function handleHostMessage(msg) {
  // Host receives client actions
  switch (msg.type) {
    case 'placeTower': {
      const tower = game.placeTowerForPlayer(1, msg.towerType, msg.gridX, msg.gridY);
      if (tower) {
        const pos = mapRenderer.gridToWorld(tower.gridX, tower.gridY, 1);
        towerRenderer.createTowerMesh(tower, pos.x, pos.z);
      }
      break;
    }
    case 'upgradeTower': {
      const tower = game.upgradeTowerForPlayer(1, msg.towerId, msg.branch);
      if (tower) {
        const pos = mapRenderer.gridToWorld(tower.gridX, tower.gridY, 1);
        towerRenderer.removeTower(msg.towerId);
        towerRenderer.createTowerMesh(tower, pos.x, pos.z);
      }
      break;
    }
    case 'sellTower': {
      game.sellTowerForPlayer(1, msg.towerId);
      towerRenderer.removeTower(msg.towerId);
      towerRenderer.removeRangeIndicator(msg.towerId);
      break;
    }
    case 'queueCards': {
      game.deployQueuedCardsForPlayer(1, msg.cardIds);
      break;
    }
    case 'ready': {
      if (msg.isReady) game.playerReady(1);
      else game.playerUnready(1);
      if (game.onReadyChange) game.onReadyChange();
      break;
    }
    case 'setTargeting': {
      game.towers.setTargeting(msg.towerId, msg.mode);
      break;
    }
  }
}

function handleClientMessage(msg) {
  // Client receives state from host
  switch (msg.type) {
    case 'gameStart': {
      localPlayer = 1;
      isMultiplayer = true;
      game.isMultiplayer = true;
      game.isNetworkClient = true;
      game.startGameWithMap(msg.mapKey);
      setupGame(msg.mapKey);
      break;
    }
    case 'state': {
      game.applyNetworkState(msg);
      break;
    }
    case 'event': {
      handleGameEvent(msg.event);
      break;
    }
    case 'gameOver': {
      game.state = GAME_STATES.GAME_OVER;
      if (game.onGameOver) game.onGameOver(msg.winner, msg.stats);
      break;
    }
  }
}

// ========== MOUSE INPUT ==========
canvas.addEventListener('click', (e) => {
  if (game.state !== GAME_STATES.PLAYING) return;

  const worldPos = sceneSetup.getWorldPosition(e.clientX, e.clientY);
  if (!worldPos) return;

  const grid = mapRenderer.getGridAtWorld(worldPos.x, worldPos.z);

  // Build phase: place tower on local player's grid
  if (game.getPhase() === PHASES.BUILD && ui.selectedTowerType && grid && grid.player === localPlayer) {
    if (isMultiplayer && localPlayer === 1) {
      // Client: send action to host
      network.send({ type: 'placeTower', towerType: ui.selectedTowerType, gridX: grid.gridX, gridY: grid.gridY });
    } else {
      const tower = game.placeTowerForPlayer(localPlayer, ui.selectedTowerType, grid.gridX, grid.gridY);
      if (tower) {
        SFX.build();
        const pos = mapRenderer.gridToWorld(grid.gridX, grid.gridY, localPlayer);
        towerRenderer.createTowerMesh(tower, pos.x, pos.z);
      }
    }
  }

  // Click on existing tower to show info
  if (grid && grid.player === localPlayer) {
    const playerTowers = game.towers.getPlayerTowers(localPlayer);
    const clickedTower = playerTowers.find(t => t.gridX === grid.gridX && t.gridY === grid.gridY);
    if (clickedTower && !ui.selectedTowerType) {
      ui.showTowerInfo(clickedTower);
      const def = TOWER_TYPES[clickedTower.type];
      towerRenderer.showRangeIndicator(clickedTower.id, grid.worldX, grid.worldZ, clickedTower.range, def.color);
    }
  } else {
    ui.hideTowerInfo();
    towerRenderer.rangeIndicators.forEach((_, id) => towerRenderer.removeRangeIndicator(id));
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (game.state !== GAME_STATES.PLAYING) return;

  const worldPos = sceneSetup.getWorldPosition(e.clientX, e.clientY);
  if (!worldPos) return;

  mapRenderer.resetGridHighlights();

  const grid = mapRenderer.getGridAtWorld(worldPos.x, worldPos.z);

  if (game.getPhase() === PHASES.BUILD && ui.selectedTowerType && grid && grid.player === localPlayer) {
    const isOccupied = game.towers.isCellOccupied(localPlayer, grid.gridX, grid.gridY);
    const isBuildable = game.getBuildableSquaresForPlayer(localPlayer).some(s => s.x === grid.gridX && s.y === grid.gridY);
    const color = (!isOccupied && isBuildable) ? 0x6bcb77 : 0xff6b6b;
    mapRenderer.highlightGrid(grid.gridX, grid.gridY, localPlayer, color);

    if (!isOccupied && isBuildable) {
      const def = TOWER_TYPES[ui.selectedTowerType];
      towerRenderer.showRangeIndicator('preview', grid.worldX, grid.worldZ, def.range, def.color);
    } else {
      towerRenderer.removeRangeIndicator('preview');
    }
  } else {
    towerRenderer.removeRangeIndicator('preview');
  }

  hoveredGrid = grid;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ui.deselectTower();
  ui.hideTowerInfo();
  ui.clearQueuedCards();
  ui.updateCardHand(game.getHandForPlayer(localPlayer), true);
  towerRenderer.removeRangeIndicator('preview');
  towerRenderer.rangeIndicators.forEach((_, id) => towerRenderer.removeRangeIndicator(id));
});

// ========== HELPER ==========
function worldToScreen(x, y, z) {
  const vec = new THREE.Vector3(x, y, z);
  vec.project(camera);
  return {
    x: (vec.x * 0.5 + 0.5) * window.innerWidth,
    y: (-vec.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function syncTowerMeshes() {
  const allTowers = [...game.getPlayerTowers(), ...game.getEnemyTowers()];
  for (const tower of allTowers) {
    if (!towerRenderer.towerMeshes.has(tower.id)) {
      const pos = mapRenderer.gridToWorld(tower.gridX, tower.gridY, tower.player);
      towerRenderer.createTowerMesh(tower, pos.x, pos.z);
    }
  }

  const towerIds = new Set(allTowers.map(t => t.id));
  for (const [id] of towerRenderer.towerMeshes) {
    if (!towerIds.has(id)) {
      towerRenderer.removeTower(id);
    }
  }
}

// ========== AUTO-JOIN FROM URL ==========
const urlParams = new URLSearchParams(window.location.search);
const autoJoinCode = urlParams.get('join');
if (autoJoinCode) {
  // Auto-fill the join code and open join screen
  setTimeout(() => {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-join').style.display = 'flex';
    document.getElementById('join-code-input').value = autoJoinCode;
  }, 100);
}

// ========== GAME LOOP ==========
function gameLoop(time) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  // Update game (host/single player runs simulation; client receives state)
  if (!game.isNetworkClient) {
    game.update(dt);
  }

  // Host sends state to client periodically
  if (isMultiplayer && network && network.isHost && game.state === GAME_STATES.PLAYING) {
    stateSendTimer += dt;
    if (stateSendTimer >= STATE_SEND_RATE) {
      stateSendTimer -= STATE_SEND_RATE;
      network.send({ type: 'state', ...game.getSerializedState() });
    }
  }

  if (game.state === GAME_STATES.PLAYING) {
    // Update UI - show correct player perspective
    const myHp = game.getBaseHp(localPlayer);
    const enemyHp = game.getBaseHp(1 - localPlayer);
    ui.updateHUD({
      p1Hp: myHp,
      p2Hp: enemyHp,
      round: game.getRound(),
      phase: game.getPhase(),
      timer: game.getPhaseTimer(),
      gold: game.getGoldForPlayer(localPlayer),
      income: game.getIncomeForPlayer(localPlayer),
    });
    ui.updateTowerButtons(game.getGoldForPlayer(localPlayer));

    // Update renderers
    const allTroops = game.getAllTroops();
    towerRenderer.update(dt, allTroops);
    troopRenderer.update(dt, allTroops);
    if (!game.isNetworkClient) {
      particles.updateProjectiles(game.getProjectiles());
    }
    particles.update(dt);

    syncTowerMeshes();
    ui.updateCardHand(game.getHandForPlayer(localPlayer));

    // Camera smooth return after shake
    const map = game.getMap();
    if (map) {
      const targetX = (map.gridWidth * 2 + 2) / 2;
      const targetZ = map.gridHeight / 2 + 10;
      camera.position.x += (targetX - camera.position.x) * 0.05;
      camera.position.z += (targetZ - camera.position.z) * 0.05;
    }
  }

  sceneSetup.render();
}

requestAnimationFrame(gameLoop);
