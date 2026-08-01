require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require("discord.js");
const express = require("express");

// ==================== CONFIGURAÇÃO ====================
const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

// Whitelist de servidores (vazio = todos)
const GUILD_WHITELIST = (process.env.GUILD_WHITELIST || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// IDs dos donos/admins do bot
const USER_WHITELIST = (process.env.USER_WHITELIST || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Canal onde as solicitações de liberação serão enviadas
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "";

// URL da imagem do painel (328x328) - coloque o link direto do PNG
const PANEL_IMAGE_URL = process.env.PANEL_IMAGE_URL || "";

// Cargo que será dado automaticamente após solicitar (opcional)
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID || "";

if (!TOKEN) {
  console.error("❌ ERRO: Variável DISCORD_TOKEN não definida!");
  process.exit(1);
}

function isGuildAllowed(guildId) {
  if (GUILD_WHITELIST.length === 0) return true;
  return GUILD_WHITELIST.includes(guildId);
}

function isUserAllowed(userId) {
  if (USER_WHITELIST.length === 0) return true;
  return USER_WHITELIST.includes(userId);
}

// ==================== KEEP-ALIVE ====================
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Bot Online</title></head>
      <body style="font-family:sans-serif;background:#0b0e14;color:#e8ecf4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;">
          <h1>🤖 Bot Online</h1>
          <p>Status: <span style="color:#3ba55d;">● Rodando</span></p>
          <p style="color:#8b95a8;font-size:0.9rem;">Ousadia RJ — Whitelist</p>
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
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor keep-alive na porta ${PORT}`);
});

// ==================== BOT ====================
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
  console.log(`📡 Servidores: ${c.guilds.cache.size}`);
  client.user.setActivity("Ousadia RJ", { type: ActivityType.Watching });
});

client.on(Events.GuildCreate, (guild) => {
  if (!isGuildAllowed(guild.id)) {
    console.log(`🚫 Servidor não autorizado: ${guild.name} — saindo`);
    guild.leave().catch(console.error);
  }
});

// ==================== PAINEL DE WHITELIST ====================
function createWhitelistPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C) // borda vermelha
    .setTitle("🔓 Liberação de ID — Ousadia RJ")
    .setDescription(
      "Seja bem-vindo(a) a **Ousadia RJ**.\n" +
        "Para acessar o servidor basta realizar a liberação do seu ID seguindo os passos abaixo.\n\n" +
        "• Para liberar seu ID basta apertar no botão **Liberar ID** e digitar o ID informado no jogo.\n" +
        "• Após colocar seu ID, aguarde a liberação do sistema.\n" +
        "• Você não sabe qual é seu ID? Entre no servidor, conecte-se e aguarde o aviso na tela."
    )
    .setFooter({ text: "Ousadia RJ • Sistema de Whitelist" })
    .setTimestamp();

  // Imagem no canto superior direito (thumbnail)
  if (PANEL_IMAGE_URL) {
    embed.setThumbnail(PANEL_IMAGE_URL);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("liberar_id")
      .setLabel("Liberar ID")
      .setStyle(ButtonStyle.Success) // verde
      .setEmoji("✅")
  );

  return { embeds: [embed], components: [row] };
}

// Comando para enviar o painel (!painel)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!isGuildAllowed(message.guild.id)) return;

  const content = message.content.trim().toLowerCase();

  if (content === "!painel" || content === "!whitelistpanel") {
    const isAdmin =
      isUserAllowed(message.author.id) ||
      message.member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!isAdmin) {
      return message.reply("❌ Você não tem permissão para enviar o painel.");
    }

    const panel = createWhitelistPanel();
    await message.channel.send(panel);

    if (message.deletable) {
      message.delete().catch(() => {});
    }
    return;
  }

  if (content === "!ping") {
    const sent = await message.reply("Calculando...");
    const latency = sent.createdTimestamp - message.createdTimestamp;
    sent.edit(`🏓 Pong! **${latency}ms** | API: **${Math.round(client.ws.ping)}ms**`);
    return;
  }

  if (content === "!status") {
    message.reply(
      `✅ Online\n⏱ Uptime: **${Math.floor(process.uptime())}s**\n📡 Servidores: **${client.guilds.cache.size}**`
    );
    return;
  }

  if (content === "!ajuda" || content === "!help") {
    message.reply(
      `**Comandos:**\n` +
        `\`!painel\` — Envia o painel de whitelist (admin)\n` +
        `\`!ping\` — Latência\n` +
        `\`!status\` — Status do bot\n` +
        `\`!ajuda\` — Esta mensagem`
    );
    return;
  }
});

// ==================== BOTÃO + MODAL ====================
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === "liberar_id") {
    const modal = new ModalBuilder()
      .setCustomId("modal_liberar_id")
      .setTitle("Liberação de ID — Ousadia RJ");

    const nomeInput = new TextInputBuilder()
      .setCustomId("nome")
      .setLabel("Nome")
      .setPlaceholder("Seu nome no jogo / Discord")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const idInput = new TextInputBuilder()
      .setCustomId("id_jogo")
      .setLabel("ID")
      .setPlaceholder("Digite o ID informado no jogo")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(30);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(idInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === "modal_liberar_id") {
    const nome = interaction.fields.getTextInputValue("nome");
    const idJogo = interaction.fields.getTextInputValue("id_jogo");

    await interaction.reply({
      content:
        `✅ **Solicitação enviada!**\n\n` +
        `**Nome:** ${nome}\n` +
        `**ID:** ${idJogo}\n\n` +
        `Aguarde a liberação do sistema.`,
      ephemeral: true
    });

    if (LOG_CHANNEL_ID) {
      try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("📋 Nova solicitação de whitelist")
            .addFields(
              { name: "Discord", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: false },
              { name: "ID Discord", value: `\`${interaction.user.id}\``, inline: true },
              { name: "Nome informado", value: nome, inline: true },
              { name: "ID do jogo", value: `\`${idJogo}\``, inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: "Ousadia RJ • Whitelist" })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        console.error("Erro ao enviar log:", err.message);
      }
    }

    if (AUTO_ROLE_ID && interaction.member) {
      try {
        await interaction.member.roles.add(AUTO_ROLE_ID);
        console.log(`Cargo ${AUTO_ROLE_ID} dado para ${interaction.user.tag}`);
      } catch (err) {
        console.error("Erro ao dar cargo:", err.message);
      }
    }

    console.log(`Whitelist: ${nome} | ID: ${idJogo} | Por: ${interaction.user.tag}`);
  }
});

client.on(Events.Error, (error) => console.error("Erro:", error));
process.on("unhandledRejection", (error) => console.error("Unhandled:", error));

client.login(TOKEN).catch((err) => {
  console.error("❌ Falha ao fazer login. Verifique o DISCORD_TOKEN.");
  console.error(err.message);
  process.exit(1);
});
