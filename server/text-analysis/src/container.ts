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
		.toDynamicValue(() => PrismaClientFactory.getInstance('text-analysis'))
		.inSingletonScope();

	// Bind server
	container
		.bind(MCPHttpServer)
		.toDynamicValue(
			() =>
				new MCPHttpServer(
					{
						serverInfo: {
							name: 'text-analysis-mcp',
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
	Object.entries(TOOL_MAP).forEach(([key, ToolClass]) => {
		container
			.bind<IMCPTool>(TYPES[key as keyof typeof TYPES])
			.to(ToolClass as any)
			.inSingletonScope();
	});

	return container;
}
