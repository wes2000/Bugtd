import { TOWER_TYPES, SELL_REFUND_RATE } from '../data/towers.js';

let nextTowerId = 1;

export class TowerManager {
  constructor() {
    this.towers = []; // all towers for both players
  }

  reset() {
    this.towers = [];
    nextTowerId = 1;
  }

  placeTower(playerIdx, type, gridX, gridY) {
    const def = TOWER_TYPES[type];
    if (!def) return null;

    const tower = {
      id: nextTowerId++,
      player: playerIdx,
      type,
      gridX,
      gridY,
      level: 1,
      branch: null, // 'a' or 'b' at level 2
      targeting: 'first',
      totalInvested: def.cost,
      kills: 0,
      totalDamage: 0,
      // Combat state
      attackCooldown: 0,
      currentTarget: null,
      // Computed stats (refresh on upgrade)
      ...this._getStats(type, 1, null)
    };

    this.towers.push(tower);
    return tower;
  }

  _getStats(type, level, branch) {
    const def = TOWER_TYPES[type];
    if (level === 2 && branch) {
      const upg = def.upgrades[branch];
      return {
        range: upg.range ?? def.range,
        damage: upg.damage ?? def.damage,
        attackSpeed: upg.attackSpeed ?? def.attackSpeed,
        splashRadius: upg.splashRadius ?? def.splashRadius ?? 0,
        canTargetAir: upg.canTargetAir ?? def.canTargetAir,
        damageType: upg.damageType ?? def.damageType,
        slowAmount: upg.slowAmount ?? def.slowAmount ?? 0,
        slowDuration: upg.slowDuration ?? def.slowDuration ?? 0,
        stunChance: upg.stunChance ?? 0,
        stunDuration: upg.stunDuration ?? 0,
        isAura: upg.isAura ?? false,
        goldPerTick: upg.goldPerTick ?? 0,
        bountyMultiplier: upg.bountyMultiplier ?? 1,
        bountyRadius: upg.bountyRadius ?? 0,
        burnDamage: upg.burnDamage ?? 0,
        burnDuration: upg.burnDuration ?? 0,
        projectileCount: upg.projectileCount ?? 1,
        isPiercing: upg.isPiercing ?? false,
        poisonDamage: upg.poisonDamage ?? 0,
        poisonDuration: upg.poisonDuration ?? 0,
        isBuffTower: upg.isBuffTower ?? false,
        buffRadius: upg.buffRadius ?? 0,
        damageBuffAmount: upg.damageBuffAmount ?? 0,
        speedBuffAmount: upg.speedBuffAmount ?? 0,
      };
    }
    return {
      range: def.range,
      damage: def.damage,
      attackSpeed: def.attackSpeed,
      splashRadius: def.splashRadius ?? 0,
      canTargetAir: def.canTargetAir,
      damageType: def.damageType,
      slowAmount: def.slowAmount ?? 0,
      slowDuration: def.slowDuration ?? 0,
      stunChance: 0,
      stunDuration: 0,
      isAura: false,
      goldPerTick: def.goldPerTick ?? 0,
      bountyMultiplier: 1,
      bountyRadius: 0,
      burnDamage: 0,
      burnDuration: 0,
      projectileCount: 1,
      isPiercing: false,
      poisonDamage: 0,
      poisonDuration: 0,
      isBuffTower: false,
      buffRadius: 0,
      damageBuffAmount: 0,
      speedBuffAmount: 0,
    };
  }

  upgradeTower(towerId, branch) {
    const tower = this.towers.find(t => t.id === towerId);
    if (!tower || tower.level >= 2) return null;

    const def = TOWER_TYPES[tower.type];
    const upg = def.upgrades[branch];
    if (!upg) return null;

    tower.level = 2;
    tower.branch = branch;
    tower.totalInvested += upg.cost;

    // Refresh stats
    const stats = this._getStats(tower.type, 2, branch);
    Object.assign(tower, stats);

    return tower;
  }

  sellTower(towerId) {
    const idx = this.towers.findIndex(t => t.id === towerId);
    if (idx === -1) return 0;
    const tower = this.towers[idx];
    const refund = Math.floor(tower.totalInvested * SELL_REFUND_RATE);
    this.towers.splice(idx, 1);
    return refund;
  }

  getTower(towerId) {
    return this.towers.find(t => t.id === towerId);
  }

  getPlayerTowers(playerIdx) {
    return this.towers.filter(t => t.player === playerIdx);
  }

  isCellOccupied(playerIdx, gridX, gridY) {
    return this.towers.some(t => t.player === playerIdx && t.gridX === gridX && t.gridY === gridY);
  }

  setTargeting(towerId, mode) {
    const tower = this.towers.find(t => t.id === towerId);
    if (tower) tower.targeting = mode;
  }

  // Get buff multipliers from nearby Buff Totem towers
  getBuffMultipliers(tower) {
    let dmgMult = 1;
    let spdMult = 1;
    for (const t of this.towers) {
      if (t.id === tower.id) continue;
      if (t.player !== tower.player) continue;
      if (!t.isBuffTower) continue;
      const dx = t.gridX - tower.gridX;
      const dy = t.gridY - tower.gridY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= t.buffRadius) {
        dmgMult += t.damageBuffAmount;
        spdMult += t.speedBuffAmount;
      }
    }
    return { dmgMult, spdMult };
  }

  // Get bounty multiplier from nearby Bounty Hunter towers
  getBountyMultiplier(tower) {
    let mult = 1;
    for (const t of this.towers) {
      if (t.id === tower.id) continue;
      if (t.player !== tower.player) continue;
      if (t.bountyMultiplier > 1 && t.bountyRadius > 0) {
        const dx = t.gridX - tower.gridX;
        const dy = t.gridY - tower.gridY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= t.bountyRadius) {
          mult = Math.max(mult, t.bountyMultiplier);
        }
      }
    }
    return mult;
  }
}
