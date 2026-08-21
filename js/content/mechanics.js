export const MECHANICS = {
  curse: {
    tell: "lays a dusk curse",
    counter: "vial",
    apply(state) {
      state.combat.curse = Math.max(state.combat.curse || 0, 4);
      state.combat.takenMul = 1.18;
    }
  },
  phase: {
    tell: "shifts its veil",
    counter: "wait",
    apply(state, m) {
      if (state.combat.phased) return;
      state.combat.phased = true;
      state.combat.monsterHp = Math.max(1, Math.floor((state.combat.monsterMaxHp || m.hp) * 0.5));
      m._phaseAcc = m.acc;
      m.acc = Math.floor(m.acc * 1.35);
      m.maxHit = Math.floor(m.maxHit * 1.2);
    }
  },
  guard: {
    tell: "raises a veilward — swap style",
    counter: "style",
    apply(state) {
      state.combat.guardUntil = (state.now || 0) + 8000;
      state.combat.guardStyle = state.combat.style;
    }
  },
  enrage: {
    tell: "the dusk boils — enrage",
    counter: "burst",
    apply(state, m) {
      if (state.combat.enraged) return;
      state.combat.enraged = true;
      m.interval = Math.max(900, Math.floor(m.interval * 0.72));
      m.maxHit = Math.floor(m.maxHit * 1.5);
    }
  },
  summon: {
    tell: "calls a remnant add",
    counter: "cleave",
    apply(state) {
      state.combat.addHits = (state.combat.addHits || 0) + 2;
    }
  }
};

export function mechanicOf(m) {
  const spec = m?.mechanic;
  if (!spec) return null;
  const type = spec.type || spec.kind;
  return MECHANICS[type] ? { ...MECHANICS[type], ...spec, type } : null;
}
