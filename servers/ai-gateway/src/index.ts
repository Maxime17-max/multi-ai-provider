import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Gateway } from './gateway.js';
import { providerTools } from './tools/providers.js';
import { modelTools } from './tools/models.js';
import { chatTools } from './tools/chat.js';
import { conversationTools, initConversationTools } from './tools/conversation.js';
import { logger } from './logging/logger.js';

const DATA_DIR = process.env.PLUGIN_DATA_DIR || './data';

async function main(): Promise<void> {
  const gateway = new Gateway();
  await gateway.loadConfig();

  initConversationTools(DATA_DIR);

  const server = new Server(
    { name: 'multi-ai-provider-gateway', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const allDefinitions: Record<string, import('./tools/types.js').ToolDefinition> = {};
  const allHandlers: Record<string, import('./tools/types.js').ToolHandler> = {};

  const toolModules = [
    providerTools(gateway),
    modelTools(gateway),
    chatTools(gateway),
    conversationTools(gateway),
  ];

  for (const mod of toolModules) {
    for (const def of mod.definitions) {
      allDefinitions[def.name] = def;
      allHandlers[def.name] = mod.handlers[def.name];
    }
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.values(allDefinitions),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = allHandlers[name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args || {});
      return result;
    } catch (err: unknown) {
      logger.error(`Tool ${name} failed:`, err);
      if (err instanceof McpError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: msg }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Multi-AI Provider Gateway MCP server started');
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});