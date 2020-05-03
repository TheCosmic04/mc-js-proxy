# MINECRAFT NODEJS PROXY
A minecraft proxy for minecraft based on mc-protocol.
This proxy allow multiple client to be connected at once in differents servers.

## Currently anvailable feature:
* `/connect <ip> [port]` to connect to a server (default port is 25565)
* `/proxylist` or `/plist` allow to see all player connected to the proxy

## Future features:
* premium account login `/login <login> <password>` (currently the proxy is only cracked)
* change name of the account `/setusername <username>`
* a better command handler that will allow also for custom commands
* event files that will allow you to modify packets
* tab complete for proxy commands
* and more...

## Currently known bugs:
* tab list header and footer dont change when the player change server
* ~~entities and chunks sometimes dont unload when the player change server~~
* connecting to the same server you are already connected will get you in a infinite loop where the proxy keep try to connecting to the server failing

## How to use it:
* `git clone https://github.com/TheCosmic04/mc-js-proxy.git`
* `npm i`
* `node index.js <version>` (default: 1.15.2)
