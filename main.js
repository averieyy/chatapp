const { WebSocketServer } = require("ws");
const { parse } = require("url");
const fs = require("fs");
const { createServer } = require ("http");

let chathistory = "";

const server = createServer();
const wss = new WebSocketServer({
    noServer: true
});

let activews = [];

wss.on("connection", (ws, req) => {
    let username = "";
    ws.on("message", (data) => {
        let args = data.toString().split(" ");
        switch (args[0]) {
            case "AUTH":
                username = args[1];
                activews.push(ws);
                ws.send("CHIS " + chathistory);
                chathistory += "AUTH " + username + "\n";
                for (let user of activews) {
                    user.send("AUTH " + username);
                }
                break;
            case "MSG":
                if (args[1].length == 0) break;
                let msg = args.slice(1).join(" ");
                console.log(msg);
                chathistory += "MSG " + username + " " + msg + "\n";
                for (let user of activews) {
                    user.send("MSG " + username + " " + msg);
                }
                break;
        }
    });

    ws.on("close", (w, code, reason) => {
        activews.splice(activews.indexOf(ws), 1);
        chathistory += "EXIT " + username + "\n";
        for (let user of activews) {
            user.send("EXIT " + username);
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

    if (pathname == "/") {
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
    }
    else {
        if (fs.existsSync("."+pathname)) {

            let file = fs.readFileSync("."+pathname);
            
            res.writeHead(200);
            res.write(file, "binary");
            res.end();
        }
    }
});

server.listen(3000);