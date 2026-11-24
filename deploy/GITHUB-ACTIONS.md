# GitHub Actions deployment

Target repository: Akt-AI/AIBooking (private by default).

Pull requests run Node 24 tests and a production Docker build on GitHub-hosted runners. Main-branch pushes deploy only after both pass. Deployment jobs serialize; pull requests never receive deployment credentials.

The repository needs secret `PI_SSH_KEY` (dedicated Ed25519 key), secret `PI_KNOWN_HOSTS` (server host keys verified through the existing trusted SSH connection), and repository variable `PI_HOST` (server address).

Install `deploy/github-deploy.sh` at `/home/pi/bin/aibooking-github-deploy`, mode 700. Its dedicated authorized_keys entry must use `restrict,command="/home/pi/bin/aibooking-github-deploy"`. The key accepts only `deploy <40-character SHA>` and cannot start a shell or forward ports. Docker access is privileged, so deploy access must be limited to trusted maintainers.

Each deployment extracts the committed archive into `/home/pi/aibooking-releases/<SHA>`, builds Docker Compose app only, waits for container health, checks the local API, and restores the prior image if startup fails. GitHub then checks the public HTTPS API. The production `.env` stays at `/home/pi/aibooking/.env`; the existing Compose project name and persistent data volume remain the same. Certificate renewal and the shared Caddy proxy remain managed separately.

Successful revisions are recorded at `/home/pi/aibooking-current-revision`; `/home/pi/aibooking-current` points to their source. To roll back deliberately, re-run the successful GitHub Actions run for the desired main-branch revision. Source releases and images are retained for rollback; monitor disk use before pruning older releases.

GitHub credentials are required to create the repository, install repository secrets, push, and verify the first run. Never add application API keys, SSH private keys, certificates, or SQLite data to Git.

After authenticating GitHub CLI with access to Akt-AI, run `./deploy/publish-github.sh`. It creates the private repository if missing, installs the dedicated deployment secrets without printing them, sets the server address, and pushes main. The dedicated SSH key and verified host-key file are stored outside this repository in `~/.ssh/aibooking_actions` and `~/.ssh/aibooking_actions_known_hosts`.
