var util = require("./../util.js");         //A module wit some utility function
                                            //util.message(string)  return the object used to send the client a message

var alias = ["example"];                    //Aliases for the command
var usage = `{prefix}${alias[0]}`;          //In future version the help command will replace {prefix} automatcly with the current prefix
var description = "An example command";     //Description of the command


/*The execute function is the code that the command is gona execute.
arguments:
    -client  is the client that executed the command
    -command  is the command used
    -args  are the argument of the command
    -handler  is the command handler object that has some utility
    -clients  is an object containing all the clients at clients[client.id] with also the bot object at clients[client.id].bot
handler functions:
    -.info(command)  return an object with the command info --> {path:"path to the file", command: "command object"}
    -.isCommand(command)  return if the given command is a valid command
handler fields:
    -.commands  an array with all the commands object
    -.prefix  the current prefix the comand handler is using
    -.path  the path to the commands folder
*/
function execute(client, command, args, handler, clients) {
    if (args.length == 0) {
        client.write("chat", util.message("§aNor arguments used"));  //send the client a chat packet
    } else {
        client.write("chat", util.message(`§aRecived args: [${args.join(", ")}]`));
    }
    return true;  //By return true the server will never recive the command packet
}