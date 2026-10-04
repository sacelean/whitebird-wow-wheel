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
  getWowCharacters, resetGuild, resetUser, savePanel, saveWowCharacter,
  updateRole, updateWowCharacterStats
} from './database.js';
import { makeWheelImage } from './wheel-image.js';
import { fetchRaiderIoCharacter, raiderIoCharacterUrl } from './raider-io.js';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('Falta DISCORD_TOKEN. Copia .env.example a .env y añade el token del bot.');

const officerRoleIds = new Set((process.env.OFFICER_ROLE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const SPIN_BUTTON_ID = 'whitebird:spin';
const BRAND = 0x5865f2;
const pickRandom = (items) => items[randomInt(items.length)];

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
      const picked = pickRandom(available);
      const pickedRole = pickRandom(picked.roles);
      try {
        assignClass(interaction.guildId, interaction.user.id, picked.name, pickedRole);
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
        .setDescription(`Tu asignación para Whitebird queda registrada:\n\n**Clase:** ${wowClass.name}\n**Rol:** ${pickedRole}\n\n¡A disfrutarla!`)
        .setImage('attachment://whitebird-wheel.png')
        .setFooter({ text: `Asignación ${total} de ${CLASSES.length} · La lista es visible con /alter-list` });
      const wheel = await makeWheelImage(CLASSES.filter((entry) => !getUsedClasses(interaction.guildId).has(entry.name)).map((entry) => entry.name));
      await interaction.editReply({ embeds: [resultEmbed], files: [new AttachmentBuilder(wheel, { name: 'whitebird-wheel.png' })] });
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return interaction.reply({ content: 'Este comando solo funciona en un servidor.', flags: MessageFlags.Ephemeral });

    if (interaction.commandName === 'ruleta-alter') {
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
      return interaction.reply({ content: assignment ? `Tu asignación es **${assignment.class_name}**${assignment.role ? ` · **${assignment.role}**` : ''}.` : 'Aún no has girado. Busca el mensaje de la ruleta y pulsa **Girar la ruleta**.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === 'alter-list') {
      const rows = getAssignments(interaction.guildId);
      const body = rows.length
        ? rows.map((entry) => `**${entry.class_name}**${entry.role ? ` · ${entry.role}` : ''} — <@${entry.user_id}>`).join('\n')
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

    if (interaction.commandName === 'alter-spec') {
      if (!isOfficer(interaction)) return interaction.reply(unauthorizedReply());
      const target = interaction.options.getUser('usuario', true);
      const requestedRole = interaction.options.getString('spec', true);
      const assignment = getAssignment(interaction.guildId, target.id);
      if (!assignment) return interaction.reply({ content: `<@${target.id}> no tiene un alter asignado esta ronda.`, flags: MessageFlags.Ephemeral });
      const wowClass = CLASS_BY_NAME.get(assignment.class_name);
      if (!wowClass?.roles.includes(requestedRole)) {
        return interaction.reply({ content: `**${assignment.class_name}** no puede tener rol **${requestedRole}**. Opciones válidas: ${wowClass?.roles.join(', ') || 'ninguna'}.`, flags: MessageFlags.Ephemeral });
      }
      updateRole(interaction.guildId, target.id, requestedRole);
      return interaction.reply({ content: `Actualizado: el alter **${assignment.class_name}** de <@${target.id}> ahora tiene rol **${requestedRole}**.`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === 'registrar-alter') {
      const assignment = getAssignment(interaction.guildId, interaction.user.id);
      if (!assignment) return interaction.reply({ content: 'Primero tienes que girar la ruleta y recibir una clase.', flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const name = interaction.options.getString('nombre', true).trim();
      const realm = interaction.options.getString('reino', true).trim();
      const region = interaction.options.getString('region', true);
      let character;
      try {
        character = await fetchRaiderIoCharacter(region, realm, name);
      } catch (error) {
        const reason = error.message === 'NOT_FOUND'
          ? 'No encuentro ese personaje en Raider.IO. Comprueba el nombre, reino y región, y que el perfil esté disponible.'
          : error.message === 'RATE_LIMITED'
            ? 'Raider.IO está limitando las consultas ahora mismo. Espera un poco y vuelve a intentarlo.'
            : error.message === 'INCOMPLETE_PROFILE'
              ? 'Raider.IO no devuelve todavía datos completos de clase/equipo para ese personaje.'
              : 'No he podido consultar Raider.IO ahora. Inténtalo de nuevo más tarde.';
        return interaction.editReply(reason);
      }
      if (character.characterClass !== assignment.class_name) {
        return interaction.editReply(`Tu clase asignada es **${assignment.class_name}**, pero ese personaje aparece como **${character.characterClass}** en Raider.IO. Registra un personaje de la clase que te tocó.`);
      }
      try {
        saveWowCharacter(interaction.guildId, interaction.user.id, character);
      } catch {
        return interaction.editReply('Ese personaje ya está vinculado a otra persona de Whitebird. Si es un error, avisa a un oficial.');
      }
      const profileUrl = raiderIoCharacterUrl(region, character.realmSlug, character.characterName);
      return interaction.editReply(`Personaje vinculado: [${character.characterName} — ${realm}](${profileUrl}) · **${assignment.class_name}** · ilvl **${character.itemLevel.toFixed(1)}**.`);
    }

    if (interaction.commandName === 'ranking-alters') {
      if (!isOfficer(interaction)) return interaction.reply(unauthorizedReply());
      await interaction.deferReply();
      let characters = getWowCharacters(interaction.guildId);
      if (!characters.length) return interaction.editReply('Todavía nadie ha registrado su alter. Usa `/registrar-alter` después de girar la ruleta.');

      const forceRefresh = interaction.options.getBoolean('actualizar') ?? false;
      const staleAfterMs = 30 * 60 * 1000;
      const refreshResults = await Promise.all(characters.map(async (character) => {
        const cacheAge = character.data_updated_at ? Date.now() - Date.parse(character.data_updated_at) : Infinity;
        if (!forceRefresh && cacheAge < staleAfterMs) return { character, failed: false };
        try {
          const latest = await fetchRaiderIoCharacter(character.region, character.realm, character.character_name);
          if (latest.characterClass !== character.class_name) throw new Error('CLASS_MISMATCH');
          updateWowCharacterStats(interaction.guildId, character.user_id, latest);
          return { character: { ...character, ...latest }, failed: false };
        } catch {
          return { character, failed: true };
        }
      }));
      characters = refreshResults.map((result) => result.character);
      characters.sort((a, b) => (b.best_key ?? -1) - (a.best_key ?? -1) || (b.item_level ?? -1) - (a.item_level ?? -1));

      const rows = characters.map((character, index) => {
        const profileUrl = raiderIoCharacterUrl(character.region, character.realm_slug, character.character_name);
        const ilvl = character.item_level != null && Number.isFinite(Number(character.item_level)) ? Number(character.item_level).toFixed(1) : 'sin datos';
        const key = character.best_key ? `+${character.best_key}${character.best_dungeon ? ` ${character.best_dungeon}` : ''}` : 'sin M+ registrada';
        return `**${index + 1}.** [${character.character_name} — ${character.realm}](${profileUrl}) · <@${character.user_id}> · ${character.class_name} · ilvl **${ilvl}** · **${key}**`;
      });
      const failedCount = refreshResults.filter((result) => result.failed).length;
      const description = `Clasificado por piedra más alta; empate desempatado por ilvl. Datos de [Raider.IO](https://raider.io), que pueden tener retraso.\n\n${rows.join('\n')}${failedCount ? `\n\n_${failedCount} perfil(es) no pudieron actualizarse; se muestran los últimos datos guardados._` : ''}`;
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND).setTitle(`🏆 Ranking de alters · Whitebird (${characters.length})`).setDescription(description).setFooter({ text: 'Usa /ranking-alters actualizar:true para pedir una consulta nueva a Raider.IO.' })] });
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
