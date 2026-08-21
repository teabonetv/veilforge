/** ~100 diaries riding the quest-req engine. */
import { SKILLS } from "./catalog.js";

function killsMonster(id, count, name, tier) {
  return { id: `kill-${id}-${count}`, name, tier, req: [{ type: "kills-monster", id, count }], reward: { title: name } };
}

export function buildAchievements() {
  const list = [];
  list.push(
    { id: "first-blood", name: "First Blood", tier: 1, req: [{ type: "stat", key: "kills", count: 1 }], reward: { title: "Dock Rat" } },
    { id: "mite-knight", name: "Mite Knight", tier: 2, req: [{ type: "kills-monster", id: "cinder-docks-ash-mite", count: 100 }], reward: { title: "Mite Knight" } },
    { id: "hundred-kills", name: "Red Ledger", tier: 2, req: [{ type: "stat", key: "kills", count: 100 }], reward: { title: "Red Ledger" } },
    { id: "thousand-kills", name: "The Tally", tier: 3, req: [{ type: "stat", key: "kills", count: 1000 }], reward: { title: "The Tally" } },
    { id: "chop-100", name: "Grove Hand", tier: 1, req: [{ type: "action", id: "timber-0", count: 100 }], reward: { title: "Grove Hand" } },
    { id: "chop-1000", name: "Choir Feller", tier: 2, req: [{ type: "action", id: "timber-0", count: 1000 }], reward: { title: "Choir Feller" } },
    { id: "cook-50", name: "Third-Watch Cook", tier: 1, req: [{ type: "action", id: "cook-0", count: 50 }], reward: { title: "Third-Watch Cook" } },
    { id: "vault-clear", name: "Vault Walker", tier: 2, req: [{ type: "dungeon", id: "dock-vault" }], reward: { title: "Vault Walker" } },
    { id: "last-page", name: "Last Page", tier: 3, req: [{ type: "dungeon", id: "the-last-page" }], reward: { title: "Last Page" } },
    { id: "echo-5", name: "Five Descents", tier: 2, req: [{ type: "echo-depth", count: 5 }], reward: { title: "Echo Walker" } },
    { id: "echo-15", name: "Fifteen Descents", tier: 3, req: [{ type: "echo-depth", count: 15 }], reward: { title: "Echo Warden" } },
    { id: "pet-one", name: "A Quiet Friend", tier: 2, req: [{ type: "pets", count: 1 }], reward: { title: "Keeper" } },
    { id: "pet-all", name: "Full Menagerie", tier: 3, req: [{ type: "pets", count: 22 }], reward: { title: "Menagerie" } },
    { id: "log-25", name: "Quarter Remembered", tier: 2, req: [{ type: "log-pct", count: 25 }], reward: { title: "Scribe" } },
    { id: "log-50", name: "Half the Citadel", tier: 3, req: [{ type: "log-pct", count: 50 }], reward: { title: "Archivist" } },
    { id: "log-100", name: "The Whole Dusk", tier: 3, req: [{ type: "log-pct", count: 100 }], reward: { title: "The Whole Dusk" } },
    { id: "bounty-10", name: "Contract Hand", tier: 1, req: [{ type: "bounty", count: 10 }], reward: { title: "Contract Hand" } },
    { id: "bounty-50", name: "Slayer Desk", tier: 2, req: [{ type: "bounty", count: 50 }], reward: { title: "Slayer Desk" } },
    { id: "chain-1", name: "Linked Hunt", tier: 2, req: [{ type: "stat", key: "chains", count: 1 }], reward: { title: "Linked" } },
    { id: "chain-10", name: "Chain Warden", tier: 3, req: [{ type: "stat", key: "chains", count: 10 }], reward: { title: "Chain Warden" } },
    { id: "renew-1", name: "First Rite", tier: 3, req: [{ type: "renewals", count: 1 }], reward: { title: "Renewed" } },
    { id: "hardcore-live", name: "Still Standing", tier: 3, req: [{ type: "mode", id: "hardcore" }, { type: "stat", key: "kills", count: 50 }], reward: { title: "Still Standing" } },
    { id: "iron-path", name: "Wanderer's Path", tier: 2, req: [{ type: "mode", id: "iron" }], reward: { title: "Self-Made" } },
    { id: "deaths-0-100kills", name: "Unscarred", tier: 3, req: [{ type: "stat", key: "kills", count: 100 }, { type: "deaths-at-most", count: 0 }], reward: { title: "Unscarred" } },
    { id: "bank-rich", name: "Fat Purse", tier: 2, req: [{ type: "coins", count: 50000 }], reward: { title: "Fat Purse" } },
    { id: "bank-legend", name: "Citadel Treasury", tier: 3, req: [{ type: "coins", count: 1000000 }], reward: { title: "Treasury" } },
    { id: "mastery-50", name: "Seasoned Chop", tier: 2, req: [{ type: "mastery", id: "timber-0", count: 50 }], reward: { title: "Seasoned" } },
    { id: "mastery-100", name: "Legend Chop", tier: 3, req: [{ type: "mastery", id: "timber-0", count: 100 }], reward: { title: "Legend" } },
    { id: "seal-5", name: "Five Pages", tier: 1, req: [{ type: "quests-done", count: 5 }], reward: { title: "Page Five" } },
    { id: "seal-all", name: "The Sealed Book", tier: 3, req: [{ type: "quests-done", count: 20 }], reward: { title: "Sealed Book" } }
  );

  SKILLS.forEach((sk, i) => {
    list.push({
      id: `lv-${sk.id}-50`,
      name: `${sk.name} Fifty`,
      tier: 2,
      req: [{ type: "level", skill: sk.id, level: 50 }],
      reward: { title: `${sk.name} Adept` }
    });
    list.push({
      id: `lv-${sk.id}-99`,
      name: `${sk.name} Ninety-Nine`,
      tier: 3,
      req: [{ type: "level", skill: sk.id, level: 99 }],
      reward: { title: `${sk.name} Crown` }
    });
    if (i < 8) {
      list.push({
        id: `act-${sk.id}-500`,
        name: `${sk.name} Five Hundred`,
        tier: 2,
        req: [{ type: "skill-actions", skill: sk.id, count: 500 }],
        reward: { title: `${sk.name} Hand` }
      });
    }
  });

  const areas = [
    ["cinder-docks", "Cinder Docks", 50],
    ["lantern-sewers", "Lantern Sewers", 50],
    ["ashfen", "Ashfen", 40]
  ];
  for (const [id, name, n] of areas) {
    list.push({
      id: `area-${id}`,
      name: `${name} Sweep`,
      tier: 2,
      req: [{ type: "kills", area: name, count: n }],
      reward: { title: `${name} Sweep` }
    });
  }

  while (list.length < 100) {
    const n = list.length + 1;
    list.push({
      id: `diary-${n}`,
      name: `Diary ${n}`,
      tier: 1 + (n % 3),
      req: [{ type: "stat", key: "actions", count: 20 * n }],
      reward: { title: `Page ${n}` }
    });
  }
  return list.slice(0, 100);
}

export const ACHIEVEMENTS = buildAchievements();
