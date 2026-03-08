// 1. Configure Firebase using the credentials provided
const firebaseConfig = {
    apiKey: "AIzaSyCOEeYfiYHm8QWvq4g9OVL6fMjGwhokYjU",
    authDomain: "pulsewatch-baac1.firebaseapp.com",
    projectId: "pulsewatch-baac1",
    storageBucket: "pulsewatch-baac1.firebasestorage.app",
    messagingSenderId: "839217399482",
    appId: "1:839217399482:web:2f04360b06937687812483",
    measurementId: "G-XQX1VE443L"
};

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// 2. DOM Elements
const readingsTableBody = document.getElementById('readingsTableBody');
const totalUsersElement = document.getElementById('totalUsersCount');
const totalReadingsElement = document.getElementById('totalReadingsCount');
const alertsElement = document.getElementById('alertsCount');
const alarmAudio = document.getElementById('alarmAudio');

// 3. Application State
const state = {
    uniqueUsers: new Set(),
    userRows: {}, // Maps userId -> tr DOM element
    totalReadings: 0,
    totalAlerts: 0,
    isFirstLoad: true, // Prevents animation spam on page load
    viewMode: 'live', // 'live' or 'log'
    cachedDocs: [] // Stores snapshotted docs for instant re-renders
};

// 4. Formatting Utility
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Just now';
    
    // Convert Firestore Timestamp to JS Date
    const date = timestamp.toDate();
    
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).format(date);
}

// 5. Update UI Stats
function updateStatsSummary(userId, isAbnormal) {
    // Track unique users
    if (!state.uniqueUsers.has(userId)) {
        state.uniqueUsers.add(userId);
        totalUsersElement.innerText = state.uniqueUsers.size;
    }

    // Increment readings
    state.totalReadings++;
    totalReadingsElement.innerText = state.totalReadings;

    // Increment alerts
    if (isAbnormal) {
        state.totalAlerts++;
        alertsElement.innerText = state.totalAlerts;
        
        // Add minimal highlight animation to the card
        const alertCard = document.querySelector('.alert-card');
        alertCard.style.transform = 'scale(1.05)';
        alertCard.style.boxShadow = '0 0 20px rgba(255, 51, 102, 0.5)';
        setTimeout(() => {
            alertCard.style.transform = '';
            alertCard.style.boxShadow = '';
        }, 500);
    }
}

// 6. Navigation Functions
function openPatientDetails(patient) {
    // Convert patient object to base64 JSON state parameter for easy URL passing
    const b64Data = encodeURIComponent(btoa(JSON.stringify(patient)));
    window.location.href = `patient.html?data=${b64Data}`;
}

// 7. Listen for real-time updates from Firestore
function startListening() {
    // We listen to the 'heart_rate_readings' collection, ordered by timestamp descending
    // This perfectly matches your Flutter app's Firestore writes.
    db.collection("heart_rate_readings")
      .orderBy("timestamp", "desc")
      .limit(100) // Keep the UI light by only taking recent 100 on load
      .onSnapshot((snapshot) => {
          
          // Clear loading state if it exists
          if (document.getElementById('emptyRow')) {
             readingsTableBody.innerHTML = '';
          }

          snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                  const data = change.doc.data();
                  state.cachedDocs.unshift({doc: change.doc, data: data}); // Add to top of cache
                  
                  // Extract data
                  const docId = change.doc.id;
                  const userId = data.userId || 'Unknown';
                  const patientName = data.patientName || 'Unknown Patient';
                  const hr = data.heartRate || 0;
                  const timestamp = data.timestamp;
                  const isAbnormal = data.isAbnormal || false;
                  const isAssigned = data.isAssigned || false;
                  
                  // Extract location and history
                  const loc = data.location || {};
                  const lat = loc.latitude !== undefined ? loc.latitude.toFixed(4) : 'N/A';
                  const lng = loc.longitude !== undefined ? loc.longitude.toFixed(4) : 'N/A';
                  const historyArr = data.history || [];

                  // Update Analytics
                  updateStatsSummary(userId, isAbnormal);

                  // Trigger Audio Alarm on live data (only if not assigned yet)
                  if (!state.isFirstLoad && isAbnormal && !isAssigned && hr > 95) {
                      // Modern browsers require user interaction first, or they catch the promise rejection
                      alarmAudio.play().catch(e => console.log("Audio play prevented by browser policy", e));
                  }

                  // Create table row
                  const tr = document.createElement('tr');
                  
                  // Add class for styling logic
                  if (isAbnormal && !isAssigned) {
                      tr.classList.add('abnormal');
                  } else if (isAbnormal && isAssigned) {
                      tr.classList.add('assigned');
                  }
                  
                  // Add animation if it's a new live read vs initial dump
                  if (!state.isFirstLoad) {
                      tr.classList.add((isAbnormal && !isAssigned) ? 'abnormal-row' : 'new-row');
                  }

                  const timeString = formatTimestamp(timestamp);
                  
                  // Build simple inline sparkline text for history: [80, 82, 85, 90, 96]
                  const historyText = historyArr.length > 0 
                      ? `<span style="color:var(--text-muted); font-size:12px;">[${historyArr.join(', ')}]</span>` 
                      : `<span style="color:var(--text-muted); font-size:12px;">No history</span>`;
                  
                  // Status Badge Logic
                  let badgeHtml = '';
                  if (isAbnormal && !isAssigned) {
                      badgeHtml = `<span class="chip chip-abnormal">⚠️ Critical</span>`;
                  } else if (isAbnormal && isAssigned) {
                      badgeHtml = `<span class="chip chip-assigned">👨‍⚕️ Assigned</span>`;
                  } else {
                      badgeHtml = `<span class="chip chip-normal">✓ Normal</span>`;
                  }

                  // Build HTML
                  tr.innerHTML = `
                      <td>${timeString}</td>
                      <td>
                        <strong>${patientName}</strong>
                        <div style="font-size:11px;color:var(--text-muted)">ID: ${userId}</div>
                      </td>
                      <td>
                        <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" style="color:var(--accent); text-decoration:none;">
                            &#128205; ${lat}, ${lng}
                        </a>
                      </td>
                      <td class="bpm-value ${(isAbnormal && !isAssigned) ? 'text-red' : (isAssigned ? 'text-green' : '')}">
                        ${hr} BPM
                      </td>
                      <td>
                        ${badgeHtml}
                      </td>
                      <td>${historyText}</td>
                  `;

                  // 8. Manage DOM Updates (Replace old row or Add new)
                  if (state.viewMode === 'live' && state.userRows[userId]) {
                      // LIVE MODE: We already have a row for this user. Replace it instead of spamming.
                      const oldTr = state.userRows[userId];
                      oldTr.innerHTML = tr.innerHTML;
                      oldTr.className = tr.className;
                      
                      // Clone events over by using the same logic for the new wrapper
                      if (isAbnormal || isAssigned) {
                          oldTr.classList.add('clickable-row');
                          // Remove old listeners by cloning
                          const newTr = oldTr.cloneNode(true);
                          oldTr.parentNode.replaceChild(newTr, oldTr);
                          
                          newTr.addEventListener('click', () => {
                              openPatientDetails({
                                  docId: docId,
                                  id: userId,
                                  name: patientName,
                                  time: timeString,
                                  lat: lat,
                                  lng: lng,
                                  history: historyArr,
                                  hr: hr,
                                  isAssigned: isAssigned
                              });
                          });
                          state.userRows[userId] = newTr; // Update reference
                      } else {
                          // No click behavior for normal
                          const newTr = oldTr.cloneNode(true);
                          oldTr.parentNode.replaceChild(newTr, oldTr);
                          state.userRows[userId] = newTr;
                      }
                  } else {
                      // LOG MODE or First time seeing this user
                      readingsTableBody.prepend(tr);
                      
                      // Only cache the row map in Live Mode
                      if (state.viewMode === 'live') {
                          state.userRows[userId] = tr;
                      }
                      
                      // Add click listener if abnormal or assigned
                      if (isAbnormal) {
                          tr.classList.add('clickable-row');
                          tr.addEventListener('click', () => {
                              openPatientDetails({
                                  docId: docId,
                                  id: userId,
                                  name: patientName,
                                  time: timeString,
                                  lat: lat,
                                  lng: lng,
                                  history: historyArr,
                                  hr: hr,
                                  isAssigned: isAssigned
                              });
                          });
                      }
                  }
              }
          });
          
          // Turn off first load flag after initial batch
          if (state.isFirstLoad) {
              state.isFirstLoad = false;
          }
      }, (error) => {
          console.error("Error listening to Firestore updates: ", error);
          readingsTableBody.innerHTML = `<tr><td colspan="4" style="color:red;text-align:center;">Connection Error: Please check API Keys</td></tr>`;
      });
}

// 8. View Toggle Logic
function setupViewToggles() {
    const lblLive = document.getElementById('lblLive');
    const lblLog = document.getElementById('lblLog');
    const rbLive = document.getElementById('viewLive');
    const rbLog = document.getElementById('viewLog');

    function updateToggleUI() {
        if (rbLive.checked) {
            lblLive.style.background = 'var(--accent)';
            lblLive.style.color = '#000';
            lblLog.style.background = 'transparent';
            lblLog.style.color = 'var(--text-muted)';
            state.viewMode = 'live';
        } else {
            lblLog.style.background = 'var(--accent)';
            lblLog.style.color = '#000';
            lblLive.style.background = 'transparent';
            lblLive.style.color = 'var(--text-muted)';
            state.viewMode = 'log';
        }
        reRenderTable();
    }

    rbLive.addEventListener('change', updateToggleUI);
    rbLog.addEventListener('change', updateToggleUI);
}

// Full re-render from cache when switching views
function reRenderTable() {
    readingsTableBody.innerHTML = '';
    state.userRows = {}; // Reset tracking
    
    // Reverse cache to simulate chronological insertion so prepend puts latest on top
    const renderList = [...state.cachedDocs].reverse();
    
    // Force firstLoad flag to prevent audio spam on re-render
    const wasFirstLoad = state.isFirstLoad;
    state.isFirstLoad = true;
    
    // Simulate a snapshot bulk add to reuse all logic
    const fakeSnapshot = {
        docChanges: () => renderList.map(item => ({ type: 'added', doc: item.doc }))
    };
    
    // We need to bypass the real snapshot listener for this re-render, 
    // but the logic inside the listener relies on the listener scope. 
    // To keep it simple, we just reload the page with a query param if it gets too complex, 
    // but a cleaner way is just abstracting the row builder.
    // Since we're refactoring, let's just trigger a hard refresh for the MVP toggle if preferred, 
    // but here we can just clear and let the next polling handle it, OR we just rebuild DOM locally.
    
    // Rebuild DOM locally manually
    renderList.forEach(item => {
        buildRow(item.doc, item.data);
    });
    
    state.isFirstLoad = wasFirstLoad;
}

// Extracted Row Builder
function buildRow(doc, data) {
    const docId = doc.id;
    const userId = data.userId || 'Unknown';
    const patientName = data.patientName || 'Unknown Patient';
    const hr = data.heartRate || 0;
    const timestamp = data.timestamp;
    const isAbnormal = data.isAbnormal || false;
    const isAssigned = data.isAssigned || false;
    const loc = data.location || {};
    const lat = loc.latitude !== undefined ? loc.latitude.toFixed(4) : 'N/A';
    const lng = loc.longitude !== undefined ? loc.longitude.toFixed(4) : 'N/A';
    const historyArr = data.history || [];

    const tr = document.createElement('tr');
    
    if (isAbnormal && !isAssigned) {
        tr.classList.add('abnormal');
    } else if (isAbnormal && isAssigned) {
        tr.classList.add('assigned');
    }

    const timeString = formatTimestamp(timestamp);
    const historyText = historyArr.length > 0 
        ? `<span style="color:var(--text-muted); font-size:12px;">[${historyArr.join(', ')}]</span>` 
        : `<span style="color:var(--text-muted); font-size:12px;">No history</span>`;
    
    let badgeHtml = '';
    if (isAbnormal && !isAssigned) {
        badgeHtml = `<span class="chip chip-abnormal">⚠️ Critical</span>`;
    } else if (isAbnormal && isAssigned) {
        badgeHtml = `<span class="chip chip-assigned">👨‍⚕️ Assigned</span>`;
    } else {
        badgeHtml = `<span class="chip chip-normal">✓ Normal</span>`;
    }

    tr.innerHTML = `
        <td>${timeString}</td>
        <td>
          <strong>${patientName}</strong>
          <div style="font-size:11px;color:var(--text-muted)">ID: ${userId}</div>
        </td>
        <td>
          <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" style="color:var(--accent); text-decoration:none;">
              &#128205; ${lat}, ${lng}
          </a>
        </td>
        <td class="bpm-value ${(isAbnormal && !isAssigned) ? 'text-red' : (isAssigned ? 'text-green' : '')}">
          ${hr} BPM
        </td>
        <td>${badgeHtml}</td>
        <td>${historyText}</td>
    `;

    if (state.viewMode === 'live' && state.userRows[userId]) {
        const oldTr = state.userRows[userId];
        oldTr.innerHTML = tr.innerHTML;
        oldTr.className = tr.className;
        
        if (isAbnormal || isAssigned) {
            oldTr.classList.add('clickable-row');
            const newTr = oldTr.cloneNode(true);
            oldTr.parentNode.replaceChild(newTr, oldTr);
            newTr.addEventListener('click', () => openPatientDetails({docId, id: userId, name: patientName, time: timeString, lat, lng, history: historyArr, hr, isAssigned}));
            state.userRows[userId] = newTr;
        } else {
            const newTr = oldTr.cloneNode(true);
            oldTr.parentNode.replaceChild(newTr, oldTr);
            state.userRows[userId] = newTr;
        }
    } else {
        readingsTableBody.prepend(tr);
        if (state.viewMode === 'live') {
            state.userRows[userId] = tr;
        }
        if (isAbnormal) {
            tr.classList.add('clickable-row');
            tr.addEventListener('click', () => openPatientDetails({docId, id: userId, name: patientName, time: timeString, lat, lng, history: historyArr, hr, isAssigned}));
        }
    }
}

// Boot up
document.addEventListener('DOMContentLoaded', () => {
    setupViewToggles();
    startListening();
});
