import express from 'express';
import type { Express } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Implementation as MCPImplementation } from '@modelcontextprotocol/sdk/types.js';
import { ServerOptions as MCPServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { inject, injectable } from 'inversify';
import { PrismaClientFactory } from './PrismaClientFactory.js';
import { PrismaClient } from '@prisma/client';

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
	private readonly transports = {
		streamable: {} as Record<string, StreamableHTTPServerTransport>,
		sse: {} as Record<string, SSEServerTransport>,
	};
	private prisma: PrismaClient;

	constructor(
		@inject(Symbol.for('MCPServerConfig'))
		private mcpConfig: MCPServerConfig,
		@inject(Symbol.for('ExpressServerConfig'))
		private expressConfig: ExpressServerConfig
	) {
		this.mcpServer = new McpServer(mcpConfig.serverInfo, mcpConfig.options);
		this.expressApp = express();
		this.prisma = PrismaClientFactory.getInstance('news-sources');
		this.setupExpress(expressConfig);
		this.setupMCPRoutes();
	}

	private setupExpress(config: ExpressServerConfig) {
		// Middleware
		this.expressApp.use(express.json());
		this.expressApp.use(express.urlencoded({ extended: true }));

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

		// News sources API routes
		this.setupNewsSourcesRoutes();
	}

	private setupNewsSourcesRoutes() {
		// GET /api/news-sources - Returns list of active news sources with ID and name only
		this.expressApp.get('/api/news-sources', async (req, res) => {
			try {
				// Get active news sources from database
				const sources = await this.prisma.newsSource.findMany({
					where: {
						isActive: true,
						isDisabled: false,
					},
					select: {
						id: true,
						name: true,
						icon: true,
						createdAt: true,
						updatedAt: true,
					},
					orderBy: {
						name: 'asc',
					},
				});

				res.json({
					success: true,
					data: {
						sources,
						total: sources.length,
						timestamp: new Date().toISOString(),
					},
				});
			} catch (error) {
				console.error('Error loading news sources:', error);
				res.status(500).json({
					success: false,
					error: 'Failed to load news sources',
					message:
						error instanceof Error ? error.message : String(error),
				});
			}
		});

		// GET /api/news-sources/:id - Returns full configuration for a specific source
		this.expressApp.get('/api/news-sources/:id', async (req, res) => {
			try {
				const sourceId = req.params.id;

				// Find the source by ID from database
				const source = await this.prisma.newsSource.findUnique({
					where: {
						id: sourceId,
					},
				});

				if (!source) {
					res.status(404).json({
						success: false,
						error: 'News source not found',
						sourceId,
					});
					return;
				}

				// Return full source configuration
				res.json({
					success: true,
					data: {
						...source,
						timestamp: new Date().toISOString(),
					},
				});
			} catch (error) {
				console.error('Error loading news source:', error);
				res.status(500).json({
					success: false,
					error: 'Failed to load news source',
					message:
						error instanceof Error ? error.message : String(error),
				});
			}
		});

		// GET /api/news-sources/all - Returns all news sources including disabled ones
		this.expressApp.get('/api/news-sources/all', async (req, res) => {
			try {
				const sources = await this.prisma.newsSource.findMany({
					orderBy: [
						{ isActive: 'desc' },
						{ name: 'asc' },
					],
				});

				res.json({
					success: true,
					data: {
						sources,
						total: sources.length,
						active: sources.filter(s => s.isActive && !s.isDisabled).length,
						disabled: sources.filter(s => s.isDisabled).length,
						timestamp: new Date().toISOString(),
					},
				});
			} catch (error) {
				console.error('Error loading all news sources:', error);
				res.status(500).json({
					success: false,
					error: 'Failed to load all news sources',
					message:
						error instanceof Error ? error.message : String(error),
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
