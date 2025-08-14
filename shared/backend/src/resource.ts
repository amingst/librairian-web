import {
	McpServer,
	ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';

// If ConfigMetadata is a type, import it from its correct location or define it here
export type ConfigMetadata = Record<string, unknown>; // Replace with the actual type definition if available

export interface IMCPResource {
	readonly name: string;
	readonly description: string;
	readonly templateOrUri: ResourceTemplate | string;
	readonly metadata: ConfigMetadata;

	register(server: McpServer): void;
}

export abstract class MCPResource implements IMCPResource {
	abstract get name(): string;
	abstract get description(): string;
	abstract get templateOrUri(): ResourceTemplate | string;
	abstract get metadata(): ConfigMetadata;

	register(server: McpServer): void {
		server.registerResource(
			this.name,
			this.templateOrUri.toString(),
			this.metadata,
			async (uri) => ({
				contents: [
					{
						uri: uri.href,
						text: 'App configuration here',
					},
				],
			})
		);
	}
}
