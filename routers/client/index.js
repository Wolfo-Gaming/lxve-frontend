const express = require('express')
const { isLoggedIn, db } = require('../..')
const axios = require('axios').default
const router = express.Router()
const pretty = require('../../lib/pretty')
router.use(isLoggedIn)

router.get('/', async (req, res) => {
    var nodes = await db.fetchNodes()
    var servers = []
    for await (const node of nodes) {
        var node_servers = await axios.get(`${node.connection}://${node.host}:${node.port}/api/v1/instance`)
        node_servers.data.metadata = await Promise.all(node_servers.data.metadata.map(async server => {
            var state = (await axios.get(`${node.connection}://${node.host}:${node.port}/api/v1/instance/${server.name}/state`)).data
            console.log(JSON.stringify(state))
            return {
                ...server,
                node_name: node.name,
                fetched_state: {
                    cpu: Math.round(state.cpu.percent),
                    memory: {
                        limit: pretty(state.memory.limit ? state.memory.limit : 0),
                        used: pretty(state.memory.usage),
                    },
                    disk: {
                        usage: pretty(state.disk["root"] ? state.disk["root"].usage : state.disk.usage),
                    }
                }
            }
        }))
        servers = servers.concat(node_servers.data.metadata)
    }
    console.log(JSON.stringify(servers))
    res.render('client/index', {
        user: req.user,
        servers: servers
    })
})
router.get('/instance/:servernode', async (req, res) => {
    var server = req.params.servernode.split('@')[0]
    var node = req.params.servernode.split('@')[1]
    var node_info = await db.fetchNodeFromName(node)
    var server_url = `${node_info.connection}://${node_info.host}:${node_info.port}/api/v1/instance/${server}`
    var server = await axios.get(server_url)
    var state =( await axios.get(server_url + '/state')).data
    var ws_console_data = (await axios.post(server_url + '/console', {type: server.data.metadata.type == "container" ? "serial" : "vga"})).data
    console.log(ws_console_data)
    res.render('client/instance', {
        user: req.user,
        server: {
            ws_url: (node_info.connection == "http" ? "ws://" : "wss://") + node_info.host + ":" + node_info.port + "/api/v1/instance/" + server.data.metadata.name + "/console?token=" + ws_console_data.access_token,
            ...server.data,
            node_name: node.name,
            fetched_state: {
                cpu: Math.round(state.cpu.percent),
                memory: {
                    limit: pretty(state.memory.limit ? state.memory.limit : 0),
                    used: pretty(state.memory.usage),
                },
                disk: {
                    usage: pretty(state.disk["root"] ? state.disk["root"].usage : state.disk.usage),
                }
            }
        }
    })
})

module.exports = router