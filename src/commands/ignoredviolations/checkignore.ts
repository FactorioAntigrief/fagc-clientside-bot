import Command from "../../base/Command"
import { Message, MessageEmbed } from "discord.js"

export const command: Command<Message | void> = {
	name: "checkignore",
	description: "Checks if a specific violation is being ignored",
	dirname: __dirname,
	enabled: true,
	aliases: [],
	memberPermissions: [],
	botPermissions: ["SEND_MESSAGES", "EMBED_LINKS"],
	ownerOnly: false,
	cooldown: 3000,
	requiredConfig: false,
	run: async (client, message, args) => {
		if (!args[0]) return message.channel.send("Please provide a violation ID to check ignorations for")

		const report = await client.fagc.reports.fetchReport(args[0]).catch()
		if (!report?.id) return message.channel.send(`\`${args[0]}\` is an invalid violation ID`)
		const ignoration = await client.prisma.ignoredViolations.findFirst({ where: { violationId: report.id } })
		if (!ignoration) return message.channel.send(`Report with ID \`${report.id}\` is not being ignored`)
		const embed = new MessageEmbed()
			.setTitle("FAGC Violation Ignoration")
			.setColor("ORANGE")
			.setDescription("FAGC Violation Ignoration check")
			.setTimestamp()
			.setAuthor("oof2win2")
			.addFields(
				{ name: "Playername", value: report.playername, inline: true },
				{ name: "Admin ID", value: report.adminId, inline: true },
				{ name: "Community ID", value: report.communityId, inline: true },
				{ name: "Broken Rule", value: report.brokenRule, inline: true },
				{ name: "Automated", value: report.automated, inline: true },
				{ name: "Proof", value: report.proof, inline: true },
				{ name: "Description", value: report.description, inline: true },
				{ name: "Report ID", value: report.id, inline: true },
				{ name: "Reported Time", value: report.reportedTime, inline: true },
				{ name: "Ignored Since", value: ignoration.whitelistedAt},
				{name: "Ignored By", value: `<@${ignoration.whitelistedBy}> | ${await client.users.fetch(ignoration.whitelistedBy).then(u=>u?.tag)}`}
			)
		message.channel.send(embed)
	}
}