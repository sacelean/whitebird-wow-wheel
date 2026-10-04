import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) throw new Error('Configura DISCORD_TOKEN y DISCORD_CLIENT_ID en .env.');

const commands = [
  new SlashCommandBuilder()
    .setName('ruleta-alter')
    .setDescription('Publica la ruleta visual de clases de WoW')
    .addChannelOption((option) => option.setName('canal').setDescription('Canal donde publicar la ruleta').setRequired(false)),
  new SlashCommandBuilder().setName('mi-alter').setDescription('Consulta tu clase asignada'),
  new SlashCommandBuilder().setName('alter-list').setDescription('Muestra las asignaciones de la ronda'),
  new SlashCommandBuilder()
    .setName('alter-reset')
    .setDescription('Libera la asignación de un miembro (oficiales)')
    .addUserOption((option) => option.setName('usuario').setDescription('Miembro que podrá volver a girar').setRequired(true)),
  new SlashCommandBuilder()
    .setName('alter-spec')
    .setDescription('Cambia el rol/spec de la clase asignada a un miembro (oficiales)')
    .addUserOption((option) => option.setName('usuario').setDescription('Miembro cuyo alter quieres actualizar').setRequired(true))
    .addStringOption((option) => option.setName('spec').setDescription('Rol de combate').setRequired(true)
      .addChoices(
        { name: 'Tanque', value: 'Tanque' },
        { name: 'DPS', value: 'DPS' },
        { name: 'Sanador', value: 'Sanador' }
      )),
  new SlashCommandBuilder()
    .setName('registrar-alter')
    .setDescription('Vincula el personaje que te tocó en la ruleta')
    .addStringOption((option) => option.setName('nombre').setDescription('Nombre del personaje en WoW').setRequired(true).setMaxLength(24))
    .addStringOption((option) => option.setName('reino').setDescription('Reino (por ejemplo, Sanguino)').setRequired(true).setMaxLength(40))
    .addStringOption((option) => option.setName('region').setDescription('Región del personaje').setRequired(true)
      .addChoices(
        { name: 'Europa', value: 'eu' },
        { name: 'América', value: 'us' },
        { name: 'Corea', value: 'kr' },
        { name: 'Taiwán', value: 'tw' }
      )),
  new SlashCommandBuilder()
    .setName('ranking-alters')
    .setDescription('Muestra ilvl equipado y la mejor piedra M+ de los alters registrados')
    .addBooleanOption((option) => option.setName('actualizar').setDescription('Solicita datos recientes a Raider.IO').setRequired(false)),
  new SlashCommandBuilder()
    .setName('alter-reset-all')
    .setDescription('Libera todas las clases e inicia una ronda (oficiales)')
    .addBooleanOption((option) => option.setName('confirmar').setDescription('Confirma el reinicio de la ronda').setRequired(true))
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);
const guildId = process.env.DISCORD_GUILD_ID;
const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
await rest.put(route, { body: commands });
console.log(guildId ? `Comandos registrados en el servidor ${guildId}.` : 'Comandos globales registrados (pueden tardar en aparecer).');
