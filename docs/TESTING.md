# Testing

## Audit report offline

- scoreBar: 0 → empty, 50 → half, 100 → full
- Allow: `audit:summary`, `audit:priorities`, `audit:back`
- Reject: `audit:https://evil`

## Production

`/api/audit` and other tools remain HTTP 200 for valid public targets.
