let ws = new WebSocket("ws://"+location.host+"/chat");

let username;
let loggedin = false;

let currentchatusers = [];
let selecteduser;

const background = document.getElementById("background");
const themelink = document.getElementById("theme");
const lightmode = document.getElementById("lightmode");
const themechange = document.getElementById("themechange");
const themelist = document.getElementById("themelist");

const chistorybox = document.getElementById("chathistory");
const chatroomlist = document.getElementById("chatroomlist");
const userlist = document.getElementById("userlist");
const msgin = document.getElementById("messagein");
const msgbtn = document.getElementById("msgsubmit");
const title = document.getElementById("title");
const description = document.getElementById("description");

themechange.addEventListener("mouseenter", () => themelist.hidden = false);
themechange.addEventListener("mouseleave", () => themelist.hidden = true);

lightmode.addEventListener("mousedown", () => background.hidden = true);
lightmode.addEventListener("mouseup", () => background.hidden = false);
lightmode.addEventListener("mouseleave", () => background.hidden = false);

let chathistory = "";
let currentchatroom = "";
let chroomjson;

ws.addEventListener("message", (ev) => {
  let msg = ev.data;
  let args = msg.split(" ");
  switch (args[0]) {
    case "CHIS":
      chathistory = args.splice(1).join(" ").trim();
      renderchathistory();
      break;
    default:
      chathistory += "\n" + msg;
      renderline(msg)
      break;
  }
});

function sendmsg () {
  if (!loggedin) {
    if (!username) {
      if (msgin.value.length == 0) return;
      username = msgin.value;
      msgin["placeholder"] = "Password";
      msgin["type"] = "password";
      msgin.value = "";
      return;
    }
    if (msgin.value.length == 0) return;
    let passwd = msgin.value;
    ws.send("AUTH " + username + " " + passwd);
    let room = "";
    msgin["placeholder"] = "Message";
    msgin["type"] = "text";
    msgin.value = "";
    loggedin = true;
    for (let chatroom of chroomjson['chatrooms']) {
      if (chatroom['name'] == chroomjson['default']) {
        room = chatroom;
      }
    }
    joinRoom(room);
    return;
  }
  ws.send("MSG " + msgin.value);
  msgin.value = "";
}

msgin.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") sendmsg();
})
msgbtn.addEventListener("click", (ev) => {
  sendmsg();
});

function renderchathistory() {
  chistorybox.innerHTML = "";
  currentchatusers = [];
  historylines = chathistory.split("\n");
  for (let line of historylines) {
    renderline(line);
  }
}

function renderline(line) {
  let lineargs = line.split(" ");
  let currenthtmlelement = document.createElement("p");
  if (lineargs[0] == "MSG") {
    let message = lineargs.splice(2).join(" ");
    if(message.includes('@'.concat(username)) || (userlist && lineargs[1] == selecteduser)){
      currenthtmlelement.className = "wsmention";
    } else {
      currenthtmlelement.className = "wsmessage";
    }
    currenthtmlelement.innerText = "[ " + lineargs[1] + " ]: " + message;
  }
  if (lineargs[0] == "JOIN") {
    currenthtmlelement.className = "wsdetail";
    currenthtmlelement.innerText = lineargs[1] + " joined!";
    currentchatusers.push(lineargs[1]);
    renderusers();
  }
  if (lineargs[0] == "EXIT") {
    currenthtmlelement.className = "wsdetail";
    currenthtmlelement.innerText = lineargs[1] + " left!";
    currentchatusers.splice(currentchatusers.indexOf(lineargs[1]),1);
    renderusers();
  }
  if (lineargs[0] == "NOTE") {
    currenthtmlelement.className = "wswarning";
    currenthtmlelement.innerText = lineargs.splice(1).join(" ");
  }
  if (lineargs[0] == "ERR") {
    currenthtmlelement.className = "wswarning";
    currenthtmlelement.innerText = "Failed to log in";
    msgin.value = "";
    username = "";
    loggedin = false;
  }

  chistorybox.appendChild(currenthtmlelement);
}

function joinRoom(room){
  if (loggedin && currentchatroom != room['name']){
    currentchatroom = room['name'];
    ws.send("JOIN " + room['name']);
    title.innerText = room['name'].charAt(0).toUpperCase() + room['name'].slice(1);
    description.innerText = room['description'];
  }
}

async function getchatrooms () {
  let chatrooms = await fetch("/chatrooms");
  chroomjson = await chatrooms.json();
  for (let chatroom of chroomjson['chatrooms']) {
    let chatroomelement = document.createElement("div");
    chatroomelement.className = "chatroom";
    chatroomelement.innerText = "/"+chatroom['name'];
    chatroomelement.title = chatroom['description'];
    chatroomelement.addEventListener("click", () => {
      joinRoom(chatroom);
    });
    chatroomlist.appendChild(chatroomelement);
  }
}

function renderusers () {
  userlist.innerHTML = "";
  for (let user of currentchatusers) {
    let userelement = document.createElement("div");
    userelement.className = "user";
    if (selecteduser == user) userelement.classList.add("wsmention");
    userelement.innerText = "@"+user;
    userelement.addEventListener("click", () => {
      if (selecteduser == user) selecteduser = "";
      else selecteduser = user;
      renderchathistory();
    });
    userlist.appendChild(userelement);
  }
}

async function renderthemes () {
  let themesjson = await (await fetch("/themes/themes.json")).json();
  for (let th in themesjson['themes']) {
    let currentthemeelement = document.createElement("div");
    currentthemeelement.className = "theme";
    currentthemeelement.style.backgroundColor = themesjson['themes'][th]['colour'];
    currentthemeelement.addEventListener("click", () => {
      themelink.href = themesjson['themes'][th]['href'];
    });
    themelist.appendChild(currentthemeelement);
  }
}

renderthemes();
getchatrooms();
