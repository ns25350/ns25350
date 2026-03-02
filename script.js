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
      seat.dataset.state = 'active'; 
      seat.innerHTML = `<span class="group-name"></span><span class="seat-count"></span>`;
      
      seat.onclick = () => {
        let state = seat.dataset.state;
        if (state === 'active') {
          seat.dataset.state = 'absent';
          seat.className = 'seat absent';
          seat.querySelector('.group-name').innerText = '休';
        } else if (state === 'absent') {
          seat.dataset.state = 'space';
          seat.className = 'seat space';
          seat.querySelector('.group-name').innerText = '✖';
        } else {
          seat.dataset.state = 'active';
          seat.className = 'seat';
          seat.querySelector('.group-name').innerText = '';
        }
        seat.style.backgroundColor = ''; 
        seat.querySelector('.seat-count').innerText = '';
      };
      mapDiv.appendChild(seat);
    }
  }
}

function resetColors() {
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      const seat = document.getElementById(`${r}-${c}`);
      if (seat) {
        seat.style.backgroundColor = '';
        seat.style.color = '';
        if (seat.dataset.state === 'active') seat.querySelector('.group-name').innerText = '';
        if (seat.dataset.state === 'absent') seat.querySelector('.group-name').innerText = '休';
        if (seat.dataset.state === 'space') seat.querySelector('.group-name').innerText = '✖';
        seat.querySelector('.seat-count').innerText = '';
      }
    }
  }
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

function getGroupSizes(totalPeople, target) {
  if (totalPeople === 0) return [];
  let numGroups = Math.round(totalPeople / target);
  if (numGroups === 0) numGroups = 1;
  
  let baseSize = Math.floor(totalPeople / numGroups);
  let remainder = totalPeople % numGroups;
  
  let sizes = [];
  for (let i = 0; i < numGroups; i++) {
    sizes.push(i < remainder ? baseSize + 1 : baseSize);
  }
  return sizes.sort((a, b) => b - a); 
}

// 理想の形（枠）からはみ出していないかを判定し、ペナルティを返す関数
function calculateShapePenalty(targetSize, width, height) {
  let penalty = 0;
  if (targetSize <= 4) {
    // 4人以下は 2x2 の枠内に絶対収める
    if (width > 2 || height > 2) penalty += 2000;
  } else if (targetSize === 5 || targetSize === 6) {
    // 5〜6人は 2x3 か 3x2 の枠内に収める
    if (width > 3 || height > 3) penalty += 2000; // 4列以上は一発アウト
    if (width > 2 && height > 2) penalty += 2000; // 3x3のような四角形もアウト（どちらかは2以下）
  } else {
    // 7人以上の場合は極端に細長くならないようにする
    if (width > 4 || height > 4) penalty += 2000;
  }
  return penalty;
}

function generateSingleAttempt(cornerWeightFn, groupSizes, availableDesks) {
  let unassigned = new Set(availableDesks);
  let groups = [];

  for (let targetSize of groupSizes) {
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

    if (!bestSeed) break;

    let currentGroup = [bestSeed];
    unassigned.delete(bestSeed);

    while (currentGroup.length < targetSize) {
      let candidates = new Set();
      for (let member of currentGroup) {
        getNeighbors(member, unassigned).forEach(n => candidates.add(n));
      }

      if (candidates.size === 0) {
        let bestFallback = null;
        let minDist = Infinity;
        let cr = currentGroup.reduce((sum, s) => sum + s.r, 0) / currentGroup.length;
        let cc = currentGroup.reduce((sum, s) => sum + s.c, 0) / currentGroup.length;
        for (let cand of unassigned) {
          let dist = Math.pow(cand.r - cr, 2) + Math.pow(cand.c - cc, 2);
          if (dist < minDist) {
            minDist = dist;
            bestFallback = cand;
          }
        }
        if (bestFallback) {
          currentGroup.push(bestFallback);
          unassigned.delete(bestFallback);
          continue;
        } else {
          break; 
        }
      }

      let bestCand = null;
      let bestCandScore = -Infinity;

      for (let cand of candidates) {
        let minR = cand.r, maxR = cand.r, minC = cand.c, maxC = cand.c;
        for (let m of currentGroup) {
          minR = Math.min(minR, m.r); maxR = Math.max(maxR, m.r);
          minC = Math.min(minC, m.c); maxC = Math.max(maxC, m.c);
        }
        let width = maxC - minC + 1;
        let height = maxR - minR + 1;
        
        let shapePenalty = calculateShapePenalty(targetSize, width, height);

        let connections = 0;
        for (let m of currentGroup) {
          if (Math.abs(cand.r - m.r) + Math.abs(cand.c - m.c) === 1) connections++;
        }
        
        // 接地面が多いほどプラス、理想の形から外れるほど特大マイナス
        let score = (connections * 20) - shapePenalty;
        
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
  return { groups: groups, unused: Array.from(unassigned) };
}

function evaluateGroups(groups) {
  let score = 0;
  for (let g of groups) {
    if (!isConnected(g)) score -= 5000; 
    
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    let edges = 0;
    for (let i = 0; i < g.length; i++) {
      minR = Math.min(minR, g[i].r); maxR = Math.max(maxR, g[i].r);
      minC = Math.min(minC, g[i].c); maxC = Math.max(maxC, g[i].c);
      for (let j = i + 1; j < g.length; j++) {
        if (Math.abs(g[i].r - g[j].r) + Math.abs(g[i].c - g[j].c) === 1) edges++;
      }
    }
    let width = maxC - minC + 1;
    let height = maxR - minR + 1;
    
    let targetSize = g.length;
    let shapePenalty = calculateShapePenalty(targetSize, width, height);

    score += edges * 10;
    score -= shapePenalty; // 全体評価でも形の綺麗さを重視
  }
  return score;
}

function generateGroups() {
  resetColors();
  const targetSize = parseInt(document.getElementById('group-size').value);
  seatMapGlobal.clear();
  
  let availableDesks = [];
  let totalPeople = 0;
  
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      const seatDiv = document.getElementById(`${r}-${c}`);
      if (seatDiv && seatDiv.dataset.state !== 'space') {
        let seatObj = { r, c, id: `${r}-${c}`, element: seatDiv, state: seatDiv.dataset.state };
        seatMapGlobal.set(seatObj.id, seatObj);
        availableDesks.push(seatObj);
        
        if (seatObj.state === 'active') {
          totalPeople++;
        }
      }
    }
  }

  if (totalPeople === 0) {
    alert("参加者がいません。");
    return;
  }

  let groupSizes = getGroupSizes(totalPeople, targetSize);

  const corners = [
    (r, c) => r + c,       
    (r, c) => r - c,       
    (r, c) => -r + c,      
    (r, c) => -r - c       
  ];

  let bestGroups = [];
  let bestUnused = [];
  let bestScore = -Infinity;

  for (let cornerFn of corners) {
    let result = generateSingleAttempt(cornerFn, groupSizes, availableDesks);
    let score = evaluateGroups(result.groups);
    
    if (score > bestScore) {
      bestScore = score;
      bestGroups = result.groups;
      bestUnused = result.unused;
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

  bestUnused.forEach(seat => {
    seat.element.style.backgroundColor = '#ddd';
    seat.element.style.color = '#888';
    seat.element.querySelector('.group-name').innerText = '空';
    seat.element.querySelector('.seat-count').innerText = '';
  });
}

window.onload = createMap;
