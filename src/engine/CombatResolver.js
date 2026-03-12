import { TOWER_TYPES } from '../data/towers.js';

export class CombatResolver {
  constructor(towerManager, troopManager, economyManager) {
    this.towerManager = towerManager;
    this.troopManager = troopManager;
    this.economyManager = economyManager;
    this.projectiles = [];
    this.events = []; // events for rendering (damage numbers, etc.)
    this.goldTickTimers = {}; // for gold-generating towers
  }

  reset() {
    this.projectiles = [];
    this.events = [];
    this.goldTickTimers = {};
  }

  update(dt, round) {
    this.events = [];

    // Update towers
    for (const tower of this.towerManager.towers) {
      this._updateTower(tower, dt, round);
    }

    // Update projectiles
    this._updateProjectiles(dt, round);
  }

  _updateTower(tower, dt, round) {
    // Gold generation is handled by GameManager._updateGoldTowers (runs all phases)
    if (tower.goldPerTick > 0) return;

    // Buff towers don't attack either
    if (tower.isBuffTower) return;

    // Aura towers (Icy Aura) - apply slow to all enemies in range
    if (tower.isAura) {
      const enemyPlayer = tower.player; // towers defend against troops sent by the OTHER player
      // Troops targeting this player's base = troops owned by opponent
      const opponentIdx = 1 - tower.player;
      const troops = this.troopManager.getTroopsForPlayer(opponentIdx);
      for (const troop of troops) {
        if (troop.dead || troop.isFlying) continue;
        const dx = troop.x - tower.gridX;
        const dz = troop.z - tower.gridY;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= tower.range) {
          troop.slowAmount = Math.max(troop.slowAmount, tower.slowAmount);
          troop.slowTimer = Math.max(troop.slowTimer, 0.5);
          // Aura does light damage
          if (tower.damage > 0) {
            this.troopManager.applyDamage(troop, tower.damage * dt);
          }
        }
      }
      return;
    }

    // Attack cooldown
    tower.attackCooldown -= dt;
    if (tower.attackCooldown > 0) return;

    // Get buff multipliers
    const buffs = this.towerManager.getBuffMultipliers(tower);
    const effectiveSpeed = tower.attackSpeed * buffs.spdMult;
    if (effectiveSpeed <= 0) return;

    // Find target - troops sent BY opponent that are attacking this player's side
    const opponentIdx = 1 - tower.player;
    const target = this._findTarget(tower, opponentIdx);
    if (!target) return;

    tower.currentTarget = target.id;
    tower.attackCooldown = 1.0 / effectiveSpeed;

    const effectiveDamage = tower.damage * buffs.dmgMult;

    // Butterfly pixie dust - reduce range
    if (target.abilityActive && target.type === 'butterfly') {
      // Already filtered in findTarget via effective range
    }

    if (tower.damageType === 'instant') {
      this._applyHit(tower, target, effectiveDamage, round);
    } else {
      // Launch projectile
      const count = tower.projectileCount || 1;
      for (let i = 0; i < count; i++) {
        const spreadAngle = count > 1 ? (i - (count - 1) / 2) * 0.3 : 0;
        this.projectiles.push({
          x: tower.gridX,
          y: 0.8,
          z: tower.gridY,
          targetId: target.id,
          targetX: target.x + Math.sin(spreadAngle) * 0.5,
          targetZ: target.z + Math.cos(spreadAngle) * 0.5,
          speed: 8,
          damage: effectiveDamage / count,
          tower: tower,
          splashRadius: tower.splashRadius,
          isPiercing: tower.isPiercing,
          color: TOWER_TYPES[tower.type].color,
          round: round,
        });
      }
    }

    // Tower attack event for animation
    this.events.push({
      type: 'tower_attack',
      towerId: tower.id,
      towerType: tower.type,
      targetId: target.id,
      x: tower.gridX, z: tower.gridY,
    });
  }

  _findTarget(tower, opponentIdx) {
    const troops = this.troopManager.getTroopsForPlayer(opponentIdx);
    let candidates = [];

    // Calculate effective range (may be reduced by butterfly pixie dust)
    let effectiveRange = tower.range;

    for (const troop of troops) {
      if (troop.dead) continue;
      if (troop.isFlying && !tower.canTargetAir) continue;
      if (troop.invulnTimer > 0) continue;

      const dx = troop.x - tower.gridX;
      const dz = troop.z - tower.gridY;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Check for pixie dust range reduction
      let range = effectiveRange;
      if (troop.abilityActive && troop.type === 'butterfly') {
        range *= (1 - 0.4);
      }

      if (dist <= range) {
        candidates.push({ troop, dist });
      }
    }

    if (candidates.length === 0) return null;

    switch (tower.targeting) {
      case 'first':
        // Furthest along path
        candidates.sort((a, b) => {
          const aProgress = a.troop.pathIndex + a.troop.pathProgress;
          const bProgress = b.troop.pathIndex + b.troop.pathProgress;
          return bProgress - aProgress;
        });
        break;
      case 'strongest':
        candidates.sort((a, b) => b.troop.hp - a.troop.hp);
        break;
      case 'closest':
        candidates.sort((a, b) => a.dist - b.dist);
        break;
      case 'weakest':
        candidates.sort((a, b) => a.troop.hp - b.troop.hp);
        break;
    }

    return candidates[0].troop;
  }

  _updateProjectiles(dt, round) {
    const toRemove = [];
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];

      // Find target troop for homing
      const target = this.troopManager.troops.find(t => t.id === proj.targetId && !t.dead);
      if (target) {
        proj.targetX = target.x;
        proj.targetZ = target.z;
      }

      const dx = proj.targetX - proj.x;
      const dz = proj.targetZ - proj.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.3) {
        // Hit!
        if (target) {
          this._applyHit(proj.tower, target, proj.damage, proj.round);

          // Splash damage
          if (proj.splashRadius > 0) {
            const opponentIdx = 1 - proj.tower.player;
            const troops = this.troopManager.getTroopsForPlayer(opponentIdx);
            for (const other of troops) {
              if (other.id === target.id || other.dead) continue;
              const sdx = other.x - target.x;
              const sdz = other.z - target.z;
              if (Math.sqrt(sdx * sdx + sdz * sdz) <= proj.splashRadius) {
                this._applyHit(proj.tower, other, proj.damage * 0.5, proj.round);
              }
            }
          }

          // Piercing - continue through (simplified: just hits extras)
          if (proj.isPiercing) {
            const opponentIdx = 1 - proj.tower.player;
            const troops = this.troopManager.getTroopsForPlayer(opponentIdx);
            for (const other of troops) {
              if (other.id === target.id || other.dead) continue;
              const ldx = other.x - proj.x;
              const ldz = other.z - proj.z;
              if (Math.sqrt(ldx * ldx + ldz * ldz) <= 1.5) {
                this._applyHit(proj.tower, other, proj.damage * 0.7, proj.round);
              }
            }
          }
        }
        toRemove.push(i);
      } else {
        // Move projectile
        const speed = proj.speed * dt;
        proj.x += (dx / dist) * speed;
        proj.z += (dz / dist) * speed;
      }
    }

    // Remove hit projectiles (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.projectiles.splice(toRemove[i], 1);
    }
  }

  _applyHit(tower, troop, damage, round) {
    // Apply slow
    if (tower.slowAmount > 0 && tower.slowDuration > 0) {
      troop.slowAmount = Math.max(troop.slowAmount, tower.slowAmount);
      troop.slowTimer = Math.max(troop.slowTimer, tower.slowDuration);
    }

    // Apply stun
    if (tower.stunChance > 0 && Math.random() < tower.stunChance) {
      troop.stunTimer = Math.max(troop.stunTimer, tower.stunDuration);
      this.events.push({ type: 'stun', x: troop.x, z: troop.z });
    }

    // Apply burn
    if (tower.burnDamage > 0) {
      troop.burnDamage = tower.burnDamage;
      troop.burnTimer = tower.burnDuration;
    }

    // Apply poison
    if (tower.poisonDamage > 0) {
      troop.poisonDamage = tower.poisonDamage;
      troop.poisonTimer = tower.poisonDuration;
    }

    // Apply weaken (Hexling base)
    if (tower.type === 'hexling' && tower.level === 1) {
      troop.weakenAmount = 0.15;
      troop.weakenTimer = 3.0;
    }

    const actualDamage = this.troopManager.applyDamage(troop, damage);
    tower.totalDamage += actualDamage;

    this.events.push({
      type: 'damage',
      x: troop.x, z: troop.z,
      amount: Math.round(actualDamage),
      isBig: actualDamage > 15,
    });

    // Check kill
    if (troop.hp <= 0) {
      troop.dead = true;
      tower.kills++;
      this.troopManager.troopsKilled[tower.player]++;

      // Kill bounty
      const baseBounty = this.economyManager.getKillBounty(round, troop.type);
      const bountyMult = this.towerManager.getBountyMultiplier(tower);
      const bounty = Math.floor(baseBounty * bountyMult);
      this.economyManager.addGold(tower.player, bounty);

      this.events.push({
        type: 'kill',
        troopType: troop.type,
        x: troop.x, z: troop.z,
        bounty,
        player: tower.player,
        color: troop.color,
      });
    }
  }

  getProjectiles() {
    return this.projectiles;
  }

  getEvents() {
    return this.events;
  }
}
