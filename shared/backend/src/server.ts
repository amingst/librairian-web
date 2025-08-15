import express from 'express';
import type { Express } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Implementation as MCPImplementation } from '@modelcontextprotocol/sdk/types.js';
import { ServerOptions as MCPServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { inject, injectable } from 'inversify';
import { PrismaClientFactory } from './PrismaClientFactory.js';
import { PrismaClient } from '@prisma/client';
import { registerControllers } from './controller/controller.decorator.js';
import { IMCPPrompt } from './prompt.js';

export interface MCPServerConfig {
	serverInfo: MCPImplementation;
	options?: MCPServerOptions;
}

export interface ExpressServerConfig {
	port: number;
	host: string | 'localhost';
}

export interface ServerConfig {
	mcp: MCPServerConfig;
	express: ExpressServerConfig;
}

@injectable()
export class MCPHttpServer {
	private mcpServer: McpServer;
	private expressApp: Express;
	private httpServer: any;
	private registeredTools: Map<string, any> = new Map();
	private prisma: PrismaClient;
	private registeredResources: Map<string, any> = new Map();
	private registeredPrompts: Map<string, any> = new Map();

	constructor(
		@inject(Symbol.for('MCPServerConfig'))
		private mcpConfig: MCPServerConfig,
		@inject(Symbol.for('ExpressServerConfig'))
		private expressConfig: ExpressServerConfig
	) {
		this.mcpServer = new McpServer(
			this.mcpConfig.serverInfo,
			this.mcpConfig.options
		);
		this.expressApp = express();
		this.prisma = PrismaClientFactory.getInstance('news-sources');
		this.setupExpress(this.expressConfig);
		this.setupMCPRoutes();
	}

	private setupExpress(config: ExpressServerConfig) {
		// Middleware
		this.expressApp.use(express.json({ limit: '1mb' }));
		this.expressApp.use(
			express.urlencoded({ extended: true, limit: '1mb' })
		);

		// CORS headers
		this.expressApp.use((req, res, next) => {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
			res.setHeader(
				'Access-Control-Allow-Headers',
				'Content-Type, mcp-protocol-version, authorization'
			);

			if (req.method === 'OPTIONS') {
				res.sendStatus(200);
				return;
			}
			next();
		});

		// NOTE: Controllers will be registered later via registerControllers() method
		// after controller classes are instantiated

		// Start server
		this.httpServer = this.expressApp.listen(
			config.port,
			config.host,
			() => {
				console.log(
					`🚀 MCP HTTP Server running on http://${config.host}:${config.port}`
				);
				console.log(
					`📖 Visit http://${config.host}:${config.port} for API documentation`
				);
			}
		);
	}

	private setupMCPRoutes() {
		// Simple JSON-RPC endpoint (similar to your current http-server.ts)
		this.expressApp.post('/mcp', async (req, res) => {
			try {
				const request = req.body;

				// Handle initialization
				if (request.method === 'initialize') {
					res.json({
						jsonrpc: '2.0',
						id: request.id,
						result: {
							protocolVersion: '2024-11-05',
							capabilities: {
								tools: {},
							},
							serverInfo: {
								name: 'html-scraper-mcp',
								version: '1.0.0',
							},
						},
					});
					return;
				}

				// Handle tools/list
				if (request.method === 'tools/list') {
					const tools = Array.from(this.registeredTools.values()).map(
						(tool) => ({
							name: tool.name,
							description: tool.description,
							inputSchema: tool.schema || {},
						})
					);

					res.json({
						jsonrpc: '2.0',
						id: request.id,
						result: { tools },
					});
					return;
				}

				// Handle tools/call - connect to registered tools
				if (request.method === 'tools/call') {
					const { name, arguments: args } = request.params;

					if (!this.registeredTools.has(name)) {
						res.json({
							jsonrpc: '2.0',
							id: request.id,
							error: {
								code: -32601,
								message: `Tool not found: ${name}`,
							},
						});
						return;
					}

					try {
						const tool = this.registeredTools.get(name);
						const result = await tool.execute(args);

						res.json({
							jsonrpc: '2.0',
							id: request.id,
							result,
						});
					} catch (toolError) {
						res.json({
							jsonrpc: '2.0',
							id: request.id,
							error: {
								code: -32603,
								message: 'Tool execution failed',
								data:
									toolError instanceof Error
										? toolError.message
										: String(toolError),
							},
						});
					}
					return;
				}

				// Unknown method
				res.json({
					jsonrpc: '2.0',
					id: request.id,
					error: {
						code: -32601,
						message: `Method not found: ${request.method}`,
					},
				});
			} catch (error) {
				console.error('Error handling MCP request:', error);
				res.status(500).json({
					jsonrpc: '2.0',
					id: req.body?.id || null,
					error: {
						code: -32603,
						message: 'Internal error',
						data:
							error instanceof Error
								? error.message
								: String(error),
					},
				});
			}
		});
	}

	// Method to register MCP tools from your existing tool classes
	public registerTools(tools: any[]) {
		console.log(`Registering ${tools.length} tools with MCP server`);

		for (const tool of tools) {
			if (
				tool &&
				typeof tool.name === 'string' &&
				typeof tool.execute === 'function'
			) {
				this.registeredTools.set(tool.name, tool);
				console.log(`✓ Registered tool: ${tool.name}`);
			} else {
				console.warn(`⚠️  Invalid tool provided:`, tool);
			}
		}
	}

	public registerPrompts(prompts: IMCPPrompt[]) {
		console.log(`Registering ${prompts.length} prompts with MCP server`);

		for (const prompt of prompts) {
			if (
				prompt &&
				typeof prompt.name === 'string' &&
				typeof prompt.callback === 'function'
			) {
				this.registeredPrompts.set(prompt.name, prompt);
				console.log(`✓ Registered prompt: ${prompt.name}`);
			} else {
				console.warn(`⚠️  Invalid prompt provided:`, prompt);
			}
		}
	}

	public registerResources(resources: any[]) {
		console.log(
			`Registering ${resources.length} resources with MCP server`
		);

		for (const resource of resources) {
			if (
				resource &&
				typeof resource.name === 'string' &&
				typeof resource.callback === 'function'
			) {
				this.registeredResources.set(resource.name, resource);
				console.log(`✓ Registered resource: ${resource.name}`);
			} else {
				console.warn(`⚠️  Invalid resource provided:`, resource);
			}
		}
	}

	// Method to register controllers dynamically
	public registerControllers(controllers: any[]) {
		console.log(
			`Registering ${controllers.length} controllers with MCP server`
		);

		for (const ControllerClass of controllers) {
			try {
				// Instantiate the controller - this will trigger the decorator registration
				new ControllerClass();
				console.log(`✓ Registered controller: ${ControllerClass.name}`);
			} catch (error) {
				console.warn(
					`⚠️  Failed to register controller ${ControllerClass.name}:`,
					error
				);
			}
		}

		// IMPORTANT: Register all controllers with Express AFTER instantiating them
		registerControllers(this.expressApp);
	}

	// Method to stop the server
	public async stop() {
		return new Promise<void>((resolve) => {
			if (this.httpServer) {
				this.httpServer.close(async () => {
					await this.prisma.$disconnect();
					console.log('🛑 MCP HTTP Server stopped');
					resolve();
				});
			} else {
				this.prisma.$disconnect().then(() => resolve());
			}
		});
	}

	// Getter for the Express app
	public get app(): Express {
		return this.expressApp;
	}

	// Getter for the MCP server
	public get mcp(): McpServer {
		return this.mcpServer;
	}
}
