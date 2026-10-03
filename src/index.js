import 'dotenv/config';
import { randomInt } from 'node:crypto';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';
import { CLASSES, CLASS_BY_NAME } from './classes.js';
import {
  assignClass, getAssignment, getAssignments, getPanel, getUsedClasses,
  resetGuild, resetUser, savePanel
} from './database.js';
import { makeWheelImage } from './wheel-image.js';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('Falta DISCORD_TOKEN. Copia .env.example a .env y añade el token del bot.');

const officerRoleIds = new Set((process.env.OFFICER_ROLE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const SPIN_BUTTON_ID = 'whitebird:spin';
const BRAND = 0x5865f2;

function isOfficer(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  const roles = interaction.member?.roles?.cache;
  return roles ? officerRoleIds.size > 0 && [...officerRoleIds].some((id) => roles.has(id)) : false;
}

function spinRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(SPIN_BUTTON_ID).setLabel('🎰 Girar la ruleta').setStyle(ButtonStyle.Primary).setDisabled(disabled)
  );
}

function panelEmbed(usedNames = new Set()) {
  const left = CLASSES.filter((wowClass) => !usedNames.has(wowClass.name));
  const taken = CLASSES.filter((wowClass) => usedNames.has(wowClass.name));
  const remainingText = left.length ? left.map((entry) => entry.name).join(' · ') : 'Ninguna; la ronda ha terminado.';
  const usedText = taken.length ? taken.map((entry) => entry.name).join(' · ') : 'Aún no ha salido ninguna.';
  return new EmbedBuilder()
    .setColor(BRAND)
    .setTitle('🎰 Ruleta de alters · Whitebird')
    .setDescription('Pulsa el botón para recibir tu clase. Cada miembro puede girar una vez por ronda y cada clase se asigna a una sola persona.')
    .addFields(
      { name: `Disponibles (${left.length}/12)`, value: remainingText },
      { name: 'Ya asignadas', value: usedText }
    )
    .setImage('attachment://whitebird-wheel.png')
    .setFooter({ text: 'Resultados guardados · Oficiales: /alter-reset y /alter-reset-all' });
}

async function panelPayload(guildId) {
  const usedNames = getUsedClasses(guildId);
  const wheel = await makeWheelImage(CLASSES.filter((entry) => !usedNames.has(entry.name)).map((entry) => entry.name));
  return {
    embeds: [panelEmbed(usedNames)],
    files: [new AttachmentBuilder(wheel, { name: 'whitebird-wheel.png' })],
    components: [spinRow(usedNames.size === CLASSES.length)]
  };
}

async function refreshPanel(guildId) {
  const panel = getPanel(guildId);
  if (!panel) return;
  try {
    const channel = await client.channels.fetch(panel.channel_id);
    const message = await channel?.messages?.fetch(panel.message_id);
    if (message) await message.edit({ ...await panelPayload(guildId), attachments: [] });
  } catch (error) {
    console.warn(`No se pudo actualizar el panel de ${guildId}:`, error.message);
  }
}

function unauthorizedReply() {
  return { content: 'Este comando está reservado a oficiales de Whitebird (permiso **Gestionar servidor** o un rol configurado).', flags: MessageFlags.Ephemeral };
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Conectado como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === SPIN_BUTTON_ID) {
      if (!interaction.guildId) return interaction.reply({ content: 'Usa la ruleta dentro de Whitebird.', flags: MessageFlags.Ephemeral });
      const previous = getAssignment(interaction.guildId, interaction.user.id);
      if (previous) return interaction.reply({ content: `Ya tienes **${previous.class_name}** esta ronda. Pide a un oficial que reinicie tu asignación si necesitas volver a tirar.`, flags: MessageFlags.Ephemeral });

      const available = CLASSES.filter((entry) => !getUsedClasses(interaction.guildId).has(entry.name));
      if (!available.length) return interaction.reply({ content: 'La ronda ya terminó: las 12 clases están asignadas. Pide a un oficial que use `/alter-reset-all` para iniciar otra.', flags: MessageFlags.Ephemeral });

      // SQLite uniqueness constraints protect both one assignment per player and one player per class.
      const picked = available[randomInt(available.length)];
      try {
        assignClass(interaction.guildId, interaction.user.id, picked.name);
      } catch (error) {
        const nowAssigned = getAssignment(interaction.guildId, interaction.user.id);
        if (nowAssigned) return interaction.reply({ content: `Ya tienes **${nowAssigned.class_name}** esta ronda.`, flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: 'Alguien acaba de llevarse esa clase. Pulsa de nuevo para girar entre las que quedan.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await refreshPanel(interaction.guildId);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2200));
      const total = getAssignments(interaction.guildId).length;
      const wowClass = CLASS_BY_NAME.get(picked.name);
      const resultEmbed = new EmbedBuilder()
        .setColor(Number.parseInt(wowClass.color.slice(1), 16))
        .setTitle(`${wowClass.emoji} ¡Te ha tocado ${wowClass.name}!`)
        .setDescription(`Tu clase de alter para Whitebird queda registrada como **${wowClass.name}**. ¡A disfrutarla!`)
        .setImage('attachment://whitebird-wheel.png')
        .setFooter({ text: `Asignación ${total} de ${CLASSES.length} · La lista es visible con /alter-list` });
      const wheel = await makeWheelImage(CLASSES.filter((entry) => !getUsedClasses(interaction.guildId).has(entry.name)).map((entry) => entry.name));
      await interaction.editReply({ embeds: [resultEmbed], files: [new AttachmentBuilder(wheel, { name: 'whitebird-wheel.png' })] });
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return interaction.reply({ content: 'Este comando solo funciona en un servidor.', flags: MessageFlags.Ephemeral });

    if (interaction.commandName === 'alter') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = interaction.options.getChannel('canal') || interaction.channel;
      if (!channel?.isTextBased() || !channel.send) return interaction.editReply('Elige un canal de texto.');
      const message = await channel.send(await panelPayload(interaction.guildId));
      savePanel(interaction.guildId, channel.id, message.id);
      await interaction.editReply(`Ruleta publicada en ${channel}. Los resultados se mostrarán en privado a cada jugador.`);
      return;
    }

    if (interaction.commandName === 'mi-alter') {
      const assignment = getAssignment(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: assignment ? `Tu alter asignado es **${assignment.class_name}**.` : 'Aún no has girado. Busca el mensaje de la ruleta y pulsa **Girar la ruleta**.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === 'alter-list') {
      const rows = getAssignments(interaction.guildId);
      const body = rows.length
        ? rows.map((entry) => `**${entry.class_name}** — <@${entry.user_id}>`).join('\n')
        : 'Todavía no hay asignaciones.';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(BRAND).setTitle(`📜 Asignaciones Whitebird (${rows.length}/12)`).setDescription(body).setFooter({ text: 'Cada clase se asigna una sola vez por ronda.' })], flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === 'alter-reset') {
      if (!isOfficer(interaction)) return interaction.reply(unauthorizedReply());
      const target = interaction.options.getUser('usuario', true);
      const removed = resetUser(interaction.guildId, target.id);
      if (removed) await refreshPanel(interaction.guildId);
      return interaction.reply({ content: removed ? `Se ha liberado la clase de <@${target.id}>. Ya puede volver a girar.` : `<@${target.id}> no tenía una clase asignada.`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === 'alter-reset-all') {
      if (!isOfficer(interaction)) return interaction.reply(unauthorizedReply());
      if (!interaction.options.getBoolean('confirmar', true)) return interaction.reply({ content: 'Operación cancelada.', flags: MessageFlags.Ephemeral });
      const removed = resetGuild(interaction.guildId);
      await refreshPanel(interaction.guildId);
      return interaction.reply({ content: `Nueva ronda iniciada. Se han liberado ${removed} asignaciones.`, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error('Error al procesar interacción:', error);
    const message = 'Ha ocurrido un error. Inténtalo de nuevo o avisa a un oficial.';
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(token);
