export const TROOP_TYPES = {
  ant: {
    name: 'Ant',
    emoji: '🐜',
    color: 0x8B4513,
    hp: 15,
    speed: 2.0,
    baseDamage: 3,
    spawnCount: 5,
    rarity: 'common',
    isFlying: false,
    ability: {
      name: 'Rally',
      description: '+15% speed to nearby ants for 3s',
      cooldown: 8,
      radius: 2.0,
      speedBoost: 0.15,
      duration: 3
    },
    description: 'Tiny, cheap, numerous. Fifty ants are a problem.'
  },
  beetle: {
    name: 'Beetle',
    emoji: '🪲',
    color: 0x2d5016,
    hp: 120,
    speed: 1.0,
    baseDamage: 15,
    spawnCount: 1,
    rarity: 'uncommon',
    isFlying: false,
    ability: {
      name: 'Shell Up',
      description: '50% damage reduction for 3s',
      cooldown: 10,
      damageReduction: 0.5,
      duration: 3
    },
    description: 'Slow, armored, extremely hard to kill.'
  },
  cricket: {
    name: 'Cricket',
    emoji: '🦗',
    color: 0x567d46,
    hp: 25,
    speed: 3.5,
    baseDamage: 5,
    spawnCount: 3,
    rarity: 'common',
    isFlying: false,
    ability: {
      name: 'Leap',
      description: 'Dash forward, briefly untargetable',
      cooldown: 6,
      dashDistance: 2.0,
      invulnDuration: 0.5
    },
    description: 'Blazing fast. Blink and it\'s past your towers.'
  },
  butterfly: {
    name: 'Butterfly',
    emoji: '🦋',
    color: 0xe091d3,
    hp: 30,
    speed: 2.0,
    baseDamage: 8,
    spawnCount: 2,
    rarity: 'rare',
    isFlying: true,
    ability: {
      name: 'Pixie Dust',
      description: 'Reduces tower range briefly',
      cooldown: 12,
      rangeReduction: 0.4,
      duration: 2,
      radius: 2.0
    },
    description: 'Floats above ground. Only some towers can target.'
  },
  caterpillar: {
    name: 'Caterpillar',
    emoji: '🐛',
    color: 0x7cb342,
    hp: 50,
    speed: 1.0,
    baseDamage: 10,
    spawnCount: 1,
    rarity: 'uncommon',
    isFlying: false,
    ability: {
      name: 'Regenerate',
      description: 'Heals 5 HP every 2s (passive)',
      cooldown: 2,
      healAmount: 5,
      isPassive: true
    },
    description: 'Slow but keeps healing. Kill it fast.'
  },
  spider: {
    name: 'Spider',
    emoji: '🕷️',
    color: 0x424242,
    hp: 40,
    speed: 2.0,
    baseDamage: 6,
    spawnCount: 1,
    rarity: 'rare',
    isFlying: false,
    ability: {
      name: 'Web Shield',
      description: '20 HP shield for nearby bugs',
      cooldown: 10,
      shieldAmount: 20,
      radius: 2.0
    },
    description: 'Support unit. Shields itself and nearby bugs.'
  }
};

export const CARD_RARITY_WEIGHTS = {
  common: 0.40,
  uncommon: 0.30,
  rare: 0.20,
  golden: 0.10 // any card but +25% HP
};

export const CARDS_PER_DRAW_EARLY = 4; // rounds 1-5
export const CARDS_PER_DRAW_LATE = 5;  // rounds 6+
