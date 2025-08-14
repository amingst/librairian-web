import { Container } from 'inversify';
import { TOOL_MAP, TYPES } from './types/di.types.js';
import { IMCPTool, MCPHttpServer, PrismaClientFactory } from '@shared/backend';
import config from './config.js';

export function createContainer(): Container {
	const container = new Container();

	// Bind config
	container.bind(TYPES.Config).toConstantValue(config);

	// Bind PrismaClient
	container
		.bind(TYPES.PrismaClient)
		.toDynamicValue(() => PrismaClientFactory.getInstance('news-scraper'))
		.inSingletonScope();

	// Bind server
	container
		.bind(MCPHttpServer)
		.toDynamicValue(
			() =>
				new MCPHttpServer(
					{
						serverInfo: {
							name: 'html-scraper-mcp-express',
							version: '1.0.0',
						},
						options: {
							capabilities: {
								tools: {},
								resources: {},
							},
						},
					},
					{
						port: config.port,
						host: config.host,
					}
				)
		)
		.inSingletonScope();

	// Bind all tools
	(Object.keys(TOOL_MAP) as Array<keyof typeof TOOL_MAP>).forEach((key) => {
		const ToolClass = TOOL_MAP[key];
		container.bind<IMCPTool>(TYPES[key]).to(ToolClass).inSingletonScope();
	});

	return container;
}
