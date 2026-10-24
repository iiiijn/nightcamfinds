# Provider adapter contract

Each provider must expose:

- `normalizeRoom(raw)` -> normalized room or null
- `extractRooms(payload)` -> normalized room array
- `fetchRooms({ apiUrl, apiKey, fetchImpl })` -> Promise<room[]>

The adapter must hide provider-specific response shapes from the rest of NightCamFinds.

## Important

The exact API endpoint and authentication scheme must come from the provider's current affiliate/API documentation or the credentials/configuration already supplied for NightCamFinds. Do not guess an endpoint, token, or response schema in production.
