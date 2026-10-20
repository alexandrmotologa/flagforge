# CNCF OpenFeature Specification Conformance

FlagForge implements the OpenFeature specification v0.7+ and the OpenFeature Remote Evaluation Protocol (OFREP).

## Evaluation Reason Codes

FlagForge uses standard OpenFeature resolution reason strings:

| Reason Code | Condition |
| :--- | :--- |
| `TARGETING_MATCH` | Context met all conditions within a targeting rule |
| `SPLIT` | Context fell within the configured MurmurHash3 percentage bucket |
| `DEFAULT` | No rules matched and user was outside rollout percentage |
| `DISABLED` | Flag killswitch was toggled off |
| `STATIC` | Flag served a static default configuration |
| `ERROR` | Missing flag, invalid context, or type mismatch |

## OFREP Protocol Endpoints

The local daemon exposes standard OFREP evaluation routes on port 4900.

### Single Flag Evaluation
```http
POST /ofrep/v1/evaluate/flags/new-dashboard-ui
Content-Type: application/json

{
  "context": {
    "targetingKey": "usr_77",
    "email": "engineer@flagforge.dev",
    "tier": "enterprise",
    "country": "MD"
  }
}
```

Response:
```json
{
  "key": "new-dashboard-ui",
  "value": true,
  "reason": "TARGETING_MATCH",
  "variant": "on",
  "metadata": {
    "type": "boolean",
    "lifecycle": "canary",
    "canaryStage": "beta_25",
    "flagName": "New Dashboard UI (v2)"
  }
}
```

### Bulk Evaluation
```http
POST /ofrep/v1/evaluate/flags
Content-Type: application/json

{
  "context": {
    "targetingKey": "usr_77"
  }
}
```

Response:
```json
{
  "flags": [
    {
      "key": "new-dashboard-ui",
      "value": false,
      "reason": "SPLIT",
      "variant": "off"
    },
    {
      "key": "ai-copilot-engine",
      "value": "gemini-flash",
      "reason": "SPLIT",
      "variant": "fast"
    }
  ]
}
```
