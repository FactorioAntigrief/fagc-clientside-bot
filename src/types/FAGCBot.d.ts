import { Snowflake } from "discord.js";

export interface BotConfigEmotes {
	error: string,
	success: string
}

export interface BotConfig {
	token: string,
	prefix: string,
	apiurl: string,
	websocketurl: string,
	adminIDs: string[],
	embeds: {
		color: string,
		footer: string,
	},
	emotes: BotConfigEmotes,
	owner: {
		id: Snowflake, // guild owner's ID, such as 429696038266208258
		name: String // guild owner's tag, such as oof2win2#3149
	}
}