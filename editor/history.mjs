export function createHistory(initial, limit = 80) {
  let states = [initial];
  let cursor = 0;
  return {
    get canUndo() { return cursor > 0; },
    get canRedo() { return cursor < states.length - 1; },
    push(value) {
      if (value === states[cursor]) return false;
      states = states.slice(0, cursor + 1);
      states.push(value);
      if (states.length > limit) states.shift();
      cursor = states.length - 1;
      return true;
    },
    undo() {
      if (cursor === 0) return undefined;
      return states[--cursor];
    },
    redo() {
      if (cursor >= states.length - 1) return undefined;
      return states[++cursor];
    },
    reset(value) {
      states = [value];
      cursor = 0;
    },
  };
}
