import moment from "moment/moment"
import {serverData} from "../Domain/serverData.js"
import {socketListeners} from "../Domain/socketListeners.js"
import {redisData} from "../Domain/redisData.js"

export const wsServerStat = () => {
    let channelsCount = 0
    let listenersCount = 0
    for (const channel in socketListeners) {
        if (!socketListeners.hasOwnProperty(channel)) {
            continue
        }
        channelsCount++
        listenersCount += socketListeners[channel].size
    }
    return {
        status: (redisData.status === `connected`) ? `ok` : `error`,
        channels: channelsCount,
        listeners: {
            count: listenersCount,
        },
        server: {
            start: serverData.start,
            duration: moment(serverData.start).locale("ru").fromNow(),
            freeCPU: serverData.freeCPU,
            freeRAM: serverData.freeRAM
        },
        redis: {
            status: redisData.status,
            start: redisData.start,
            duration: moment(redisData.start).locale("ru").fromNow()
        }
    }
}
