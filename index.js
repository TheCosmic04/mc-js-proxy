var mc = require(`minecraft-protocol`);
require('events').EventEmitter.defaultMaxListeners = Infinity;

var version = process.argv[2] || "1.15.2";


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
    client.write("chat", message("Commands:\n -/connect <ip> [port]  -> connect to a server (default port: 25565).\n -/plist or /proxylist  -> List of all the players connected to the proxy."));


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

var timeout = 15;
var prefix = "/";
function chatEvent(client, packet, meta) {
    let content = packet.message;
    let args = content.split(" ");
    let cmd = args.shift().slice(prefix.length);

    let cancelled = false;
    switch (cmd.toLowerCase()) {
        case "connect":
            cancelled = true;
            if (args.length < 1) {
                client.write("chat", message(`§4Usage: ${prefix}connect <ip> [port]`));
                cancelled = true;
                break;
            }
            if (clients[client.id].connecting === true) {
                client.write("chat", message("§4Already connecting to a server!"));
                cancelled = true;
                break;
            }
            clients[client.id].connecting = true;

            let options = {
                host: args[0],
                port: args[1] || 25565,
                version: version,
                username: client.username,
                keepAlive: true
            };
            let bot = null;
            try {
                bot = mc.createClient(options);
            } catch (err) {
                console.log(err);
                client.write("chat", message(`§4${err}`));
                clients[client.id].connecting = false;
                return;
            }
            if (clients[client.id].connecting === true) {
                console.log(`Adding bot id: ${client.id} (IP: ${options.host}, Username: ${client.username})`);
                client.write("chat", message(`§aConnecting to ${options.host}...`));
            } else {
                client.write("chat", message(`§4Error: Couldnt connect to the server ${options.host}`));
            }

            setTimeout(function() {
                if (clients[client.id] == null || clients[client.id].bot == bot) return;
                console.log(`Bot id ${client.id} timed out!`);
                clients[client.id].connecting = false;
                if (!bot.ended) {
                    bot.end();
                }
                client.write("chat", message("§4Error: timeout!"));
            }, timeout * 1000);

            bot.on("error", function(err) {
                console.log(err);
                if (clients[client.id] == null || clients[client.id].bot == bot) return;
                console.log(err);
                clients[client.id].connecting = false;
                client.write("chat", message(`§4${err}`));
                bot.end();
            });

            bot.on("packet", function(packet, meta) {
                if (clients[client.id] == null || clients[client.id].bot == bot) return;
                switch (meta.name) {
                    case "login":
                        client.write("game_state_change", {reason: 3, gameMode: packet.gameMode});
                        if (clients[client.id].bot != null) clients[client.id].bot.end();
                        bot.players = {};
                        bot.entities = {};
                        clients[client.id].bot = bot;
                        clients[client.id].connecting = false;
                        client.write("chat", message(`§aSuccessfully connected to ${bot.socket._host}`));
                        bindEvents(bot, client.id)
                        break;
                }
            });
            break;
        case "plist":
        case "proxylist":
            let players = Object.keys(clients).filter(key => {return isNaN(Number(key))});
            client.write("chat", message(`Players:\n ${players.join(", ")}`));
            cancelled = true;
            break;


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

        clients[id].client.end();
        // delete bot;
    })

}

function message(msg) {
    return {message: JSON.stringify({text: msg}), position: 1};
}
