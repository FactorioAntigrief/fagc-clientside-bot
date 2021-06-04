/**
 * @file RCON client manager for servers
 */
import { Snowflake, TextChannel } from "discord.js"
import { Rcon } from "rcon-client"
import { FactorioServer } from "../types/types"
import FAGCBot from "./fagcbot"
import config from "../../config"
const { rconport, rconpw, errorchannel } = config
// const { rconport, rconpw, errorchannel } = require("../../config")
import servers from "../../servers"
// const servers = require("../../servers")


interface rconConfig {
	rconport: number,
	server: FactorioServer,
}
interface rconConnection {
	rcon: Rcon,
	server: FactorioServer,
}

/**
 * @typedef {Object} RCONOutput
 * @property {(string|Error)} resp - RCON output or error
 * @property {Object} server - Server
 */
class rconInterface {
	/**
	 * RCON interface for servers
	 * @param {Object[]} rconConfig - Array of RCON configs
	 * @param {number} rconConfig.rconport - Port of RCON
	 * @param {Object} rconConfig.server - Server object from {@link ../servers.js}
	 */
	private rconConfig: rconConfig[]
	private rconConnections: rconConnection[]
	public client: FAGCBot
	constructor(rconConfig) {
		this.rconConfig = rconConfig
		this.rconConnections = []
		this._init()
	}
	_init() {
		if (!this.rconConfig) return console.log("no config")
		this.rconConfig.forEach(async (server) => {
			let rcon = new Rcon({
				host: "localhost",
				port: server.rconport,
				password: rconpw
			})
			try {
				await rcon.connect()
				this.rconConnections.push({
					rcon: rcon,
					server: server.server
				})

				// reconnection mechanism
				rcon.on("end", () => {
					let i = 0
					const interval = setInterval(async () => {
						try {
							rcon.connect().then(() => {
								clearInterval(interval)
								this.client?.channels.fetch(errorchannel).then((channel?: TextChannel) => channel.send(`Server <#${server.server.discordid}> has connected to RCON`))
							}).catch(() => { })
							i++
							if (i === 60) { // 5 minutes
								// clearInterval(interval) // just keep trying to reconnect
								this.client?.channels.fetch(errorchannel).then((channel?: TextChannel) => channel.send(`Server <#${server.server.discordid}> is having RCON issues`))
							}
						// eslint-disable-next-line no-empty
						} catch (error) { }
					}, 5000)
				})
			} catch (error) {
				console.error(error)
				const errorSend = setInterval(() => {
					this.client?.channels?.fetch(errorchannel).then((channel?: TextChannel) => channel?.send(`Server <#${server.server.discordid}> is having RCON issues`))
						.then(() => clearInterval(errorSend)).catch(() => { })
				}, 1000)
				let i = 0
				const interval = setInterval(async () => {
					try {
						rcon.connect().then(() => {
							clearInterval(interval)
							this.client?.channels.fetch(errorchannel).then((channel?: TextChannel) => channel.send(`Server <#${server.server.discordid}> has connected to RCON`))
						}).catch(() => { })
						i++
						if (i === 60) { // 5 minutes
							// clearInterval(interval) // just keep trying to reconnect
							this.client?.channels.fetch(errorchannel).then((channel?: TextChannel) => channel.send(`Server <#${server.server.discordid}> is having RCON issues`))
						}
					// eslint-disable-next-line no-empty
					} catch (error) { }
				}, 5000)
			}
		})
	}
	/**
	 * Send a RCON command to a Factorio server
	 * @param {string} command - Command to send to the server. Automatically prefixed with /
	 * @param {(discord.Snowflake|string)} serverIdentifier - Identifier for server. Either server's Discord channel ID, Discord name or debug name
	 * @returns {Promise<RCONOutput>} RCON output or error. Can be "Server couldn't be found" if no server was found
	 */
	async rconCommand(command, serverIdentifier) {
		if (!command.startsWith("/")) command = `/${command}`
		let server = undefined
		this.rconConnections.forEach(serverConnections => {
			if ([serverConnections.server.name, serverConnections.server.discordid, serverConnections.server.discordname].some((identifier) => identifier === serverIdentifier))
				server = serverConnections
		})
		if (server == undefined) {
			throw new Error("Server couldn't be found")
		}
		try {
			let resp = await server.rcon.send(command)
			if (typeof resp == "string" && resp.length) return { resp: resp, server: server }
		} catch (error) {
			return { resp: error, server: server }
		}
	}
	/**
	 * Send a RCON command to all Factorio servers
	 * @param {string} command - Command to send to the servers. Automatically prefixed with /
	 * @returns {Promise<RCONOutput[]>} RCON output of all servers
	 */
	async rconCommandAll(command: string) {
		let promiseArray = this.rconConnections.map(async (server) => {
			return new Promise((resolve, reject) => {
				const resultIdentifier = {
					name: server.server.name,
					discordid: server.server.discordid,
					discordname: server.server.discordname,
				}
				this.rconCommand(command, server.server.discordid)
					.then(res => resolve({ resp: res, server: resultIdentifier }))
					.catch(e => reject({ resp: e, server: resultIdentifier }))
			})
		})
		return await Promise.all(promiseArray)
	}
	/**
	 * Send a RCON command to all Factorio servers except the one you specify
	 * @param {string} command - Command to send to the servers. Automatically prefixed with /
	 * @param {(discord.Snowflake[]|string[])} exclusionServerIdentifiers - Identifier of server to exclude
	 * @returns {Promise<RCONOutput[]>} RCON output of servers
	 */
	async rconCommandAllExclude(command, exclusionServerIdentifiers) {
		if (!command.startsWith("/")) command = `/${command}` //add a '/' if not present

		const getArrayOverlap = (array1, array2) => {
			return array1.filter(x => array2.indexOf(x) !== -1)
		}

		let overlap = []
		let nameArr = this.rconConnections.map((connection) => { return connection.server.name })
		let channelIDArr = this.rconConnections.map((connection) => { return connection.server.discordid })
		let channelNameArr = this.rconConnections.map((connection) => { return connection.server.discordname })
		overlap.push(...getArrayOverlap(exclusionServerIdentifiers, nameArr))
		overlap.push(...getArrayOverlap(exclusionServerIdentifiers, channelIDArr))
		overlap.push(...getArrayOverlap(exclusionServerIdentifiers, channelNameArr))

		let toRun = []
		this.rconConnections.forEach(connection => {
			if (overlap.includes(connection.server.name) ||
				overlap.includes(connection.server.discordid) ||
				overlap.includes(connection.server.discordname)) return
			else
				toRun.push(connection)
		})

		let promiseArray = toRun.map((connection) => {
			return new Promise((resolve, reject) => {
				const resultIdentifier = {
					name: connection.server.name,
					discordid: connection.server.discordid,
					discordname: connection.server.discordname,
				}
				this.rconCommand(command, connection.server.discordid)
					.then(res => resolve({ resp: res, server: resultIdentifier }))
					.catch(e => reject({ resp: e, server: resultIdentifier }))
			})
		})
		return await Promise.all(promiseArray)
	}
}
const rconPorts = servers.map((server) => {
	return {
		rconport: server.rconoffset + rconport,
		server: server
	}
})
const rcon = new rconInterface(rconPorts)
export default rcon