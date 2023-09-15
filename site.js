let ws = new WebSocket("ws://"+location.host+"/chat");

let username;
let loggedin = false;

const chistorybox = document.getElementById("chathistory");
const chatroomlist = document.getElementById("chatroomlist");
const msgin = document.getElementById("messagein");
const msgbtn = document.getElementById("msgsubmit");

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
            chathistory += msg + "\n";
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
            msgin.value = "";
            return;
        }
        if (msgin.value.length == 0) return;
        let passwd = msgin.value;
        ws.send("AUTH " + username + " " + passwd);
        ws.send("JOIN " + chroomjson['default']);
        currentchatroom = chroomjson['default'];
        msgin["placeholder"] = "Message";
        msgin.value = "";
        loggedin = true;
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
    historylines = chathistory.split("\n");
    for (let line of historylines) {
        renderline(line);
    }
}

function renderline(line) {
    let lineargs = line.split(" ");
    let currenthtmlelement = document.createElement("p");
    if (lineargs[0] == "MSG") {
        currenthtmlelement.className = "wsmessage";
        currenthtmlelement.innerText = "[ " + lineargs[1] + " ]: " + lineargs.splice(2).join(" ");
    }
    if (lineargs[0] == "JOIN") {
        currenthtmlelement.className = "wsdetail";
        currenthtmlelement.innerText = lineargs[1] + " joined!";
    }
    if (lineargs[0] == "EXIT") {
        currenthtmlelement.className = "wsdetail";
        currenthtmlelement.innerText = lineargs[1] + " left!";
    }
    if (lineargs[0] == "NOTE") {
        currenthtmlelement.className = "wswarning";
        currenthtmlelement.innerText = lineargs.splice(1).join(" ");
    }

    chistorybox.appendChild(currenthtmlelement);
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
            if (username && currentchatroom != chatroom['name']){
                currentchatroom = chatroom['name']
                ws.send("JOIN " + chatroom['name']);
            }
        });
        chatroomlist.appendChild(chatroomelement);
    }
}

getchatrooms();