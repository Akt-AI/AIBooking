#!/usr/bin/env bash
# Run after gh auth login has authenticated an account with Akt-AI access.
set -euo pipefail
cd "$(dirname "$0")/.."
repo=Akt-AI/AIBooking
gh api user --jq .login
test -f "$HOME/.ssh/aibooking_actions"
test -f "$HOME/.ssh/aibooking_actions_known_hosts"
if ! gh repo view "$repo" --json name >/dev/null 2>&1; then
  gh repo create "$repo" --private --description 'AIBooking rail information, AI assistant and booking services'
fi
# Fail rather than inadvertently publishing proprietary source to a public repo.
[[ $(gh repo view "$repo" --json visibility --jq .visibility) == PRIVATE ]]
gh secret set PI_SSH_KEY --repo "$repo" < "$HOME/.ssh/aibooking_actions"
gh secret set PI_KNOWN_HOSTS --repo "$repo" < "$HOME/.ssh/aibooking_actions_known_hosts"
gh variable set PI_HOST --repo "$repo" --body '187.127.186.243'
gh auth setup-git --hostname github.com
git remote set-url origin "https://github.com/$repo.git"
git push -u origin main
printf 'Repository: https://github.com/%s\nActions: https://github.com/%s/actions\n' "$repo" "$repo"
