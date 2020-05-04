const fs = require("fs");
const self = this;

var initialized = false;

module.exports = {
    commands: [],
    prefix: "/",
    path: "",
    init,
    execute,
    info,
    isCommand
}


function init(prefix = "/", folder="./commands") {
    if (initialized) return false;
    self.path = folder;
    self.prefix = prefix;
    self.commands = loadCommands(self.path);

    initialized = true;
    return true; 
}

function execute(client, command, args, clients) {
    try {
        let cmd_info = info(command);
        if (cmd_info == null) return {status: "error", error: "cmd not found!", code: "not_found"};

        let returnValue = cmd_info.command.execute(client, command, args, this, clients);

        return {status: "success", value: returnValue};
    } catch (err) {
        console.log(err);
        return {status: "error", error: err, code: (err.code != null) ? err.code : "unknown"};
    }
}

function info(command) {
    if (!isCommand(command)) return;
    let found = null;
    self.commands.forEach(obj => {
        if (found !== null) return;
        if (obj.command.alias.includes(command))
            found = obj;
    });

    return found;
}

function isCommand(command) {
    if (!initialized) return false;
    let found = false;
    self.commands.forEach(obj => {
        if (found) return;
        // console.log({cmd: command, alias:obj.command.alias, includes: obj.command.alias.includes(command)})
        if (obj.command.alias.includes(command))
            found = true;
    });

    return found;
}


function loadCommands(path) {
    let commands = [];
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
        return [];
    } else {
        let stats = fs.statSync(path);
        if (!stats.isDirectory()) {
            fs.mkdirSync(path);
            return [];
        }
    }

    fs.readdirSync(path).forEach(file => {
        let curr = `${path}/${file}`;
        let stats = fs.statSync(curr);
        if (stats.isFile() && file.endsWith(".js")) {
            try {
                let command = require(curr);
                if (isValidCommand(command)) {
                    command.alias = command.alias.filter(alias => {return typeof(alias) === "string"});
                    commands.push({
                        command: command,
                        path: curr
                    });
                    console.log(`Successfuly loaded ${file}`);
                }
            } catch (err) {
                console.log(`failed to load command ${file}:\n ${err}`);
            }
        }
    });
    return commands;
}

function isValidCommand(command) {
    return Array.isArray(command.alias) && command.alias.filter(alias => {return typeof(alias) === "string"}).length > 0 && typeof(command.usage) === "string" && typeof(command.description) === "string" && typeof(command.execute) === "function";
}