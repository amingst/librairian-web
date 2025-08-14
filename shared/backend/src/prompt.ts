import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import {
	ServerRequest,
	ServerNotification,
	GetPromptResult,
} from '@modelcontextprotocol/sdk/types';

export type CallbackType = (
	args: {
		[x: string]: string | undefined;
	},
	extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => GetPromptResult | Promise<GetPromptResult>;

// Temporary placeholder type for PromptArgsRawShape if import fails
export type PromptArgsRawShape = Record<string, unknown>;
export interface IMCPPrompt {
	readonly name: string;
	readonly args: PromptArgsRawShape;
	readonly callback: CallbackType;

	register(server: McpServer): void;
}

export abstract class MCPPrompt implements IMCPPrompt {
	abstract get name(): string;
	abstract get args(): PromptArgsRawShape;
	abstract get callback(): CallbackType;

	register(server: McpServer): void {
		server.registerPrompt(this.name, this.args, this.callback);
	}
}
