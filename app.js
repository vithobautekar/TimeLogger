let currentTrack = null;
let startTime = null;
let logs = [];

let unsyncedLogs = JSON.parse(localStorage.getItem("unsyncedLogs")) || [];

const API_URL = "https://script.google.com/macros/s/AKfycbzS3qhAASPLqlPrxUYODoBD88ET2kl1NR8iBdK-B4Brw-oVspeotLSNPJDRy1w5ejRg/exec";

const grid = document.getElementById("grid");

let sessionData = {};

function startSession() {
  sessionData = {
    vehicle: document.getElementById("vehicle").value.trim(),
    project: document.getElementById("project").value.trim(),
    driver: document.getElementById("driver").value.trim(),
    category: document.getElementById("category").value,
    pass: document.getElementById("pass").value.trim()
  };

  document.getElementById("sessionInfo").innerText = sessionData.vehicle;
  document.getElementById("date").innerText = new Date().toDateString();

  document.getElementById("homeScreen").classList.remove("active");
  document.getElementById("trackScreen").classList.add("active");

  buildGrid();
  updateSyncStatus();
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
      logId: generateLogId(sessionData.pass, track, startTime),
      ...sessionData,
      track: track,
      start: startTime.toLocaleString(),
      end: endTime.toLocaleString(),
      duration: duration,
      synced: false,
      createdAt: new Date().toISOString()
    };

    logs.push(log);

    addToUnsyncedQueue(log);
    sendToGoogle();

    currentTrack = null;
    tile.classList.remove("activeTile");
    enableAll();
  }
}

function generateLogId(passNumber, track, entryTime) {
  const datePart = formatDateForId(entryTime);
  const passPart = sanitizeForId(passNumber || "NOPASS");
  const trackPart = sanitizeForId(track);
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `NATRAX_${datePart}_${passPart}_${trackPart}_${randomPart}`;
}

function formatDateForId(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hour}${minute}${second}`;
}

function sanitizeForId(value) {
  return String(value)
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toUpperCase();
}

function addToUnsyncedQueue(log) {
  const alreadyExists = unsyncedLogs.some(item => item.logId === log.logId);

  if (!alreadyExists) {
    unsyncedLogs.push(log);
    saveToLocal();
    updateSyncStatus();
  }
}

function saveToLocal() {
  localStorage.setItem("unsyncedLogs", JSON.stringify(unsyncedLogs));
}

function sendToGoogle() {
  if (unsyncedLogs.length === 0) {
    updateSyncStatus();
    return;
  }

  const log = unsyncedLogs[0];

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(log)
  })
    .then(response => response.json())
    .then(result => {
      console.log("Google response:", result);

      if (result.status === "success" || result.status === "duplicate") {
        unsyncedLogs.shift();
        saveToLocal();
        updateSyncStatus();

        sendToGoogle();
      } else {
        console.log("Sync failed:", result.message);
        updateSyncStatus();
      }
    })
    .catch(error => {
      console.log("Offline or network error. Will retry later.", error);
      updateSyncStatus();
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
  const indicator = document.getElementById("syncStatus");

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
  document.querySelectorAll(".tile").forEach(tile => {
    if (tile !== activeTile) {
      tile.classList.add("disabled");
    }
  });
}

function enableAll() {
  document.querySelectorAll(".tile").forEach(tile => {
    tile.classList.remove("disabled");
    tile.innerText = tile.innerText.split("\n")[0];
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

function exportToExcel() {
  if (logs.length === 0 && unsyncedLogs.length === 0) {
    alert("No data to export");
    return;
  }

  const allLogs = [...logs, ...unsyncedLogs];

  const data = allLogs.map(log => {
    const billedHours = Math.max(2, log.duration / 60);

    return {
      "Log ID": log.logId,
      "Date": new Date().toLocaleDateString(),
      "Driver": log.driver,
      "Vehicle": log.vehicle,
      "Project": log.project,
      "Pass": log.pass,
      "Category": log.category,
      "Track": log.track,
      "Entry": log.start,
      "Exit": log.end,
      "Duration (min)": log.duration,
      "Billed Hours": billedHours.toFixed(2),
      "Sync Status": log.synced ? "Synced" : "Pending"
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Track Logs");

  XLSX.writeFile(workbook, `TrackLogs_${Date.now()}.xlsx`);
}

function endSession() {
  if (currentTrack !== null) {
    alert("Please exit the active track before ending the session.");
    return;
  }

  if (confirm("End session?")) {
    alert("Session ended. Any pending logs will sync automatically.");
    location.reload();
  }
}
