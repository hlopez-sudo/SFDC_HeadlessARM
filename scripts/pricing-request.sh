#!/usr/bin/env bash
# Run the pricing practice script using the Salesforce CLI session (default org: forticloud-cursor).
# Usage: ./scripts/pricing-request.sh
#        ./scripts/pricing-request.sh --product-id 01tXXXX --api-version 67.0
#
# The Node script calls `sf org display --json` when SF_INSTANCE_URL / SF_ACCESS_TOKEN are unset.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/sf-pricing-request.mjs "$@"
