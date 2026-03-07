const map = L.map('map').setView([13.0827,80.2707],6);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

db.collection("patients").onSnapshot(snapshot=>{

snapshot.forEach(doc=>{

const p=doc.data();

L.marker([p.lat,p.lng])
.addTo(map)
.bindPopup(p.name+"<br>"+p.bpm+" BPM");

});

});