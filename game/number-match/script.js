(() => {
  const root = document.querySelector("[data-number-match]");
  if (!root) return;

  const UNLOCK_KEY = "number_match_level2_unlocked_v3";
  const LEVELS = {
    demo: {
      id: "demo",
      label: "LV0 Demo",
      columns: 4,
      rows: 4,
      demo: true,
    },
    classic: {
      id: "classic",
      label: "8 x 8",
      columns: 8,
      rows: 8,
      seed: 8080,
      openingPairs: 3,
      shufflePasses: 2600,
    },
    compact: {
      id: "compact",
      label: "20 x 20",
      columns: 20,
      rows: 20,
      seed: 20200,
      openingPairs: 14,
      shufflePasses: 7200,
    },
  };
  const MAX_HINTS = 3;
  const DEMO_STEPS = [
    {
      title: "(a) 1 + 1 相同",
      prompt: "LV0-1：先点击相邻的两个 1。相同数字可以消除。",
      nudge: "提示：这一步只练习相同数字，请点带光圈的两个 1。",
      success: "正确：两个相同的 1 已消除。",
      cells: [1, 1, null, 8, null, 5, null, null, 3, null, 2, null, null, null, null, 9],
      target: [0, 1],
      path: [0, 1],
    },
    {
      title: "(b) 4 + 6 = 10",
      prompt: "LV0-2：现在点击 4 和 6。两个数字相加等于 10 可以消除。",
      nudge: "提示：找 4 和 6，它们合计为 10。",
      success: "正确：4 + 6 = 10。",
      cells: [4, 6, null, 1, null, 8, null, null, 7, null, 2, null, null, null, 5, 9],
      target: [0, 1],
      path: [0, 1],
    },
    {
      title: "(c) 一次拐弯",
      prompt: "LV0-3：点击 3 和 7。它们会先走到空格拐点，再转向连接。",
      nudge: "提示：选左侧的 3，再选下方的 7；中间的路径和拐点要是空格。",
      success: "正确：一次拐弯路径也可以消除。",
      cells: [2, null, null, 9, 3, null, null, 5, 8, 4, null, 6, 1, 2, 7, 4],
      target: [4, 14],
      path: [4, 5, 6, 10, 14],
      corner: 6,
    },
  ];

  const selectors = {
    board: root.querySelector("#nmBoard"),
    fxLayer: root.querySelector("#nmFxLayer"),
    score: root.querySelector("#nmScore"),
    pairs: root.querySelector("#nmPairs"),
    left: root.querySelector("#nmLeft"),
    rows: root.querySelector("#nmRows"),
    mode: root.querySelector("#nmMode"),
    moves: root.querySelector("#nmMoves"),
    best: root.querySelector("#nmBest"),
    status: root.querySelector("#nmStatus"),
    restart: root.querySelector("#nmRestart"),
    hint: root.querySelector("#nmHint"),
    next: root.querySelector("#nmNext"),
    levelButtons: Array.from(root.querySelectorAll("[data-level]")),
  };

  const state = {
    levelId: "demo",
    cells: [],
    nextId: 1,
    selectedId: null,
    removingIds: new Set(),
    animating: false,
    score: 0,
    pairs: 0,
    moves: 0,
    hintsLeft: 0,
    hintedIds: new Set(),
    demoStep: 0,
    status: "Pick a pair.",
    statusTone: "",
    completed: false,
    gameOver: false,
    level2Unlocked: readLevel2Unlock(),
  };

  function makeRng(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function shuffled(items, rng) {
    const next = items.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const temp = next[i];
      next[i] = next[j];
      next[j] = temp;
    }
    return next;
  }

  function createStartCells(level) {
    const rng = makeRng(level.seed);
    const arranged = makeConflictAvoidingValues(level, rng);
    const fixed = injectOpeningPairs(arranged, level, rng);
    const finalValues = pickHardestShuffle(arranged, level, rng, fixed);

    return finalValues.map((value) => ({
      id: state.nextId++,
      value,
      removed: false,
    }));
  }

  function createDemoCells(step) {
    return step.cells.map((value) => ({
      id: state.nextId++,
      value,
      removed: value === null,
    }));
  }

  function makeConflictAvoidingValues(level, rng) {
    const values = Array(level.columns * level.rows).fill(0);
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    for (let index = 0; index < values.length; index += 1) {
      const ranked = shuffled(digits, rng)
        .map((value) => ({ value, score: localConflictScore(values, index, value, level) }))
        .sort((left, right) => left.score - right.score);
      const bestScore = ranked[0].score;
      const best = ranked.filter((item) => item.score === bestScore);
      values[index] = best[Math.floor(rng() * best.length)].value;
    }

    return values;
  }

  function makeHardArrangement(values, level, rng) {
    const remaining = shuffled(values, rng);
    const arranged = Array(level.columns * level.rows).fill(0);

    for (let index = 0; index < arranged.length; index += 1) {
      let bestAt = 0;
      let bestScore = Infinity;
      const attempts = Math.min(remaining.length, 18);

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidateAt = Math.floor(rng() * remaining.length);
        const value = remaining[candidateAt];
        const score = localConflictScore(arranged, index, value, level);
        if (score < bestScore) {
          bestAt = candidateAt;
          bestScore = score;
          if (score === 0) break;
        }
      }

      arranged[index] = remaining.splice(bestAt, 1)[0];
    }

    return arranged;
  }

  function localConflictScore(values, index, value, level) {
    const row = Math.floor(index / level.columns);
    const col = index % level.columns;
    const checks = [
      index - 1,
      index - level.columns,
      index - level.columns - 1,
      index - level.columns + 1,
    ];
    let score = 0;

    for (const otherIndex of checks) {
      if (otherIndex < 0 || otherIndex >= values.length) continue;
      const otherRow = Math.floor(otherIndex / level.columns);
      const otherCol = otherIndex % level.columns;
      const isReadingNeighbor = otherIndex === index - 1;
      const isGridNeighbor = Math.abs(otherRow - row) <= 1 && Math.abs(otherCol - col) <= 1;
      if (!isReadingNeighbor && !isGridNeighbor) continue;
      if (valuesMatchRaw(value, values[otherIndex])) score += isReadingNeighbor ? 3 : 2;
    }

    return score;
  }

  function injectOpeningPairs(values, level, rng) {
    const edges = shuffled(candidateOpeningEdges(level), rng);
    const matchPairs = [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5], [7, 7], [8, 8], [9, 9]];
    const used = new Set();
    let placed = 0;

    for (const [left, right] of edges) {
      if (placed >= level.openingPairs) break;
      if (used.has(left) || used.has(right)) continue;
      const pair = matchPairs[Math.floor(rng() * matchPairs.length)];
      const ordered = rng() > 0.5 ? pair : [pair[1], pair[0]];
      values[left] = ordered[0];
      values[right] = ordered[1];
      used.add(left);
      used.add(right);
      placed += 1;
    }

    return used;
  }

  function candidateOpeningEdges(level) {
    const edges = [];
    for (let row = 0; row < level.rows; row += 1) {
      for (let col = 0; col < level.columns; col += 1) {
        const index = row * level.columns + col;
        if (col + 1 < level.columns) edges.push([index, index + 1]);
        if (row + 1 < level.rows) edges.push([index, index + level.columns]);
        if (row + 1 < level.rows && col + 1 < level.columns) edges.push([index, index + level.columns + 1]);
        if (row + 1 < level.rows && col - 1 >= 0) edges.push([index, index + level.columns - 1]);
      }
    }
    for (let index = level.columns; index < level.columns * level.rows; index += level.columns) {
      edges.push([index - 1, index]);
    }
    return edges;
  }

  function pickHardestShuffle(values, level, rng, fixed) {
    let best = values.slice();
    let bestScore = initialMatchScore(best, level);
    let current = best.slice();
    let currentScore = bestScore;
    const movable = values
      .map((_, index) => index)
      .filter((index) => !fixed.has(index));
    const targetScore = level.openingPairs + (level.columns >= 20 ? 5 : 1);

    for (let pass = 0; pass < level.shufflePasses; pass += 1) {
      const candidate = current.slice();
      if (rng() < 0.72) {
        const index = movable[Math.floor(rng() * movable.length)];
        candidate[index] = 1 + Math.floor(rng() * 9);
      } else {
        const left = movable[Math.floor(rng() * movable.length)];
        const right = movable[Math.floor(rng() * movable.length)];
        if (left === right) continue;
        const temp = candidate[left];
        candidate[left] = candidate[right];
        candidate[right] = temp;
      }
      const score = initialMatchScore(candidate, level);

      if (score <= currentScore || rng() < 0.012) {
        current = candidate;
        currentScore = score;
      }

      if (score > 0 && score < bestScore) {
        best = candidate;
        bestScore = score;
        if (bestScore <= targetScore) break;
      }
    }

    return best;
  }

  function initialMatchScore(values, level) {
    let score = 0;
    for (const [left, right] of candidateOpeningEdges(level)) {
      if (valuesMatchRaw(values[left], values[right])) score += 1;
    }
    return score;
  }

  function startLevel(levelId) {
    const level = LEVELS[levelId] || LEVELS.classic;
    if (level.id === "compact" && !state.level2Unlocked) {
      setStatus("Clear Level 1 to unlock Level 2.", "is-warn");
      render();
      return;
    }

    state.levelId = level.id;
    state.demoStep = 0;
    state.cells = level.demo ? createDemoCells(DEMO_STEPS[0]) : createStartCells(level);
    state.selectedId = null;
    state.removingIds = new Set();
    state.hintedIds = new Set();
    state.animating = false;
    state.score = 0;
    state.pairs = 0;
    state.moves = 0;
    state.hintsLeft = level.demo ? 0 : MAX_HINTS;
    state.completed = false;
    state.gameOver = false;
    if (level.demo) {
      setStatus(DEMO_STEPS[0].prompt, "");
    } else {
      setStatus(level.id === "classic" ? "Clear Level 1 to unlock Level 2." : "Level 2 is a 20 x 20 board.", "");
    }
    render();
  }

  function activeLevel() {
    return LEVELS[state.levelId] || LEVELS.classic;
  }

  function activeCount() {
    let count = 0;
    for (const cell of state.cells) {
      if (!cell.removed) count += 1;
    }
    return count;
  }

  function rowCount() {
    return activeLevel().rows;
  }

  function isActiveIndex(index) {
    const cell = state.cells[index];
    return Boolean(cell && !cell.removed);
  }

  function cellIndexById(id) {
    return state.cells.findIndex((cell) => cell.id === id);
  }

  function valuesMatch(left, right) {
    return valuesMatchRaw(left.value, right.value);
  }

  function valuesMatchRaw(left, right) {
    return left === right || left + right === 10;
  }

  function hasReadingPath(leftIndex, rightIndex) {
    const start = Math.min(leftIndex, rightIndex);
    const end = Math.max(leftIndex, rightIndex);
    for (let index = start + 1; index < end; index += 1) {
      if (isActiveIndex(index)) return false;
    }
    return true;
  }

  function hasGridPath(leftIndex, rightIndex) {
    const level = activeLevel();
    const leftRow = Math.floor(leftIndex / level.columns);
    const leftCol = leftIndex % level.columns;
    const rightRow = Math.floor(rightIndex / level.columns);
    const rightCol = rightIndex % level.columns;
    const rowDelta = rightRow - leftRow;
    const colDelta = rightCol - leftCol;
    const aligned = rowDelta === 0 || colDelta === 0 || Math.abs(rowDelta) === Math.abs(colDelta);
    if (!aligned) return false;

    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);
    let row = leftRow + rowStep;
    let col = leftCol + colStep;

    while (row !== rightRow || col !== rightCol) {
      const index = row * level.columns + col;
      if (index < 0 || index >= state.cells.length) return false;
      if (isActiveIndex(index)) return false;
      row += rowStep;
      col += colStep;
    }

    return true;
  }

  function oneTurnPath(leftIndex, rightIndex) {
    const level = activeLevel();
    const leftRow = Math.floor(leftIndex / level.columns);
    const leftCol = leftIndex % level.columns;
    const rightRow = Math.floor(rightIndex / level.columns);
    const rightCol = rightIndex % level.columns;
    const corners = [
      leftRow * level.columns + rightCol,
      rightRow * level.columns + leftCol,
    ];

    for (const corner of corners) {
      if (corner === leftIndex || corner === rightIndex) continue;
      if (corner < 0 || corner >= state.cells.length) continue;
      if (isActiveIndex(corner)) continue;
      if (hasClearOrthogonalSegment(leftIndex, corner) && hasClearOrthogonalSegment(corner, rightIndex)) {
        return [leftIndex, corner, rightIndex];
      }
    }

    return null;
  }

  function hasClearOrthogonalSegment(startIndex, endIndex) {
    const level = activeLevel();
    const startRow = Math.floor(startIndex / level.columns);
    const startCol = startIndex % level.columns;
    const endRow = Math.floor(endIndex / level.columns);
    const endCol = endIndex % level.columns;

    if (startRow === endRow) {
      const from = Math.min(startCol, endCol) + 1;
      const to = Math.max(startCol, endCol);
      for (let col = from; col < to; col += 1) {
        if (isActiveIndex(startRow * level.columns + col)) return false;
      }
      return true;
    }

    if (startCol === endCol) {
      const from = Math.min(startRow, endRow) + 1;
      const to = Math.max(startRow, endRow);
      for (let row = from; row < to; row += 1) {
        if (isActiveIndex(row * level.columns + startCol)) return false;
      }
      return true;
    }

    return false;
  }

  function getMatchPath(leftIndex, rightIndex) {
    if (hasGridPath(leftIndex, rightIndex) || hasReadingPath(leftIndex, rightIndex)) {
      return [leftIndex, rightIndex];
    }

    return oneTurnPath(leftIndex, rightIndex);
  }

  function hasOpenPath(leftIndex, rightIndex) {
    return Boolean(getMatchPath(leftIndex, rightIndex));
  }

  function canMatch(leftIndex, rightIndex) {
    if (leftIndex === rightIndex) return false;
    const left = state.cells[leftIndex];
    const right = state.cells[rightIndex];
    if (!left || !right || left.removed || right.removed) return false;
    return valuesMatch(left, right) && hasOpenPath(leftIndex, rightIndex);
  }

  function countMatches(limit = Infinity) {
    let count = 0;
    for (let left = 0; left < state.cells.length; left += 1) {
      if (!isActiveIndex(left)) continue;
      for (let right = left + 1; right < state.cells.length; right += 1) {
        if (!isActiveIndex(right)) continue;
        if (canMatch(left, right)) {
          count += 1;
          if (count >= limit) return count;
        }
      }
    }
    return count;
  }

  function clearedRows() {
    const level = activeLevel();
    let count = 0;
    for (let row = 0; row < level.rows; row += 1) {
      const start = row * level.columns;
      const rowCells = state.cells.slice(start, start + level.columns);
      if (rowCells.length > 0 && rowCells.every((cell) => cell.removed)) count += 1;
    }
    return count;
  }

  function handleCellClick(id) {
    if (state.gameOver || state.animating) return;
    const level = activeLevel();
    const index = cellIndexById(id);
    const cell = state.cells[index];
    if (!cell || cell.removed) return;

    if (state.selectedId === null) {
      state.selectedId = id;
      setStatus(level.demo ? "已选中 " + cell.value + "。继续按提示选择第二个数字。" : "One selected.", "");
      render();
      return;
    }

    if (state.selectedId === id) {
      state.selectedId = null;
      setStatus("Selection cleared.", "");
      render();
      return;
    }

    const selectedIndex = cellIndexById(state.selectedId);
    if (level.demo && !isDemoTargetPair(selectedIndex, index)) {
      state.selectedId = id;
      setStatus(activeDemoStep().nudge, "is-warn");
      render();
      return;
    }

    if (canMatch(selectedIndex, index)) {
      removePair(selectedIndex, index);
      return;
    }

    state.selectedId = id;
    setStatus(level.demo ? activeDemoStep().nudge : "Pair blocked. New number selected.", "is-warn");
    render();
  }

  function activeDemoStep() {
    return DEMO_STEPS[state.demoStep] || DEMO_STEPS[DEMO_STEPS.length - 1];
  }

  function isDemoTargetPair(leftIndex, rightIndex) {
    const target = activeDemoStep().target;
    return target.includes(leftIndex) && target.includes(rightIndex);
  }

  function removePair(leftIndex, rightIndex) {
    const beforeRows = clearedRows();
    const left = state.cells[leftIndex];
    const right = state.cells[rightIndex];
    const path = getMatchPath(leftIndex, rightIndex) || [leftIndex, rightIndex];
    state.animating = true;
    state.removingIds = new Set([left.id, right.id]);
    state.hintedIds = new Set();
    state.selectedId = null;
    setStatus("Connection made.", "is-good");
    render();
    window.requestAnimationFrame(() => drawConnection(path));

    window.setTimeout(() => {
      finishRemovePair(left.id, right.id, beforeRows);
    }, 300);
  }

  function finishRemovePair(leftId, rightId, beforeRows) {
    const leftIndex = cellIndexById(leftId);
    const rightIndex = cellIndexById(rightId);
    const left = state.cells[leftIndex];
    const right = state.cells[rightIndex];

    if (!left || !right || left.removed || right.removed) {
      state.animating = false;
      state.removingIds = new Set();
      clearConnection();
      render();
      return;
    }

    left.removed = true;
    right.removed = true;
    state.removingIds = new Set();
    state.animating = false;
    state.pairs += 1;
    state.moves += 1;

    const rowBonus = Math.max(0, clearedRows() - beforeRows) * 20;
    const gained = 10 + left.value + right.value + rowBonus;
    state.score += gained;
    if (activeLevel().demo) {
      advanceDemoStep();
      render();
      return;
    }

    updateBest();

    if (activeCount() === 0) {
      completeLevel(gained);
    } else if (countMatches(1) === 0) {
      state.gameOver = true;
      setStatus("No pairs remain. Restart the level.", "is-warn");
    } else if (rowBonus > 0) {
      setStatus("Line clear bonus. Score +" + gained + ".", "is-good");
    } else {
      setStatus("Pair removed. Score +" + gained + ".", "is-good");
    }

    render();
  }

  function advanceDemoStep() {
    const step = activeDemoStep();

    if (state.demoStep >= DEMO_STEPS.length - 1) {
      state.completed = true;
      state.gameOver = true;
      setStatus(step.success + " LV0 完成，进入 Level 1 开始正式挑战。", "is-done");
      return;
    }

    state.demoStep += 1;
    state.cells = createDemoCells(activeDemoStep());
    state.selectedId = null;
    setStatus(step.success + " 下一条提示：" + activeDemoStep().prompt, "is-good");
  }

  function findFirstMatch() {
    for (let left = 0; left < state.cells.length; left += 1) {
      if (!isActiveIndex(left)) continue;
      for (let right = left + 1; right < state.cells.length; right += 1) {
        if (!isActiveIndex(right)) continue;
        if (canMatch(left, right)) {
          return {
            left,
            right,
            path: getMatchPath(left, right) || [left, right],
          };
        }
      }
    }
    return null;
  }

  function useHint() {
    if (activeLevel().demo || state.gameOver || state.animating) return;

    if (state.hintsLeft <= 0) {
      setStatus("No hints left for this run.", "is-warn");
      render();
      return;
    }

    const match = findFirstMatch();
    if (!match) {
      setStatus("No available pair found. Restart the level.", "is-warn");
      render();
      return;
    }

    const left = state.cells[match.left];
    const right = state.cells[match.right];
    state.hintsLeft -= 1;
    state.hintedIds = new Set([left.id, right.id]);
    setStatus("提示：试试 " + left.value + " 和 " + right.value + "。剩余 " + state.hintsLeft + " 次。", "is-good");
    render();
    window.requestAnimationFrame(() => drawConnection(match.path));

    const levelId = state.levelId;
    const hintedIds = [left.id, right.id];
    window.setTimeout(() => {
      if (state.levelId !== levelId) return;
      if (!hintedIds.every((id) => state.hintedIds.has(id))) return;
      state.hintedIds = new Set();
      clearConnection();
      render();
    }, 1400);
  }

  function drawConnection(path) {
    if (!selectors.fxLayer) return;
    const points = path.map((index) => cellCenter(index)).filter(Boolean);
    if (points.length < 2) return;

    clearConnection();
    for (let index = 0; index < points.length - 1; index += 1) {
      drawConnectionSegment(points[index], points[index + 1], index);
    }
  }

  function cellCenter(index) {
    const node = selectors.board.querySelector(`[data-cell="${index}"]`);
    if (!node || !selectors.fxLayer) return null;
    const wrapRect = selectors.fxLayer.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    return {
      x: nodeRect.left + nodeRect.width / 2 - wrapRect.left,
      y: nodeRect.top + nodeRect.height / 2 - wrapRect.top,
    };
  }

  function drawConnectionSegment(start, end, index) {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;

    const line = document.createElement("div");
    line.className = "nm-connection-line";
    line.style.width = length + "px";
    line.style.animationDelay = index * 45 + "ms";
    line.style.transform = `translate(${start.x}px, ${start.y}px) rotate(${angle}deg)`;
    selectors.fxLayer.appendChild(line);
  }

  function clearConnection() {
    if (selectors.fxLayer) selectors.fxLayer.innerHTML = "";
  }

  function completeLevel(gained) {
    state.completed = true;
    state.gameOver = true;

    if (state.levelId === "classic") {
      state.level2Unlocked = true;
      writeLevel2Unlock();
      setStatus("Level 1 clear. Level 2 unlocked.", "is-done");
      return;
    }

    setStatus("Level clear. Score +" + gained + ".", "is-done");
  }

  function updateBest() {
    const key = bestKey();
    const best = Math.max(readBest(), state.score);
    try {
      window.localStorage.setItem(key, String(best));
    } catch {
      /* ignore */
    }
  }

  function bestKey() {
    return "number_match_best_" + state.levelId;
  }

  function readBest() {
    try {
      return Number(window.localStorage.getItem(bestKey()) || 0);
    } catch {
      return 0;
    }
  }

  function readLevel2Unlock() {
    try {
      return window.localStorage.getItem(UNLOCK_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeLevel2Unlock() {
    try {
      window.localStorage.setItem(UNLOCK_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function setStatus(message, tone) {
    state.status = message;
    state.statusTone = tone || "";
  }

  function render() {
    renderLevelButtons();
    if (!state.animating) clearConnection();
    renderBoard();
    renderStats();
    syncGlobals();
  }

  function renderLevelButtons() {
    selectors.levelButtons.forEach((button) => {
      const levelId = button.dataset.level || "classic";
      const selected = levelId === state.levelId;
      const locked = levelId === "compact" && !state.level2Unlocked;
      const label = button.querySelector("span");

      button.classList.toggle("is-active", selected);
      button.classList.toggle("is-locked", locked);
      button.disabled = locked;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.setAttribute("aria-disabled", locked ? "true" : "false");

      if (label) {
        label.textContent = locked ? "Clear Level 1" : LEVELS[levelId].label;
      }
    });
  }

  function renderBoard() {
    const level = activeLevel();
    selectors.board.classList.toggle("is-demo", Boolean(level.demo));
    selectors.board.style.setProperty("--nm-cols", String(level.columns));
    selectors.board.style.setProperty("--nm-board-max", level.demo ? "340px" : level.columns >= 20 ? "980px" : "620px");
    selectors.board.innerHTML = "";
    selectors.board.setAttribute("role", "grid");
    selectors.board.setAttribute("aria-label", level.demo ? "LV0 tutorial grid" : "Number grid");

    state.cells.forEach((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nm-cell";
      button.dataset.cell = String(index);
      button.dataset.id = String(cell.id);
      button.setAttribute("role", "gridcell");

      if (cell.removed) {
        button.classList.add("is-empty");
        button.disabled = true;
        button.setAttribute("aria-label", "Empty");
      } else {
        button.dataset.value = String(cell.value);
        button.textContent = String(cell.value);
        button.setAttribute("aria-label", "Number " + cell.value);
        button.addEventListener("click", () => handleCellClick(cell.id));
      }

      if (state.selectedId === cell.id) button.classList.add("is-selected");
      if (state.removingIds.has(cell.id)) button.classList.add("is-removing");
      if (state.hintedIds.has(cell.id)) button.classList.add("is-hinted");
      if (level.demo && !state.completed) {
        const step = activeDemoStep();
        if (step.path.includes(index)) button.classList.add("is-demo-path");
        if (step.target.includes(index)) button.classList.add("is-demo-goal");
        if (step.corner === index) button.classList.add("is-demo-corner");
      }
      selectors.board.appendChild(button);
    });
  }

  function renderStats() {
    const level = activeLevel();
    if (selectors.hint) {
      selectors.hint.hidden = Boolean(level.demo);
      selectors.hint.disabled = state.gameOver || state.animating || state.hintsLeft <= 0;
      selectors.hint.textContent = "Hint (" + state.hintsLeft + ")";
    }

    if (level.demo) {
      selectors.score.textContent = String(state.score);
      selectors.pairs.textContent = state.pairs + "/" + DEMO_STEPS.length;
      selectors.left.textContent = String(activeCount());
      selectors.rows.textContent = "4 x 4";
      selectors.mode.textContent = level.label;
      selectors.moves.textContent = String(state.moves);
      selectors.best.textContent = "0";
      selectors.next.hidden = !state.completed;
      selectors.next.textContent = "Start Level 1";
      selectors.status.textContent = state.status;
      selectors.status.className = "nm-status" + (state.statusTone ? " " + state.statusTone : "");
      return;
    }

    selectors.score.textContent = String(state.score);
    selectors.pairs.textContent = String(state.pairs);
    selectors.left.textContent = String(activeCount());
    selectors.rows.textContent = String(rowCount());
    selectors.mode.textContent = level.label;
    selectors.moves.textContent = String(state.moves);
    selectors.best.textContent = String(readBest());
    selectors.next.hidden = !(state.completed && state.levelId === "classic");
    selectors.next.textContent = "Next Level";
    selectors.status.textContent = state.status;
    selectors.status.className = "nm-status" + (state.statusTone ? " " + state.statusTone : "");
  }

  function bindEvents() {
    selectors.levelButtons.forEach((button) => {
      button.addEventListener("click", () => startLevel(button.dataset.level || "classic"));
    });
    selectors.restart.addEventListener("click", () => startLevel(state.levelId));
    if (selectors.hint) selectors.hint.addEventListener("click", useHint);
    selectors.next.addEventListener("click", () => startLevel(state.levelId === "demo" ? "classic" : "compact"));
  }

  function syncGlobals() {
    window.score = state.score;
    window.gameOver = state.gameOver;
    window.numberMatch = {
      level: state.levelId,
      score: state.score,
      pairs: state.pairs,
      left: activeCount(),
      moves: state.moves,
      hintsLeft: state.hintsLeft,
      demoStep: activeLevel().demo ? state.demoStep + 1 : 0,
      level2Unlocked: state.level2Unlocked,
      matches: state.gameOver ? 0 : activeLevel().demo ? 1 : countMatches(999),
    };
  }

  bindEvents();
  startLevel("demo");

  window.startGame = () => startLevel(state.levelId);
  window.restartGame = () => startLevel(state.levelId);
  window.updateGame = render;
})();
