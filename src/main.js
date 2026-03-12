import * as THREE from 'three';
import { GameManager, GAME_STATES, PHASES } from './engine/GameManager.js';
import { TOWER_TYPES } from './data/towers.js';
import { SceneSetup } from './rendering/SceneSetup.js';
import { MapRenderer } from './rendering/MapRenderer.js';
import { TowerRenderer } from './rendering/TowerRenderer.js';
import { TroopRenderer } from './rendering/TroopRenderer.js';
import { ParticleSystem } from './rendering/ParticleSystem.js';
import { UIManager } from './rendering/UIManager.js';
import { SFX, resumeAudio, startAmbient, stopAmbient } from './utils/audio.js';

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

// ========== GAME CALLBACKS ==========
game.onPhaseChange = (phase) => {
  if (phase === PHASES.BUILD) {
    // AI builds during build phase
    game.runAIBuildPhase();
    // Render AI towers
    syncTowerMeshes();
    ui.deselectTower();
    ui.hideTowerInfo();
  }
  if (phase === PHASES.COMBAT) {
    SFX.fight();
  }
};

game.onRoundChange = (round) => {
  SFX.roundStart();
  ui.updateCardHand(game.getPlayerHand());
  ui.updateSpawnButtons(game.getMap().pathCount);
};

game.onAnnounce = (text) => {
  ui.announce(text);
};

game.onBaseHit = (targetPlayer, damage) => {
  SFX.baseDamage();
  // Screen shake
  const shakeAmt = Math.min(damage * 0.02, 0.5);
  camera.position.x += (Math.random() - 0.5) * shakeAmt;
  camera.position.z += (Math.random() - 0.5) * shakeAmt;
};

game.onGameOver = (winner, stats) => {
  if (winner === 0) {
    SFX.victory();
    ui.announce('VICTORY!', '#6bcb77');
    // Confetti
    const map = game.getMap();
    particles.emitConfetti(map.gridWidth, map.gridHeight / 2);
    particles.emitConfetti(map.gridWidth + 2, map.gridHeight / 2);
  } else {
    SFX.defeat();
    ui.announce('DEFEAT', '#ff6b6b');
  }
  setTimeout(() => {
    ui.showGameOver(winner, stats, 0);
    stopAmbient();
  }, 2000);
};

game.onEvent = (evt) => {
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
      if (evt.player === 0) {
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
      const screen = evt.player === 0
        ? worldToScreen(0.5, 1, game.getMap().gridHeight / 2)
        : worldToScreen(game.getMap().gridWidth * 2 + 1.5, 1, game.getMap().gridHeight / 2);
      if (screen) ui.spawnDamageNumber(screen.x, screen.y, evt.amount, 'base');
      break;
    }
    case 'stun': {
      particles.emitBurst(evt.x, 0.5, evt.z, 0x88ccff, 5);
      break;
    }
  }
};

// ========== UI CALLBACKS ==========
ui.onStartGame = (name) => {
  resumeAudio();
  startAmbient();

  // Clear old state
  towerRenderer.towerMeshes.forEach((mesh, id) => {
    scene.remove(mesh);
  });
  towerRenderer.towerMeshes.clear();
  troopRenderer.clear();
  particles.clear();
  mapRenderer.clear();

  // Start game
  game.startGame();

  // Build map
  const map = game.getMap();
  mapRenderer.setCurrentMap(map);
  mapRenderer.buildMap(map);
  sceneSetup.setCameraForMap(map);

  ui.showHUD();
  ui.updateCardHand(game.getPlayerHand());
  ui.updateSpawnButtons(map.pathCount);
};

ui.onTowerSelect = (type) => {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh = null;
  }
  // Clear tower info when selecting a new tower type
  ui.hideTowerInfo();
  // Show range preview
  towerRenderer.rangeIndicators.forEach((_, id) => towerRenderer.removeRangeIndicator(id));
};

ui.onCardSelect = (cardId) => {
  // Show spawn selector
};

ui.onSpawnSelect = (pathIdx) => {
  if (ui.selectedCard !== null) {
    const success = game.playCard(ui.selectedCard, pathIdx);
    if (success) {
      SFX.cardPlay();
      ui.selectedCard = null;
      ui.updateCardHand(game.getPlayerHand());
    }
  }
};

ui.onUpgrade = (towerId, branch) => {
  const tower = game.upgradeTower(towerId, branch);
  if (tower) {
    SFX.build();
    // Rebuild tower mesh
    const pos = mapRenderer.gridToWorld(tower.gridX, tower.gridY, 0);
    towerRenderer.removeTower(towerId);
    towerRenderer.createTowerMesh(tower, pos.x, pos.z);
    ui.showTowerInfo(tower);
  }
};

ui.onSell = (towerId) => {
  const tower = game.towers.getTower(towerId);
  if (!tower) return;
  const refund = game.sellTower(towerId);
  if (refund > 0) {
    SFX.sell();
    towerRenderer.removeTower(towerId);
    towerRenderer.removeRangeIndicator(towerId);
  }
};

ui.onTargeting = (towerId, mode) => {
  game.towers.setTargeting(towerId, mode);
};

// ========== MOUSE INPUT ==========
canvas.addEventListener('click', (e) => {
  if (game.state !== GAME_STATES.PLAYING) return;

  const worldPos = sceneSetup.getWorldPosition(e.clientX, e.clientY);
  if (!worldPos) return;

  const grid = mapRenderer.getGridAtWorld(worldPos.x, worldPos.z);

  // Build phase: place tower
  if (game.getPhase() === PHASES.BUILD && ui.selectedTowerType && grid && grid.player === 0) {
    const tower = game.placeTower(ui.selectedTowerType, grid.gridX, grid.gridY);
    if (tower) {
      SFX.build();
      const pos = mapRenderer.gridToWorld(grid.gridX, grid.gridY, 0);
      towerRenderer.createTowerMesh(tower, pos.x, pos.z);
    }
  }

  // Click on existing tower to show info
  if (grid && grid.player === 0) {
    const playerTowers = game.getPlayerTowers();
    const clickedTower = playerTowers.find(t => t.gridX === grid.gridX && t.gridY === grid.gridY);
    if (clickedTower && !ui.selectedTowerType) {
      ui.showTowerInfo(clickedTower);
      const def = TOWER_TYPES[clickedTower.type];
      towerRenderer.showRangeIndicator(
        clickedTower.id,
        grid.worldX, grid.worldZ,
        clickedTower.range,
        def.color
      );
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

  if (game.getPhase() === PHASES.BUILD && ui.selectedTowerType && grid && grid.player === 0) {
    const isOccupied = game.towers.isCellOccupied(0, grid.gridX, grid.gridY);
    const isBuildable = game.getBuildableSquares().some(s => s.x === grid.gridX && s.y === grid.gridY);
    const color = (!isOccupied && isBuildable) ? 0x6bcb77 : 0xff6b6b;
    mapRenderer.highlightGrid(grid.gridX, grid.gridY, 0, color);

    // Range preview
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

// Right click to deselect
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ui.deselectTower();
  ui.hideTowerInfo();
  ui.selectedCard = null;
  ui.hideSpawnSelector();
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
  // Sync AI tower meshes
  const allTowers = [...game.getPlayerTowers(), ...game.getEnemyTowers()];
  for (const tower of allTowers) {
    if (!towerRenderer.towerMeshes.has(tower.id)) {
      const pos = mapRenderer.gridToWorld(tower.gridX, tower.gridY, tower.player);
      towerRenderer.createTowerMesh(tower, pos.x, pos.z);
    }
  }

  // Remove meshes for sold towers
  const towerIds = new Set(allTowers.map(t => t.id));
  for (const [id] of towerRenderer.towerMeshes) {
    if (!towerIds.has(id)) {
      towerRenderer.removeTower(id);
    }
  }
}

// ========== GAME LOOP ==========
function gameLoop(time) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((time - lastTime) / 1000, 0.05); // cap delta
  lastTime = time;

  // Update game
  game.update(dt);

  if (game.state === GAME_STATES.PLAYING) {
    // Update UI
    ui.updateHUD({
      p1Hp: game.getBaseHp(0),
      p2Hp: game.getBaseHp(1),
      round: game.getRound(),
      phase: game.getPhase(),
      timer: game.getPhaseTimer(),
      gold: game.getGold(),
      income: game.getIncome(),
    });
    ui.updateTowerButtons(game.getGold());

    // Update renderers
    const allTroops = game.getAllTroops();
    towerRenderer.update(dt, allTroops);
    troopRenderer.update(dt, allTroops);
    particles.updateProjectiles(game.getProjectiles());
    particles.update(dt);

    // Sync tower meshes (for AI builds)
    syncTowerMeshes();

    // Update card hand during combat
    if (game.getPhase() === PHASES.COMBAT) {
      ui.updateCardHand(game.getPlayerHand());
    }

    // Camera smooth return after shake
    const map = game.getMap();
    const targetX = (map.gridWidth * 2 + 2) / 2;
    const targetZ = map.gridHeight / 2 + 10;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
  }

  // Render
  sceneSetup.render();
}

// Start
requestAnimationFrame(gameLoop);
