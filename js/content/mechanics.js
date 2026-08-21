export const MECHANICS = {
  curse: {
    tell: "lays a dusk curse",
    counter: "vial",
    apply(state) {
      /* A live combat draught braces you: shorter curse, softer tax. */
      const braced = !!state._mechBraced;
      const dur = braced ? 4000 : 8000;
      state.combat.curse = Math.max(state.combat.curse || 0, Math.ceil(dur / 1000));
      state.combat.curseUntil = (state.now || 0) + dur;
      state.combat.takenMul = braced ? 1.08 : 1.18;
      if (braced) state.combat.curseBraced = true;
    }
  },
  phase: {
    tell: "shifts its veil",
    counter: "wait",
    apply(state, m) {
      if (state.combat.phased) return;
      state.combat.phased = true;
      captureMechBase(m);
      /* Phase sharpens the foe; it never rewinds its wounds. */
      state.combat.monsterHp = Math.min(
        state.combat.monsterHp,
        Math.max(1, Math.floor((state.combat.monsterMaxHp || m.hp) * 0.5))
      );
      m.acc = Math.floor(m.acc * 1.35);
      m.maxHit = Math.floor(m.maxHit * 1.2);
    }
  },
  guard: {
    tell: "raises a veilward — swap style",
    counter: "style",
    apply(state) {
      state.combat.guardUntil = (state.now || 0) + 8000;
      /* combat.js stamps guardStyle from the held weapon's live style. */
    }
  },
  enrage: {
    tell: "the dusk boils — enrage",
    counter: "burst",
    apply(state, m) {
      if (state.combat.enraged) return;
      state.combat.enraged = true;
      captureMechBase(m);
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

function captureMechBase(m) {
  if (!m || m._mechBase) return;
  m._mechBase = { acc: m.acc, maxHit: m.maxHit, interval: m.interval };
}

/* Undo every mechanic stat mutation on a catalog monster. */
export function restoreMech(m) {
  if (m && m._mechBase) {
    Object.assign(m, m._mechBase);
    delete m._mechBase;
  }
}

export function mechanicOf(m) {
  const spec = m?.mechanic;
  if (!spec) return null;
  const type = spec.type || spec.kind;
  return MECHANICS[type] ? { ...MECHANICS[type], ...spec, type } : null;
}
