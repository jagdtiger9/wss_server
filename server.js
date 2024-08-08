'use strict'

import WebSocket, {WebSocketServer} from 'ws'
import {createClient} from "redis"
import express from 'express'
import {wsServerStat} from "./application/wsServerStatQuery.js"
import {updateServerData} from "./application/updateServerDataCommand.js"
import {redisConnectHandler, redisErrorHandler, redisMessageHandler, redisReconnectingHandler} from "./application/redisHandler.js"
import {addSocketConnection, deleteSocketConnection} from "./application/socketConnectionHandler.js"

const expressPort = process.env.WS_HTTP_PORT
const redisHost = process.env.REDIS_HOST
const redisPort = process.env.REDIS_PORT
const redisChannel = process.env.REDIS_CHANNEL
const websocketPort = process.env.WS_PORT
const updateTimeout = 30000
const baseUrl = 'http://nodejs'

// Redis PUB/SUB messages
const redisClient = createClient({
    url: `redis://${redisHost}:${redisPort}`
})
redisClient.connect().then(() => {})
redisClient.on(`connect`, redisConnectHandler)
redisClient.on(`reconnecting`, redisReconnectingHandler)
redisClient.on(`error`, redisErrorHandler)
redisClient.subscribe(redisChannel, redisMessageHandler)

const heartbeat = () => {
    this.isAlive = true
}
const interval = setInterval(() => {
    wsServer.clients.forEach(function each(ws) {
        if (ws.isAlive === false) {
            return ws.terminate()
        }
        ws.isAlive = false
        ws.ping()
    });
}, 30000)

const wsServer = new WebSocketServer({port: websocketPort})
wsServer.on('connection', function connection(ws, req) {
    ws.isAlive = true

    const url = new URL(`${baseUrl}${req.url}`)
    const channelName = url.searchParams['channel'] || ''
    console.log('New connection', req.url, url.searchParams)
    addSocketConnection(channelName, ws)

    ws.on('pong', heartbeat)
    ws.on('message', function message(data, isBinary) {
        console.log('received: %s', data)
        wsServer.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data, {binary: isBinary});
            }
        });
    });
    ws.on('close', function (code, reason) {
        // отправка уведомления в консоль
        console.log(`Пользователь отключился, ${code} - ${reason}`)
        deleteSocketConnection(channelName, ws)
    })
    ws.on('error', console.error)
})
wsServer.on('close', function close() {
    clearInterval(interval)
})

// HTTP server with express, websocket server stat page
const httpServer = express()
httpServer.listen(expressPort);
httpServer.route([`/`, `/stat`]).get((request, response) => {
    return response.send(wsServerStat())
})

setInterval(updateServerData, updateTimeout)
