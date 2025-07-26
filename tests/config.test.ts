import fs from 'fs';
import path from 'path';
import { getSettings } from '../src/config/index.js';

describe('configuration with secrets', () => {
  test('merges secrets with config file', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-config-'));
    const configPath = path.join(tmpDir, 'mcp_agent.yaml');
    const secretsPath = path.join(tmpDir, 'mcp_agent.secrets.yaml');
    fs.writeFileSync(configPath, 'openai:\n  default_model: gpt-4o\n');
    fs.writeFileSync(secretsPath, 'openai:\n  api_key: sk-test\n');
    process.env.MCP_AGENT_CONFIG_PATH = configPath;
    const settings = getSettings();
    expect(settings.openai?.default_model).toBe('gpt-4o');
    expect(settings.openai?.api_key).toBe('sk-test');
    delete process.env.MCP_AGENT_CONFIG_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
