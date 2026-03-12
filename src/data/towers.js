export const TOWER_TYPES = {
  chomper: {
    name: 'Chomper',
    emoji: '🟢',
    color: 0x6bcb77,
    cost: 15,
    range: 3.0,
    damage: 8,
    attackSpeed: 1.0, // attacks per second
    projectileSpeed: 8,
    splashRadius: 0,
    canTargetAir: true,
    damageType: 'projectile',
    description: 'Single-target DPS. Bites bugs with enthusiasm.',
    upgrades: {
      a: {
        name: 'Sniper Fang',
        cost: 25,
        range: 5.0,
        damage: 22,
        attackSpeed: 0.5,
        damageType: 'instant',
        description: 'Long range, high damage, slow attack.',
      },
      b: {
        name: 'Rapid Nibbler',
        cost: 20,
        range: 2.2,
        damage: 5,
        attackSpeed: 3.0,
        damageType: 'projectile',
        description: 'Short range, rapid fire.',
      }
    }
  },
  splorch: {
    name: 'Splorch',
    emoji: '🔴',
    color: 0xff6b6b,
    cost: 20,
    range: 3.5,
    damage: 6,
    attackSpeed: 0.7,
    projectileSpeed: 5,
    splashRadius: 1.2,
    canTargetAir: true,
    damageType: 'projectile',
    description: 'Splash AOE damage. Spits explosive globs.',
    upgrades: {
      a: {
        name: 'Magma Belch',
        cost: 30,
        range: 3.5,
        damage: 8,
        attackSpeed: 0.6,
        splashRadius: 1.8,
        burnDamage: 3, // DPS
        burnDuration: 3,
        description: 'Larger splash, burn DOT.',
      },
      b: {
        name: 'Scatter Shot',
        cost: 25,
        range: 3.5,
        damage: 4,
        attackSpeed: 0.8,
        splashRadius: 0.8,
        projectileCount: 3,
        description: 'Fires 3 smaller globs.',
      }
    }
  },
  freezlick: {
    name: 'Freezlick',
    emoji: '🔵',
    color: 0x4d96ff,
    cost: 15,
    range: 2.8,
    damage: 2,
    attackSpeed: 0.8,
    slowAmount: 0.4, // 40% slow
    slowDuration: 2.0,
    canTargetAir: false,
    damageType: 'instant',
    description: 'Slows enemies with its tongue.',
    upgrades: {
      a: {
        name: 'Brain Freeze',
        cost: 25,
        range: 3.0,
        damage: 3,
        attackSpeed: 0.7,
        slowAmount: 0.5,
        slowDuration: 2.5,
        stunChance: 0.25,
        stunDuration: 1.0,
        description: 'Chance to stun for 1s.',
      },
      b: {
        name: 'Icy Aura',
        cost: 30,
        range: 2.5,
        damage: 1,
        attackSpeed: 0, // aura
        slowAmount: 0.3,
        isAura: true,
        description: 'Passive slow field, no targeting needed.',
      }
    }
  },
  goldbug: {
    name: 'Goldbug',
    emoji: '🟡',
    color: 0xffd93d,
    cost: 20,
    range: 0,
    damage: 0,
    attackSpeed: 0,
    goldPerTick: 2, // gold per 3 seconds
    canTargetAir: false,
    damageType: 'none',
    description: 'Generates passive gold income.',
    upgrades: {
      a: {
        name: 'Hoarder',
        cost: 20,
        goldPerTick: 5,
        description: 'Generates much more gold.',
      },
      b: {
        name: 'Bounty Hunter',
        cost: 25,
        goldPerTick: 0,
        bountyMultiplier: 2.0,
        bountyRadius: 2.5,
        description: 'Doubles kill bounty for adjacent towers.',
      }
    }
  },
  hexling: {
    name: 'Hexling',
    emoji: '🟣',
    color: 0x9b59b6,
    cost: 20,
    range: 3.2,
    damage: 5,
    attackSpeed: 0.8,
    canTargetAir: true,
    damageType: 'instant',
    debuffType: 'weaken', // 15% more damage taken
    debuffAmount: 0.15,
    debuffDuration: 3.0,
    description: 'Light damage + debuff. Curses bugs.',
    upgrades: {
      a: {
        name: 'Poison Hex',
        cost: 30,
        range: 3.5,
        damage: 3,
        attackSpeed: 0.6,
        damageType: 'projectile',
        isPiercing: true,
        poisonDamage: 4,
        poisonDuration: 4,
        description: 'Piercing DOT, damages all in a line.',
      },
      b: {
        name: 'Buff Totem',
        cost: 35,
        range: 0,
        damage: 0,
        attackSpeed: 0,
        buffRadius: 3.0,
        damageBuffAmount: 0.25,
        speedBuffAmount: 0.2,
        isBuffTower: true,
        description: 'Boosts nearby tower damage & speed.',
      }
    }
  }
};

export const TARGETING_MODES = ['first', 'strongest', 'closest', 'weakest'];

export const SELL_REFUND_RATE = 0.6;
