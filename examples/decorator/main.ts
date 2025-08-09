import { MCPAgentDecorator } from '../../src/core/decorator_app.js';

const agentApp = new MCPAgentDecorator('root-test');

agentApp.agent(
  'basic_agent',
  'A simple agent that helps with basic tasks.',
  ['mcp_root']
)(async function main() {
  const { wrapper, cleanup } = await agentApp.run();
  try {
    const result = await wrapper.send('basic_agent', "what's the next number?");
    console.log('\n\n\n' + result);
  } finally {
    await cleanup();
  }
})();
