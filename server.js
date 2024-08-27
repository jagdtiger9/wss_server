'use strict'

import WebSocket, {WebSocketServer} from 'ws'
import {createClient} from "redis"
import express from 'express'
import {wsServerStat} from "./application/wsServerStatQuery.js"
import {updateServerData} from "./application/updateServerDataCommand.js"
import {redisConnectHandler, redisErrorHandler, redisMessageHandler, redisReconnectingHandler} from "./application/redisHandler.js"
import {addSocketConnection, deleteSocketConnection} from "./application/socketConnectionHandler.js"
import axios from "axios"

const expressPort = process.env.WS_HTTP_PORT
const redisHost = process.env.REDIS_HOST
const redisPort = process.env.REDIS_PORT
const redisChannel = process.env.REDIS_CHANNEL
const websocketPort = process.env.WS_PORT
const updateTimeout = 30000
const baseUrl = 'http://nodejs'
const webHookDomain = process.env.WEB_HOOK

// Redis PUB/SUB messages
const redisClient = createClient({
    url: `redis://${redisHost}:${redisPort}`
})
redisClient.connect().then(() => {})
redisClient.on(`connect`, redisConnectHandler)
redisClient.on(`reconnecting`, redisReconnectingHandler)
redisClient.on(`error`, redisErrorHandler)
redisClient.subscribe(redisChannel, redisMessageHandler)

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

    const url = new URL(`${baseUrl}${req.url}`)
    const channelName = url.searchParams['channel'] || ''
    console.log('New client', req.url, url.searchParams)
    addSocketConnection(channelName, ws)
    axios.create({
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
        },
        responseType: 'json',
    }).post(webHookDomain, Object.assign({event: 'connect'}))

    ws.on('pong', () => {
        console.log(`Pong received`)
        ws.isAlive = true
    })
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
        console.log(`Client disconnected, ${code}`)
        deleteSocketConnection(channelName, ws)

        axios.create({
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            },
            responseType: 'json',
        }).post(webHookDomain, Object.assign({event: 'disconnect'}))
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
