import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export interface IMCPTool {
	readonly name: string;
	readonly description: string;
	readonly schema: Record<string, any>;

	register(server: McpServer): void;
}
export abstract class MCPTool implements IMCPTool {
	abstract get name(): string;
	abstract get description(): string;
	abstract get schema(): Record<string, any>;
	abstract execute(params: any): Promise<any>;

	register(server: McpServer): void {
		server.tool(
			this.name,
			this.description,
			this.schema,
			this.execute.bind(this)
		);
	}
}
