var util = require("./../util.js");

var alias = ["proxylist", "plist"];
var usage = `{prefix}${alias[0]}`;
var description = "Show all the players connected to the proxy.";

function execute(client, command, args, handler, clients) {
    let players = Object.keys(clients).filter(key => {return isNaN(Number(key))});
    client.write("chat", util.message(`Players:\n ${players.join(", ")}`));
    return true;
}

module.exports = {
    alias,
    usage,
    description,
    execute
};