#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
This helper prints suggested `vercel env add` commands to set production environment variables.

It can also apply them automatically if you export the vars and run with the `apply` argument.
EOF

ENV_VARS=(GROQ_API_KEY GROQ_BASE_URL CHAT_OTP_DELIVERY_MODE RESEND_API_KEY OTP_FROM_EMAIL CHAT_INCLUDE_DEBUG_OTP EMBEDDING_PROVIDER EMBEDDING_API_KEY OPENAI_API_KEY)

if command -v vercel >/dev/null 2>&1; then
  VERCEL_CMD=(vercel)
else
  VERCEL_CMD=(npx --yes vercel)
fi

derive_scope_and_project() {
  local source_url="${VERCEL_PROJECT_URL-}"
  local project_ref="${VERCEL_PROJECT-}"
  local scope=""
  local project=""

  if [ -n "$source_url" ]; then
    source_url="${source_url#https://}"
    source_url="${source_url#http://}"
    source_url="${source_url#vercel.com/}"
    source_url="${source_url#www.vercel.com/}"
    scope="$(echo "$source_url" | awk -F/ '{print $1}')"
    project="$(echo "$source_url" | awk -F/ '{print $2}')"
  elif [ -n "$project_ref" ]; then
    if [[ "$project_ref" == http*://* ]]; then
      project_ref="${project_ref#https://}"
      project_ref="${project_ref#http://}"
      project_ref="${project_ref#vercel.com/}"
      project_ref="${project_ref#www.vercel.com/}"
      scope="$(echo "$project_ref" | awk -F/ '{print $1}')"
      project="$(echo "$project_ref" | awk -F/ '{print $2}')"
    elif [[ "$project_ref" == */* ]]; then
      scope="${project_ref%%/*}"
      project="${project_ref##*/}"
    else
      scope="$project_ref"
      project="${VERCEL_PROJECT_NAME-}"
    fi
  fi

  echo "$scope|$project"
}

if [ "${1-}" = "apply" ]; then
  if [ -z "${VERCEL_TOKEN-}" ]; then
    echo "Please export VERCEL_TOKEN in your environment to allow non-interactive updates." >&2
    exit 2
  fi

  IFS='|' read -r VERCEL_SCOPE VERCEL_PROJECT_NAME <<< "$(derive_scope_and_project)"

  if [ -z "$VERCEL_SCOPE" ] || [ -z "$VERCEL_PROJECT_NAME" ]; then
    echo "Please set either VERCEL_PROJECT_URL=https://vercel.com/<scope>/<project> or VERCEL_PROJECT=<scope>/<project>." >&2
    exit 2
  fi

  echo "Using scope: $VERCEL_SCOPE"
  echo "Using project: $VERCEL_PROJECT_NAME"

  if [ ! -f ".vercel/project.json" ]; then
    "${VERCEL_CMD[@]}" link --yes --token "$VERCEL_TOKEN" --scope "$VERCEL_SCOPE" --project "$VERCEL_PROJECT_NAME" >/dev/null
  fi

  for var in "${ENV_VARS[@]}"; do
    val="${!var-}"
    if [ -z "$val" ]; then
      echo "Skipping $var (no value set in environment)"
      continue
    fi
    echo "Setting $var in production..."
    "${VERCEL_CMD[@]}" env add "$var" production --value "$val" --yes --force --token "$VERCEL_TOKEN" --scope "$VERCEL_SCOPE" >/dev/null
  done

  echo "Done. Remember to redeploy your project so runtime picks up new vars."
  exit 0
fi

echo "Suggested commands (copy/paste and replace <value>):"
for var in "${ENV_VARS[@]}"; do
  echo "npx --yes vercel env add $var production --value <value> --yes"
done

echo
cat <<'EOF'
To auto-apply, export VERCEL_TOKEN and either:
  VERCEL_PROJECT_URL=https://vercel.com/<scope>/<project>
or
  VERCEL_PROJECT=<scope>/<project>

Then export your environment variable values and run:
  ./scripts/setup-vercel-env.sh apply

Be careful: this will attempt to add variables to your Vercel project and requires a valid token and project scope.
EOF
