require("dotenv").config();
const { Client, GatewayIntentBits, Events, ActivityType } = require("discord.js");
const express = require("express");

// ==================== CONFIGURAÇÃO ====================
const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID || "";

// WHITELIST DE SERVIDORES (IDs separados por vírgula)
// Deixe vazio = funciona em TODOS os servidores
// Exemplo: "123456789012345678,987654321098765432"
const GUILD_WHITELIST = (process.env.GUILD_WHITELIST || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// WHITELIST DE USUÁRIOS (donos / admins do bot)
// Só esses usuários podem usar comandos de admin
// Exemplo: "111111111111111111,222222222222222222"
const USER_WHITELIST = (process.env.USER_WHITELIST || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error("❌ ERRO: Variável DISCORD_TOKEN não definida!");
  console.error("   Vá no Render → Environment → adicione DISCORD_TOKEN");
  process.exit(1);
}

// ==================== FUNÇÕES DE WHITELIST ====================
function isGuildAllowed(guildId) {
  // Se a lista estiver vazia, permite todos
  if (GUILD_WHITELIST.length === 0) return true;
  return GUILD_WHITELIST.includes(guildId);
}

function isUserAllowed(userId) {
  // Se a lista estiver vazia, permite todos
  if (USER_WHITELIST.length === 0) return true;
  return USER_WHITELIST.includes(userId);
}

// ==================== KEEP-ALIVE (obrigatório no Render free) ====================
const app = express();

app.get("/", (req, res) => {
  const guildInfo =
    GUILD_WHITELIST.length > 0
      ? `Whitelist: ${GUILD_WHITELIST.length} servidor(es)`
      : "Todos os servidores liberados";

  res.send(`
    <html>
      <head><title>Bot Online</title></head>
      <body style="font-family:sans-serif;background:#0b0e14;color:#e8ecf4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;">
          <h1>🤖 Bot Online</h1>
          <p>Status: <span style="color:#3ba55d;">● Rodando</span></p>
          <p style="color:#8b95a8;font-size:0.9rem;">${guildInfo}</p>
          <p style="color:#8b95a8;font-size:0.9rem;">Hospedado no Render</p>
        </div>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    bot: client.isReady() ? "online" : "starting",
    guilds: client.isReady() ? client.guilds.cache.size : 0,
    whitelist: {
      guilds: GUILD_WHITELIST.length || "all",
      users: USER_WHITELIST.length || "all"
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor keep-alive rodando na porta ${PORT}`);
});

// ==================== BOT DO DISCORD ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot logado como ${c.user.tag}`);
  console.log(`📡 Presente em ${c.guilds.cache.size} servidor(es)`);

  if (GUILD_WHITELIST.length > 0) {
    console.log(`🔒 Whitelist de servidores ativa: ${GUILD_WHITELIST.length} ID(s)`);
  } else {
    console.log(`🔓 Sem whitelist de servidores (funciona em todos)`);
  }

  if (USER_WHITELIST.length > 0) {
    console.log(`👤 Whitelist de usuários ativa: ${USER_WHITELIST.length} ID(s)`);
  }

  client.user.setActivity("seus comandos", { type: ActivityType.Listening });
});

// Quando o bot entra em um servidor novo
client.on(Events.GuildCreate, (guild) => {
  if (!isGuildAllowed(guild.id)) {
    console.log(`🚫 Servidor não autorizado: ${guild.name} (${guild.id}) — saindo...`);
    guild.leave().catch(console.error);
  } else {
    console.log(`✅ Entrou no servidor autorizado: ${guild.name}`);
  }
});

// ==================== COMANDOS ====================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // ignora DM

  // Verifica se o servidor está na whitelist
  if (!isGuildAllowed(message.guild.id)) return;

  const content = message.content.trim();

  // ----- Comandos públicos (qualquer um no servidor autorizado) -----
  if (content === "!ping") {
    const sent = await message.reply("Calculando...");
    const latency = sent.createdTimestamp - message.createdTimestamp;
    sent.edit(`🏓 Pong! Latência: **${latency}ms** | API: **${Math.round(client.ws.ping)}ms**`);
    return;
  }

  if (content === "!status") {
    message.reply(
      `✅ Estou online!\n` +
        `⏱ Uptime: **${Math.floor(process.uptime())}s**\n` +
        `📡 Servidores: **${client.guilds.cache.size}**\n` +
        `🔒 Whitelist: **${GUILD_WHITELIST.length > 0 ? GUILD_WHITELIST.length + " servidores" : "desativada"}**`
    );
    return;
  }

  if (content === "!ajuda" || content === "!help") {
    message.reply(`**Comandos disponíveis:**
\`!ping\` — Testa a latência
\`!status\` — Mostra status do bot
\`!ajuda\` — Mostra esta mensagem
\`!whitelist\` — Mostra a whitelist (só donos)`);
    return;
  }

  // ----- Comandos só para usuários da whitelist -----
  if (content === "!whitelist") {
    if (!isUserAllowed(message.author.id)) {
      return message.reply("❌ Você não tem permissão para usar este comando.");
    }

    const guilds =
      GUILD_WHITELIST.length > 0
        ? GUILD_WHITELIST.map((id) => `• \`${id}\``).join("\n")
        : "_Nenhum (funciona em todos)_";

    const users =
      USER_WHITELIST.length > 0
        ? USER_WHITELIST.map((id) => `• \`${id}\``).join("\n")
        : "_Nenhum (qualquer um pode usar comandos públicos)_";

    message.reply(
      `**🔒 Whitelist de Servidores:**\n${guilds}\n\n` +
        `**👤 Whitelist de Usuários (admins):**\n${users}`
    );
    return;
  }
});

// Tratamento de erros
client.on(Events.Error, (error) => {
  console.error("Erro no client:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

// Login
client.login(TOKEN).catch((err) => {
  console.error("❌ Falha ao fazer login. Verifique o DISCORD_TOKEN.");
  console.error(err.message);
  process.exit(1);
});
