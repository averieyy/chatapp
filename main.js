/* Requires */

const { WebSocketServer } = require("ws");
const { parse } = require("url");
const fs = require("fs");
const { createServer } = require("http");
const { createHash, randomBytes } = require("crypto");

/* Variables with inits */

// Banned users
let bannedusers = {
  "banned": [],
  "ipbanned": []
};
if (fs.existsSync("./bannedusers.json")) {
  bannedusers = JSON.parse(fs.readFileSync("./bannedusers.json"));
}

// Chatrooms
let chatrooms = JSON.parse(fs.readFileSync("chatrooms.json"));
let chatroomparticipants = {
  // 'chat': [ws1, ws2]
};

// Fill <<chatroomparticipants>> with empty arrays
for (let chatroom of chatrooms['chatrooms']) {
  chatroomparticipants[chatroom['name']] = [];
}

// User logins
let logins;
if (!fs.existsSync("./logins.json")) {
  logins = {};
}
else {
  let rawlogins = fs.readFileSync("./logins.json");
  if (rawlogins == "") logins = {};
  else logins = JSON.parse(rawlogins);
}

// Chathistory (stored by chatroom)
let chathistories = {};

const server = createServer();
const wss = new WebSocketServer({
  noServer: true
});

const adminwss = new WebSocketServer({
  noServer: true
});

/* Functions */

function ischatroom(chatroom) {
  for (let cr of chatrooms['chatrooms']) {
    if (cr['name'] == chatroom) return true;
  }
  return false;
}

function isuser(username) {
  return username in logins;
}

function broadcastAll(content) {
  for (let chatroom of chatrooms['chatrooms']) {
    broadcast(chatroom['name'], content);
  }
}

function broadcast(chatroom, content) {
  console.log(`${chatroom} ${content}`);
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

/* HTTP & WS Server */

wss.on("connection", (ws, req) => {
  // let ip = req.socket.remoteAddress; // For possible ip bans
  let username;
  let privileges;
  let chatroom;
  let lastmessagetimings = [];
  let timeoutuntil = 0;
  let felonies = 0;
  let loggedin = false;

  ws.on("message", (data) => {
    let args = data.toString().split(" ");
    if (loggedin && bannedusers['banned'].includes(username)) {
      ws.send("NOTE This account has been banned.");
      ws.send("USER BANNED");
      loggedin = false;
    }
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
          if (bannedusers['banned'].includes(username)) {
            username = "";
            ws.send("LOGIN ERR");
            ws.send("NOTE This account has been banned");
            break;
          }
          if (!success) {
            username = "";
            ws.send("LOGIN ERR");
          } else {
            ws.send("LOGIN SUCC " + logins[username]['privileges']);
            loggedin = true;
            privileges = logins[username]['privileges'];
          };
        } else {
          let login = hashPassword(args[2]);
          logins[username] = {};
          logins[username]['hash'] = login.hash.toString();
          logins[username]['salt'] = login.salt.toString();
          logins[username]['privileges'] = 0;
          loggedin = true;
          ws.send("LOGIN SUCC " + logins[username]['privileges'])
          fs.writeFileSync("./logins.json", JSON.stringify(logins, "utf8"));
        }
        break;
      case "MSG":
        if (!loggedin) break;
        if (args[1].length == 0) break;
        if (!ischatroom(chatroom)) break;

        // Anti spam
        if (!(privileges & (1 << 1))) {
          let now = new Date().getTime();
          if (timeoutuntil > now) break;
          for (let message of lastmessagetimings) {
            if (message + 20000 < now) lastmessagetimings.splice(lastmessagetimings.indexOf(message), 1);
          }
          lastmessagetimings.push(now)
          if (lastmessagetimings.length >= 13) {
            // Punishment
            ws.send("NOTE Spamming is disallowed, you will be timed out for " + 4 * (2 ** felonies) + " seconds");
            timeoutuntil = now + 4 * (2 ** felonies) * 1000;
            felonies++;
            lastmessagetimings = [];
            break;
          }
        }


        let msg = args.slice(1).join(" ");

        chathistories[chatroom] += "MSG " + username + " " + msg + "\n";

        if (!chatroomparticipants[chatroom] && ischatroom(chatroom)) chatroomparticipants[chatroom] = [ws];

        broadcast(chatroom, "MSG " + username + " " + msg);
        break;
      case "CHADD":
        if (!loggedin) break;
        if (args[1].length == 0) break;
        if (ischatroom(args[1])) {
          ws.send("CHROOM EXISTS");
          break;
        }
        if (privileges & 1) {
          chatrooms['chatrooms'].push({ "name": args[1], "description": args.splice(2).join(" ") });
          fs.writeFileSync("./chatrooms.json", JSON.stringify(chatrooms, "utf8"));
          chatroomparticipants[args[1]] = [];
          broadcastAll("CHADD " + args[1]);
        }
        break;
      case "BAN":
        if (!loggedin) break;
        if (args.length == 1) break;
        if (args[1].length == 0) break;
        if (!(privileges & (1 << 2))) break;
        if (!isuser(args[1])) break;

        bannedusers['banned'].push(args[1]);
        if (args.length <= 2) args.push("The ban hammer has spoken!");
        broadcastAll(`BAN ${args[1]} ${username} ${args.splice(2)}`);
        fs.writeFileSync("bannedusers.json", JSON.stringify(bannedusers));
        break;
      case "IPBAN":
        if (!loggedin) break;
        if (args.length == 1) break;
        if (args[1].length == 0) break;
        if (!(privileges & (1 << 3))) break;
        if (!isuser(args[1])) break;

        bannedusers['ipbanned'].push(args[1]);
        if (args.length <= 2) args.push("The ban hammer has spoken!");
        broadcastAll(`IPBAN ${username} ${args.splice(2)}`);
        fs.writeFileSync("bannedusers.json", JSON.stringify(bannedusers));
        break;
      default: // In case a nerd messes up
        ws.send("NOTE This command is not supported.");
        break;
    }
  });

  ws.on("close", (w, code, reason) => {
    if (ischatroom(chatroom)) {
      chatroomparticipants[chatroom].splice(chatroomparticipants[chatroom].indexOf(ws), 1);
      chathistories[chatroom] += "EXIT " + username + "\n";

      broadcast(chatroom, "EXIT " + username);
    }
  });
});

adminwss.on("connection", (ws, req) => {
  let username;
  let privileges;
  let loggedin = false;
  ws.on("message", (data) => {
    let args = data.toString().split(" ");
    switch (args[0]) {
      case 'AUTH':
        if (args.length < 3) break;
        username = args[1];
        if (username in logins) {
          let success = validatePasswd(logins[username]['hash'], logins[username]['salt'], args[2]);
          if (bannedusers['banned'].includes(username)) {
            username = "";
            ws.send("LOGIN ERR");
            ws.send("NOTE This account has been banned");
            break;
          }
          if (!success) {
            username = "";
            ws.send("LOGIN ERR");
          } else {
            success = logins[username]['privileges'] != 0;
            if (!success) {
              ws.send("LOGIN ERR");
              ws.send("NOTE You aren't privileged enought to interact with the admin panel");
              break;
            }
            ws.send("LOGIN SUCC " + logins[username]['privileges']);
            loggedin = true;
            privileges = logins[username]['privileges'];
          };
        } else {
          ws.send("LOGIN ERR");
          ws.send("NOTE You need to already have an account with privileges");
        }
        break;
      case "CHADD":
        if (!loggedin) break;
        if (args[1].length == 0) break;
        if (ischatroom(args[1])) {
          ws.send("CHROOM EXISTS");
          break;
        }
        if (privileges & 1) {
          chatrooms['chatrooms'].push({ "name": args[1], "description": args.splice(2).join(" ") });
          fs.writeFileSync("./chatrooms.json", JSON.stringify(chatrooms, "utf8"));
          chatroomparticipants[args[1]] = [];
          broadcastAll("CHADD " + args[1]);
        }
        break;
      case "CHRM":
        if (!loggedin) break;
        if (args[1].length == 0) break;
        if (ischatroom(args[1])) {
          ws.send("CHRM DOESN'T EXIST");
          break;
        }
        if (privileges & 1) {
          let chrmindex = chatrooms['chatrooms'].find((chroomname) => {
            return chroomname == args[1];
          });
          if (chrmindex == -1) {
            ws.send("NOTE chroom doesn't exist")
            break;
          } else {
            chatrooms['chatrooms'].splice(chrmindex, 1);
          }
          fs.writeFileSync("./chatrooms.json", JSON.stringify(chatrooms, "utf8"));
          chatroomparticipants[args[1]] = [];
          broadcastAll("CHRM " + args[1]);
        }
      case "BAN":
        if (!loggedin) break;
        if (args.length == 1) break;
        if (args[1].length == 0) break;
        if (!(privileges & (1 << 2))) break;
        if (!isuser(args[1])) break;

        bannedusers['banned'].push(args[1]);
        if (args.length <= 2) args.push("The ban hammer has spoken!");
        broadcastAll(`BAN ${args[1]} ${username} ${args.splice(2)}`);
        fs.writeFileSync("bannedusers.json", JSON.stringify(bannedusers));
        break;
      case "UNBAN":
        if (!loggedin) break;
        if (args.length == 1) break;
        if (args[1].length == 0) break;
        if (!(privileges & (1 << 2))) break;
        if (!isuser(args[1])) break;

        let index = bannedusers.banned['banned'].indexOf(args[1]);
        if (index == -1) {
          ws.send("NOTE User hasn't been banned");
        } else {
          bannedusers.banned['banned'].splice(index, 1);
        }
        if (args.length <= 2) args.push("The ban hammer made a mistake!");
        broadcastAll(`UNBAN ${args[1]} ${username} ${args.splice(2)}`);
        fs.writeFileSync("bannedusers.json", JSON.stringify(bannedusers));
        break;
      case "IPBAN":
        if (!loggedin) break;
        if (args.length == 1) break;
        if (args[1].length == 0) break;
        if (!(privileges & (1 << 3))) break;
        if (!isuser(args[1])) break;

        bannedusers['ipbanned'].push(args[1]);
        if (args.length <= 2) args.push("The ban hammer has spoken!");
        broadcastAll(`IPBAN ${username} ${args.splice(2)}`);
        fs.writeFileSync("bannedusers.json", JSON.stringify(bannedusers));
        break;
      default: // In case a nerd messes up
        ws.send("NOTE This command is not supported.");
        break;
      case "IPUNBAN":
        if (!loggedin) break;
        if (args.length == 1) break;
        if (args[1].length == 0) break;
        if (!(privileges & (1 << 2))) break;
        if (!isuser(args[1])) break;

        let ipindex = bannedusers.banned['ipbanned'].indexOf(args[1]);
        if (ipindex == -1) {
          ws.send("NOTE User hasn't been banned");
        } else {
          bannedusers.banned['ipbanned'].splice(ipindex, 1);
        }
        if (args.length <= 2) args.push("The ban hammer made a mistake!");
        broadcastAll(`IPUNBAN ${args[1]} ${username} ${args.splice(2)}`);
        fs.writeFileSync("bannedusers.json", JSON.stringify(bannedusers));
        break;
    }
  });
});

server.on("upgrade", (req, sock, head) => {
  const { pathname } = parse(req.url);
  if (pathname == "/chat") {
    wss.handleUpgrade(req, sock, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
  if (pathname == "/admin") {
    adminwss.handleUpgrade(req, sock, head, (ws) => {
      adminwss.emit("connection", ws, req);
    });
  }
});

server.on("request", (req, res) => {
  const { pathname } = parse(req.url);

  if (req.method == "GET") {
    switch (pathname) {
      case '/chatrooms':
        res.writeHead(200, { "Content-Type": "application/json" });
        res.write(JSON.stringify(chatrooms), "binary");
        res.end();
        break;
      case '/':
        fs.readFile("./index.html", "binary", (err, file) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.write(err + "\n");
            res.end();
            return;
          }

          res.writeHead(200);
          res.write(file, "binary");
          res.end();
        });
        break;
      case '/adminpanel':
        let file = fs.readFileSync("./admin.html");

        res.writeHead(200);
        res.write(file, "binary");
        res.end();
      default:
        if (fs.existsSync("." + pathname)) {

          let file = fs.readFileSync("." + pathname);

          res.writeHead(200);
          res.write(file, "binary");
          res.end();
        }
        break;
    }
  }

});

server.listen(3000);
