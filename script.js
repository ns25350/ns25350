let currentRows = 0;
let currentCols = 0;
let seatMapGlobal = new Map();

function updateSliderValue(val) {
  document.getElementById('group-size-val').innerText = val;
}

function createMap() {
  const rows = parseInt(document.getElementById('rows').value);
  const cols = parseInt(document.getElementById('cols').value);
  const mapDiv = document.getElementById('seat-map');
  
  currentRows = rows;
  currentCols = cols;
  
  mapDiv.innerHTML = '';
  mapDiv.style.gridTemplateColumns = `repeat(${cols}, 50px)`;
  mapDiv.style.gridTemplateRows = `repeat(${rows}, 50px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.id = `${r}-${c}`;
      seat.innerHTML = `<span class="group-name"></span><span class="seat-count"></span>`;
      seat.onclick = () => {
        seat.classList.toggle('absent');
        seat.querySelector('.group-name').innerText = seat.classList.contains('absent') ? '✖' : '';
        seat.querySelector('.seat-count').innerText = '';
        seat.style.backgroundColor = ''; 
      };
      mapDiv.appendChild(seat);
    }
  }
}

function resetColors() {
  const seats = document.querySelectorAll('.seat:not(.absent)');
  seats.forEach(seat => {
    seat.style.backgroundColor = '';
    seat.style.color = '#000';
    seat.querySelector('.group-name').innerText = '';
    seat.querySelector('.seat-count').innerText = '';
  });
}

function getNeighbors(seat, validSet) {
  let nbs = [];
  let dirs = [[-1,0], [1,0], [0,-1], [0,1]];
  for (let [dr, dc] of dirs) {
    let nid = `${seat.r + dr}-${seat.c + dc}`;
    if (seatMapGlobal.has(nid)) {
      let s = seatMapGlobal.get(nid);
      if (validSet.has(s)) nbs.push(s);
    }
  }
  return nbs;
}

function isConnected(nodes) {
  if (nodes.length <= 1) return true;
  let visited = new Set([nodes[0].id]);
  let queue = [nodes[0]];
  let nodesSet = new Set(nodes.map(n => n.id));

  while (queue.length > 0) {
    let curr = queue.shift();
    let dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    for (let [dr, dc] of dirs) {
      let nid = `${curr.r + dr}-${curr.c + dc}`;
      if (nodesSet.has(nid) && !visited.has(nid)) {
        visited.add(nid);
        queue.push(seatMapGlobal.get(nid));
      }
    }
  }
  return visited.size === nodes.length;
}

function findSplitSizes(n, target) {
  let minS = Math.max(2, target - 1);
  let maxS = target + 1;
  if (n === 0) return [];
  if (n >= minS && n <= maxS) return [n];

  let memo = new Map();
  function dfs(rem) {
    if (rem === 0) return [];
    if (memo.has(rem)) return memo.get(rem);
    if (rem >= minS && rem <= maxS) return [rem];

    for (let step = maxS; step >= minS; step--) {
      if (rem - step >= 0) {
        let res = dfs(rem - step);
        if (res !== null) {
          let ans = [step, ...res];
          memo.set(rem, ans);
          return ans;
        }
      }
    }
    memo.set(rem, null);
    return null;
  }
  return dfs(n);
}

function splitSet(nodes, sizes) {
  if (sizes.length <= 1) return [nodes];
  let s1 = sizes[0];
  let remainingSizes = sizes.slice(1);

  for (let startNode of nodes) {
    let part1 = [startNode];
    let visited = new Set([startNode.id]);
    let queue = [startNode];
    let nodesMap = new Map(nodes.map(n => [n.id, n]));

    while (queue.length > 0 && part1.length < s1) {
      let curr = queue.shift();
      let dirs = [[-1,0], [1,0], [0,-1], [0,1]];
      for (let [dr, dc] of dirs) {
        let nid = `${curr.r + dr}-${curr.c + dc}`;
        if (nodesMap.has(nid) && !visited.has(nid)) {
          visited.add(nid);
          let nb = nodesMap.get(nid);
          part1.push(nb);
          queue.push(nb);
          if (part1.length === s1) break;
        }
      }
    }

    if (part1.length === s1) {
      let part2 = nodes.filter(n => !visited.has(n.id));
      if (isConnected(part2)) {
        return [part1, ...splitSet(part2, remainingSizes)];
      }
    }
  }
  
  let part1 = nodes.slice(0, s1);
  let part2 = nodes.slice(s1);
  return [part1, ...splitSet(part2, remainingSizes)];
}

function generateSingleAttempt(cornerWeightFn, targetSize, availableSeats) {
  let unassigned = new Set(availableSeats);
  let groups = [];

  while (unassigned.size > 0) {
    let bestSeed = null;
    let minVal = Infinity;

    for (let seat of unassigned) {
      let nbsCount = getNeighbors(seat, unassigned).length;
      let cVal = cornerWeightFn(seat.r, seat.c);
      let val = nbsCount * 50 + cVal; 
      if (val < minVal) {
        minVal = val;
        bestSeed = seat;
      }
    }

    let currentGroup = [bestSeed];
    unassigned.delete(bestSeed);

    while (currentGroup.length < targetSize) {
      let candidates = new Set();
      for (let member of currentGroup) {
        getNeighbors(member, unassigned).forEach(n => candidates.add(n));
      }

      if (candidates.size === 0) break;

      let bestCand = null;
      let bestCandScore = -Infinity;
      let cr = currentGroup.reduce((sum, s) => sum + s.r, 0) / currentGroup.length;
      let cc = currentGroup.reduce((sum, s) => sum + s.c, 0) / currentGroup.length;

      for (let cand of candidates) {
        let connections = 0;
        for (let m of currentGroup) {
          if (Math.abs(cand.r - m.r) + Math.abs(cand.c - m.c) === 1) connections++;
        }
        let distToCentroid = Math.pow(cand.r - cr, 2) + Math.pow(cand.c - cc, 2);
        let score = connections * 10 - distToCentroid; 
        if (score > bestCandScore) {
          bestCandScore = score;
          bestCand = cand;
        }
      }

      currentGroup.push(bestCand);
      unassigned.delete(bestCand);
    }
    groups.push(currentGroup);
  }
  return groups;
}

function fixGroups(initialGroups, targetSize) {
  let minS = Math.max(2, targetSize - 1);
  let maxS = targetSize + 1;
  let groups = initialGroups.map(g => [...g]);
  let changed = true;
  let loopCount = 0;

  while (changed && loopCount < 50) {
    changed = false;
    loopCount++;

    let largeIdx = groups.findIndex(g => g.length > maxS);
    if (largeIdx !== -1) {
      let largeGroup = groups[largeIdx];
      let sizes = findSplitSizes(largeGroup.length, targetSize);
      if (!sizes) sizes = [targetSize, largeGroup.length - targetSize];
      if (sizes.length > 1) {
        let newGroups = splitSet(largeGroup, sizes);
        groups.splice(largeIdx, 1, ...newGroups);
        changed = true;
        continue;
      }
    }

    let smallIndices = [];
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].length > 0 && groups[i].length < minS) smallIndices.push(i);
    }

    for (let smallIdx of smallIndices) {
      let smallGroup = groups[smallIdx];
      let neighborGroups = new Set();

      for (let node of smallGroup) {
        let dirs = [[-1,0], [1,0], [0,-1], [0,1]];
        for (let [dr, dc] of dirs) {
          let nid = `${node.r + dr}-${node.c + dc}`;
          let gIdx = groups.findIndex((g, i) => i !== smallIdx && g.some(n => n.id === nid));
          if (gIdx !== -1) neighborGroups.add(gIdx);
        }
      }

      if (neighborGroups.size > 0) {
        let bestNIdx = Array.from(neighborGroups)[0];
        let minSize = Infinity;
        for (let idx of neighborGroups) {
          if (groups[idx].length < minSize) {
            minSize = groups[idx].length;
            bestNIdx = idx;
          }
        }

        let combined = [...smallGroup, ...groups[bestNIdx]];
        let idx1 = Math.max(smallIdx, bestNIdx);
        let idx2 = Math.min(smallIdx, bestNIdx);
        groups.splice(idx1, 1);
        groups.splice(idx2, 1);
        groups.push(combined);
        changed = true;
        break; 
      }
    }
  }
  return groups.filter(g => g.length > 0);
}

function evaluateGroups(groups, T) {
  let score = 0;
  let minS = Math.max(2, T - 1);
  let maxS = T + 1;

  for (let g of groups) {
    if (g.length < minS || g.length > maxS) score -= 10000; 
    if (!isConnected(g)) score -= 5000; 
    
    let edges = 0;
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        if (Math.abs(g[i].r - g[j].r) + Math.abs(g[i].c - g[j].c) === 1) edges++;
      }
    }
    score += edges * 10; 
  }
  return score;
}

function generateGroups() {
  resetColors();
  const targetSize = parseInt(document.getElementById('group-size').value);
  seatMapGlobal.clear();
  let availableSeats = [];
  
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      const seatDiv = document.getElementById(`${r}-${c}`);
      if (seatDiv && !seatDiv.classList.contains('absent')) {
        let seatObj = { r, c, id: `${r}-${c}`, element: seatDiv };
        seatMapGlobal.set(seatObj.id, seatObj);
        availableSeats.push(seatObj);
      }
    }
  }

  if (availableSeats.length === 0) {
    alert("有効な席がありません。");
    return;
  }

  const corners = [
    (r, c) => r + c,       
    (r, c) => r - c,       
    (r, c) => -r + c,      
    (r, c) => -r - c       
  ];

  let bestGroups = [];
  let bestScore = -Infinity;

  for (let cornerFn of corners) {
    let initialGroups = generateSingleAttempt(cornerFn, targetSize, availableSeats);
    let fixedGroups = fixGroups(initialGroups, targetSize);
    let score = evaluateGroups(fixedGroups, targetSize);
    
    if (score > bestScore) {
      bestScore = score;
      bestGroups = fixedGroups;
    }
  }

  const colors = [
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', 
    '#E8BAFF', '#FFBAE1', '#E2F0CB', '#FFC8A2', '#D5AAFF',
    '#85E3FF', '#B9F2FF', '#F3FFE3', '#FFABAB', '#C4FAF8'
  ];
  
  bestGroups.forEach((group, index) => {
    let color = colors[index % colors.length];
    let groupSize = group.length;
    group.forEach((seat) => {
      seat.element.style.backgroundColor = color;
      seat.element.style.color = '#333';
      seat.element.querySelector('.group-name').innerText = `G${index + 1}`;
      seat.element.querySelector('.seat-count').innerText = `(${groupSize}人)`;
    });
  });
}

window.onload = createMap;
