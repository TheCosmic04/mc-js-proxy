var mc = require(`minecraft-protocol`);
var handler = require("./command-handler.js");
var util = require("./util.js");

require('events').EventEmitter.defaultMaxListeners = Infinity;

var version = process.argv[2] || require("./config.json").version || "1.15.2";
var timeout = 15;
var prefix = "/";
handler.init(prefix, "./commands");
handler.bindEvents = bindEvents;

var options = {
    host:"localhost",
    port:"25565",
    kickTimeout:1000*10,
    checkTimeoutInterval:1000*4,
    "online-mode": false,
    motd: "Nodejs proxy server",
    maxPlayers: 1,
    keepAlive: true,
    version: version
}

const proxy = mc.createServer(options);

var clients = {};
function endClient(id, reason = "kicked") {
    let client = clients[id].client;
    let username = client.username;

    console.log(`Ended client ${id} (Reason: ${reason}, Username: ${client.username})`);

    delete clients[username];
    delete clients[id];
}

proxy.on("login", function(client) {
    if (clients[client.username] != null && clients[client.username].username != null) {
        client.end("§4Already logged-in");
        clients[clients[client.username].id].connecting = false;
        console.log(`Kicked client ${client.id} (Reason: Already logged-in, Username: ${client.username})`);
        return;
    }
    else {
        clients[client.username] = {};
        clients[client.username].username = client.username;
        clients[client.username].id = client.id;
        console.log(`Client ${client.id} logged-in (Username: ${client.username})`);
    }

    clients[client.id] = {};
    clients[client.id].client = client;
    clients[client.id].connecting = false;

    initilizeClient(client);
    client.write("chat", util.message("Commands:\n -/connect <ip> [port]  -> connect to a server (default port: 25565).\n -/plist or /proxylist  -> List of all the players connected to the proxy."));


    client.write(`login`, {
		entityId: client.id,
		dimension: 0,
		gamemode: 0,
		difficulty: 0,
		maxPlayers: proxy.maxPlayers,
		levelType: `default`,
		reducedDebugInfo: false,
		hashedSeed: 0
    });
    client.write(`position`, {
		x: 0,
		y: 0,
		z: 0,
		yaw: 0,
		pitch: 0
    });
});


function C2S(id, packet, meta) {  //ClientToServer
    if (clients[id] == null) return;
    let client = (clients[id].client != null) ? clients[id].client : null;
    if (client == null) return;
    let cancelled = false;
    switch (meta.name) {
        case "chat":
            (chatEvent(client, packet, meta) === true) ? cancelled = true : null;
            break;
        case "tab_complete":
            //console.log(packet);
            break;
    }

    if (!cancelled)
        fowardPacket(id, packet, meta, {type: "client", source: client});
}

function S2C(id, packet, meta) {  //ServerToClient
    if (clients[id] == null) return;
    let bot = (clients[id].bot != null) ? clients[id].bot : null;
    if (bot == null) return;
    let cancelled = false;
    switch (meta.name) {
        case "disconnect":
            bot.end();
            cancelled = true;
            break;
        case "kick_disconnect":
            bot.end();
            cancelled = true;
            break;
        case "player_info":
            if (!Array.isArray(packet.data)) 
                break;
            if (bot.players[packet.data[0].UUID] == null) 
                bot.players[packet.data[0].UUID] = {}  
            switch (packet.action) {
                case 0:
                    bot.players[packet.data[0].UUID] = packet.data[0];
                    break;
                case 1:
                    bot.players[packet.data[0].UUID].gamemode = packet.data[0].gamemode;
                    break; 
                case 2:
                    bot.players[packet.data[0].UUID].ping = packet.data[0].ping;
                    break;
                case 4:
                    delete bot.players[packet.data[0].UUID];
                    break;
                default:
                    console.log(packet);
                    break;
                
            }
            break;
        case "spawn_entity_painting":
        case "spawn_entity_living":
            bot.entities[packet.entityId] = packet;
            break;
        case "entity_destroy":
            if (bot.entities[packet.entityId] != null)
                delete bot.entities[packet.entityId];
            break;
        case "login":
            cancelled = true;
        case "tab_complete":
            //console.log(packet);
            break;
            
    }

    if (!cancelled)
        fowardPacket(id, packet, meta, {type: "bot", source: bot});
}


function initilizeClient(client) {
    client.on(`packet`, function(packet, meta) {
        C2S(client.id, packet, meta)
    });
    client.on(`end`, function(reason) {
        if (clients[client.id].bot != null && !clients[client.id].bot.ended)
            clients[client.id].bot.end();
        if (reason !== "§4Already logged-in")
            endClient(client.id, "Disconnected.");
    });
}

function fowardPacket(id, packet, meta, source) {
    if (clients[id] == null || (!(source instanceof Object) && !("type" in source) && !("source" in source))) return;

    switch (source.type) {
        case "client":
            if (clients[id].bot != null && !clients[id].bot.ended) clients[id].bot.write(meta.name, packet);
            break;
        case "bot":
            if (clients[id].bot == source.source && !clients[id].bot.ended) clients[id].client.write(meta.name, packet);
            break;
    }
}

function chatEvent(client, packet, meta) {
    let content = packet.message;
    let args = content.split(" ");
    let cmd = args.shift().slice(handler.prefix.length);

    if (!handler.isCommand(cmd)) return false;
    let result = handler.execute(client, cmd, args, clients);

    let cancelled = false;
    if (result.status == "error") {
        client.write("chat", message("§4An error occurred while executing the command!"));
        console.log(`Code: ${result.code}\nError: ${result.error}`);
    } else if (result.status == "success") {
        if (typeof(result.value) === "boolean")
            cancelled = result.value;
    }
    return cancelled;
}

function bindEvents(bot, id) {
    if (bot == null || id == null) return;

    bot.on("packet", function(packet, meta) {
        S2C(id, packet, meta);
    });
    bot.on("end", function(reason) {
        if (clients[id] == null) return;
        if (clients[id] == null || clients[id].bot != bot) {
            let entities = [];
            Object.keys(bot.entities).forEach(key => {entities.push(bot.entities[key].entityId)});
            clients[id].client.write("entity_destroy", {entityIds: entities});
            
            Object.keys(bot.players).forEach(key => {
                clients[id].client.write("player_info", {
                    action: 4,
                    data: [{
                        UUID: key,
                        name: undefined,
                        properties: undefined,
                        gamemode: undefined,
                        ping: undefined,
                        displayName: undefined
                    }]
                });
            });
            return;
        }
        console.log(`Removing bot id: ${id} (username: ${clients[id].client.username})`);

        clients[id].client.end(reason);
        // delete bot;
    })

}
