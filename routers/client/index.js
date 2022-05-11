const express = require('express')
const res = require('express/lib/response')

const { isLoggedIn, db } = require('../..')
const axios = require('axios').default
const router = express.Router()
const pretty = require('../../lib/pretty')
router.use(isLoggedIn)
require('express-ws')(router)
router.get('/', async (req, res) => {
    var nodes = await db.fetchNodes()
    var servers = []
    await Promise.all(nodes.map(async (node, i) => {
        console.log(i)
        try {
            var node_servers = await axios.get(`${node.connection}://${node.host}:${node.port}/api/v1/instance`)
        } catch (error) {
            console.log(error, i)
            return;
        }

        node_servers.data.metadata = await Promise.all(node_servers.data.metadata.map(async server => {
            var state = (await axios.get(`${node.connection}://${node.host}:${node.port}/api/v1/instance/${server.name}/state`)).data
            console.log(JSON.stringify(state))
            return {
                ...server,
                node_name: node.name,
                fetched_state: {
                    cpu: Math.round(state.cpu.percent),
                    temp: state.cpu.temp,
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
        console.log(servers)
        return;
    }))
    console.log(JSON.stringify(servers))
    res.render('client/index', {
        user: req.user,
        servers: servers
    })
})
router.get('/instance/:servernode', async (req, res) => {
    try {
        var server = req.params.servernode.split('@')[0]
        var node = req.params.servernode.split('@')[1]

        var node_info = await db.fetchNodeFromName(node)
        var server_url = `${node_info.connection}://${node_info.host}:${node_info.port}/api/v1/instance/${server}`
        var server = await axios.get(server_url)
        var state = (await axios.get(server_url + '/state')).data
        if (state.state == "Running") {
            var ws_console_data = (await axios.post(server_url + '/console', { access_token: req.user.access_token, type: server.data.metadata.type == "container" ? "serial" : "vga" })).data
            console.log(ws_console_data)
        }
        var url = '/client/instance/' + req.params.servernode
        res.render('client/instance', {
            user: req.user,
            url,
            server: {
                control_ws_url: 'ws://10.17.167.166:3030/client/instance/' + req.params.servernode + '/resources',
                ws_url: state.state != "Running" ? null : ((node_info.connection == "http" ? "ws://" : "wss://") + node_info.host + ":" + node_info.port + "/api/v1/instance/" + server.data.metadata.name + "/console?token=" + ws_console_data.access_token),
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
    } catch (error) {
        res.send('Node is unavailable')
    }

})
router.ws('/instance/:servernode/resources', async (ws, req) => {
    //console.log(ws)
    var server = req.params.servernode.split('@')[0]
    var node = req.params.servernode.split('@')[1]
    console.log(node)
    var node_info = await db.fetchNodeFromName(node)
    var server_url = `${node_info.connection}://${node_info.host}:${node_info.port}/api/v1/instance/${server}`
    var int = setInterval(async () => {
        console.log('interval')
        try {
            var state = (await axios.get(server_url + '/state')).data
            ws.send(JSON.stringify({
                type: "state",
                state: {
                    state: state.state,
                    cpu: Math.round(state.cpu.percent),
                    memory: {
                        raw: state.memory.usage,
                        limit: pretty(state.memory.limit ? state.memory.limit : 0),
                        used: pretty(state.memory.usage),
                    },
                    disk: {
                        usage: pretty(state.disk["root"] ? state.disk["root"].usage : state.disk.usage),
                    }
                }
            }))
        } catch (error) {
            ws.close()
        }

    }, 2000)
    ws.on('message', async (msg) => {
        var data = JSON.parse(msg)
        if (data.type == "powerstate") {
            ws.send(JSON.stringify({ type: "response", response: (await axios.post(server_url + '/state?action=' + data.powerstate + "&wstoken=" + req.user.access_token)).data }))
        }
    })
    ws.on('close', () => {
        console.log('close resource ws')
        clearInterval(int)
    })
})
router.get('/instance/:servernode/files', async (req, res) => {
    var current_path = req.query.path ? req.query.path : ''
    //console.log(ws)
    var server = req.params.servernode.split('@')[0]
    var node = req.params.servernode.split('@')[1]
    console.log(node)
    var node_info = await db.fetchNodeFromName(node)
    var server_url = `${node_info.connection}://${node_info.host}:${node_info.port}/api/v1/instance/${server}`
    var server = await axios.get(server_url)
    var state = (await axios.get(server_url + '/state')).data
    var type = (await axios.get(server_url + '/files/type?path=' + (current_path == "" ? "/" : current_path))).data
    if (type.type == "dir") {
        var dirlist = (await axios.get(server_url + '/files?path=' + (current_path == "" ? "/" : current_path))).data
        var url = '/client/instance/' + req.params.servernode
        console.log(dirlist)
        var previous_path = current_path.split('/').slice(0, current_path.split('/').length - 1).join('/')
        dirlist = dirlist.map(el => {
            return {
                ...el,
                size: pretty(el.size),
            }
        })
        var file_arr = dirlist.filter(el => el.isFile)
        var dir_arr = dirlist.filter(el => !el.isFile)
        file_arr = file_arr.sort(function (a, b) {
            return a.name.localeCompare(b.name); //using String.prototype.localCompare()
        });
        dir_arr = dir_arr.sort(function (a, b) {
            return a.name.localeCompare(b.name); //using String.prototype.localCompare()
        });
        dirlist = dir_arr.concat(file_arr)
        console.log({
            user: req.user,
            url,
            server: {
                previous_path,
                current_path,
                dirlist,
                control_ws_url: 'ws://10.17.167.166:3030/client/instance/' + req.params.servernode + '/resources',
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
        res.render('client/instance/files', {
            user: req.user,
            url,
            server: {
                previous_path,
                current_path,
                dirlist,
                control_ws_url: 'ws://10.17.167.166:3030/client/instance/' + req.params.servernode + '/resources',
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
    } else if (type.type == "file") {
        console.log(type)
        if (type.is_text == true) {
            res.render('client/instance/files/editor', {
                user: req.user,
                url,
                server: {
                    current_path,
                    control_ws_url: 'ws://10.17.167.166:3030/client/instance/' + req.params.servernode + '/resources',
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
        } else {
            var filename = req.query.path.split('/').slice(-1)[0];
            console.log(filename)
            res.attachment(filename);
            var file_data = (await axios.get(server_url + '/files?path=' + req.query.path, {responseType: "stream"}))
            file_data.data.pipe(res)
            //res.attachment()
        }
    }
    
})


module.exports = router