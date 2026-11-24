# Private RailKit MCP integration

The AIBooking bot now uses a real MCP client/server pair built with the official `@modelcontextprotocol/sdk` (pinned in package-lock.json). The in-process transport keeps credentials on the Pi and adds no unauthenticated HTTP endpoint. This is an AIBooking adapter around RailKit, not a server published or endorsed by RailKit/IRCTC, and not an additional data provider.

Fourteen read-only information tools are exposed: search, train details, availability, fares, both running-status feeds, station board, timetable, history, cancellations and station/train lookups. PNR is intentionally excluded from MCP and Gemini; the dedicated web form continues to use RailKit directly. No booking, payment, cancellation, recharge, shipping-label or admin tool is exposed.

## Connect an external MCP client

SSH access to `pi` is the authentication boundary. Use this configuration in a client that supports stdio MCP:

```json
{
  "mcpServers": {
    "aibooking-railkit": {
      "command": "ssh",
      "args": [
        "pi",
        "cd /home/pi/aibooking && docker compose -p aibooking -f compose.pi.yaml run --rm -T --no-deps -e GEMINI_API_KEY= -e ADMIN_TOKEN= app node mcp-stdio.mjs"
      ]
    }
  }
}
```

No API key is embedded in this configuration. The server uses the RailKit key already configured on the Pi; unused Gemini/admin credentials are cleared for this command. Docker/Compose progress belongs on stderr, while stdout is reserved for MCP messages.

Local development can run `node --env-file=.env mcp-stdio.mjs` with Node.js 22+ and installed dependencies. The standalone server does not start the website or access the operations database.

## Verification

The SDK client initialized and discovered 14 tools over both in-memory transport and an actual SSH/stdio connection to the Pi. A live `rail_train` call for 12301 returned HTTP-equivalent status 200, RailKit source, MCP transport and nine route stops. Tests cover tool discovery, read-only annotations, input validation, PNR exclusion and error propagation.

## Other servers evaluated on 2026-11-24

- RailKit upstream documentation: no verified upstream MCP endpoint was found.
- `nayanraj210401/irctc-mcp`: community server requiring a RapidAPI key.
- `Manj620026/irctc-mcp`: server for the independent irctc.dev provider, with its own API-key/anonymous-quota model. Its "official" wording refers to that provider, not verified IRCTC authorization.
- `amith-vp/indian-railway-mcp`: documents a hosted MCP URL; the initialization attempt returned HTTP 403.
- `Nirmal2007/indian-railway-mcp`: RailRadar wrapper using browser-like headers against website endpoints; no validated service agreement/production API access was established.

These alternatives were not connected to the production app, and no RailKit/Gemini credential was sent to them. Their presence does not prove current availability, accuracy or ticket-issuance authority. A second data source can be added after its access terms and credentials are independently established.

References:
- https://github.com/modelcontextprotocol/typescript-sdk
- https://github.com/RAJIV81205/RailKit
- https://github.com/nayanraj210401/irctc-mcp
- https://github.com/Manj620026/irctc-mcp
- https://github.com/amith-vp/indian-railway-mcp
- https://github.com/Nirmal2007/indian-railway-mcp
