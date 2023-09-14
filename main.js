const { WebSocketServer } = require("ws");
const { parse } = require("url");
const fs = require("fs");
const { createServer } = require ("http");

let chatrooms = JSON.parse(fs.readFileSync("chatrooms.json"));
let chatroomparticipants = {
    // 'chat': [ws1, ws2]
};

let chathistories = {};

const server = createServer();
const wss = new WebSocketServer({
    noServer: true
});

function ischatroom (chatroom) {
    for (let cr of chatrooms['chatrooms']) {
        if (cr['name'] == chatroom) return true;
    }
    return false;
}

function broadcast (chatroom, content) {
    console.log(chatroom);
    for (let user of chatroomparticipants[chatroom]) {
        user.send(content);
    }
}

wss.on("connection", (ws, req) => {
    let username;
    let chatroom;

    ws.on("message", (data) => {
        let args = data.toString().split(" ");
        switch (args[0]) {
            case "JOIN":
                if (ischatroom(chatroom)) {
                    chatroomparticipants[chatroom].splice(chatroomparticipants[chatroom].indexOf(ws), 1);
                    broadcast(chatroom, "EXIT " + username);
                    chathistories[chatroom] += "EXIT " + username + "\n";
                }
                chatroom = "";
                for (let cr of chatrooms['chatrooms']) {
                    if (cr['name'] == args[1]) chatroom = args[1];
                    
                    else continue;
                    if (chatroomparticipants[args[1]]) chatroomparticipants[args[1]].push(ws);
                    else {
                        chatroomparticipants[args[1]] = [ws];
                        chathistories[args[1]] = "";
                    }
                    ws.send("CHIS " + chathistories[chatroom]);
                    chathistories[chatroom] += "JOIN " + username + "\n";

                    broadcast(chatroom, "JOIN " + username);
                }
                if (chatroom == "") {
                    chatroom = chatrooms['default'];
                    ws.send("NOTE Chatroom " + args[1] + " does not exist. You are now in the " + chatroom + " chatroom");

                    if (chatroomparticipants[chatroom]) chatroomparticipants[chatroom].push(ws);
                    else {
                        chatroomparticipants[chatroom] = [ws];
                        chathistories[chatroom] = "";
                    }
                }
                break;
            case "AUTH":
                username = args[1];
                break;
            case "MSG":
                if (args[1].length == 0) break;
                if (!ischatroom(chatroom)) break;
                let msg = args.slice(1).join(" ");

                console.log(chatroom + " " + username + " " + msg);
                chathistories[chatroom] += "MSG " + username + " " + msg + "\n";

                if (!chatroomparticipants[chatroom] && ischatroom(chatroom)) chatroomparticipants[chatroom] = [ws];

                broadcast(chatroom, "MSG " + username + " " + msg);
                break;
        }
    });

    ws.on("close", (w, code, reason) => {
        if (ischatroom(chatroom)) {
            console.log(chatroom);
            chatroomparticipants[chatroom].splice(chatroomparticipants[chatroom].indexOf(ws), 1);
            chathistories[chatroom] += "EXIT " + username + "\n";

            broadcast(chatroom, "EXIT " + username);
        }
    });
});

server.on("upgrade", (req, sock, head) => {
    const { pathname } = parse(req.url);
    if (pathname == "/chat") {
        wss.handleUpgrade(req, sock, head, (ws) => {
            wss.emit("connection", ws, req)
        });
    }
});

server.on("request", (req, res) => {
    const { pathname } = parse(req.url);

    if (req.method == "GET") {
        switch (pathname) {
            case '/chatrooms':
                res.writeHead(200, {"Content-Type": "application/json"});
                res.write(JSON.stringify(chatrooms), "binary");
                res.end();
                break;
            case '/':
                fs.readFile("./index.html", "binary", (err, file) => {
                    if (err) {
                        res.writeHead(500, {"Content-Type": "text/plain"});
                        res.write(err + "\n");
                        res.end();
                        return;
                    }

                    res.writeHead(200);
                    res.write(file, "binary");
                    res.end();
                });
                break;
            default:
                if (fs.existsSync("."+pathname)) {

                    let file = fs.readFileSync("."+pathname);
                    
                    res.writeHead(200);
                    res.write(file, "binary");
                    res.end();
                }
                break;
        }
    }
    
});

server.listen(3000);