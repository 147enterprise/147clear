const fs = require("fs");
const readlineSync = require("readline-sync");
const readline = require("readline");
const { Client } = require("discord.js-selfbot-v13");
const { spawn, exec, spawnSync } = require("child_process");
const crypto = require("crypto");
const lame = require("@suldashi/lame");
const RPC = require("discord-rpc");
const AdmZip = require("adm-zip");
const transcripts = require("discord-html-transcripts");
const Speaker = require("speaker");
const path = require("path");

const VERSAO_ATUAL = "1.1.9";
const GRAVACOES_ATIVAS = new Map();
const client = new Client({ checkUpdate: false });
const rpc = new RPC.Client({ transport: "ipc" });

const config = (() => {
	if (!fs.existsSync("./config.json")) {
		criarConfig();
	}
	return JSON.parse(
		fs.readFileSync(path.join(process.cwd(), "config.json"), "utf8"),
	);
})();

const esperarEnter = () => {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.question("", () => {
			rl.close();
			resolve();
		});
	});
};

const clientId = config.rpc.id_aplicacao || "1257500388408692800";
let encontrarTokens;

if (!config.desativar_rpc) {
	try {
		RPC.register(clientId);
		rpc.login({ clientId }).catch(() => {});
	} catch {}
}

if (process.platform === "win32") {
	const appData = process.env.APPDATA;

	const PATHS_DISCORD = [
		{
			name: "Discord",
			path: path.join(appData, "discord", "Local Storage", "leveldb"),
		},
		{
			name: "DiscordCanary",
			path: path.join(appData, "discordcanary", "Local Storage", "leveldb"),
		},
		{
			name: "DiscordPTB",
			path: path.join(appData, "discordptb", "Local Storage", "leveldb"),
		},
	];

	const descriptografar_dpapi = (buffer) => {
		const input = buffer.toString("base64");

		const psScript = `
	    	Add-Type -AssemblyName System.Security;
	    	$encrypted = [Convert]::FromBase64String("${input}");
	    	$decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(
	    		$encrypted, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser
	    	);
	    	[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
	    	[System.Convert]::ToBase64String($decrypted);
	    `;

		const result = spawnSync(
			"powershell.exe",
			["-EncodedCommand", Buffer.from(psScript, "utf16le").toString("base64")],
			{
				encoding: "utf8",
				windowsHide: true,
			},
		);

		if (result.status !== 0 || result.error) return null;

		try {
			return Buffer.from(result.stdout.trim(), "base64");
		} catch {
			return null;
		}
	};

	const descriptografarAES = (buffer, key) => {
		try {
			const iv = buffer.slice(3, 15);
			const payload = buffer.slice(15);
			const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
			decipher.setAuthTag(payload.slice(-16));

			const descriptografado = Buffer.concat([
				decipher.update(payload.slice(0, -16)),
				decipher.final(),
			]);
			return descriptografado.toString("utf8");
		} catch {
			return null;
		}
	};

	encontrarTokens = async () => {
		let tokens = [];
		for (const { name, path: lvlPath } of PATHS_DISCORD) {
			if (!fs.existsSync(lvlPath)) continue;

			const localStatePath = path.join(appData, name, "Local State");
			if (!fs.existsSync(localStatePath)) continue;

			try {
				const localState = JSON.parse(fs.readFileSync(localStatePath, "utf-8"));
				const encryptedKey = Buffer.from(
					localState.os_crypt.encrypted_key,
					"base64",
				).slice(5);

				const decryptedKey = descriptografar_dpapi(encryptedKey);
				const files = fs
					.readdirSync(lvlPath)
					.filter((f) => f.endsWith(".ldb") || f.endsWith(".log"));

				for (const file of files) {
					const fullPath = path.join(lvlPath, file);
					const lines = fs.readFileSync(fullPath, "utf-8").split("\n");

					for (const line of lines) {
						const match = line.match(/dQw4w9WgXcQ:[^\"]+/);
						if (match) {
							const base64Data = match[0].split("dQw4w9WgXcQ:")[1];
							const decrypted = descriptografarAES(
								Buffer.from(base64Data, "base64"),
								decryptedKey,
							);
							if (!decrypted) continue;

							const userData = await validarToken(decrypted);
							if (userData) {
								tokens.push(decrypted);
							}
						}
					}
				}
			} catch (e) {
				continue;
			}
		}
		return [...new Set(tokens)];
	};
}

const menuOptions = [
	{ id: "1", description: "Apagar DM única", action: clearUnica },
	{ id: "2", description: "Apagar com Trigger", action: triggerClear },
	{ id: "3", description: "Apagar DMs abertas", action: clearAbertas },
	{ id: "4", description: "Apagar package", action: clearPackage },
	{ id: "5", description: "Remover amigos", action: removerAmigos },
	{ id: "6", description: "Remover servidores", action: removerServidores },
	{ id: "7", description: "Fechar DMs", action: fecharDMs },
	{ id: "8", description: "Kosame Farm", action: kosameFarm },
	{ id: "9", description: "Userinfo", action: userInfo },
	{ id: "10", description: "Abrir DMs", action: abrirDMs },
	{ id: "11", description: "Utilidades de call", action: utilidadesCall },
	{ id: "12", description: "Scraper Icons", action: scraperIcons },
	{ id: "13", description: "Clonar servidores", action: clonarServidores },
	{ id: "14", description: "Backup de mensagens", action: backupMensagens },
	{ id: "15", description: "Definir Rich Presence", action: definirRPC },
	{ id: "16", description: "Customizar", action: configurar },
	{ id: "17", description: "Sair", action: () => process.exit(0) },
];

function pegarTema() {
	return {
		name: config.rpc.nome,
		state: config.rpc.estado || `v${VERSAO_ATUAL}`,
		details: config.rpc.detalhe || "No menu principal",
		largeImageKey: config.rpc.url_imagem || "https://i.imgur.com/eZcFTY2.jpeg",
		...(config.rpc.texto_botao && config.rpc.url_botao
			? {
					textoBotao: config.rpc.texto_botao,
					urlBotao: config.rpc.url_botao,
				}
			: {}),
	};
}

const cor = hex(config.cor_painel || "#A020F0");
const erro = hex("#ff0000");
const ativo = hex("#19e356");
const reset = hex("#ffffff");
const aviso = "\u001b[43";

const sleep = (seconds) =>
	new Promise((resolve) => setTimeout(resolve, seconds * 1000));

async function updatePresence(presence) {
	if (!rpc || config.desativar_rpc) return;

	const theme = pegarTema();
	const activity = {
		state: presence.state || theme.state,
		details: presence.details || theme.details,
		largeImageKey: presence.largeImageKey || theme.largeImageKey,
		largeImageText: presence.largeImageText || theme.largeImageText,
		smallImageKey: presence.smallImageKey || theme.smallImageKey,
		smallImageText: presence.smallImageText || theme.smallImageText,
		...(theme.textoBotao && theme.urlBotao
			? { buttons: [{ label: theme.textoBotao, url: theme.urlBotao }] }
			: {}),
	};

	try {
		await rpc.setActivity(activity);
	} catch {}
}

function hex(hex) {
	if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
		throw new Error("Código hex inválido. Deve ser no formato #RRGGBB.");
	}

	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);

	if (
		isNaN(r) ||
		isNaN(g) ||
		isNaN(b) ||
		r < 0 ||
		r > 255 ||
		g < 0 ||
		g > 255 ||
		b < 0 ||
		b > 255
	) {
		throw new Error("Valores RGB fora do intervalo válido (0-255).");
	}

	return `\x1b[38;2;${r};${g};${b}m`;
}

async function fetchMsgs(canal) {
	const canall = client.channels.cache.get(canal);

	if (!canall) {
		return [];
	}

	let ultimoid;
	let messages = [];
	let totalMessages = 0;

	while (true) {
		const fetched = await canall.messages.fetch({
			limit: 100,
			...(ultimoid && { before: ultimoid }),
		});

		if (fetched.size === 0) {
			return messages.filter(
				(msg) => msg.author.id === client.user.id && !msg.system,
			);
		}

		totalMessages += fetched.size;
		console.clear();
		await titulo(client?.user?.username || "a", client?.user?.id || "ww");
		console.log(
			`${reset}- [${cor}!${reset}] ${cor}Dando fetch nas mensagens com ${reset}${canall?.recipient?.globalName || canall?.recipient?.username || canall?.name}.\n- [${cor}@${reset}] ${cor}Encontradas ${reset}${totalMessages} mensagens ${cor}totais até agora.`,
		);

		messages = messages.concat(Array.from(fetched.values()));
		ultimoid = fetched.lastKey();
	}
}

async function titulo(username, userId) {
	console.log(`
        ${cor} ██╗██╗  ██╗███████╗ ${reset} ██████╗██╗     ███████╗ █████╗ ██████╗ 
        ${cor}███║██║  ██║╚════██║ ${reset}██╔════╝██║     ██╔════╝██╔══██╗██╔══██╗
        ${cor}╚██║███████║    ██╔╝ ${reset}██║     ██║     █████╗  ███████║██████╔╝
        ${cor} ██║╚════██║   ██╔╝  ${reset}██║     ██║     ██╔══╝  ██╔══██║██╔══██╗
        ${cor} ██║     ██║   ██║   ${reset}╚██████╗███████╗███████╗██║  ██║██║  ██║
        ${cor} ╚═╝     ╚═╝   ╚═╝   ${reset}╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝\n   
        ${cor}Usuário:${reset} ${username}
        ${cor}ID:${reset} ${userId}\n`);
}

function criarConfig() {
	const configData = {
		tokens: [],
		rpc: {
			id_aplicacao: "1257500388408692800",
			detalhe: "O melhor CL do Discord!",
			estado: "/147",
		},
		cor_painel: "#A020F0",
		delay: "1",
		esperar_fetch: false,
	};

	if (!fs.existsSync("config.json")) {
		fs.writeFileSync("config.json", JSON.stringify(configData, null, 4));
	} else {
		try {
			const currentConfig = JSON.parse(fs.readFileSync("config.json"));
			if (!currentConfig.tokens || !Array.isArray(currentConfig.tokens)) {
				throw new Error();
			}
		} catch (error) {
			fs.writeFileSync("config.json", JSON.stringify(configData, null, 4));
		}
	}
}

function escreverToken(nome, token) {
	criarConfig();
	const currentConfig = JSON.parse(fs.readFileSync("config.json"));
	currentConfig.tokens.push({ nome, token });
	fs.writeFileSync("config.json", JSON.stringify(currentConfig, null, 4));
}

async function pedirToken() {
	console.clear();
	process.title = "147Clear | Adicionar token";
	while (true) {
		const token = readlineSync.question("Token: ").replace(/"/g, "").trim();
		const nome = readlineSync.question("Nome para representar a token: ");

		const nomeExistente = config.tokens.find((t) => t.nome === nome);
		if (nomeExistente) {
			console.clear();
			console.log(
				`${erro}[X]${reset} Já existe uma token com esse nome. Insira um nome novo.\n`,
			);
			await sleep(5);
			return;
		}

		if (await validarToken(token)) {
			const tokenExistente = config.tokens.find((t) => t.token === token);
			if (tokenExistente) {
				console.clear();
				console.log(`${erro}[X]${reset} Essa token já está na config.`);
				await sleep(5);
				return;
			}
			escreverToken(nome, token);
			break;
		} else {
			console.clear();
			console.log(`${erro}[X]${reset} Token inválida, insira outra.\n`);
		}
	}
}

async function validarToken(token) {
	const response = await fetch("https://discord.com/api/v9/users/@me", {
		headers: {
			Authorization: token.replace(/Bot|Bearer/gi, "").trim(),
		},
	});
	const u = await response.json();
	return u.username || false;
}

async function exibirBarraDeProgresso(
	contador,
	total,
	tituloTexto = "Progresso",
	textoProgress,
	textoComp = "",
	client,
) {
	const porcentagem = (contador / total) * 100;
	const progresso =
		"[" +
		"█".repeat(Math.floor(porcentagem / 2)) +
		"░".repeat(50 - Math.floor(porcentagem / 2)) +
		"]";

	process.title = `${tituloTexto} | ${contador}/${total} ${textoProgress}`;

	console.clear();
	await titulo(client?.user?.username || "a", client?.user?.id || "ww");

	console.log(
		`${textoComp ? `${textoComp}` : ""}${cor}${progresso}${reset} | ${porcentagem.toFixed(2)}% | ${contador}/${total} ${textoProgress}`,
	);
}

async function clearUnica() {
	console.clear();

	process.title = "147Clear | Limpar com DM única";
	console.log("Insira o ID do usuário.");
	let id = readlineSync.question("> ");
	let nome;
	let canal = client.channels.cache.get(id);
	let contador = 0;

	if (!canal) {
		const user = await client.users.fetch(id).catch(() => {});
		if (!user) {
			console.clear();
			console.log(`${erro}[X]${reset} Este ID é inválido.`);
			await sleep(3.5);
			await clearUnica();
		}
		nome = user?.globalName || user?.username;
		await user
			?.createDM()
			.then((c) => ((id = c.id), (canal = c)))
			.catch(async () => {
				console.clear();
				console.log(
					`${erro}[X]${reset} Não foi possível abrir DM com o usuário.`,
				);
				await sleep(3.5);
				await clearUnica();
			});
	} else {
		nome = canal.name;
	}

	let totalFiltrados = 0;
	if (config.esperar_fetch === false) {
		let ultimoid;
		while (true) {
			const fetched = await canal.messages.fetch({
				limit: 100,
				...(ultimoid && { before: ultimoid }),
			});

			if (fetched.size === 0) break;

			const msgsFiltradas = Array.from(fetched.values()).filter(
				(msg) => msg.author.id === client.user.id && !msg.system,
			);

			totalFiltrados += msgsFiltradas.length;

			for (const [index, msg] of msgsFiltradas.entries()) {
				await sleep(Number.parseFloat(config.delay) || 1);
				await msg
					.delete()
					.then(async () => {
						contador++;
						await exibirBarraDeProgresso(
							contador,
							totalFiltrados,
							"147Clear | Limpar com DM única",
							"mensagens removidas",
							`        ${cor}Apagando com${reset} ${nome}\n`,
							client,
						);

						await updatePresence({
							state: `${Math.round((contador / totalFiltrados) * 100)}%`,
							details: `Apagando mensagens: ${contador}/${totalFiltrados}`,
						});
					})
					.catch(() => {});
			}
			ultimoid = fetched.lastKey();
		}
	} else {
		const msgs = await fetchMsgs(id);
		totalFiltrados = msgs.length;
		for (const [index, msg] of msgs.entries()) {
			await sleep(Number.parseFloat(config.delay) || 1);
			await msg
				.delete()
				.then(async () => {
					contador++;
					await exibirBarraDeProgresso(
						contador,
						totalFiltrados,
						"147Clear | Limpar com DM única",
						"mensagens removidas",
						`        ${cor}Apagando com${reset} ${nome}\n`,
						client,
					);

					await updatePresence({
						state: `${Math.round((contador / totalFiltrados) * 100)}%`,
						details: `Apagando mensagens: ${contador}/${totalFiltrados}`,
					});
				})
				.catch(() => {});
		}
	}

	if (!totalFiltrados) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não tem mensagens ai.`);
		await sleep(3.5);
		menu(client);
	}

	setTimeout(async () => {
		menu(client);
	}, 1000);
}

async function clearAbertas() {
	console.clear();

	process.title = "147Clear | Limpar com DMs abertas";
	const dms = await client.channels.cache
		.filter((c) => c.type == "DM")
		.map((a) => a);
	let contador = 0;

	if (!dms.length) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não tem DMs abertas.`);
		await sleep(3.5);
		return menu(client);
	}

	console.log("Fechar cada DM após apagar as mensagens? [s/sim]");
	const pergunta = readlineSync.question("> ");
	const fechar =
		pergunta.toLowerCase() === "s" || pergunta.toLowerCase() === "sim";

	for (const dm of dms) {
		contador++;
		let contador_msgs = 0;
		let totalFiltrados = 0;

		if (config.esperar_fetch === false) {
			let ultimoid;
			while (true) {
				const fetched = await dm.messages.fetch({
					limit: 100,
					...(ultimoid && { before: ultimoid }),
				});

				if (fetched.size === 0) break;

				const msgsFiltradas = Array.from(fetched.values()).filter(
					(msg) => msg.author.id === client.user.id && !msg.system,
				);

				totalFiltrados += msgsFiltradas.length;

				for (const [index, msg] of msgsFiltradas.entries()) {
					await sleep(Number.parseFloat(config.delay) || 1);
					await msg
						.delete()
						.then(async () => {
							contador_msgs++;
							await exibirBarraDeProgresso(
								contador_msgs,
								totalFiltrados,
								"147Clear | Limpar com DMs abertas",
								"mensagens removidas",
								`        ${cor}Apagando com${reset} ${
									dm.recipient.globalName || dm.recipient.username
								}\n`,
								client,
							);

							await updatePresence({
								state: `${contador_msgs}/${totalFiltrados}`,
								details: `Apagando ${contador_msgs}/${totalFiltrados} [${Math.round(
									(contador_msgs / totalFiltrados) * 100,
								)}%]`,
							});
						})
						.catch(() => {});
				}

				ultimoid = fetched.lastKey();
			}
		} else {
			const msgs = await fetchMsgs(dm.id);
			totalFiltrados = msgs.length;

			if (!msgs.length) continue;

			for (const [index, msg] of msgs.entries()) {
				await sleep(Number.parseFloat(config.delay) || 1);
				await msg
					.delete()
					.then(async () => {
						contador_msgs++;
						await exibirBarraDeProgresso(
							contador_msgs,
							totalFiltrados,
							"147Clear | Limpar com DMs abertas",
							"mensagens removidas",
							`        ${cor}Apagando com${reset} ${
								dm.recipient.globalName || dm.recipient.username
							}\n`,
							client,
						);

						await updatePresence({
							state: `${contador_msgs}/${totalFiltrados}`,
							details: `Apagando ${contador_msgs}/${totalFiltrados} [${Math.round(
								(contador_msgs / totalFiltrados) * 100,
							)}%]`,
						});
					})
					.catch(() => {});
			}
		}

		if (fechar) await dm.delete().catch(() => {});
	}

	setTimeout(async () => {
		menu(client);
	}, 1000);
}

async function removerAmigos() {
	console.clear();

	process.title = "147Clear | Remover amigos";
	const amigos = client.relationships.cache
		.filter((value) => value === 1)
		.map((value, key) => key);
	let contador = 0;

	if (!amigos.length) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não tem amigos :(`);
		await sleep(3.5);
		menu(client);
	}

	for (const amigo of amigos) {
		await sleep(Number.parseFloat(config.delay) || 1);
		const user = await client.users.fetch(amigo).catch(() => {});
		await client.relationships
			.deleteRelationship(user)
			.then(async () => {
				contador++;
				await exibirBarraDeProgresso(
					contador,
					amigos.length,
					"147Clear | Remover amigos",
					"amigos removidos",
					"",
					client,
				);

				await updatePresence({
					details: `Removendo amigos ${contador}/${amigos.length} [${Math.round((contador / amigos.length) * 100)}%]`,
				});
			})
			.catch(() => {});
	}

	setTimeout(() => {
		menu(client);
	}, 1000);
}

async function removerServidores() {
	console.clear();

	process.title = "147Clear | Remover servidores";
	const servers = client.guilds.cache.map((a) => a);
	let contador = 0;

	if (!servers.length) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não está em nenhum servidor.`);
		await sleep(3.5);
		menu(client);
	}

	for (const server of servers) {
		await sleep(Number.parseFloat(config.delay) || 1);
		await server
			.leave()
			.then(async () => {
				contador++;
				await exibirBarraDeProgresso(
					contador,
					servers.length,
					"147Clear | Remover servidores",
					"servidores removidos",
					"",
					client,
				);

				await updatePresence({
					details: `Removendo servidores ${contador}/${servers.length} [${Math.round((contador / servers.length) * 100)}%]`,
				});
			})
			.catch(() => {});
	}

	setTimeout(() => {
		menu(client);
	}, 1000);
}

async function fecharDMs() {
	console.clear();

	process.title = "147Clear | Fechar DMs";
	const dms = await client.channels.cache
		.filter((c) => c.type == "DM")
		.map((a) => a);
	let contador = 0;

	if (!dms.length) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não tem DMs abertas.`);
		await sleep(3.5);
		menu(client);
	}

	for (const dm of dms) {
		await sleep(1.3);
		await dm
			.delete()
			.then(async () => {
				contador++;
				await exibirBarraDeProgresso(
					contador,
					dms.length,
					"147Clear | Fechar DMs",
					"DMs fechadas",
					"",
					client,
				);

				await updatePresence({
					details: `Fechando DMs ${contador}/${dms.length} [${Math.round((contador / dms.length) * 100)}%]`,
				});
			})
			.catch(() => {});
	}

	setTimeout(() => {
		menu(client);
	}, 1000);
}

async function configurar() {
	console.clear();

	process.title = "147Clear | Configuração";
	await titulo(client?.user?.username || "a", client?.user?.id || "ww");

	console.log(`
        ${cor}[ 1 ]${reset} Mudar delay
        ${cor}[ 2 ]${reset} Mudar cor do painel
        ${cor}[ 3 ]${reset} Esperar obtenção de todas as mensagens para apagar
        ${cor}[ 4 ]${reset} Ativar ou desativar o Rich Presence (RPC) do perfil
        
        ${cor}[ 5 ]${reset} Voltar
  `);

	const opcoes = {
		1: async () => {
			console.clear();
			console.log(
				"Insira o delay em segundos. (ex: 1.5 para 1 segundo e meio)",
			);
			const delayInput = readlineSync.question("> ");

			const delayInSeconds = Number.parseFloat(delayInput);
			if (isNaN(delayInSeconds) || delayInSeconds <= 0) {
				console.clear();
				console.log(`${erro}[X]${reset} Isso não é um delay válido.`);
				await sleep(3.5);
			} else {
				const currentConfig = JSON.parse(fs.readFileSync("config.json"));
				currentConfig.delay = delayInSeconds.toString();
				fs.writeFileSync("config.json", JSON.stringify(currentConfig, null, 4));
				await sleep(1.5);
			}
		},
		2: async () => {
			console.clear();
			console.log("Insira a cor em formato HEX (ex: #ffffff)");
			const cor = readlineSync.question("> ");

			try {
				const cor_convertida = hex(cor);
				const currentConfig = JSON.parse(fs.readFileSync("config.json"));
				currentConfig.cor_painel = cor;
				fs.writeFileSync("config.json", JSON.stringify(currentConfig, null, 4));
				console.clear();
				console.log("Cor trocada com sucesso, inicie o programa novamente.");
				await sleep(7);
				process.exit(0);
			} catch {
				console.clear();
				console.log(`${erro}[X]${reset} Isso não é uma cor HEX válida.`);
				await sleep(3.5);
			}
		},
		3: async () => {
			while (true) {
				console.clear();
				console.log("Esperar a obtenção de TODAS as mensagens para apagar?");
				console.log(
					"Estado atual:",
					config.esperar_fetch
						? `${ativo}Ativado${reset}`
						: `${erro}Desativado${reset}`,
				);
				console.log(`\n${cor}[ 1 ]${reset} Alterar estado`);
				console.log(`${cor}[ 2 ]${reset} Voltar para o menu\n`);

				const opcao = readlineSync.question("> ");

				switch (opcao) {
					case "1":
						config.esperar_fetch = !config.esperar_fetch;
						fs.writeFileSync("config.json", JSON.stringify(config, null, 4));
						break;
					case "2":
						return menu(client);
					default:
						console.clear();
						console.log(`${erro}[X] ${reset} Opção inválida, tente novamente.`);
						await sleep(1.5);
						break;
				}
			}
		},
		4: async () => {
			while (true) {
				console.clear();
				console.log(
					`(Reinicie o clear após alterar o estado para aplicar as alterações)
Estado atual do Rich Presence:`,
					!config.desativar_rpc
						? `${ativo}Ativo${reset}`
						: `${erro}Desativado${reset}`,
				);
				console.log(`\n${cor}[ 1 ]${reset} Alterar estado`);
				console.log(`${cor}[ 2 ]${reset} Voltar para o menu\n`);

				const opcao = readlineSync.question("> ");

				switch (opcao) {
					case "1":
						config.desativar_rpc = !config.desativar_rpc;
						fs.writeFileSync("config.json", JSON.stringify(config, null, 4));
						break;
					case "2":
						return menu(client);
					default:
						console.clear();
						console.log(`${erro}[X] ${reset} Opção inválida, tente novamente.`);
						await sleep(1.5);
						break;
				}
			}
		},
		5: async () => {
			return menu(client);
		},
		default: async () => {
			console.log(`${erro}[X] ${reset}Opção inválida, tente novamente.`);
			await sleep(1.5);
			console.clear();
		},
	};

	const opcao = readlineSync.question("> ");

	await (opcoes[opcao] || opcoes["default"])();
	await configurar();
}

async function kosameFarm() {
	console.clear();
	process.title = "147Clear | Kosame Farm";

	console.log("ID do chat para envio dos comandos.");
	const chat_id = readlineSync.question("> ");
	const canal = client.channels.cache.get(chat_id);

	if (!canal) {
		console.clear();
		console.log(`${erro}[X] ${reset}ID inválido, tente novamente.`);
		await sleep(1.5);
		return menu(client);
	}

	if (!canal.permissionsFor(canal.guild.members.me).has("SEND_MESSAGES")) {
		console.clear();
		console.log(
			`${erro}[X] ${reset}Você não tem permissão para enviar mensagens neste canal.`,
		);
		await sleep(4.5);
		return menu(client);
	}

	console.clear();
	await titulo(client?.user?.username || "a", client?.user?.id || "ww");
	console.log(
		`  ${cor}[+] ${reset}Farmando no canal ${cor}${canal.name}${reset} no servidor ${cor}${canal.guild.name}${reset}.`,
	);
	console.log(
		`  ${cor}[+] ${reset}Pressione ${cor}ENTER ${reset}para parar de farmar.\n`,
	);

	const delays = {
		gf: 30 * 60 * 1000,
		crime: 10 * 60 * 1000,
		daily: 24 * 60 * 60 * 1000,
		work: 60 * 60 * 1000,
		semanal: 7 * 24 * 60 * 60 * 1000,
	};

	const comandos = {
		gf: { comando: "k!gf", ultimoEnvio: 0 },
		crime: { comando: "k!crime", ultimoEnvio: 0 },
		daily: { comando: "k!daily", ultimoEnvio: 0 },
		work: { comando: "k!work", ultimoEnvio: 0 },
		semanal: { comando: "k!semanal", ultimoEnvio: 0 },
	};

	const messageCreateListener = async (msg) => {
		if (
			msg.reference &&
			msg.author.id === "762320527637217312" &&
			msg.mentions.has(client.user) &&
			msg.content.includes("Você pode reduzir o tempo de espera")
		) {
			const msg_kk = await msg.channel.messages
				.fetch(msg.reference.messageId, { force: true })
				.catch(() => {});
			if (!msg_kk) return;

			const comandoReenviado = Object.keys(comandos).find(
				(chave) => comandos[chave].comando === msg_kk.content,
			);

			if (
				comandoReenviado &&
				Date.now() - comandos[comandoReenviado].ultimoEnvio < 15 * 1000
			) {
				console.log(
					`  ${erro}[!] ${reset}Ignorando retry de ${msg_kk.content}, enviado há pouco tempo.`,
				);
				return;
			}

			await sleep(9);
			await msg.channel.send(msg_kk.content).catch(() => {});

			if (comandoReenviado) {
				comandos[comandoReenviado].ultimoEnvio = Date.now();
				console.log(
					`  ${cor}[+]${reset} Retry pós delay enviado: ${msg_kk.content}`,
				);
			}
		}
	};

	client.on("messageCreate", messageCreateListener);

	let interromper = false;
	const escutandoEnter = esperarEnter().then(() => {
		interromper = true;
	});

	const chavesComandos = Object.keys(comandos);

	while (!interromper) {
		const agora = Date.now();

		for (let i = 0; i < chavesComandos.length; i++) {
			if (interromper) break;

			const chave = chavesComandos[i];
			const cmd = comandos[chave];
			const tempoPassado = agora - cmd.ultimoEnvio;

			if (tempoPassado >= delays[chave]) {
				try {
					await canal.send(cmd.comando);
					await sleep(9);
					cmd.ultimoEnvio = Date.now();
					console.log(`  ${cor}[+] ${reset}Enviado: ${cmd.comando}`);
				} catch (e) {
					console.log(
						`  ${erro}[!] ${reset}Falha ao enviar ${cmd.comando}: ${e.message}`,
					);
				}
			}
		}

		for (let i = 0; i < 10 && !interromper; i++) {
			await sleep(0.1);
		}
	}

	client.off("messageCreate", messageCreateListener);
	return menu(client);
}

async function processarCanais(zipEntries, whitelist) {
	const totalDMs = await contarDMs(zipEntries);
	let contador = 0;

	for (const entry of zipEntries) {
		if (!canalValido(entry)) continue;

		const channelData = dadosCanal(entry);
		if (!ehDMGrupo(channelData)) continue;

		for (const recipientId of pegarRecipients(channelData.recipients)) {
			if (whitelist.includes(recipientId)) continue;

			const user = await client.users.fetch(recipientId).catch(() => {});
			await sleep(Number.parseFloat(config.delay) || 1);

			const dmChannel = await user?.createDM().catch(() => {});
			if (dmChannel) {
				await cleanMessagesFromDM(dmChannel, client);
				contador++;

				await exibirBarraDeProgresso(
					contador,
					totalDMs,
					"147Clear | Apagar package",
					"DMs limpas",
					`        ${cor}Apagando com${reset} ${dmChannel.recipient.globalName || dmChannel.recipient.username}\n`,
					client,
				);

				await updatePresence({
					details: `Usando CL all`,
					state: `Apagando ${contador}/${totalDMs} DMs [${Math.round((contador / totalDMs) * 100)}%]`,
				});
			}
		}
	}
}

function canalValido(entry) {
	return /^(?:messages|Mensagens)\/c[0-9]+\/channel\.json$/.test(
		entry.entryName,
	);
}

function dadosCanal(entry) {
	try {
		return JSON.parse(entry.getData().toString());
	} catch {
		return null;
	}
}

function ehDMGrupo(data) {
	return (
		data?.recipients &&
		Array.isArray(data.recipients) &&
		data.type === "DM" &&
		data.recipients.length > 1
	);
}

function pegarRecipients(recipients) {
	return recipients.filter((r) => r !== client.user.id);
}

async function contarDMs(zipEntries) {
	let count = 0;
	for (const entry of zipEntries) {
		if (canalValido(entry)) {
			count++;
		}
	}
	return count;
}

async function cleanMessagesFromDM(dmChannel, client) {
	let deletedCount = 0;
	let totalFiltrados = 0;

	if (config.esperar_fetch === false) {
		let ultimoid;

		while (true) {
			const fetched = await dmChannel.messages.fetch({
				limit: 100,
				...(ultimoid && { before: ultimoid }),
			});

			if (fetched.size === 0) break;

			const msgsFiltradas = Array.from(fetched.values()).filter(
				(msg) => msg.author.id === client.user.id && !msg.system,
			);

			totalFiltrados += msgsFiltradas.length;

			for (const msg of msgsFiltradas) {
				await sleep(Number.parseFloat(config.delay) || 1);

				await msg
					.delete()
					.then(async () => {
						deletedCount++;

						await exibirBarraDeProgresso(
							deletedCount,
							totalFiltrados,
							"147Clear | Apagar package",
							"mensagens removidas",
							`        ${cor}Apagando mensagens no canal ${reset}${
								dmChannel.name || dmChannel.recipient.username
							} \n`,
							client,
						);
					})
					.catch((e) => {
						if (e.message.includes("Could not find the channel")) {
							return;
						}
					});
			}

			ultimoid = fetched.lastKey();
		}
	} else {
		const messages = await fetchMsgs(dmChannel.id);
		totalFiltrados = messages.length;

		for (const msg of messages) {
			await sleep(Number.parseFloat(config.delay) || 1);

			await msg
				.delete()
				.then(async () => {
					deletedCount++;

					await exibirBarraDeProgresso(
						deletedCount,
						totalFiltrados,
						"147Clear | Apagar package",
						"mensagens removidas",
						`        ${cor}Apagando mensagens no canal ${reset}${
							dmChannel.name || dmChannel.recipient.username
						} \n`,
						client,
					);
				})
				.catch((e) => {
					if (e.message.includes("Could not find the channel")) {
						return;
					}
				});
		}
	}

	await dmChannel.delete().catch(() => {});
}

async function userInfo() {
	console.clear();
	process.title = "147Clear | Informações do Usuário";

	await titulo(client.user.username, client.user.id);

	const impulsionamento =
		await client.api.users[client.user.id]["profile"].get();
	const dmsAbertas = await client.api.users["@me"]["channels"].get();

	let nivelImpulsionamento = {};

	if (impulsionamento.premium_guild_since) {
		const dataImpulsionamento = new Date(impulsionamento.premium_guild_since);
		const agora = new Date();

		const diffMeses = diferencaEmMeses(dataImpulsionamento, agora);
		const niveisMeses = [1, 2, 3, 6, 9, 12, 15, 18, 24];

		let previous = 0;
		let next = 0;

		for (const meses of niveisMeses) {
			if (diffMeses >= meses) {
				previous = meses;
			} else {
				next = meses;
				break;
			}
		}

		if (diffMeses < 1) {
			previous = 1;
			next = 2;
		}

		const duracaoAteAgora = calcularDuracao(dataImpulsionamento, agora);

		if (diffMeses >= 24) {
			nivelImpulsionamento = {
				dataImpulsionamento: `${formatarData(dataImpulsionamento)} (Há ${duracaoAteAgora})`,
				dataProxima: "Não sobe mais de nível",
			};
		} else {
			const dataProxima = adicionarMeses(dataImpulsionamento, next);
			const duracaoRestante = calcularDuracao(agora, dataProxima);
			nivelImpulsionamento = {
				dataImpulsionamento: `${formatarData(dataImpulsionamento)} (Há ${duracaoAteAgora})`,
				dataProxima: `${formatarData(dataProxima)} (Em ${duracaoRestante})`,
			};
		}
	}

	console.log(`
    ${reset}├─>${cor} Usuário:${reset}${client.user.globalName ? ` ${client.user.username} (\`${client.user.globalName}\`) > ${cor}${client.user.id}` : `${client.user.username} | ${cor}${client.user.id}`}
    ${reset}├─>${cor} DMs abertas:${reset} ${dmsAbertas.length}
    ${
			nivelImpulsionamento.dataImpulsionamento
				? `${reset}└─>${cor} Boost:
    ${reset}  ├─> ${cor} Data início: ${reset} ${nivelImpulsionamento.dataImpulsionamento}
    ${reset}  └─> ${cor} Data próxima: ${reset} ${nivelImpulsionamento.dataProxima}`
				: ``
		}
  `);

	readlineSync.question(
		`${cor}>${reset} Aperte ${cor}ENTER${reset} para voltar`,
	);
	menu(client);

	function diferencaEmMeses(inicio, fim) {
		const anos = fim.getFullYear() - inicio.getFullYear();
		const meses = fim.getMonth() - inicio.getMonth();
		return anos * 12 + meses - (fim.getDate() < inicio.getDate() ? 1 : 0);
	}

	function adicionarMeses(data, meses) {
		const novaData = new Date(data.getTime());
		novaData.setMonth(novaData.getMonth() + meses);
		return novaData;
	}

	function calcularDuracao(inicio, fim) {
		let delta = Math.floor((fim - inicio) / 1000);
		const minutos = Math.floor(delta / 60) % 60;
		const horas = Math.floor(delta / 3600) % 24;
		const dias = Math.floor(delta / 86400) % 30;
		const meses = Math.floor(delta / 2592000) % 12;
		const anos = Math.floor(delta / 31104000);

		const partes = [];
		if (anos > 0) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
		if (meses > 0) partes.push(`${meses} mês${meses > 1 ? "es" : ""}`);
		if (dias > 0) partes.push(`${dias} dia${dias > 1 ? "s" : ""}`);
		if (horas > 0) partes.push(`${horas} hora${horas > 1 ? "s" : ""}`);
		if (minutos > 0) partes.push(`${minutos} minuto${minutos > 1 ? "s" : ""}`);

		if (partes.length > 1) {
			const ultimo = partes.pop();
			return partes.join(", ") + " e " + ultimo;
		}
		return partes[0] || "menos de um minuto";
	}

	function formatarData(data) {
		return new Intl.DateTimeFormat("pt-BR", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(data);
	}
}

async function clearPackage() {
	console.clear();

	process.title = "147Clear | Apagar package";

	const psScript = `
  Function Select-ZipFileDialog {
      param([string]$Description="Selecione o ZIP do Discord", [string]$Filter="ZIP files (*.zip)|*.zip")

      [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null

      $objForm = New-Object System.Windows.Forms.OpenFileDialog
      $objForm.Filter = $Filter
      $objForm.Title = $Description
      $Show = $objForm.ShowDialog()
      If ($Show -eq "OK") {
          Return $objForm.FileName
      }
  }

  $zipFile = Select-ZipFileDialog
  Write-Output $zipFile
  `;

	console.log(`
  ${cor}Você precisa ter o pacote de dados do Discord em mãos, você o tem?
  
  [!] ${reset}Como pegá-lo: Configurações > Dados e privacidade > Solicitar dados (marque Mensagens). O .ZIP chegará no e-mail, prazo varia conforme a idade da conta.
  
  ${cor}[ 1 ]${reset} Tenho
  ${cor}[ 2 ]${reset} Não tenho
  `);

	const tem = readlineSync.question("> ");
	if (tem !== "1") return menu(client);

	if (process.platform === "win32") {
		const child = spawnSync("powershell.exe", ["-Command", psScript], {
			encoding: "utf8",
			windowsHide: true,
		});
		const path = child.stdout.toString().trim();
		if (!path) {
			console.clear();
			console.log(`${erro}[X]${reset} Você não selecionou o ZIP.`);
			await sleep(5);
			await menu(client);
		}

		const buffer_zip = fs.readFileSync(path);
		const zipEntries = new AdmZip(buffer_zip).getEntries();

		console.clear();
		console.log(
			"Insira os IDs que você não deseja apagar (id, id, id). caso não tenha nenhum aperte ENTER.",
		);
		const whitelist = readlineSync.question("> ");
		const ids_whitelist = whitelist.split(/,\s*/);

		await processarCanais(zipEntries, ids_whitelist);
	} else {
		if (!fs.existsSync("package.zip")) {
			console.clear();
			console.log(
				`${erro}[X]${reset} Não achei o arquivo "package.zip", coloque-o na mesma pasta que eu(${path.basename(__filename)}) e tente novamente.`,
			);
			await sleep(8);
			await menu(client);
		}

		console.clear();
		console.log(
			"Insira os IDs que você não deseja apagar (id, id, id). caso não tenha nenhum aperte ENTER.",
		);
		const whitelist = readlineSync.question("> ");
		const ids_whitelist = whitelist.split(/,\s*/);

		const buffer_zip = fs.readFileSync("package.zip");
		const zipEntries = new AdmZip(buffer_zip).getEntries();
		await processarCanais(zipEntries, ids_whitelist);
	}

	menu(client);
}

async function abrirDMs() {
	console.clear();

	process.title = "147Clear | Abrir DMs";
	console.log(`
    ${cor}[ 1 ]${reset} Abrir DMs com amigos
    ${cor}[ 2 ]${reset} Abrir todas as DMs com quem conversou (package)

    ${cor}[ 3 ]${reset} Voltar
  `);
	const opcao = readlineSync.question("> ");

	if (opcao === "1") {
		await abrirDMsComAmigos();
	} else if (opcao === "2") {
		await abrirTodasAsDMs();
	} else if (opcao === "3") {
		return await menu(client);
	} else {
		console.clear();
		console.log(`${erro}[X] ${reset}Opção inválida, tente novamente.`);
		await sleep(1.5);
		await menu(client);
	}

	menu(client);
}

async function abrirDMsComAmigos() {
	const amigos = client.relationships.cache
		.filter((value) => value === 1)
		.map((value, key) => key);
	let contador = 0;

	if (!amigos.length) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não tem amigos :(`);
		await sleep(5);
		menu(client);
		return;
	}

	for (const amigo of amigos) {
		const amigokk = await client.users.fetch(amigo).catch(() => {});
		await sleep(1.7);
		await amigokk
			.createDM()
			.then(async () => {
				contador++;
				await exibirBarraDeProgresso(
					contador,
					amigos.length,
					"147Clear | Abrir DMs",
					"DMs abertas",
					"",
					client,
				);

				await updatePresence({
					details: `Abrindo DMs com amigos ${contador}/${amigos.length} [${Math.round((contador / amigos.length) * 100)}%]`,
				});
			})
			.catch(() => {});
	}

	setTimeout(() => {
		menu(client);
	}, 1000);
}

async function abrirTodasAsDMs() {
	console.clear();
	console.log(`
    ${cor}Você precisa ter o pacote de dados do Discord em mãos, você o tem?
  
    [!] ${reset}Como pegá-lo: Configurações > Dados e privacidade > Solicitar dados (marque Mensagens). O .ZIP chegará no e-mail, prazo varia conforme a idade da conta.
  
    ${cor}[ 1 ]${reset} Tenho
    ${cor}[ 2 ]${reset} Não tenho
  `);

	const tem = readlineSync.question("> ");
	if (tem !== "1") return menu(client);

	const path = await selecionarArquivoZip();
	if (!path) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não selecionou o ZIP.`);
		await sleep(5);
		await menu(client);
		return;
	}

	const buffer_zip = fs.readFileSync(path);
	const zipEntries = new AdmZip(buffer_zip).getEntries();
	const totalDMs = (await contarDMs(zipEntries)) / 2;
	let contador = 0;

	for (const entry of zipEntries) {
		if (!canalValido(entry)) continue;

		const channelData = dadosCanal(entry);
		if (!ehDMGrupo(channelData)) continue;

		for (const recipientId of pegarRecipients(channelData.recipients)) {
			const user = await client.users.fetch(recipientId).catch(() => {});
			await sleep(Number.parseFloat(config.delay) || 1);
			await user
				?.createDM()
				.then(async () => {
					contador++;
					await exibirBarraDeProgresso(
						contador,
						totalDMs,
						"147Clear | Abrir DMs",
						"DMs abertas",
						"",
						client,
					);

					await updatePresence({
						details: `Abrindo todas as DMs ${contador}/${totalDMs} [${Math.round((contador / totalDMs) * 100)}%]`,
					});
				})
				.catch(() => {});
		}
	}

	setTimeout(() => {
		menu(client);
	}, 1000);
}

async function selecionarArquivoZip() {
	if (process.platform === "win32") {
		const psScript = `
      Function Select-ZipFileDialog {
        param([string]$Description="Selecione o ZIP do Discord", [string]$Filter="ZIP files (*.zip)|*.zip")

        [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null

        $objForm = New-Object System.Windows.Forms.OpenFileDialog
        $objForm.Filter = $Filter
        $objForm.Title = $Description
        $Show = $objForm.ShowDialog()
        If ($Show -eq "OK") {
            Return $objForm.FileName
        }
      }

      $zipFile = Select-ZipFileDialog
      Write-Output $zipFile
    `;

		const child = spawnSync("powershell.exe", ["-Command", psScript], {
			encoding: "utf8",
			windowsHide: true,
		});
		return child.stdout.toString().trim();
	} else {
		if (!fs.existsSync("package.zip")) {
			console.clear();
			console.log(
				`${erro}[X]${reset} Não achei o arquivo "package.zip", coloque-o na mesma pasta que eu(${path.basename(__filename)}) e tente novamente.`,
			);
			await sleep(8);
			return menu(client);
		}

		return "package.zip";
	}
}

async function utilidadesCall() {
	console.clear();
	process.title = "147Clear | Utilidades de call";

	const escolherOpcao = () => {
		console.log(`
    Escolha uma opção.

    ${cor}[ 1 ]${reset} Desconectar todos da call
    ${cor}[ 2 ]${reset} Mover todos da call
    ${cor}[ 3 ]${reset} Gravar áudio da call
    ${cor}[ 4 ]${reset} Farmar hora em call
    ${cor}[ 5 ]${reset} Ouvir call com fone mutado
	
    ${cor}[ 6 ]${reset} Voltar
		`);
		return readlineSync.question("> ");
	};

	const confirmarAcao = async (mensagem) => {
		console.clear();
		console.log(`
    ${mensagem}

    ${cor}[ 1 ]${reset} Sim
    ${cor}[ 2 ]${reset} Não
		`);
		return readlineSync.question("> ") === "1";
	};

	const obterCanalVoz = (id) => {
		const canal = client.channels.cache.get(id);
		return canal?.type === "GUILD_VOICE" ? canal : null;
	};

	const voltarMenu = async () => {
		await sleep(1.5);
		await menu(client);
	};

	const moverMembros = async () => {
		console.clear();
		console.log("Digite o ID da call de origem.");
		const idOrigem = readlineSync.question("> ");
		console.clear();

		console.log("Digite o ID da call de destino.");
		const idDestino = readlineSync.question("> ");

		if (!(await confirmarAcao("Tem certeza que deseja mover os usuários?"))) {
			console.clear();
			return voltarMenu();
		}

		const canalOrigem = obterCanalVoz(idOrigem);
		const canalDestino = obterCanalVoz(idDestino);

		if (!canalOrigem || !canalDestino) {
			console.clear();
			console.log(`${erro}[X]${reset} ID inválido.`);
			return sleep(3.5).then(() => menu(client));
		}

		if (!canalOrigem.members.size) {
			console.clear();
			console.log(`${erro}[X]${reset} A call está vazia.`);
			return sleep(3.5).then(() => menu(client));
		}

		for (const member of canalOrigem.members.values()) {
			if (canalDestino.locked || canalDestino.full) {
				console.clear();
				console.log(`${erro}[X]${reset} A call está privada ou lotada.`);
				return sleep(3.5).then(() => menu(client));
			}

			try {
				await member.voice.setChannel(canalDestino.id);
				if (member.id !== client.user.id) {
					console.log(
						`${cor}[+]${reset} ${member.user.username} movido para ${canalDestino.name}`,
					);
				}
			} catch (err) {
				if (err.message === "Missing Permissions") {
					console.clear();
					console.log(`${erro}[X]${reset} Você não tem permissão.`);
					return sleep(3.5).then(() => menu(client));
				}
			}
		}
		await menu(client);
	};

	const gravarCall = async () => {
		console.clear();
		console.log(`
    Escolha uma opção.

    ${cor}[ 1 ]${reset} Gravar áudio de pessoas específicas
    ${cor}[ 2 ]${reset} Gravar áudio de todos
	
    ${cor}[ 3 ]${reset} Voltar
		`);
		const escolha = readlineSync.question("> ");
		if (escolha === "3") return menu(client);

		if (!["1", "2"].includes(escolha)) {
			console.clear();
			console.log(`${erro}[X]${reset} Opção inválida.`);
			return sleep(3.5).then(() => menu(client));
		}

		console.clear();
		console.log("Digite o ID da call que você deseja gravar o áudio.");
		const idCall = readlineSync.question("> ");
		const canal = client.channels.cache.get(idCall);

		if (!canal || canal.type !== "GUILD_VOICE") {
			console.clear();
			console.log(`${erro}[X]${reset} ID inválido.`);
			return sleep(3.5).then(() => menu(client));
		}

		if (!canal.permissionsFor(canal.guild.members.me).has("CONNECT")) {
			console.clear();
			console.log(
				`${erro}[X] ${reset}Você não tem permissão para entrar neste canal.`,
			);
			await sleep(4.5);
			await menu(client);
		}

		if (
			canal.members.size >= canal.userLimit &&
			!canal.permissionsFor(canal.guild.members.me).has("MOVE_MEMBERS")
		) {
			console.clear();
			console.log(`${erro}[X] ${reset}A call está lotada.`);
			await sleep(4.5);
			await menu(client);
		}

		let idsPermitidos = [];

		if (escolha === "1") {
			console.clear();
			console.log("Digite os IDs dos usuários que deseja gravar (id, id).");
			const idsStr = await readlineSync.question("> ");
			idsPermitidos = idsStr.split(",").map((id) => id.trim());
		}

		console.clear();
		console.log(`
    Deseja escutar o áudio da call enquanto grava?

    ${cor}[ 1 ]${reset} Sim
    ${cor}[ 2 ]${reset} Não
	    `);
		const escutarAoVivo = readlineSync.question("> ");
		const deveOuvir = escutarAoVivo === "1";

		const connection = await client.voice.joinChannel(canal, {
			selfMute: true,
			selfDeaf: true,
			selfVideo: false,
		});

		console.clear();
		await titulo(client?.user?.username || "a", client?.user?.id || "ww");
		console.log(
			`  ${cor}[+]${reset} Aguardando algum usuário começar a falar...`,
		);

		connection.on("speaking", (user, speaking) => {
			if (!user) return;
			const userId = user.id;

			if (speaking.bitfield) {
				if (!GRAVACOES_ATIVAS.has(userId)) {
					if (escolha === "2" || idsPermitidos.includes(userId)) {
						comecarGravacao(connection, user, deveOuvir);
					}
				}
			} else {
				const active = GRAVACOES_ATIVAS.get(userId);
				if (active?.stream) {
					active.stream.destroy();
					GRAVACOES_ATIVAS.delete(userId);
				}
			}
		});

		async function comecarGravacao(connection, user) {
			const timestamp = Date.now();
			const mp3FileName = `${user.username}-${timestamp}.mp3`;
			const outputPath = path.join(
				process.pkg ? process.cwd() : __dirname,
				"gravacoes_call",
			);

			if (!fs.existsSync(outputPath)) {
				fs.mkdirSync(outputPath);
			}

			const mp3Path = path.join(outputPath, mp3FileName);
			const fileStream = fs.createWriteStream(mp3Path);

			const audioStream = connection.receiver.createStream(user, {
				mode: "pcm",
				end: "manual",
			});

			const encoder = new lame.Encoder({
				channels: 2,
				bitDepth: 16,
				sampleRate: 48000,
				bitRate: 128,
				outSampleRate: 16000,
				mode: lame.MONO,
			});

			let speaker;
			if (deveOuvir) {
				speaker = new Speaker({
					channels: 2,
					bitDepth: 16,
					sampleRate: 48000,
				});
				audioStream.pipe(speaker);
			}
			audioStream.pipe(encoder).pipe(fileStream);

			console.clear();
			await titulo(client?.user?.username || "a", client?.user?.id || "ww");
			console.log(
				`  ${cor}[+]${reset} Gravando áudio de ${cor}${user.username}${reset}...`,
			);
			console.log(
				`  ${cor}[+]${reset} Salvando na pasta ${cor}gravacoes_call${reset}.\n`,
			);
			console.log(`  Aperte ${cor}ENTER${reset} para parar de gravar.`);

			GRAVACOES_ATIVAS.set(user.id, { stream: audioStream });
			audioStream.on("end", () => {
				audioStream.unpipe(encoder);
				audioStream.unpipe(speaker);
				encoder.end();
				GRAVACOES_ATIVAS.delete(user.id);
			});
		}

		await esperarEnter();
		if (connection) await connection.disconnect();
		await menu(client);
	};

	const farmarHora = async () => {
		console.clear();
		console.log(`
    Escolha uma opção.
         
    ${cor}[ 1 ]${reset} Farmar em call específica
    ${cor}[ 2 ]${reset} Farmar em calls aleatórias
    	`);

		const escolha = readlineSync.question("> ");

		if (!["1", "2"].includes(escolha)) {
			console.clear();
			console.log(`${erro}[X]${reset} Opção inválida, tente novamente.`);
			await sleep(4);
			return await menu(client);
		}

		let canalSelecionado;

		if (escolha === "1") {
			console.clear();
			console.log("Digite o ID da call que você deseja farmar.");
			const idCall = readlineSync.question("> ");
			const canal = client.channels.cache.get(idCall);

			if (!canal || canal.type !== "GUILD_VOICE") {
				console.clear();
				console.log(`${erro}[X]${reset} ID inválido.`);
				await sleep(3.5);
				return await menu(client);
			}

			if (!canal.permissionsFor(canal.guild.members.me).has("CONNECT")) {
				console.clear();
				console.log(`${erro}[X]${reset} Sem permissão para entrar na call.`);
				await sleep(3.5);
				return await menu(client);
			}

			canalSelecionado = canal;
		} else {
			console.clear();
			console.log("Digite o ID do servidor onde deseja farmar.");
			const idGuild = readlineSync.question("> ");
			const guild = client.guilds.cache.get(idGuild);

			if (!guild) {
				console.clear();
				console.log(`${erro}[X]${reset} Servidor não encontrado.`);
				await sleep(3.5);
				return await menu(client);
			}

			console.clear();
			console.log(
				"Tem uma categoria específica? se sim, insira o ID. se não, deixe vazio e aperte ENTER.",
			);
			const categoria = readlineSync.question("> ");

			const calls = guild.channels.cache.filter(
				(c) =>
					c.type === "GUILD_VOICE" &&
					c.members.size === 0 &&
					c.permissionsFor(guild.members.me).has("CONNECT") &&
					(!categoria || c.parentId === categoria),
			);

			if (!calls.size) {
				console.clear();
				console.log(`${erro}[X]${reset} Nenhuma call vazia disponível.`);
				await sleep(3.5);
				return await menu(client);
			}

			canalSelecionado = calls.random();
		}

		let connection;
		let iniciou = Date.now();

		const conectar = async () => {
			try {
				connection = await client.voice.joinChannel(canalSelecionado, {
					selfMute: false,
					selfDeaf: false,
					selfVideo: false,
				});
			} catch (err) {
				console.log(`${erro}[X]${reset} Erro ao conectar: ${err.message}`);
				await sleep(3.5);
				return await menu(client);
			}
		};

		await conectar();

		const atualizarTempo = setInterval(() => {
			const tempo = Date.now() - iniciou;
			const segundos = Math.floor((tempo / 1000) % 60);
			const minutos = Math.floor((tempo / 1000 / 60) % 60);
			const horas = Math.floor(tempo / 1000 / 60 / 60);

			console.clear();
			titulo(client?.user?.username || "a", client?.user?.id || "ww");

			console.log(
				`  ${cor}[+]${reset} Farmando por ${horas} horas, ${minutos} minutos e ${segundos} segundos.\n`,
			);
			console.log(`  Aperte ${cor}ENTER${reset} para parar de farmar.`);
		}, 1000);

		const voiceUpdateListener = async (oldState, newState) => {
			if (
				oldState.member.id === client.user.id &&
				oldState.channelId &&
				!newState.channelId
			) {
				await sleep(2);
				await conectar();
			}
		};

		client.on("voiceStateUpdate", voiceUpdateListener);
		await esperarEnter();

		client.off("voiceStateUpdate", voiceUpdateListener);
		if (connection) await connection.disconnect();

		clearInterval(atualizarTempo);
		await menu(client);
	};

	const ouvirCall = async () => {
		console.clear();
		console.log(`
    Escolha uma opção.
    
    ${cor}[ 1 ]${reset} Ouvir áudio de pessoas específicas
    ${cor}[ 2 ]${reset} Ouvir áudio de todos
    
    ${cor}[ 3 ]${reset} Voltar
    	`);

		const escolha = readlineSync.question("> ").trim();
		if (escolha === "3") return await menu(client);

		let idsPermitidos = [];

		if (escolha === "1") {
			console.clear();
			console.log("Digite os IDs dos usuários que deseja ouvir (id, id).");
			const idsStr = readlineSync.question("> ");
			idsPermitidos = idsStr.split(",").map((id) => id.trim());
		}

		console.clear();
		console.log("Digite o ID da call que você deseja ouvir mutado.");
		const idCall = readlineSync.question("> ");
		const canal = client.channels.cache.get(idCall);

		if (!canal || canal.type !== "GUILD_VOICE") {
			console.clear();
			console.log(`${erro}[X]${reset} ID inválido.`);
			return sleep(3.5).then(() => menu(client));
		}

		if (!canal.permissionsFor(canal.guild.members.me).has("CONNECT")) {
			console.clear();
			console.log(
				`${erro}[X] ${reset}Você não tem permissão para entrar neste canal.`,
			);
			await sleep(4.5);
			return await menu(client);
		}

		if (
			canal.members.size >= canal.userLimit &&
			!canal.permissionsFor(canal.guild.members.me).has("MOVE_MEMBERS")
		) {
			console.clear();
			console.log(`${erro}[X] ${reset}A call está lotada.`);
			await sleep(4.5);
			return await menu(client);
		}

		const GRAVACOES_ATIVAS = new Map();

		const connection = await client.voice.joinChannel(canal, {
			selfMute: true,
			selfDeaf: true,
			selfVideo: false,
		});

		console.clear();
		await titulo(client?.user?.username || "a", client?.user?.id || "ww");
		console.log(
			`  ${cor}[+]${reset} Aguardando algum usuário começar a falar...`,
		);

		connection.on("speaking", async (user, speaking) => {
			if (!user) return;

			if (escolha === "1" && !idsPermitidos.includes(user.id)) return;

			if (speaking.bitfield) {
				if (!GRAVACOES_ATIVAS.has(user.id)) {
					await comecarGravacao(connection, user);
				}
			} else {
				const active = GRAVACOES_ATIVAS.get(user.id);
				if (active?.stream) {
					active.stream.destroy();
					GRAVACOES_ATIVAS.delete(user.id);
				}
			}
		});

		async function comecarGravacao(connection, user) {
			const audioStream = connection.receiver.createStream(user, {
				mode: "pcm",
				end: "manual",
			});

			const speaker = new Speaker({
				channels: 2,
				bitDepth: 16,
				sampleRate: 48000,
			});

			audioStream.pipe(speaker);

			console.clear();
			await titulo(client?.user?.username || "a", client?.user?.id || "ww");
			console.log(
				`  ${cor}[+]${reset} Ouvindo áudio de ${cor}${user.username}${reset}...`,
			);
			console.log(
				`  ${cor}[+]${reset} Aperte ${cor}ENTER${reset} para parar de ouvir.`,
			);

			GRAVACOES_ATIVAS.set(user.id, { stream: audioStream });

			audioStream.on("end", () => {
				audioStream.unpipe(speaker);
				GRAVACOES_ATIVAS.delete(user.id);
			});
		}

		await esperarEnter();
		if (connection) await connection.disconnect();
		await menu(client);
	};

	const desconectarMembros = async () => {
		console.clear();
		console.log("Digite o ID da call que você deseja desconectar todos.");
		const idCall = readlineSync.question("> ");

		if (!(await confirmarAcao("Tem certeza que deseja desconectar todos?"))) {
			console.clear();
			return voltarMenu();
		}

		const canal = obterCanalVoz(idCall);

		if (!canal) {
			console.clear();
			console.log(`${erro}[X]${reset} ID inválido.`);
			return sleep(3.5).then(() => menu(client));
		}

		if (!canal.members.size) {
			console.clear();
			console.log(`${erro}[X]${reset} A call está vazia.`);
			return sleep(3.5).then(() => menu(client));
		}

		for (const member of canal.members.values()) {
			try {
				await member.voice.setChannel(null);
				console.log(
					`${cor}[+]${reset} ${member.user.tag} desconectado da call ${canal.name}`,
				);
			} catch (err) {
				if (err.message === "Missing Permissions") {
					console.clear();
					console.log(`${erro}[X]${reset} Você não tem permissão.`);
					return sleep(3.5).then(() => menu(client));
				}
			}
		}
		await menu(client);
	};

	switch (escolherOpcao()) {
		case "1":
			return await desconectarMembros();
		case "2":
			return await moverMembros();
		case "3":
			return await gravarCall();
		case "4":
			return await farmarHora();
		case "5":
			return await ouvirCall();
		case "6":
			return await menu(client);
		default:
			console.clear();
			console.log(`${erro}[X]${reset} Opção inválida, tente novamente.`);
			return voltarMenu();
	}
}

async function triggerClear() {
	console.clear();

	process.title = "147Clear | Limpar com Trigger";
	console.log("Insira o trigger que vai iniciar o clear.");
	let trigger = readlineSync.question("> ");
	let triggered = false;
	let contador = 0;

	console.clear();
	console.log(
		`${reset}Envie ${cor}${trigger} ${reset}em algum chat para limpar suas mensagens.`,
	);

	const waitForTrigger = () => {
		return new Promise((resolve) => {
			client.on("messageCreate", async (message) => {
				if (message.author.id !== client.user.id) return;
				if (message.content === trigger) {
					triggered = true;
					resolve(message);
				}
			});
		});
	};

	const message = await waitForTrigger();

	let totalFiltrados = 0;
	let msgs = [];
	if (config.esperar_fetch === false) {
		let ultimoid;
		while (true) {
			const fetched = await message.channel.messages.fetch({
				limit: 100,
				...(ultimoid && { before: ultimoid }),
			});

			if (fetched.size === 0) break;

			const msgsFiltradas = Array.from(fetched.values()).filter(
				(msg) => msg.author.id === client.user.id && !msg.system,
			);

			totalFiltrados += msgsFiltradas.length;

			for (const [index, msg] of msgsFiltradas.entries()) {
				await sleep(parseFloat(config.delay) || 1);
				await msg
					.delete()
					.then(async () => {
						contador++;
						await exibirBarraDeProgresso(
							contador,
							totalFiltrados,
							"147Clear | Limpar com Trigger",
							"mensagens removidas",
							`        ${cor}Apagando mensagens com ${reset}${message.channel.recipient?.globalName || message.channel.recipient?.username || message.channel.name} \n`,
							client,
						);
					})
					.catch(() => {});
			}

			ultimoid = fetched.lastKey();
		}
	} else {
		msgs = await fetchMsgs(message.channel.id);
		totalFiltrados = msgs.length;
		for (const [index, msg] of msgs.entries()) {
			await sleep(parseFloat(config.delay) || 1);
			await msg
				.delete()
				.then(async () => {
					contador++;
					await exibirBarraDeProgresso(
						contador,
						totalFiltrados,
						"147Clear | Limpar com Trigger",
						"mensagens removidas",
						`        ${cor}Apagando mensagens com ${reset}${message.channel.recipient?.globalName || message.channel.recipient?.username || message.channel.name} \n`,
						client,
					);
				})
				.catch(() => {});
		}
	}

	if (!totalFiltrados) {
		console.clear();
		console.log(`${erro}[X]${reset} Você não tem mensagens ai.`);
		await sleep(3.5);
		menu(client);
		return;
	}

	menu(client);
}

async function scraperIcons() {
	console.clear();
	process.title = "147Clear | Scraper de Icons";
	console.log("Escolha uma opção.\n");

	console.log(`${cor}[ 1 ]${reset} Pegar apenas JPEGs e PNGs do chat`);
	console.log(`${cor}[ 2 ]${reset} Pegar apenas GIFs do chat`);
	console.log(`${cor}[ 3 ]${reset} Pegar todos\n`);
	console.log(`${cor}[ 4 ]${reset} Voltar\n`);

	const opcao = readlineSync.question("> ");

	if (opcao === "4") return await menu(client);
	if (!["1", "2", "3"].includes(opcao)) {
		console.clear();
		console.log(`${erro}[X] ${reset}Opção inválida, tente novamente.`);
		await sleep(1.5);
		await menu(client);
	}

	const formatos =
		opcao === "1"
			? ["jpeg", "jpg", "png"]
			: opcao === "2"
				? ["gif"]
				: ["jpeg", "jpg", "png", "gif"];

	console.clear();
	console.log("Insira o ID do canal que os icons estão.\n");
	const canal_icons = client.channels.cache.get(readlineSync.question("> "));

	if (!canal_icons) {
		console.clear();
		console.log(`${erro}[X] ${reset}Este ID é inválido.`);
		await sleep(3.5);
		await menu(client);
	}

	if (
		!canal_icons
			.permissionsFor(canal_icons.guild.members.me)
			.has(["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"])
	) {
		console.clear();
		console.log(
			`${erro}[X] ${reset}Você não tem permissão para ler mensagens neste canal.`,
		);
		await sleep(4.5);
		await menu(client);
	}

	console.clear();
	console.log("Insira o ID do canal para envio dos icons.\n");
	const canal_envio = client.channels.cache.get(readlineSync.question("> "));

	if (!canal_envio) {
		console.clear();
		console.log(`${erro}[X] ${reset}Este ID é inválido.`);
		await sleep(3.5);
		await menu(client);
	}

	if (
		!canal_envio
			.permissionsFor(canal_envio.guild.members.me)
			.has(["SEND_MESSAGES", "ATTACH_FILES"])
	) {
		console.clear();
		console.log(
			`${erro}[X] ${reset}Você não tem permissão para enviar mensagens ou arquivos neste canal.`,
		);
		await sleep(4.5);
		await menu(client);
	}

	console.clear();
	console.log("Escolha uma opção.\n");
	console.log(
		`${cor}[ 1 ]${reset} Pegar tudo primeiro, depois enviar (mais lento)`,
	);
	console.log(
		`${cor}[ 2 ]${reset} Pegar e enviar em blocos de 100 (mais rápido)\n`,
	);

	const escolha = readlineSync.question("> ");

	const filtrarImagens = (msgs) => {
		return msgs.filter((msg) => {
			return msg.attachments.some((attachment) => {
				const ext = attachment.name.split(".").pop().toLowerCase();
				return formatos.includes(ext);
			});
		});
	};

	if (escolha === "1") {
		console.clear();
		let totalEnviado = 0;

		const msgs = await fetchMsgs(canal_icons.id);
		const imagens = filtrarImagens(msgs);

		for (const img of imagens) {
			for (const attachment of img.attachments.values()) {
				await sleep(1.5);
				await canal_envio.send({ files: [attachment.url] });
				totalEnviado++;
				await exibirBarraDeProgresso(
					totalEnviado,
					imagens.length,
					"147Clear | Scraper de Icons",
					"icons enviados",
					`        ${cor}Enviando icons em ${reset}${canal_envio.name} \n`,
					client,
				);
			}
		}

		await sleep(2);
		await menu(client);
	} else if (escolha === "2") {
		let ultimoid;
		let totalEnviado = 0;

		while (true) {
			const fetched = await canal_icons.messages.fetch({
				limit: 100,
				...(ultimoid && { before: ultimoid }),
			});

			if (fetched.size === 0) break;
			const msgsFiltradas = filtrarImagens(Array.from(fetched.values()));

			for (const msg of msgsFiltradas) {
				for (const attachment of msg.attachments.values()) {
					try {
						await sleep(1.5);
						await canal_envio.send({ files: [attachment.url] });
						totalEnviado++;
						await exibirBarraDeProgresso(
							totalEnviado,
							msgsFiltradas.length,
							"147Clear | Scraper de Icons",
							"icons enviados",
							`        ${cor}Enviando icons em ${reset}${canal_envio.name} \n`,
							client,
						);
					} catch (err) {
						console.log(
							`${erro}[!] ${reset}Erro ao enviar um arquivo: ${err.message}`,
						);
					}
				}
			}

			ultimoid = fetched.lastKey();
		}

		await sleep(2);
		await menu(client);
	}
}

async function clonarServidores() {
	console.clear();
	process.title = "147Clear | Clonar servidores";

	const idOriginal = readlineSync.question("ID do servidor original.\n> ");
	const guildOriginal = client.guilds.cache.get(idOriginal);

	if (!guildOriginal) {
		console.clear();
		console.log(`${erro}[X] ${reset}Servidor original não encontrado.`);
		await sleep(3);
		return await menu(client);
	}

	console.clear();
	const idNovo = readlineSync.question("ID do servidor de destino.\n> ");
	const guildNovo = client.guilds.cache.get(idNovo);

	if (!guildNovo) {
		console.clear();
		console.log(`${erro}[X] ${reset}Servidor de destino não encontrado.`);
		await sleep(3);
		return await menu(client);
	}

	console.clear();
	console.log(
		`Deseja mesmo continuar? Isso irá apagar tudo do servidor de destino (${guildNovo.name}).\n`,
	);
	console.log(`
  ${cor}[ 1 ]${reset} Tenho certeza
  ${cor}[ 2 ]${reset} Desisti, voltar
	`);
	const opcao = readlineSync.question("\n> ");
	if (opcao !== "1") return await menu(client);

	console.clear();
	try {
		await guildOriginal.stickers.fetch().catch(() => {});
		const stickers = Array.from(
			guildOriginal.stickers.cache,
			([name, value]) => ({ name, value }),
		);

		await guildNovo.setName(guildOriginal.name);
		await guildNovo.setIcon(guildOriginal.iconURL() || null);

		if (guildOriginal.premiumSubscriptionCount > 0) {
			await guildNovo.setBanner(guildOriginal.bannerURL() || null);
		}

		for (const emoji of guildNovo.emojis.cache.values()) {
			await emoji.delete().catch(() => {
				console.log(`${erro}[X] ${reset}Erro ao deletar emoji: ${emoji.name}`);
			});
		}

		await guildNovo.stickers.fetch().catch(() => {});
		for (const sticker of guildNovo.stickers.cache.values()) {
			await sticker.delete().catch(() => {
				console.log(
					`${erro}[X] ${reset}Erro ao deletar sticker: ${sticker.name}`,
				);
			});
		}

		for (const canal of guildNovo.channels.cache.values()) {
			await canal.delete().catch(() => {
				console.log(`${erro}[X] ${reset}Erro ao deletar canal: ${canal.name}`);
			});
		}

		const cargosParaExcluir = guildNovo.roles.cache.filter(
			(r) => r.name !== "@everyone",
		);
		for (const cargo of cargosParaExcluir.values()) {
			await cargo.delete().catch(() => {
				console.log(`${erro}[X] ${reset}Erro ao deletar cargo: ${cargo.name}`);
			});
		}

		const cargosMap = new Map();
		const cargosOriginais = guildOriginal.roles.cache
			.filter((r) => r.name !== "@everyone")
			.sort((a, b) => b.position - a.position);

		for (const cargo of cargosOriginais.values()) {
			const novoCargo = await guildNovo.roles.create({
				name: cargo.name,
				color: cargo.color,
				hoist: cargo.hoist,
				permissions: cargo.permissions,
			});
			cargosMap.set(cargo.id, novoCargo);
		}

		const clonarPermissoes = (canalOriginal, cargosMap) => {
			const overwrites = [];

			for (const overwrite of canalOriginal.permissionOverwrites.cache.values()) {
				if (overwrite.type === "role" && cargosMap.has(overwrite.id)) {
					overwrites.push({
						id: cargosMap.get(overwrite.id).id,
						allow: overwrite.allow.bitfield,
						deny: overwrite.deny.bitfield,
						type: "role",
					});
				}
			}

			return overwrites;
		};

		const categoriasMap = new Map();
		const categorias = guildOriginal.channels.cache
			.filter((c) => c.type === "GUILD_CATEGORY")
			.sort((a, b) => a.position - b.position);

		for (const categoria of categorias.values()) {
			const novaCategoria = await guildNovo.channels.create(categoria.name, {
				type: "GUILD_CATEGORY",
				permissionOverwrites: clonarPermissoes(categoria, cargosMap),
			});

			categoriasMap.set(categoria.id, novaCategoria);
		}

		const canaisTexto = guildOriginal.channels.cache.filter(
			(c) => c.type === "GUILD_TEXT",
		);
		const canaisVoz = guildOriginal.channels.cache.filter(
			(c) => c.type === "GUILD_VOICE",
		);

		const clonarCanais = async (canais, tipo) => {
			for (const canal of canais.values()) {
				const categoriaPai = categoriasMap.get(canal.parentId ?? "")?.id;
				await guildNovo.channels.create(canal.name, {
					type: tipo,
					parent: categoriaPai,
					...(tipo === "GUILD_TEXT"
						? { topic: canal.topic || undefined, nsfw: canal.nsfw }
						: { bitrate: canal.bitrate, userLimit: canal.userLimit }),
					permissionOverwrites: clonarPermissoes(canal, cargosMap),
				});
			}
		};

		const pegarMime = (ext) => {
			const map = {
				apng: "image/apng",
				jpg: "image/jpeg",
				jpeg: "image/jpeg",
				png: "image/png",
				gif: "image/gif",
			};
			const normalized = ext.trim().toLowerCase().replace(".", "");
			return map[normalized] || null;
		};

		await clonarCanais(canaisTexto, 0);
		await clonarCanais(canaisVoz, 2);

		for (const sticker of stickers) {
			const response = await fetch(sticker.value.url);
			const buffer = await response.arrayBuffer();
			const ext = sticker.value.url.split("?")[0].split(".").at(-1);
			const blob = new Blob([buffer], { type: pegarMime(ext) });

			const form = new FormData();
			form.append("name", sticker.value.name);
			form.append("tags", sticker.value.tags[0]);
			form.append("description", sticker.value.description || "");
			form.append("file", blob, "sticker.png");

			const res = await fetch(
				`https://discord.com/api/v9/guilds/${guildNovo.id}/stickers`,
				{
					method: "POST",
					headers: {
						Authorization: client.token,
					},
					body: form,
				},
			);

			if (!res.ok) {
				const text = await res.text();
				console.log(
					`${erro}[X]${reset} Erro ao criar sticker ${sticker.value.name}: ${text}`,
				);
			}
		}

		for (const emoji of guildOriginal.emojis.cache.values()) {
			try {
				await guildNovo.emojis.create(emoji.url, emoji.name);
			} catch (e) {
				console.log(
					`${erro}[X] ${reset}Erro ao clonar emoji ${emoji.name}: ${e.message}`,
				);
			}
		}

		await sleep(3);
		await menu(client);
	} catch {}
}

async function backupMensagens() {
	console.clear();
	process.title = "147Clear | Backup de mensagens";

	const idChat = readlineSync.question(
		"ID da conversa/chat para salvar as mensagens.\n> ",
	);
	const canal = client.channels.cache.get(idChat);

	if (!canal) {
		console.clear();
		console.log(`${erro}[X] ${reset}Este ID é inválido.`);
		await sleep(3.5);
		await menu(client);
	}

	if (!canal?.isText()) {
		console.clear();
		console.log(
			`${erro}[X] ${reset}O canal deve ser baseado em texto para fazer backup de mensagens.`,
		);
		await sleep(5);
		await menu(client);
	}

	const pasta = path.join(
		process.pkg ? process.cwd() : __dirname,
		"backup_mensagens",
	);

	if (!fs.existsSync(pasta)) {
		fs.mkdirSync(pasta);
	}

	const saida = path.join(pasta, `${Date.now()}.html`);
	const fileBuffer = await transcripts.createTranscript(canal, {
		returnType: "buffer",
	});

	fs.writeFileSync(saida, fileBuffer);

	console.clear();
	await titulo(client?.user?.username || "a", client?.user?.id || "ww");
	console.log(`  ${cor}[+]${reset} Arquivo salvo em ${cor}${saida}${reset}.`);
	console.log(
		`  ${cor}[+]${reset} Pressione ${cor}ENTER ${reset}para voltar pro menu`,
	);

	readlineSync.question("");
	await menu(client);
}

async function definirRPC() {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [require.resolve("definir-rpc")]);

		console.clear();
		console.log(
			`  ${cor}[+]${reset} Link para definir o RPC aberto no seu navegador. caso não tenha sido aberto, acesse ${cor}http://localhost ${reset}manualmente`,
		);
		console.log(
			`  ${cor}[+]${reset} Pressione ${cor}ENTER ${reset}para cancelar a definição e voltar pro menu`,
		);

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.on("line", () => {
			console.log(`${cor}[!]${reset} Cancelando definição do RPC...`);
			child.kill();
			rl.close();
			resolve("cancelado");
		});

		child.on("exit", () => {
			rl.close();
			resolve("setado");
		});
	});
}

function getMaxDescriptionLength(options) {
	return Math.max(...options.map((option) => option.description.length));
}

function formatMenuInColumns(options, columns = 2) {
	const maxDescriptionLength = getMaxDescriptionLength(options);
	const rows = Math.ceil(options.length / columns);
	let output = "";

	for (let i = 0; i < rows; i++) {
		let row = "";
		for (let j = 0; j < columns; j++) {
			const index = i + j * rows;
			if (index < options.length) {
				const option = options[index];
				const paddedDescription = option.description.padEnd(
					maxDescriptionLength,
					" ",
				);
				row += `      ${cor}[ ${option.id} ]${reset} ${paddedDescription}`;
				if (j < columns - 1) {
					row += "          ";
				}
			}
		}
		output += row + "\n";
	}

	return output;
}

async function menu(client) {
	console.clear();
	process.title = `147Clear | Menu | v${VERSAO_ATUAL}`;

	await updatePresence(pegarTema());

	while (true) {
		console.clear();
		await titulo(client?.user?.username || "a", client?.user?.id || "ww");

		if (await checarUpdates()) {
			console.log(
				`        ${cor}[!]${reset} Há uma atualização disponível, vá em https://github.com/147enterprise/147clear`,
			);
		}

		console.log("\n" + formatMenuInColumns(menuOptions, 2) + "\n");

		const opcao = readlineSync.question("> ");
		const selectedOption = menuOptions.find((option) => option.id === opcao);
		if (selectedOption) {
			await selectedOption.action();
		} else {
			console.log(`${erro}[X] ${reset}Opção inválida, tente novamente.`);
			await sleep(2.5);
		}
	}
}

async function checarUpdates() {
	try {
		const response = await fetch(
			"https://api.github.com/repos/147enterprise/147clear/releases/latest",
		);
		const json = await response.json();

		if (json.tag_name !== VERSAO_ATUAL) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

async function iniciarCliente() {
	console.clear();

	const tokensValidos = await validarTokens(config.tokens);
	if (tokensValidos.length) return await selecionarToken(tokensValidos, config);

	const tokensMenu = ["Adicionar token manualmente"];
	const opcoes = { 1: "manual" };

	let index = 2;
	if (typeof encontrarTokens === "function") {
		tokensMenu.push("Encontrar tokens automaticamente");
		opcoes[String(index++)] = "auto";
	}

	tokensMenu.push("Sair");
	opcoes[String(index)] = "sair";

	console.log("Escolha uma opção.\n");
	tokensMenu.forEach((opt, i) => {
		console.log(`${cor}[ ${i + 1} ]${reset} ${opt}`);
	});

	const escolha = readlineSync.question("\n> ").trim();
	const acao = opcoes[escolha];

	switch (acao) {
		case "manual":
			await pedirToken();
			return iniciarCliente();
		case "auto":
			const encontrados = await encontrarTokens();
			let adicionados = 0;

			for (const token of encontrados) {
				const validacao = await validarToken(token);
				if (validacao) {
					const duplicado = config.tokens.find((t) => t.token === token);
					if (!duplicado) {
						config.tokens.push({
							nome: validacao,
							token,
						});
						adicionados++;
					}
				}
			}

			fs.writeFileSync("config.json", JSON.stringify(config, null, 4));
			console.clear();
			console.log(
				`${cor}[+]${reset} ${adicionados} token(s) adicionadas automaticamente.\n`,
			);
			await sleep(2);
			return iniciarCliente();
		case "sair":
			process.exit();
			break;

		default:
			console.clear();
			console.log(`${erro}[X]${reset} Opção inválida.`);
			await sleep(2);
			return iniciarCliente();
	}
}

async function validarTokens(tokens) {
	const tokensValidos = [];
	for (const { nome, token } of tokens) {
		if (await validarToken(token)) {
			tokensValidos.push({
				nome,
				token,
			});
		}
	}

	try {
		const currentConfig = JSON.parse(fs.readFileSync("config.json"));
		currentConfig.tokens = tokensValidos;
		fs.writeFileSync("config.json", JSON.stringify(currentConfig, null, 4));
	} catch {}

	return tokensValidos;
}

async function selecionarToken(tokensValidos, config) {
	process.title = "147Clear | Selecionar token";
	console.clear();
	console.log(`  Escolha uma token para logar.\n`);

	tokensValidos.forEach((t, index) => {
		console.log(`  ${cor}[ ${index + 1} ]${reset} ${t.nome}`);
	});

	console.log(
		`\n  ${cor}[ ${tokensValidos.length + 1} ]${reset} Adicionar nova token`,
	);
	console.log(
		`  ${cor}[ ${tokensValidos.length + 2} ]${reset} Remover uma token`,
	);

	const opcao = readlineSync.question("\n> ");

	switch (parseInt(opcao)) {
		case tokensValidos.length + 1:
			console.clear();
			await pedirToken();
			return iniciarCliente();
		case tokensValidos.length + 2:
			await removerToken(tokensValidos, config);
			return iniciarCliente();
		default:
			await logarToken(tokensValidos, opcao);
	}
}

async function removerToken(tokensValidos, config) {
	console.clear();
	console.log(`  Escolha uma token para remover.\n`);
	tokensValidos.forEach((t, index) => {
		console.log(`  ${cor}[ ${index + 1} ]${reset} ${t.nome}`);
	});

	const indiceTokenRemover = parseInt(readlineSync.question("\n> ")) - 1;

	if (indiceTokenRemover >= 0 && indiceTokenRemover < tokensValidos.length) {
		const tokenRemover = tokensValidos[indiceTokenRemover];
		config.tokens = config.tokens.filter((t) => t.token !== tokenRemover.token);
		fs.writeFileSync("config.json", JSON.stringify(config, null, 4));
		console.log(`Token "${tokenRemover.nome}" removida com sucesso.\n`);
	} else {
		console.clear();
		console.log(`${erro}[X]${reset} Opção inválida.`);
		await sleep(5);
	}
}

async function logarToken(tokensValidos, opcao) {
	const tokenEscolhido = tokensValidos[parseInt(opcao) - 1];

	if (tokenEscolhido) {
		await client.login(tokenEscolhido.token);
		menu(client);
	} else {
		console.log("Opção inválida.");
		await iniciarCliente();
	}
}

iniciarCliente();
