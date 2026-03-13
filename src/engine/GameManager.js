import { MAPS, getRandomMap, calculateBuildableSquares } from '../data/maps.js';
import { TOWER_TYPES } from '../data/towers.js';
import { TROOP_TYPES } from '../data/troops.js';
import { EconomyManager } from './EconomyManager.js';
import { TowerManager } from './TowerManager.js';
import { TroopManager } from './TroopManager.js';
import { CardManager } from './CardManager.js';
import { CombatResolver } from './CombatResolver.js';

const BUILD_PHASE_DURATION = 120; // 2 minutes, or until both sides ready

const COMBAT_TIMING = [
  25, // round 1-3
  25,
  25,
  35, // round 4-6
  35,
  35,
  40, // round 7-9
  40,
  40,
  50, // round 10-12
  50,
  50,
  55, // round 13-15
  55,
  55,
  60, // overtime
];

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
};

export const PHASES = {
  BUILD: 'build',
  COUNTDOWN: 'countdown',
  COMBAT: 'combat',
  ROUND_END: 'roundEnd',
};

export class GameManager {
  constructor() {
    this.economy = new EconomyManager();
    this.towers = new TowerManager();
    this.troops = new TroopManager();
    this.cards = new CardManager();
    this.combat = new CombatResolver(this.towers, this.troops, this.economy);

    this.state = GAME_STATES.MENU;
    this.phase = PHASES.BUILD;
    this.round = 0;
    this.maxRounds = 15;
    this.phaseTimer = 0;

    this.baseHp = [100, 100];
    this.totalBaseDamage = [0, 0]; // damage dealt TO each player's base

    this.mapKey = null;
    this.map = null;
    this.buildableSquares = [[], []]; // for each player
    this.playerPaths = [[], []]; // paths for each player's attackers

    // AI state
    this.aiCardTimer = 0;
    this.aiTowerTimer = 0;

    // Ready state for build phase
    this.readyState = [false, false]; // player 0, player 1 (AI)

    // Event callbacks
    this.onPhaseChange = null;
    this.onRoundChange = null;
    this.onBaseHit = null;
    this.onGameOver = null;
    this.onAnnounce = null;
    this.onEvent = null;
    this.onReadyChange = null;

    // Stats
    this.stats = {
      troopsSent: [0, 0],
      troopsKilled: [0, 0],
      towersBuilt: [0, 0],
      goldEarned: [0, 0],
      goldSpent: [0, 0],
      baseDamageDealt: [0, 0],
    };
  }

  startGame() {
    // Reset everything
    this.economy.reset();
    this.towers.reset();
    this.troops.reset();
    this.cards.reset();
    this.combat.reset();

    this.baseHp = [100, 100];
    this.totalBaseDamage = [0, 0];
    this.round = 0;
    this.state = GAME_STATES.PLAYING;

    // Pick random map
    this.mapKey = getRandomMap();
    this.map = MAPS[this.mapKey];

    // Calculate buildable squares for each player
    const buildable = calculateBuildableSquares(this.map);
    this.buildableSquares[0] = buildable;
    // Player 1's grid is mirrored
    this.buildableSquares[1] = buildable.map(s => ({
      x: this.map.gridWidth - 1 - s.x,
      y: s.y
    }));

    // Set up paths
    // Player 0's attackers go through player 1's territory (right side)
    // Player 1's attackers go through player 0's territory (left side)
    this._setupPaths();

    // Start first round
    this._startRound();
  }

  _setupPaths() {
    const map = this.map;
    const halfWidth = map.gridWidth;

    // Each troop follows the FULL path: own territory → cross divider → enemy territory
    // Rendered left-side coords:  x = p.x + 1  (goes base→divider)
    // Rendered right-side coords: x = (halfWidth - p.x) + halfWidth + 2  (goes base→divider)

    // Player 0: follow left-side path (own, base→divider) then right-side path reversed (enemy, divider→base)
    this.playerPaths[0] = map.paths.map(path => {
      const ownSide = path.map(p => ({ x: p.x + 1, y: p.y }));
      const enemySide = path.map(p => ({
        x: (halfWidth - p.x) + halfWidth + 2,
        y: p.y
      }));
      enemySide.reverse(); // divider → P2 base
      return [...ownSide, ...enemySide];
    });

    // Player 1: follow right-side path (own, base→divider) then left-side path reversed (enemy, divider→base)
    this.playerPaths[1] = map.paths.map(path => {
      const ownSide = path.map(p => ({
        x: (halfWidth - p.x) + halfWidth + 2,
        y: p.y
      }));
      const enemySide = path.map(p => ({ x: p.x + 1, y: p.y }));
      enemySide.reverse(); // divider → P1 base
      return [...ownSide, ...enemySide];
    });
  }

  _startRound() {
    this.round++;
    if (this.round > this.maxRounds) {
      this._endGame();
      return;
    }

    this.economy.setIncomeForRound(this.round);
    this.phase = PHASES.BUILD;
    this.readyState = [false, false];

    this.phaseTimer = BUILD_PHASE_DURATION;

    // Draw cards
    this.cards.drawCards(0, this.round);
    this.cards.drawCards(1, this.round);

    if (this.onRoundChange) this.onRoundChange(this.round);
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
    if (this.onAnnounce) this.onAnnounce(`Round ${this.round}`);
  }

  _startCountdown() {
    this.phase = PHASES.COUNTDOWN;
    this.phaseTimer = 3;
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
    if (this.onAnnounce) this.onAnnounce('FIGHT!');
  }

  _startCombat() {
    this.phase = PHASES.COMBAT;
    this.phaseTimer = COMBAT_TIMING[Math.min(this.round - 1, COMBAT_TIMING.length - 1)];
    this.aiCardTimer = 0;
    this.combat.reset();

    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  _endRound() {
    this.phase = PHASES.ROUND_END;
    this.phaseTimer = 2;

    // Clear remaining troops
    this.troops.troops = [];

    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  _endGame() {
    this.state = GAME_STATES.GAME_OVER;
    let winner;
    if (this.baseHp[0] <= 0) winner = 1;
    else if (this.baseHp[1] <= 0) winner = 0;
    else winner = this.baseHp[0] >= this.baseHp[1] ? 0 : 1;

    this.stats = {
      troopsSent: [...this.troops.troopsSent],
      troopsKilled: [...this.troops.troopsKilled],
      towersBuilt: [
        this.towers.getPlayerTowers(0).length,
        this.towers.getPlayerTowers(1).length,
      ],
      goldEarned: [...this.economy.totalEarned],
      goldSpent: [...this.economy.totalSpent],
      baseDamageDealt: [...this.totalBaseDamage],
    };

    if (this.onGameOver) this.onGameOver(winner, this.stats);
  }

  update(dt) {
    if (this.state !== GAME_STATES.PLAYING) return;

    // Update phase timer
    this.phaseTimer -= dt;

    // Phase transitions
    if (this.phaseTimer <= 0) {
      switch (this.phase) {
        case PHASES.BUILD:
          this._startCountdown();
          return;
        case PHASES.COUNTDOWN:
          this._startCombat();
          return;
        case PHASES.COMBAT:
          this._endRound();
          return;
        case PHASES.ROUND_END:
          this._startRound();
          return;
      }
    }

    // Update economy (passive gold trickle)
    this.economy.update(dt);

    // Goldbug gold generation (runs during ALL phases, not just combat)
    this._updateGoldTowers(dt);

    // During combat, update troops and combat
    if (this.phase === PHASES.COMBAT) {
      // Update troops
      this.troops.update(dt,
        // onReachBase
        (troop, damage) => {
          // Troop was sent by its owner to attack the OTHER player
          const targetPlayer = 1 - troop.owner;
          this.baseHp[targetPlayer] = Math.max(0, this.baseHp[targetPlayer] - damage);
          this.totalBaseDamage[troop.owner] += damage;

          if (this.onBaseHit) this.onBaseHit(targetPlayer, damage);
          if (this.onEvent) this.onEvent({
            type: 'base_damage',
            player: targetPlayer,
            amount: damage,
          });

          // Check for KO
          if (this.baseHp[targetPlayer] <= 0) {
            this._endGame();
          }
        },
        // onDeath
        (troop) => {
          if (this.onEvent) this.onEvent({
            type: 'troop_death',
            troopType: troop.type,
            x: troop.x, z: troop.z,
            color: troop.color,
          });
        },
        // onBugFight
        (a, b) => {
          if (this.onEvent) this.onEvent({
            type: 'bug_fight',
            x: (a.x + b.x) / 2,
            z: (a.z + b.z) / 2,
          });
        }
      );

      // Update combat (towers shooting, projectiles)
      this.combat.update(dt, this.round);

      // Forward combat events
      const events = this.combat.getEvents();
      for (const evt of events) {
        if (this.onEvent) this.onEvent(evt);
      }

      // AI plays cards automatically
      this._updateAI(dt);
    }
  }

  // Player 0 actions
  placeTower(type, gridX, gridY) {
    if (this.phase !== PHASES.BUILD) return null;
    const def = TOWER_TYPES[type];
    if (!def) return null;
    if (!this.economy.canAfford(0, def.cost)) return null;

    // Check buildable
    const isBuildable = this.buildableSquares[0].some(s => s.x === gridX && s.y === gridY);
    if (!isBuildable) return null;
    if (this.towers.isCellOccupied(0, gridX, gridY)) return null;

    this.economy.spendGold(0, def.cost);
    const tower = this.towers.placeTower(0, type, gridX, gridY);
    this._setTowerWorldPos(tower);
    return tower;
  }

  upgradeTower(towerId, branch) {
    if (this.phase !== PHASES.BUILD) return null;
    const tower = this.towers.getTower(towerId);
    if (!tower || tower.player !== 0 || tower.level >= 2) return null;

    const def = TOWER_TYPES[tower.type];
    const upg = def.upgrades[branch];
    if (!upg || !this.economy.canAfford(0, upg.cost)) return null;

    this.economy.spendGold(0, upg.cost);
    return this.towers.upgradeTower(towerId, branch);
  }

  sellTower(towerId) {
    const tower = this.towers.getTower(towerId);
    if (!tower || tower.player !== 0) return 0;
    if (this.phase !== PHASES.BUILD) return 0;

    const refund = this.towers.sellTower(towerId);
    this.economy.addGold(0, refund);
    return refund;
  }

  // Ready up during build phase
  playerReady(playerIdx) {
    if (this.phase !== PHASES.BUILD) return;
    this.readyState[playerIdx] = true;
    // If both ready, skip remaining build time
    if (this.readyState[0] && this.readyState[1]) {
      this.phaseTimer = 0; // will trigger countdown on next update
    }
  }

  playerUnready(playerIdx) {
    if (this.phase !== PHASES.BUILD) return;
    this.readyState[playerIdx] = false;
  }

  isReady(playerIdx) {
    return this.readyState[playerIdx];
  }

  // Queue cards during build phase (just validates the card exists)
  isValidCard(cardId) {
    return this.cards.getHand(0).some(c => c.id === cardId);
  }

  // Deploy queued cards at combat start - called with array of card IDs
  deployQueuedCards(cardIds) {
    const paths = this.playerPaths[0];
    let spawnDelay = 0;

    for (const cardId of cardIds) {
      const card = this.cards.playCard(0, cardId);
      if (!card) continue;

      for (let i = 0; i < card.spawnCount; i++) {
        const delay = spawnDelay;
        setTimeout(() => {
          const pIdx = Math.floor(Math.random() * paths.length);
          const path = paths[pIdx];
          this.troops.spawnTroop(0, card.troopType, path, card.hpMultiplier, card.isGolden);
        }, delay);
        spawnDelay += 300;
      }
    }

    return cardIds.length > 0;
  }

  playCard(cardId, pathIndex) {
    if (this.phase !== PHASES.COMBAT) return false;
    const card = this.cards.playCard(0, cardId);
    if (!card) return false;

    const paths = this.playerPaths[0];
    const useRandom = pathIndex < 0;

    for (let i = 0; i < card.spawnCount; i++) {
      setTimeout(() => {
        const pIdx = useRandom ? Math.floor(Math.random() * paths.length) : Math.min(pathIndex, paths.length - 1);
        const path = paths[pIdx];
        this.troops.spawnTroop(0, card.troopType, path, card.hpMultiplier, card.isGolden);
      }, i * 300);
    }

    return true;
  }

  // AI logic for player 1
  _updateAI(dt) {
    this.aiCardTimer += dt;

    // AI plays a card every 3-5 seconds during combat
    if (this.aiCardTimer >= 3 + Math.random() * 2) {
      this.aiCardTimer = 0;
      const hand = this.cards.getHand(1);
      if (hand.length > 0) {
        // Pick a random card
        const cardIdx = Math.floor(Math.random() * hand.length);
        const card = this.cards.playCard(1, hand[cardIdx].id);
        if (card) {
          const paths = this.playerPaths[1];
          const pathIdx = Math.floor(Math.random() * paths.length);
          const path = paths[pathIdx];

          for (let i = 0; i < card.spawnCount; i++) {
            setTimeout(() => {
              this.troops.spawnTroop(1, card.troopType, path, card.hpMultiplier, card.isGolden);
            }, i * 300);
          }
        }
      }
    }
  }

  // AI builds towers during build phase then readies up after a delay
  runAIBuildPhase() {
    const aiPlayer = 1;
    const buildable = this.buildableSquares[1];
    const towerTypes = ['chomper', 'splorch', 'freezlick', 'hexling', 'goldbug'];

    // AI tries to build a few towers each round
    let attempts = 3;
    while (attempts > 0 && this.economy.getGold(aiPlayer) >= 15) {
      attempts--;
      const type = towerTypes[Math.floor(Math.random() * towerTypes.length)];
      const def = TOWER_TYPES[type];

      if (!this.economy.canAfford(aiPlayer, def.cost)) continue;

      // Find a random open buildable square
      const openSquares = buildable.filter(s => !this.towers.isCellOccupied(aiPlayer, s.x, s.y));
      if (openSquares.length === 0) break;

      const square = openSquares[Math.floor(Math.random() * openSquares.length)];
      this.economy.spendGold(aiPlayer, def.cost);
      const t = this.towers.placeTower(aiPlayer, type, square.x, square.y);
      this._setTowerWorldPos(t);
    }

    // AI upgrades random towers
    const aiTowers = this.towers.getPlayerTowers(aiPlayer);
    for (const tower of aiTowers) {
      if (tower.level >= 2) continue;
      const def = TOWER_TYPES[tower.type];
      const branch = Math.random() < 0.5 ? 'a' : 'b';
      const upg = def.upgrades[branch];
      if (upg && this.economy.canAfford(aiPlayer, upg.cost)) {
        this.economy.spendGold(aiPlayer, upg.cost);
        this.towers.upgradeTower(tower.id, branch);
      }
    }

    // AI readies up after 3-8 seconds
    const delay = 3000 + Math.random() * 5000;
    setTimeout(() => {
      if (this.phase === PHASES.BUILD) {
        this.playerReady(1);
        if (this.onReadyChange) this.onReadyChange();
      }
    }, delay);
  }

  _gridToWorld(gridX, gridY, playerIdx) {
    const halfWidth = this.map.gridWidth;
    const offset = playerIdx === 0 ? 1 : halfWidth + 2;
    return {
      x: gridX + offset + 0.5,
      z: gridY + 0.5,
    };
  }

  _setTowerWorldPos(tower) {
    const pos = this._gridToWorld(tower.gridX, tower.gridY, tower.player);
    tower.worldX = pos.x;
    tower.worldZ = pos.z;
  }

  _updateGoldTowers(dt) {
    if (!this._goldTickTimers) this._goldTickTimers = {};
    for (const tower of this.towers.towers) {
      if (tower.goldPerTick <= 0) continue;
      if (!this._goldTickTimers[tower.id]) this._goldTickTimers[tower.id] = 0;
      this._goldTickTimers[tower.id] += dt;
      if (this._goldTickTimers[tower.id] >= 3.0) {
        this._goldTickTimers[tower.id] -= 3.0;
        this.economy.addGold(tower.player, tower.goldPerTick);
        if (this.onEvent) this.onEvent({
          type: 'gold',
          x: tower.worldX, z: tower.worldZ,
          amount: tower.goldPerTick,
          player: tower.player,
        });
      }
    }
  }

  getMap() { return this.map; }
  getMapKey() { return this.mapKey; }
  getPhase() { return this.phase; }
  getRound() { return this.round; }
  getPhaseTimer() { return Math.max(0, Math.ceil(this.phaseTimer)); }
  getBaseHp(playerIdx) { return this.baseHp[playerIdx]; }
  getGold() { return this.economy.getGold(0); }
  getIncome() {
    // Base income + goldbug income (goldPerTick every 3s = goldPerTick/3 per second)
    const baseIncome = this.economy.getIncome(0);
    let goldTowerIncome = 0;
    for (const tower of this.towers.getPlayerTowers(0)) {
      if (tower.goldPerTick > 0) {
        goldTowerIncome += tower.goldPerTick / 3;
      }
    }
    return +(baseIncome + goldTowerIncome).toFixed(1);
  }
  getPlayerHand() { return this.cards.getHand(0); }
  getPlayerTowers() { return this.towers.getPlayerTowers(0); }
  getEnemyTowers() { return this.towers.getPlayerTowers(1); }
  getAllTroops() { return this.troops.troops; }
  getProjectiles() { return this.combat.getProjectiles(); }
  getBuildableSquares() { return this.buildableSquares[0]; }
}
