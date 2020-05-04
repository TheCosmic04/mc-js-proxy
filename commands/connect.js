var mc = require(`minecraft-protocol`);
var util = require("./../util.js");

var version = process.argv[2] || require("./../config.json").version || "1.15.2";
var timeout = require("./../config.json").bot_timeout * 1000 || 15 * 1000;

var alias = ["connect"];
var usage = `{prefix}${alias[0]} <ip> [port]`;
var description = "Allow you to connect to any specified server (Default port: 25565)."

function execute(client, command, args, handler, clients) {
    if (args.length < 1) {
        client.write("chat", util.message(`§4${usage.replace(/{prefix}/, handler.prefix)}`));
        return true;
    }
    if (clients[client.id].connecting === true) {
        client.write("chat", util.message("§4Already connecting to a server!"));
        return true;
    }
    clients[client.id].connecting = true;
    
    let options = {
        host: args[0],
        port: args[1] || 25565,
        version: handler.version,
        username: client.username,
        keepAlive: true
    };
    let bot = null;
    try {
        bot = mc.createClient(options);
    } catch (err) {
        console.log(err);
        client.write("chat", util.message(`§4${err}`));
        clients[client.id].connecting = false;
        return true;
    }
    
    if (clients[client.id].connecting === true) {
        console.log(`Adding bot id: ${client.id} (IP: ${options.host}, Username: ${client.username})`);
        client.write("chat", util.message(`§aConnecting to ${options.host}...`));
    } else {
        client.write("chat", util.message(`§4Error: Couldnt connect to the server ${options.host}`));
    }
    
    setTimeout(function() {
        if (clients[client.id] == null || clients[client.id].bot == bot || clients[client.id].connecting === false) return;
        console.log(`Bot id ${client.id} timed out!`);
        clients[client.id].connecting = false;
        if (!bot.ended) {
            bot.end();
        }
        client.write("chat", util.message("§4Error: timeout!"));
    }, timeout * 1000);
    
    bot.on("error", function(err) {
        console.log(err);
        if (clients[client.id] == null || clients[client.id].bot == bot) return;
        console.log(err);
        clients[client.id].connecting = false;
        client.write("chat", util.message(`§4${err}`));
        bot.end();
    });
    
    bot.on("packet", function(packet, meta) {
        if (clients[client.id] == null || clients[client.id].bot == bot) return;
        switch (meta.name) {
            case "login":
                if (bot.socket._host == null) {
                    return;
                }
                client.write("game_state_change", {reason: 3, gameMode: packet.gameMode});
                console.log(`Adding bot id: ${client.id} (IP: ${bot.socket._host}, Username: ${client.username})`);
                if (clients[client.id].bot != null) clients[client.id].bot.end();
                bot.players = {};
                bot.entities = {};
                clients[client.id].bot = bot;
                clients[client.id].connecting = false;
                client.write("chat", util.message(`§aSuccessfully connected to ${bot.socket._host}`));
                handler.bindEvents(bot, client.id);
                return;
        }
    });
    return true;
}

module.exports = {
    alias,
    usage,
    description,
    execute
};