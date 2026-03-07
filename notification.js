function addNotification(msg){

const alerts=document.getElementById("alertList");

const li=document.createElement("li");

li.innerText=new Date().toLocaleTimeString()+" - "+msg;

alerts.prepend(li);

}