var mc = require(`minecraft-protocol`);
var serverIp = process.argv[2];
var serverPort = process.argv[3];
enable = false;
var proxy = mc.createServer({
	"host": `127.0.0.1`,
	"port": 25565,
	"online-mode": false,
	"version": false,
	"keepAlive": false,
	"maxPlayers": 1,
	"motd": `§eJSProxy\n§b${serverIp}:${serverPort}`
});
proxy.on(`login`, function(client) {
	var bot = mc.createClient({
		"host": serverIp,
		"port": serverPort,
		"version": client.version,
		"username": client.username,
		"keepAlive": true
	});
	bot.on(`packet`, function(packet, meta) {
		if (meta.name === `login`) enable = true;
		if (enable === true) {
			client.write(meta.name, packet);
		}
	});
	client.on(`packet`, function(packet, meta) {
		bot.write(meta.name, packet);
	});
	client.on(`end`, function() {
		process.exit();
	});
	bot.on(`end`, function() {
		process.exit();
	});
});
