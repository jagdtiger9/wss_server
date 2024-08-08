import {redisData} from "../Domain/redisData.js"
import {socketListeners} from "../Domain/socketListeners.js"

const redisConnectHandler = () => {
    redisData.status = `connected`
    redisData.start = new Date()
}

const redisReconnectingHandler = () => {
    redisData.status = `reconnection...`
    redisData.start = new Date()
}

const redisErrorHandler = () => {
    redisData.status = `error`
}

const redisMessageHandler = (message, channel) => {
    console.log(message, channel)
    if (!message) {
        return
    }
    const {
        channelName, data: result, status = 1, errorCode = 0, callback = null
    } = JSON.parse(message);
    if (!socketListeners[channelName]) {
        return
    }
    socketListeners[channelName].forEach((listener) => {
        let sendData;
        try {
            sendData = JSON.stringify({result, status, errorCode, callback})
        } catch (error) {
            sendData = JSON.stringify({message: result, callback})
        }
        listener.send(sendData)
    })
}

export {redisConnectHandler, redisReconnectingHandler, redisErrorHandler, redisMessageHandler}
