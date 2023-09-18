let ws = new WebSocket(`ws://localhost:3000/admin`);

const loginoverlay = document.getElementById("overlay");
const usernamein = document.getElementById("usernamein");
const passwdin = document.getElementById("passwdin");
const loginbtn = document.getElementById("submitlogin");

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

function setUpNavBar() {
  for (let navelement of navelements) {
    let privileged = false;
    if (!(navelement.id in priviligereqs)) privileged = true;
    if (privileges & priviligereqs[navelement.id]) privileged = true;

    if (privileged) {
      navelement.addEventListener("click", () => {
        if (navelement != selectednavelement) {
          navelement.classList.add("selected");
          selectednavelement.classList.remove("selected");
          selectednavelement = navelement;
        }
      });
    } else {
      navelement.classList.add("disabled");
      navelement.title = "You aren't privileged enough to see this tab";
    } 
  }
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
    case "":
      break;
  }
});