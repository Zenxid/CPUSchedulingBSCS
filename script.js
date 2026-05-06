
const colors = [
  "#4f8eff","#7c5cff","#34d399","#f59e0b","#f472b6","#f87171","#14b8a6","#fb923c","#a3e635","#38bdf8"
];

function generate(n) {
  let c = document.getElementById("jobsContainer");
  c.innerHTML = "";
  for (let i = 0; i < n; i++) {
    c.innerHTML += `<div class="job-row">
      <div class="job-label">P${i+1}</div>
      <input class="arrival" type="number" value="0" min="0">
      <input class="burst" type="number" value="1" min="1">
      <input class="priority" type="number" value="1" min="1">
    </div>`;
  }
}

document.getElementById("numJobs").onchange = e => generate(+e.target.value);
generate(3);

function getJobs() {
  let a = document.querySelectorAll(".arrival");
  let b = document.querySelectorAll(".burst");
  let p = document.querySelectorAll(".priority");
  let jobs = [];
  for (let i = 0; i < a.length; i++) {
    jobs.push({ id: i, arrival: +a[i].value, burst: +b[i].value, priority: +p[i].value, remaining: +b[i].value });
  }
  return jobs;
}

function run() {
  let algo = document.getElementById("algorithm").value;
  let q = +document.getElementById("quantum").value || 1;
  let jobs = getJobs();
  let time = 0, done = 0, n = jobs.length, log = [];

  // Round Robin queue — tracks order of arrival into the ready queue
  let rrQueue = [], rrInQueue = new Set();

  while (done < n) {
    let ready = jobs.filter(j => j.arrival <= time && j.remaining > 0);

    if (ready.length === 0) {
      // Idle: jump to next arrival instead of stepping 1 by 1
      let nextArrival = Math.min(...jobs.filter(j => j.remaining > 0).map(j => j.arrival));
      log.push({ id: -1, start: time, end: nextArrival });
      time = nextArrival;
      continue;
    }

    let current;

    if (algo === "FCFS") {
      // stable sort by arrival
      current = [...ready].sort((a, b) => a.arrival - b.arrival || a.id - b.id)[0];
    }
    else if (algo === "SJF") {
      // non-preemptive: shortest burst, tie-break by arrival then id
      current = [...ready].sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.id - b.id)[0];
    }
    else if (algo === "SRTF") {
      // preemptive: shortest remaining, tie-break by arrival then id
      current = [...ready].sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival || a.id - b.id)[0];
    }
    else if (algo === "PRIORITY_NP") {
      current = [...ready].sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.id - b.id)[0];
    }
    else if (algo === "PRIORITY_P") {
      current = [...ready].sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.id - b.id)[0];
    }
    else if (algo === "RR") {
      // maintain proper FIFO queue for RR
      ready.forEach(j => { if (!rrInQueue.has(j.id)) { rrQueue.push(j); rrInQueue.add(j.id); } });
      // remove finished jobs from queue
      rrQueue = rrQueue.filter(j => j.remaining > 0);
      current = rrQueue[0];
    }

    let exec = 1;
    if (algo === "FCFS" || algo === "SJF" || algo === "PRIORITY_NP") {
      exec = current.remaining; // run to completion (non-preemptive)
    }
    else if (algo === "RR") {
      exec = Math.min(q, current.remaining);
    }
    // SRTF and PRIORITY_P: exec stays 1 (preemptive, check every unit)

    log.push({ id: current.id, start: time, end: time + exec });
    current.remaining -= exec;
    time += exec;

    if (current.remaining === 0) {
      current.finish = time;
      done++;
      if (algo === "RR") { rrQueue.shift(); rrInQueue.delete(current.id); }
    } else if (algo === "RR") {
      // move to back of queue after using its quantum
      rrQueue.shift();
      rrQueue.push(current);
    }
  }

  // Merge consecutive same-process log entries (collapses preemptive 1-unit steps)
  const merged = [];
  log.forEach(entry => {
    const last = merged[merged.length - 1];
    if (last && last.id === entry.id && last.end === entry.start) {
      last.end = entry.end;
    } else {
      merged.push({ ...entry });
    }
  });
  log = merged;

  // Table
  let tat = 0, wt = 0;
  let tbody = document.querySelector("#tatTable tbody");
  tbody.innerHTML = "";
  jobs.forEach(j => {
    let t = j.finish - j.arrival;
    let w = t - j.burst;
    tat += t; wt += w;
    let row = document.createElement("tr");
    row.innerHTML = `<td>P${j.id+1}</td><td>${j.arrival}</td><td>${j.burst}</td><td>${j.priority}</td><td>${j.finish}</td><td>${t}</td><td>${w}</td>`;
    tbody.appendChild(row);
  });

  // Gantt — fixed block sizes, scrollable when overlapping
  let g = document.getElementById("gantt");
  g.innerHTML = "";

  const BLOCK_W = 72;

  const scrollWrap = document.createElement("div");
  scrollWrap.className = "gantt-scroll-wrap";

  const row = document.createElement("div");
  row.className = "gantt-blocks-row";

  log.forEach((l, i) => {
    const seg = document.createElement("div");
    seg.className = "gantt-seg";

    const b = document.createElement("div");
    b.className = "block";
    const isIdle = l.id === -1;
    const isFirst = i === 0;
    const isLast = i === log.length - 1;
    b.style.cssText = [
      `background: ${isIdle ? "#e2e8f0" : colors[l.id % colors.length]}`,
      `border: ${isIdle ? "1px dashed #cbd5e1" : "none"}`,
      `color: ${isIdle ? "#64748b" : "#fff"}`,
      `border-radius: ${isFirst && isLast ? "8px" : isFirst ? "8px 0 0 8px" : isLast ? "0 8px 8px 0" : "0"}`
    ].join(";");
    b.innerText = isIdle ? "IDLE" : `P${l.id+1}`;

    const tLabel = document.createElement("div");
    tLabel.className = "time-label";
    tLabel.innerText = l.start;

    seg.appendChild(b);
    seg.appendChild(tLabel);
    row.appendChild(seg);
  });

  if (log.length > 0) {
    const lastSeg = row.lastElementChild;
    const endLabel = document.createElement("div");
    endLabel.className = "end-label";
    endLabel.innerText = log[log.length - 1].end;
    lastSeg.appendChild(endLabel);
  }

  scrollWrap.appendChild(row);
  g.appendChild(scrollWrap);

  requestAnimationFrame(() => {
    const totalW = log.length * BLOCK_W;
    const availW = scrollWrap.clientWidth;
    scrollWrap.style.overflowX = totalW > availW ? "auto" : "visible";
  });

  // Timeline
  let timelineDiv = document.getElementById("timeline");
  timelineDiv.innerHTML = '<div class="timeline-line"></div>';
  let sorted = [...jobs].sort((a, b) => a.arrival - b.arrival);
  let gap = 80, startX = 40;

  sorted.forEach((j, index) => {
    let x = startX + index * gap;
    let color = colors[j.id % colors.length];

    let dot = document.createElement("div");
    dot.className = "timeline-dot";
    dot.style.left = x + "px";
    dot.style.background = color;
    timelineDiv.appendChild(dot);

    let mark = document.createElement("div");
    mark.className = "timeline-mark";
    mark.style.left = x + "px";
    timelineDiv.appendChild(mark);

    let timeEl = document.createElement("div");
    timeEl.className = "timeline-time";
    timeEl.style.left = x + "px";
    timeEl.innerText = j.arrival;
    timelineDiv.appendChild(timeEl);

    let label = document.createElement("div");
    label.className = "timeline-label";
    label.style.left = x + "px";
    label.style.color = color;
    label.innerText = `P${j.id+1}`;
    timelineDiv.appendChild(label);
  });

  // Metrics
  let totalTime = time;
  let busy = jobs.reduce((s, j) => s + j.burst, 0);
  let nJobs = jobs.length;
  document.getElementById("tat").innerText = (tat / nJobs).toFixed(2) + " ms";
  document.getElementById("wt").innerText = (wt / nJobs).toFixed(2) + " ms";
  document.getElementById("cpu").innerText = ((busy / totalTime) * 100).toFixed(1) + "%";
}