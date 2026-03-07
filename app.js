const firebaseConfig = {
    apiKey: "AIzaSyDJITqYAeV1hepPs-GM6BMSd8V6iVzOB98",
    authDomain: "pulse-monitor-cba0a.firebaseapp.com",
    projectId: "pulse-monitor-cba0a"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

const table = document.getElementById("patients");
const alarm = document.getElementById("alarm");

db.collection("patients").onSnapshot(snapshot => {

    table.innerHTML = "";

    snapshot.forEach(doc => {

        const p = doc.data();
        const bpm = p.bpm;

        let status = "Normal";
        let color = "green";

        if (bpm > 95) {
            status = "Critical";
            color = "red";
            alarm.play();
        }

        const row = document.createElement("tr");

        row.innerHTML = `
<td>${p.name}</td>
<td>${p.location}</td>
<td>${bpm}</td>
<td style="color:${color}">${status}</td>
<td><a href="patient.html?id=${doc.id}">View Data</a></td>
`;

        table.appendChild(row);

    });

});

