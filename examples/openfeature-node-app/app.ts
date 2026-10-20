import { OpenFeature } from '@openfeature/server-sdk';
import { FlagForgeProvider } from '../../src/provider/flagforge-provider.js';

async function main() {
  console.log('--- OpenFeature + FlagForge Local Integration Example ---\n');

  // Configure FlagForge Provider pointing to local daemon
  // Can connect remotely to daemon over HTTP/OFREP or evaluate directly
  const provider = new FlagForgeProvider({
    daemonUrl: 'http://localhost:4900',
  });

  await OpenFeature.setProviderAndWait(provider);
  const client = OpenFeature.getClient();

  console.log('1. Evaluating Flag for Internal Staff:');
  const staffContext = {
    userId: 'usr_staff_101',
    email: 'developer@flagforge.dev',
    tier: 'pro',
    country: 'MD',
  };
  const isDashboardV2 = await client.getBooleanValue('new-dashboard-ui', false, staffContext);
  console.log(`   new-dashboard-ui: ${isDashboardV2} (Expected: true via regex rule)\n`);

  console.log('2. Evaluating AI Model for Enterprise User:');
  const enterpriseContext = {
    userId: 'usr_ent_88',
    email: 'alice@enterprise-corp.io',
    tier: 'enterprise',
  };
  const aiModel = await client.getStringValue('ai-copilot-engine', 'disabled', enterpriseContext);
  console.log(`   ai-copilot-engine: ${aiModel} (Expected: claude-3-7-sonnet via rule)\n`);

  console.log('3. Evaluating Upload Limits:');
  const uploadLimit = await client.getNumberValue('max-upload-size-mb', 25, enterpriseContext);
  console.log(`   max-upload-size-mb: ${uploadLimit}MB\n`);

  console.log('4. Evaluating Canary Rollout for Regular User:');
  const standardContext = {
    userId: 'usr_regular_402',
    tier: 'free',
    country: 'US',
  };
  const canaryValue = await client.getBooleanValue('new-dashboard-ui', false, standardContext);
  console.log(`   new-dashboard-ui for usr_regular_402: ${canaryValue} (Determined by deterministic MurmurHash3 bucket)\n`);

  console.log('Integration test completed successfully.');
}

main().catch(console.error);
