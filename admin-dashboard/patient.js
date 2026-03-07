const firebaseConfig = {
    apiKey: "AIzaSyDJITqYAeV1hepPs-GM6BMSd8V6iVzOB98",
    authDomain: "pulse-monitor-cba0a.firebaseapp.com",
    projectId: "pulse-monitor-cba0a"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

const url = new URLSearchParams(window.location.search);
const id = url.get("id");

const ctx = document.getElementById("chart");
const table = document.getElementById("records");
const alarm = document.getElementById("alarm");

let labels = [];
let values = [];

const chart = new Chart(ctx, {

    type: 'line',

    data: {
        labels: labels,

        datasets: [{

            label: "ECG",

            data: values,

            borderColor: "#00ff9c",

            borderWidth: 2,

            tension: 0.4

        }]

    },

    options: {
        animation: false,
        scales: {
            y: { min: 50, max: 150 }
        }
    }

});

db.collection("patients")
    .doc(id)
    .collection("readings")
    .orderBy("time", "desc")
    .limit(50)

    .onSnapshot(snapshot => {

        table.innerHTML = "";
        labels = [];
        values = [];

        snapshot.forEach(doc => {

            const d = doc.data();

            labels.push(new Date(d.time).toLocaleTimeString());
            values.push(d.bpm);

            if (d.bpm > 95) {
                alarm.play();
            }

            const row = document.createElement("tr");

            row.innerHTML = `
<td>${new Date(d.time).toLocaleTimeString()}</td>
<td>${d.bpm}</td>
`;

            table.appendChild(row);

        });

        chart.update();

    });