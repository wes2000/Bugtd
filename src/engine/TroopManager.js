import { TROOP_TYPES } from '../data/troops.js';

let nextTroopId = 1;

export class TroopManager {
  constructor() {
    this.troops = [];
    this.troopsSent = [0, 0];
    this.troopsKilled = [0, 0]; // killed by each player's towers
  }

  reset() {
    this.troops = [];
    this.troopsSent = [0, 0];
    this.troopsKilled = [0, 0];
    nextTroopId = 1;
  }

  spawnTroop(ownerPlayer, troopType, path, hpMultiplier = 1.0, isGolden = false) {
    const def = TROOP_TYPES[troopType];
    if (!def) return null;

    const startPos = path[0];
    const troop = {
      id: nextTroopId++,
      owner: ownerPlayer, // the player who SENT this troop (attacker)
      type: troopType,
      maxHp: Math.floor(def.hp * hpMultiplier),
      hp: Math.floor(def.hp * hpMultiplier),
      speed: def.speed,
      baseSpeed: def.speed,
      baseDamage: def.baseDamage,
      isFlying: def.isFlying,
      isGolden,
      // Position along path
      x: startPos.x,
      y: 0.3, // height
      z: startPos.y,
      pathIndex: 0,
      pathProgress: 0,
      path: path,
      reachedEnd: false,
      dead: false,
      // Status effects
      slowAmount: 0,
      slowTimer: 0,
      stunTimer: 0,
      burnDamage: 0,
      burnTimer: 0,
      burnTickTimer: 0,
      poisonDamage: 0,
      poisonTimer: 0,
      poisonTickTimer: 0,
      shieldHp: 0,
      invulnTimer: 0,
      weakenAmount: 0,
      weakenTimer: 0,
      // Ability cooldown
      abilityCooldown: 0,
      abilityActive: false,
      abilityTimer: 0,
      // Visual
      color: def.color,
      scale: troopType === 'beetle' ? 0.5 : troopType === 'ant' ? 0.2 : 0.3,
    };

    this.troops.push(troop);
    this.troopsSent[ownerPlayer]++;
    return troop;
  }

  update(dt, onReachBase, onDeath) {
    for (const troop of this.troops) {
      if (troop.dead || troop.reachedEnd) continue;

      // Update status effects
      this._updateStatusEffects(troop, dt);

      // Stunned troops don't move
      if (troop.stunTimer > 0) continue;
      // Invulnerable dash
      if (troop.invulnTimer > 0) {
        troop.invulnTimer -= dt;
      }

      // Calculate effective speed
      let speed = troop.baseSpeed;
      if (troop.slowAmount > 0 && troop.slowTimer > 0) {
        speed *= (1 - troop.slowAmount);
      }
      // Apply rally boost or other speed buffs
      if (troop.abilityActive && troop.type === 'ant') {
        // Rally is applied to nearby ants externally
      }
      troop.speed = speed;

      // Move along path
      this._moveAlongPath(troop, dt * speed);

      // Check if reached end
      if (troop.reachedEnd && onReachBase) {
        const dmgPercent = troop.hp / troop.maxHp;
        const damage = Math.max(1, Math.floor(troop.baseDamage * dmgPercent));
        onReachBase(troop, damage);
      }

      // Update abilities
      this._updateAbility(troop, dt);

      // DOT damage
      this._applyDOTs(troop, dt);

      // Check death
      if (troop.hp <= 0) {
        troop.dead = true;
        if (onDeath) onDeath(troop);
      }
    }

    // Clean up dead/reached troops
    this.troops = this.troops.filter(t => !t.dead && !t.reachedEnd);
  }

  _moveAlongPath(troop, dist) {
    const path = troop.path;
    if (troop.pathIndex >= path.length - 1) {
      troop.reachedEnd = true;
      return;
    }

    let remaining = dist;
    while (remaining > 0 && troop.pathIndex < path.length - 1) {
      const current = path[troop.pathIndex];
      const next = path[troop.pathIndex + 1];
      const dx = next.x - current.x;
      const dz = next.y - current.y;
      const segLen = Math.sqrt(dx * dx + dz * dz);

      const distToEnd = segLen * (1 - troop.pathProgress);

      if (remaining >= distToEnd) {
        remaining -= distToEnd;
        troop.pathIndex++;
        troop.pathProgress = 0;
        if (troop.pathIndex >= path.length - 1) {
          troop.reachedEnd = true;
          // Set final position
          const endPt = path[path.length - 1];
          troop.x = endPt.x;
          troop.z = endPt.y;
          return;
        }
      } else {
        troop.pathProgress += remaining / segLen;
        remaining = 0;
      }
    }

    // Interpolate position
    if (troop.pathIndex < path.length - 1) {
      const a = path[troop.pathIndex];
      const b = path[troop.pathIndex + 1];
      troop.x = a.x + (b.x - a.x) * troop.pathProgress;
      troop.z = a.y + (b.y - a.y) * troop.pathProgress;
    }
  }

  _updateStatusEffects(troop, dt) {
    if (troop.slowTimer > 0) troop.slowTimer -= dt;
    if (troop.stunTimer > 0) troop.stunTimer -= dt;
    if (troop.weakenTimer > 0) troop.weakenTimer -= dt;
    else troop.weakenAmount = 0;
  }

  _applyDOTs(troop, dt) {
    // Burn
    if (troop.burnTimer > 0) {
      troop.burnTickTimer += dt;
      if (troop.burnTickTimer >= 0.5) {
        troop.burnTickTimer -= 0.5;
        troop.hp -= troop.burnDamage * 0.5;
      }
      troop.burnTimer -= dt;
    }
    // Poison
    if (troop.poisonTimer > 0) {
      troop.poisonTickTimer += dt;
      if (troop.poisonTickTimer >= 0.5) {
        troop.poisonTickTimer -= 0.5;
        troop.hp -= troop.poisonDamage * 0.5;
      }
      troop.poisonTimer -= dt;
    }
  }

  _updateAbility(troop, dt) {
    const def = TROOP_TYPES[troop.type];
    if (!def.ability) return;

    if (troop.abilityCooldown > 0) {
      troop.abilityCooldown -= dt;
      return;
    }

    // Auto-trigger abilities
    switch (troop.type) {
      case 'caterpillar':
        // Passive regen
        if (troop.hp < troop.maxHp) {
          troop.hp = Math.min(troop.maxHp, troop.hp + def.ability.healAmount);
        }
        troop.abilityCooldown = def.ability.cooldown;
        break;

      case 'beetle':
        // Shell Up when there are towers nearby (simplified: just use on cooldown)
        troop.abilityActive = true;
        troop.abilityTimer = def.ability.duration;
        troop.abilityCooldown = def.ability.cooldown;
        break;

      case 'cricket':
        // Leap forward
        this._moveAlongPath(troop, def.ability.dashDistance);
        troop.invulnTimer = def.ability.invulnDuration;
        troop.abilityCooldown = def.ability.cooldown;
        break;

      case 'spider':
        // Web Shield to self and nearby allies
        troop.shieldHp = def.ability.shieldAmount;
        // Apply to nearby troops
        for (const other of this.troops) {
          if (other.id === troop.id || other.dead || other.owner !== troop.owner) continue;
          const dx = other.x - troop.x;
          const dz = other.z - troop.z;
          if (Math.sqrt(dx * dx + dz * dz) <= def.ability.radius) {
            other.shieldHp = Math.max(other.shieldHp, def.ability.shieldAmount);
          }
        }
        troop.abilityCooldown = def.ability.cooldown;
        break;

      case 'ant':
        // Rally nearby ants
        for (const other of this.troops) {
          if (other.type !== 'ant' || other.dead || other.owner !== troop.owner) continue;
          const dx = other.x - troop.x;
          const dz = other.z - troop.z;
          if (Math.sqrt(dx * dx + dz * dz) <= def.ability.radius) {
            other.baseSpeed = TROOP_TYPES.ant.speed * (1 + def.ability.speedBoost);
            // Reset after duration (simplified)
            setTimeout(() => {
              if (!other.dead) other.baseSpeed = TROOP_TYPES.ant.speed;
            }, def.ability.duration * 1000);
          }
        }
        troop.abilityCooldown = def.ability.cooldown;
        break;

      case 'butterfly':
        // Pixie Dust - handled in combat resolver
        troop.abilityActive = true;
        troop.abilityTimer = def.ability.duration;
        troop.abilityCooldown = def.ability.cooldown;
        break;
    }
  }

  // Apply damage to a troop, considering shields and damage reduction
  applyDamage(troop, damage) {
    if (troop.dead || troop.invulnTimer > 0) return 0;

    let actualDamage = damage;

    // Weaken debuff
    if (troop.weakenAmount > 0 && troop.weakenTimer > 0) {
      actualDamage *= (1 + troop.weakenAmount);
    }

    // Beetle Shell Up
    if (troop.abilityActive && troop.type === 'beetle') {
      actualDamage *= (1 - TROOP_TYPES.beetle.ability.damageReduction);
    }

    // Shield absorbs first
    if (troop.shieldHp > 0) {
      if (troop.shieldHp >= actualDamage) {
        troop.shieldHp -= actualDamage;
        return 0;
      } else {
        actualDamage -= troop.shieldHp;
        troop.shieldHp = 0;
      }
    }

    troop.hp -= actualDamage;
    return actualDamage;
  }

  getTroopsForPlayer(attackerIdx) {
    return this.troops.filter(t => t.owner === attackerIdx);
  }

  getActiveTroopCount() {
    return this.troops.length;
  }
}
