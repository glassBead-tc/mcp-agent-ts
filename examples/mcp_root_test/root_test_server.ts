import { FastMCP, Context } from 'mcp/server/fastmcp';

const mcp = new FastMCP('MCP Root Tester');

mcp.tool('show_roots', async (ctx: Context): Promise<string> => {
  return await ctx.session.list_roots();
});

if (require.main === module) {
  mcp.run();
}
