/* Inits & requires */

const { WebSocketServer } = require("ws");
const { parse } = require("url");
const fs = require("fs");
const { createServer } = require ("http");
const { createHash, randomBytes } = require("crypto");

let chatrooms = JSON.parse(fs.readFileSync("chatrooms.json"));
let chatroomparticipants = {
  // 'chat': [ws1, ws2]
};

let logins = JSON.parse(fs.readFileSync("./logins.json"));

let chathistories = {};

const server = createServer();
const wss = new WebSocketServer({
  noServer: true
});

/* Actual code */

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

function validatePasswd(hash, salt, passwdattempt) {
  return hash == Buffer.from(createHash('sha256').update(passwdattempt + salt).digest('hex')).toString('base64');
}

function hashPassword(passwd) {
  let salt = randomBytes(127).toString("base64");
  let hash = Buffer.from(createHash('sha256').update(passwd + salt).digest('hex')).toString('base64');
  
  return {
    salt: salt,
    hash: hash,
  };
}

wss.on("connection", (ws, req) => {
  let username;
  let chatroom;
  let loggedin = false;

  ws.on("message", (data) => {
    let args = data.toString().split(" ");
    switch (args[0]) {
      case "JOIN":
        if (!loggedin) break;
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
        if (args.length < 3) break;
        username = args[1];
        if (username in logins) {
          let success = validatePasswd(logins[username]['hash'], logins[username]['salt'], args[2]);
          if (!success) {
            username = "";
            ws.send("ERR LOGIN");
            console.log("login attempt failed");
          }
          else {
            loggedin = true
          };
        }
        else {
          let login = hashPassword(args[2]);
          logins[username] = {};
          console.log(login.hash);
          console.log(login.salt);
          logins[username]['hash'] = login.hash.toString();
          logins[username]['salt'] = login.salt.toString();
          loggedin = true;
          fs.writeFileSync("./logins.json", JSON.stringify(logins, "utf8"));
        }
        break;
      case "MSG":
        if (!loggedin) break;
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
