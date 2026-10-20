import { WebhookConfig } from '../core/types.js';

export interface WebhookEventPayload {
  event: 'TOGGLE' | 'CANARY_ADVANCE' | 'CIRCUIT_BREAKER_TRIGGERED' | 'SCHEDULE_TRIGGERED';
  flagKey: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export class WebhookDispatcher {
  private webhooks: WebhookConfig[] = [];

  constructor(initialWebhooks: WebhookConfig[] = []) {
    this.webhooks = initialWebhooks;
  }

  public setWebhooks(webhooks: WebhookConfig[]): void {
    this.webhooks = webhooks;
  }

  public async dispatch(
    event: WebhookEventPayload['event'],
    flagKey: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const active = this.webhooks.filter((w) => w.enabled && w.events.includes(event));
    if (active.length === 0) return;

    const payload: WebhookEventPayload = {
      event,
      flagKey,
      details,
      timestamp: new Date().toISOString(),
    };

    // Slack / Discord compatible payload
    const textMessage = `[FlagForge Alert] Event: *${event}* on flag \`${flagKey}\` at ${payload.timestamp}`;
    const slackPayload = {
      text: textMessage,
      attachments: [
        {
          color: event === 'CIRCUIT_BREAKER_TRIGGERED' ? '#ef4444' : '#6366f1',
          fields: [
            { title: 'Flag Key', value: flagKey, short: true },
            { title: 'Event', value: event, short: true },
            { title: 'Details', value: JSON.stringify(details), short: false },
          ],
        },
      ],
      ...payload,
    };

    for (const webhook of active) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
          signal: controller.signal,
        })
          .catch(() => {})
          .finally(() => clearTimeout(timeout));
      } catch {
        // Non-blocking fire-and-forget
      }
    }
  }
}
