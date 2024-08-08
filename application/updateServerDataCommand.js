import * as NodeOsUtils from "node-os-utils"
import {serverData} from "../Domain/serverData.js"

export const updateServerData = () => {
    //console.log(NodeOsUtils.default.cpu)
    NodeOsUtils.default.cpu.free().then((cpuPercentage) => {
        serverData.freeCPU = cpuPercentage
    })
    NodeOsUtils.default.mem.info().then(({freeMemPercentage}) => {
        serverData.freeRAM = freeMemPercentage
    })
}
