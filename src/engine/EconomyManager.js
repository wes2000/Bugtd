export class EconomyManager {
  constructor() {
    this.gold = [100, 100]; // player 0 and 1
    this.totalEarned = [0, 0];
    this.totalSpent = [0, 0];
    this.goldPerSecond = [2, 2];
    this.lastTickTime = 0;
    this.tickInterval = 1.0; // seconds
  }

  reset() {
    this.gold = [100, 100];
    this.totalEarned = [0, 0];
    this.totalSpent = [0, 0];
    this.goldPerSecond = [2, 2];
  }

  setIncomeForRound(round) {
    let rate = 2;
    if (round >= 10) rate = 6;
    else if (round >= 5) rate = 4;
    this.goldPerSecond = [rate, rate];
  }

  getKillBounty(round, troopType) {
    const baseBounties = {
      ant: 2, beetle: 10, cricket: 3, butterfly: 6, caterpillar: 5, spider: 7
    };
    const base = baseBounties[troopType] || 3;
    let multiplier = 1;
    if (round >= 10) multiplier = 2.0;
    else if (round >= 5) multiplier = 1.5;
    return Math.floor(base * multiplier);
  }

  addGold(playerIdx, amount) {
    this.gold[playerIdx] += amount;
    this.totalEarned[playerIdx] += amount;
  }

  spendGold(playerIdx, amount) {
    if (this.gold[playerIdx] >= amount) {
      this.gold[playerIdx] -= amount;
      this.totalSpent[playerIdx] += amount;
      return true;
    }
    return false;
  }

  canAfford(playerIdx, amount) {
    return this.gold[playerIdx] >= amount;
  }

  update(dt) {
    this.lastTickTime += dt;
    if (this.lastTickTime >= this.tickInterval) {
      this.lastTickTime -= this.tickInterval;
      for (let i = 0; i < 2; i++) {
        this.addGold(i, this.goldPerSecond[i]);
      }
      return true; // tick happened
    }
    return false;
  }

  getGold(playerIdx) {
    return Math.floor(this.gold[playerIdx]);
  }

  getIncome(playerIdx) {
    return this.goldPerSecond[playerIdx];
  }
}
