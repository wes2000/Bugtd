import { TROOP_TYPES, CARD_RARITY_WEIGHTS, CARDS_PER_DRAW_EARLY, CARDS_PER_DRAW_LATE } from '../data/troops.js';

let nextCardId = 1;

export class CardManager {
  constructor() {
    this.hands = [[], []]; // cards for each player
    this.cardsPlayed = [0, 0];
  }

  reset() {
    this.hands = [[], []];
    this.cardsPlayed = [0, 0];
    nextCardId = 1;
  }

  drawCards(playerIdx, round) {
    const count = round <= 5 ? CARDS_PER_DRAW_EARLY : CARDS_PER_DRAW_LATE;
    const newCards = [];

    for (let i = 0; i < count; i++) {
      const card = this._generateCard();
      card.carriedOver = false;
      newCards.push(card);
    }

    // Mark existing cards as carried over
    for (const card of this.hands[playerIdx]) {
      card.carriedOver = true;
    }

    this.hands[playerIdx].push(...newCards);
    return newCards;
  }

  _generateCard() {
    const roll = Math.random();
    let isGolden = roll < CARD_RARITY_WEIGHTS.golden;

    // Pick troop type by rarity
    const troopKeys = Object.keys(TROOP_TYPES);
    let eligibleTroops;

    if (isGolden) {
      // Golden can be any troop
      eligibleTroops = troopKeys;
    } else {
      const rarityRoll = Math.random();
      let targetRarity;
      if (rarityRoll < 0.45) targetRarity = 'common';
      else if (rarityRoll < 0.75) targetRarity = 'uncommon';
      else targetRarity = 'rare';

      eligibleTroops = troopKeys.filter(k => TROOP_TYPES[k].rarity === targetRarity);
      if (eligibleTroops.length === 0) eligibleTroops = troopKeys;
    }

    const troopKey = eligibleTroops[Math.floor(Math.random() * eligibleTroops.length)];
    const troop = TROOP_TYPES[troopKey];

    return {
      id: nextCardId++,
      troopType: troopKey,
      name: troop.name,
      emoji: troop.emoji,
      spawnCount: troop.spawnCount,
      rarity: isGolden ? 'golden' : troop.rarity,
      isGolden,
      hpMultiplier: isGolden ? 1.25 : 1.0,
      carriedOver: false
    };
  }

  getHand(playerIdx) {
    return this.hands[playerIdx];
  }

  playCard(playerIdx, cardId) {
    const idx = this.hands[playerIdx].findIndex(c => c.id === cardId);
    if (idx === -1) return null;
    const card = this.hands[playerIdx].splice(idx, 1)[0];
    this.cardsPlayed[playerIdx]++;
    return card;
  }

  getHandSize(playerIdx) {
    return this.hands[playerIdx].length;
  }
}
