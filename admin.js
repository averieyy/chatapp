let ws = new WebSocket(`ws://localhost:3000/admin`);

const loginoverlay = document.getElementById("overlay");
const usernamein = document.getElementById("usernamein");
const passwdin = document.getElementById("passwdin");
const loginbtn = document.getElementById("submitlogin");

const chroomgrid = document.getElementById("chroomgrid");

const priviligereqs = {
  'usernav': 4,
  'chroomnav': 1,
  'spamnav': 2,
}

let chatrooms = {};
let users = {};
let username;
let privileges;
let loggedin = false;

let navelements = document.getElementsByClassName("navelement");
let configareas = document.getElementsByClassName("configarea");
let selectednavelement = document.getElementById("infonav");

function login() {
  username = usernamein.value;
  ws.send(`AUTH ${username} ${passwdin.value}`);
  usernamein.value = "";
  passwdin.value = "";
}

loginbtn.addEventListener("click", () => {
  login();
});

usernamein.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") passwdin.focus();
});

passwdin.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") login();
});

function switchTab(navelement) {
  let generalid = navelement.id.split("nav")[0];
  for (let configarea of configareas) {
    if (configarea.id == generalid) {
      configarea.hidden = false;
    }
    if (configarea.id == selectednavelement.id.split("nav")[0]) {
      configarea.hidden = true;
    }
  }
  if (generalid == "chroom") ws.send("LISTCHROOMS");
  if (generalid == "user") ws.send("LISTUSERS");
  navelement.classList.add("selected");
  selectednavelement.classList.remove("selected");
  selectednavelement = navelement;
}

function setUpNavBar() {
  for (let navelement of navelements) {
    let privileged = false;
    if (!(navelement.id in priviligereqs)) privileged = true;
    if (privileges & priviligereqs[navelement.id]) privileged = true;

    if (privileged) {
      navelement.addEventListener("click", () => {
        if (navelement != selectednavelement) {
          switchTab(navelement);
        }
      });
    } else {
      navelement.classList.add("disabled");
      navelement.title = "You aren't privileged enough to see this tab";
    } 
  }
}

function renderChrooms (chroomjson) {
  console.log(chroomjson);
  let chatrooms = JSON.parse(chroomjson);
  chroomgrid.innerHTML = '';
  for (let chatroom of chatrooms['chatrooms']) {
    let chroomelement = document.createElement("div");
    chroomelement.className = "chat";
    if (chatroom['name'] == chatrooms['default']) {
      chroomelement.classList.add("default");
    }

    let chroomtitle = document.createElement("h2");
    let chroomdesc = document.createElement("h4");

    chroomtitle.innerText = chatroom['name'];
    chroomdesc.innerText = chatroom['description'];

    chroomtitle.className = "chattitle";
    chroomdesc.className = "chatdesc";

    chroomelement.appendChild(chroomtitle);
    chroomelement.appendChild(chroomdesc);

    chroomgrid.appendChild(chroomelement);
  }
  let addchroomelement = document.createElement("div");
  addchroomelement.className = "addchroom";
  addchroomelement.addEventListener("click", () => {
    // Create a new element, i guess
  });

  chroomgrid.appendChild(addchroomelement);
}

ws.addEventListener("message", (ev) => {
  let msg = ev.data;
  console.log(msg);
  let args = msg.split(" ");
  switch (args[0]) {
    case "LOGIN":
      if (args[1] == "ERR") {
        username = "";
      }
      if (args[1] == "SUCC" ) {
        privileges = args[2] - 0;
        loggedin = true;
        loginoverlay.hidden = true;
        setUpNavBar();
      }
      break;
    case "CHROOMS":
      renderChrooms(args.splice(1).join(" "));
      break;
    case "CHADD":
      ws.send("LISTCHROOMS");
      break;
  }
});
