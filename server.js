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

// Redis PUB/SUB messages
const redisSubClient = createClient({
    url: `redis://${redisHost}:${redisPort}`
})

//const redisPubClient = redisSubClient.duplicate()
//redisPubClient.connect().then(() => {})

redisSubClient.connect().then(() => {})
redisSubClient.on(`connect`, redisConnectHandler)
redisSubClient.on(`reconnecting`, redisReconnectingHandler)
redisSubClient.on(`error`, redisErrorHandler)
redisSubClient.subscribe(redisChannel, redisMessageHandler)


// https://nginx.org/en/docs/http/websocket.html - last paragraph
// https://habr.com/ru/articles/762808/
// https://stackoverflow.com/questions/50876766/how-to-implement-ping-pong-request-for-websocket-connection-alive-in-javascript
// https://udf.su/ws-1006-error-handling
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

    const urlSearchParams = new URLSearchParams(req.url.charAt(0) === '/' ? req.url.slice(1) : req.url)
    const channelName = urlSearchParams['channel'] || ''
    addSocketConnection(channelName, ws)
    const clientParams = Object.assign(
        {event: 'connected'},
        Object.fromEntries(urlSearchParams)
    )
    ws.send(JSON.stringify(clientParams))
    console.log('New-client', req.url, clientParams, JSON.stringify(clientParams))

    // redisPubClient.publish(redisChannel, JSON.stringify(clientParams)).then(() => {
    //     console.log('new client publish - ok')
    // }).catch((e) => {
    //     console.log(`new client publish - err, ${e}`)
    // })

    ws.on('pong', () => {
        console.log(`Pong received`)
        ws.isAlive = true
    })
    ws.on('message', function message(data, isBinary) {
        console.log('received: %s', data)
        wsServer.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data, {binary: isBinary})
            }
        })
    })
    ws.on('close', function (code, reason) {
        // отправка уведомления в консоль
        console.log(`Client disconnected, ${code}`)
        deleteSocketConnection(channelName, ws)
        const clientParams = Object.assign(
            {event: 'disconnected'},
            Object.fromEntries(urlSearchParams)
        )
        ws.send(JSON.stringify(clientParams))
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
