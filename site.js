let ws = new WebSocket("ws://" + location.host + "/chat");

let username;
let permissions;
let loggedin = false;

let currentchatusers = [];
let selecteduser;

const chistorybox = document.getElementById("chathistory");
const chatroomlist = document.getElementById("chatroomlist");
const userlist = document.getElementById("userlist");
const msgin = document.getElementById("messagein");
const msgbtn = document.getElementById("msgsubmit");
const title = document.getElementById("title");
const lightmode = document.getElementById("lightmode");
const chaddbtn = document.getElementById("CHADDbtn");
const description = document.getElementById("description");
const chatroomselector = document.getElementById("chatroomselector");

lightmode.addEventListener("mousedown", () => {
  document.body.style.backgroundColor = '#ffffff';
});

lightmode.addEventListener("mouseup", () => document.body.style.backgroundColor = "#0f0f0f");
lightmode.addEventListener("mouseleave", () => document.body.style.backgroundColor = "#0f0f0f");

chaddbtn.addEventListener("mousedown", () => {
  title.innerText = "Enter name";
  description.innerText = "Enter the name of the new chatroom";
  mode = "CHADD";
  newch["name"] = "";
  newch["description"] = "";
  msgin["placeholder"] = "Name";
  chistorybox.innerHTML = "";
});

let chathistory = "";
let currentchatroom = "";
let chroomjson;
let mode = "";
let newch = { "name": "", "description": "" };

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

function sendmsg() {
  if (mode == "CHADD") {
    if (msgin.value.length == 0) return;
    if (newch["name"] == "") {
      newch["name"] = msgin.value.split(" ")[0];
      msgin.value = ""
      title.innerText = "Enter description";
      description.innerText = "Enter the description of the new chatroom";
      msgin["placeholder"] = "Description";
    } else {
      newch["description"] = msgin.value;
      msgin.value = "";
      ws.send("CHADD " + newch["name"] + " " + newch["description"]);
      console.log(newch);
      mode = "";
      msgin["placeholder"] = "Message";
      resetChitory();
    }
  } else {
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
      msgin["placeholder"] = "Message";
      msgin["type"] = "text";
      msgin.value = "";
      return;
    }
    ws.send("MSG " + msgin.value);
    msgin.value = "";
  }
}

msgin.addEventListener("keypress", (ev) => {
  if (ev.key == "Enter") sendmsg();
})
msgbtn.addEventListener("click", (ev) => {
  sendmsg();
});

function resetChitory() {
  currentchatroom = currentchatroom;
  title.innerText = currentchatroom.charAt(0).toUpperCase() + currentchatroom.slice(1);
  let chatroom;
  for (let cr of chroomjson['chatrooms']) {
    if (cr['name'] == currentchatroom) {
      chatroom = cr;
    }
  }
  description.innerText = chatroom['description'];
  renderchathistory();
}

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
  switch (lineargs[0]) {
    case "MSG":
      let message = lineargs.splice(2).join(" ");
      if (message.includes('@'.concat(username)) || (userlist && lineargs[1] == selecteduser)) {
        currenthtmlelement.className = "wsmention";
      } else {
        currenthtmlelement.className = "wsmessage";
      }
      currenthtmlelement.innerText = "[ " + lineargs[1] + " ]: " + message;
      break;
    case "JOIN":
      currenthtmlelement.className = "wsdetail";
      currenthtmlelement.innerText = lineargs[1] + " joined!";
      currentchatusers.push(lineargs[1]);
      renderusers();
      break;
    case "EXIT":
      currenthtmlelement.className = "wsdetail";
      currenthtmlelement.innerText = lineargs[1] + " left!";
      currentchatusers.splice(currentchatusers.indexOf(lineargs[1]), 1);
      renderusers();
      break;
    case "NOTE":
      currenthtmlelement.className = "wswarning";
      currenthtmlelement.innerText = lineargs.splice(1).join(" ");
      break;
    case "LOGIN":
      currenthtmlelement.className = "wswarning";
      switch (lineargs[1]) {
        case "ERR":
          currenthtmlelement.innerText = "Failed to log in";
          username = "";
          msgin["placeholder"] = "Username";
          loggedin = false;
          break;
        case "SUCC":
          let room = "";
          for (let chatroom of chroomjson['chatrooms']) {
            if (chatroom['name'] == chroomjson['default']) {
              room = chatroom;
            }
          }
          loggedin = true;
          joinRoom(room);
          console.log(room);
          permissions = lineargs[2] - 0;
          currenthtmlelement.innerText = "Debug";
          if (permissions & 1) chaddbtn.hidden = false; //1 allows the user te create chats
          break;
      }
      break;
    case "CHADD":
      getchatrooms();
      chistorybox.className = "wsdetail";
      chistorybox.innerText += "\nServer " + lineargs[1] + " got created.\nJoin now!";
      break;
    case "USER":
      if (lineargs[1] == "BANNED") location = location;
      break;
  }

  chistorybox.appendChild(currenthtmlelement);
}

function joinRoom(room) {
  if (loggedin && currentchatroom != room['name']) {
    currentchatroom = room['name'];
    ws.send("JOIN " + room['name']);
    title.innerText = room['name'].charAt(0).toUpperCase() + room['name'].slice(1);
    description.innerText = room['description'];
  }
}

async function getchatrooms() {
  let chatrooms = await fetch("/chatrooms");
  chroomjson = await chatrooms.json();
  chatroomlist.innerHTML = "";
  for (let chatroom of chroomjson['chatrooms']) {
    let chatroomelement = document.createElement("div");
    chatroomelement.className = "chatroom";
    chatroomelement.innerText = "/" + chatroom['name'];
    chatroomelement.title = chatroom['description'];
    chatroomelement.addEventListener("click", () => {
      joinRoom(chatroom);
    });
    chatroomlist.appendChild(chatroomelement);
  }
}

function renderusers() {
  userlist.innerHTML = "";
  for (let user of currentchatusers) {
    let userelement = document.createElement("div");
    userelement.className = "user";
    if (selecteduser == user) userelement.classList.add("wsmention");
    userelement.innerText = "@" + user;
    userelement.addEventListener("click", () => {
      if (selecteduser == user) selecteduser = "";
      else selecteduser = user;
      renderchathistory();
    });
    // Add ban button if user is privileged
    if (permissions & 4) {
      let banicon = document.createElement("button");
      banicon.className = "banicon";
      banicon.addEventListener("click", (ev) => {
        ws.send("BAN " + user);
      });
      userelement.appendChild(banicon);
    }
    userlist.appendChild(userelement);
  }
}

getchatrooms();
