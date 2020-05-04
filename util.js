function message(msg) {
    return {message: JSON.stringify({text: msg}), position: 1};
}


module.exports = {
    message
}
