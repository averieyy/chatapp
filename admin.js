let ws = new WebSocket(`ws://${location.host}/admin`);

const backoverlay = document.getElementById("overlay");
const loginpopup = document.getElementById("loginpopup");
const usernamein = document.getElementById("usernamein");
const passwdin = document.getElementById("passwdin");
const loginbtn = document.getElementById("submitlogin");
const editchroompopup = document.getElementById("editchroompopup");
const chroomtitlein = document.getElementById("titlein");
const chroomdescin = document.getElementById("descin");
const chroomeditsubmit = document.getElementById("editchroomsubmit");

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

let currentchroom = "null ";

function login() {
  username = usernamein.value;
  ws.send(`AUTH ${username} ${passwdin.value}`);
  usernamein.value = "";
  passwdin.value = "";
}

function editchroom() {
  if (currentchroom == "null ") ws.send(`CHADD ${chroomtitlein.value} ${chroomdescin.value}`);
  else ws.send(`CHEDIT ${currentchroom} ${chroomtitlein.value} ${chroomdescin.value}`);
  chroomtitlein.value = "";
  chroomdescin.value = "";
  editchroompopup.classList.add("hidden");
  backoverlay.classList.add("hidden");
}



usernamein.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") passwdin.focus();
});
passwdin.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") login();
});
loginbtn.addEventListener("click", () => {
  login();
});

chroomtitlein.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") chroomdescin.focus();
  // To not allow spaces
  else if (!"qwertyuiopasdfghjklzxcvbnm-.0123456789".includes(ev.key)) ev.preventDefault();

  if (ev.key == " ") chroomtitlein.value += "-";
});
chroomdescin.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") editchroom();
});
chroomeditsubmit.addEventListener("click", () => {
  editchroom();
});
editchroompopup.addEventListener("keydown", (ev) => {
  if (ev.key == "Escape") {
    chroomtitlein.value = "";
    chroomdescin.value = "";
    editchroompopup.classList.add("hidden");
    backoverlay.classList.add("hidden");
  }
});

function switchTab(navelement) {
  let generalid = navelement.id.split("nav")[0];
  for (let configarea of configareas) {
    if (configarea.id == generalid) {
      configarea.classList.remove("hidden");
    }
    if (configarea.id == selectednavelement.id.split("nav")[0]) {
      configarea.classList.add("hidden");
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

function revealChroomEditPopup(editElement = "null ") {
  currentchroom = editElement;

  backoverlay.classList.remove("hidden");
  editchroompopup.classList.remove("hidden");
  chroomtitlein.focus();
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

    let chroomeditmenu = document.createElement("div");
    chroomeditmenu.className = "chroomeditmenu";

    let chroomeditbtn = document.createElement("div");
    let chroomrmbtn = document.createElement("div");

    // Chatroom edit & remove buttons
    chroomeditbtn.className = "chroomeditbtn";
    chroomrmbtn.className = "chroomrmbtn";

    chroomeditbtn.addEventListener("click", () => 
      revealChroomEditPopup(chatroom['name'])
    );

    chroomrmbtn.addEventListener("click", () => 
      ws.send(`CHRM ${chatroom['name']}`)
    );

    chroomeditmenu.appendChild(chroomeditbtn);
    chroomeditmenu.appendChild(chroomrmbtn);

    chroomelement.appendChild(chroomtitle);
    chroomelement.appendChild(chroomdesc);

    chroomelement.appendChild(chroomeditmenu);

    chroomgrid.appendChild(chroomelement);
  }
  let addchroomelement = document.createElement("div");
  addchroomelement.className = "addchroom";
  addchroomelement.addEventListener("click", () => {
    // Create a new element, i guess
    revealChroomEditPopup();
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
        backoverlay.classList.add("hidden");
        loginpopup.classList.add("hidden");

        setUpNavBar();
      }
      break;
    case "CHROOMS":
      renderChrooms(args.splice(1).join(" "));
      break;
    case "CHADD":
      ws.send("LISTCHROOMS");
      break;
    case "CHEDIT":
    case "CHRM":
      ws.send("LISTCHROOMS");
      break;
  }
});
