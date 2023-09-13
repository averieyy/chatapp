let ws = new WebSocket("ws://"+location.host+"/chat");

let username;

const chistorybox = document.getElementById("chathistory");
const msgin = document.getElementById("messagein");
const msgbtn = document.getElementById("msgsubmit");

let chathistory = "";

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
    if (!username) {
        username = msgin.value;
        ws.send("AUTH " + username);
        msgin["placeholder"] = "Message";
        msgin.value = "";
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
    if (lineargs[0] == "AUTH") {
        currenthtmlelement.className = "wsdetail";
        currenthtmlelement.innerText = lineargs[1] + " joined!";
    }
    if (lineargs[0] == "EXIT") {
        currenthtmlelement.className = "wsdetail";
        currenthtmlelement.innerText = lineargs[1] + " left!";
    }

    chistorybox.appendChild(currenthtmlelement);
}