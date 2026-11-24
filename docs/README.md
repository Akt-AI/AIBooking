# Documentation

| Guide | Use it for |
| --- | --- |
| [Project overview](../README.md) | Features, supported providers and current limitations |
| [Development and configuration](DEVELOPMENT.md) | Local setup, environment variables, tests and contributions |
| [Architecture and data handling](ARCHITECTURE.md) | Request flow, storage, AI, MCP and privacy boundaries |
| [HTTP API](API.md) | Rail operations, request formats, status codes and admin routes |
| [Operations and troubleshooting](OPERATIONS.md) | Health checks, provider failures, backup, rollback and certificates |
| [GitHub Actions](../deploy/GITHUB-ACTIONS.md) | Repository publishing, deployment credentials and pipeline behavior |
| [Pi deployment record](../deploy/PI-DEPLOYMENT.md) | Existing server configuration and deployment history |
| [AI and monetization](../deploy/AI-MONETIZATION.md) | Model limits, referrals, placements and business enquiries |
| [MCP integration](../deploy/MCP.md) | Private read-only adapter and external client configuration |
| [Standalone deployment](../deploy/README.md) | Alternative fresh-host setup; not the existing shared-proxy Pi configuration |

These guides describe the implemented application. Ticket issuance, payments, AP2 transactions and independent rail-provider failover are not implemented. Booking-directory entries hand off to external providers.

As of 2026-11-24, source and documentation are pushed to [Akt-AI/AIBooking](https://github.com/Akt-AI/AIBooking), and GitHub deployment secrets are configured. Each run reports its test, build and deployment outcome in [GitHub Actions](https://github.com/Akt-AI/AIBooking/actions).
