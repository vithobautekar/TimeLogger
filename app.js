let currentTrack = null;
let startTime = null;
let logs = [];
let unsyncedLogs = JSON.parse(localStorage.getItem("unsyncedLogs")) || [];

const API_URL = "https://script.google.com/macros/s/AKfycbzS3qhAASPLqlPrxUYODoBD88ET2kl1NR8iBdK-B4Brw-oVspeotLSNPJDRy1w5ejRg/exec";

const grid = document.getElementById("grid");

let sessionData = {};

function startSession() {
  sessionData = {
    vehicle: document.getElementById("vehicle").value,
    project: document.getElementById("project").value,
    driver: document.getElementById("driver").value,
    category: document.getElementById("category").value,
    pass: document.getElementById("pass").value
  };

  document.getElementById("sessionInfo").innerText = sessionData.vehicle;
  document.getElementById("date").innerText = new Date().toDateString();

  document.getElementById("homeScreen").classList.remove("active");
  document.getElementById("trackScreen").classList.add("active");

  buildGrid();
  startAutoSync();
}

function buildGrid() {
  grid.innerHTML = "";

  for (let i = 1; i <= 16; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerText = "T" + i;

    tile.onclick = () => toggleTrack("T" + i, tile);

    grid.appendChild(tile);
  }
}

function toggleTrack(track, tile) {

  if (currentTrack === null) {
    currentTrack = track;
    startTime = new Date();

    tile.classList.add("activeTile");
    disableOthers(tile);
    startTimer(tile);

  } else if (currentTrack === track) {

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 60000);

    const log = {
      ...sessionData,
      track,
      start: startTime.toLocaleString(),
      end: endTime.toLocaleString(),
      duration,
      synced: false
    };

    logs.push(log);

    // ✅ ALWAYS store locally first
    unsyncedLogs.push(log);
    saveToLocal();

    // ✅ Try sending
    sendToGoogle();

    currentTrack = null;
    tile.classList.remove("activeTile");
    enableAll();
  }
}

function saveToLocal() {
  localStorage.setItem("unsyncedLogs", JSON.stringify(unsyncedLogs));
}

function sendToGoogle() {

  if (unsyncedLogs.length === 0) return;

  // try sending first item
  const log = unsyncedLogs[0];

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(log)
  })
  .then(() => {
    console.log("Synced:", log.track);

    // remove from queue
    unsyncedLogs.shift();
    saveToLocal();

    updateSyncStatus();

    // send next
    sendToGoogle();
  })
  .catch(() => {
    console.log("Offline, retrying later...");
  });
}

function startAutoSync() {
  setInterval(() => {
    if (navigator.onLine) {
      sendToGoogle();
    }
    updateSyncStatus();
  }, 10000);
}

function updateSyncStatus() {
  let indicator = document.getElementById("syncStatus");

  if (!indicator) return;

  if (unsyncedLogs.length === 0) {
    indicator.innerText = "✅ Synced";
    indicator.style.color = "lightgreen";
  } else {
    indicator.innerText = `⚠ ${unsyncedLogs.length} Pending`;
    indicator.style.color = "orange";
  }
}

function disableOthers(activeTile) {
  document.querySelectorAll(".tile").forEach(t => {
    if (t !== activeTile) t.classList.add("disabled");
  });
}

function enableAll() {
  document.querySelectorAll(".tile").forEach(t => {
    t.classList.remove("disabled");
    t.innerText = t.innerText.split("\n")[0];
  });
}

function startTimer(tile) {
  const interval = setInterval(() => {

    if (currentTrack === null) {
      clearInterval(interval);
      tile.innerText = tile.innerText.split("\n")[0];
      return;
    }

    const elapsed = Math.floor((new Date() - startTime) / 1000);
    tile.innerText = `${currentTrack}\n${elapsed}s`;

  }, 1000);
}

function endSession() {
  if (confirm("End session?")) {
    alert("Logs saved locally & will sync automatically ✅");
    location.reload();
  }
}
``