import {socketListeners} from "../Domain/socketListeners.js"

const addSocketConnection = (channelName, connection) => {
    if (!socketListeners[channelName]) {
        socketListeners[channelName] = new Set()
    }
    socketListeners[channelName].add(connection)
}

const deleteSocketConnection = (channelName, connection) => {
    socketListeners[channelName].delete(connection)
    if (!socketListeners[channelName].size) {
        delete socketListeners[channelName]
    }
}
export {addSocketConnection, deleteSocketConnection}
