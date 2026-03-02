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
      seat.dataset.state = 'active'; // 初期状態は通常
      seat.innerHTML = `<span class="group-name"></span><span class="seat-count"></span>`;
      
      // クリックで3状態をループ切り替え
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

// 人数から、最適なグループ分割（配列）を計算する
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
  return sizes.sort((a, b) => b - a); // 大きいグループから処理するため降順
}

function generateSingleAttempt(cornerWeightFn, groupSizes, availableDesks) {
  let unassigned = new Set(availableDesks);
  let groups = [];

  for (let targetSize of groupSizes) {
    let bestSeed = null;
    let minVal = Infinity;

    // 孤立しやすい席 ＆ 指定の隅からスタート
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

      // 孤立してしまった場合のフォールバック（一番近い席を無理やり繋げる）
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
        // 正方形（四角形）に近づけるための計算
        let minR = cand.r, maxR = cand.r, minC = cand.c, maxC = cand.c;
        for (let m of currentGroup) {
          minR = Math.min(minR, m.r); maxR = Math.max(maxR, m.r);
          minC = Math.min(minC, m.c); maxC = Math.max(maxC, m.c);
        }
        let width = maxC - minC + 1;
        let height = maxR - minR + 1;
        let area = width * height; // 囲む面積（スカスカだと広くなる）
        let squareness = Math.abs(width - height); // 縦横比の差（小さいほど正方形）

        let connections = 0;
        for (let m of currentGroup) {
          if (Math.abs(cand.r - m.r) + Math.abs(cand.c - m.c) === 1) connections++;
        }
        
        // 面積が狭く、縦横比が1:1に近く、接地面が多いものを高く評価
        let score = (connections * 20) - (area * 5) - (squareness * 10);
        
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
    let area = width * height;
    let squareness = Math.abs(width - height);

    score += edges * 10;
    score -= area * 5; 
    score -= squareness * 10; 
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
          totalPeople++; // 実際にいる人間の数をカウント
        }
      }
    }
  }

  if (totalPeople === 0) {
    alert("参加者がいません。");
    return;
  }

  // 実際にいる人間の数から、最適なグループ構成を割り出す
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
  
  // グループの色塗り
  bestGroups.forEach((group, index) => {
    let color = colors[index % colors.length];
    let groupSize = group.length; // この机の塊に座る人数
    group.forEach((seat) => {
      seat.element.style.backgroundColor = color;
      seat.element.style.color = '#333';
      seat.element.querySelector('.group-name').innerText = `G${index + 1}`;
      seat.element.querySelector('.seat-count').innerText = `(${groupSize}人)`;
    });
  });

  // 欠席パズルによってはじき出された「最終的な空き席」の表示
  bestUnused.forEach(seat => {
    seat.element.style.backgroundColor = '#ddd';
    seat.element.style.color = '#888';
    seat.element.querySelector('.group-name').innerText = '空';
    seat.element.querySelector('.seat-count').innerText = '';
  });
}

window.onload = createMap;
