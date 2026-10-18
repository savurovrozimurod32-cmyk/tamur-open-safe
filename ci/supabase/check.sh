#!/usr/bin/env bash
# Read-only Supabase audit for TAMUR Open the Safe. Runs on GitHub Actions.
# Never selects secret values or personal data; output is encrypted before it is committed (public repo).
set -uo pipefail
REF=eahpfrvevrwyoqkpysqp
OUT=work; mkdir -p "$OUT" results-supabase
STATUS=results-supabase/STATUS.md

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN secret: MISSING ($(date -u +%FT%TZ))" > "$STATUS"; exit 0
fi
echo "SUPABASE_ACCESS_TOKEN secret: present ($(date -u +%FT%TZ))" > "$STATUS"
API=https://api.supabase.com/v1
H=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")

curl -s "${H[@]}" "$API/projects/$REF" | jq '{name, region, status, created_at}' > "$OUT/project.json" 2>&1
curl -s "${H[@]}" "$API/projects/$REF/functions" | jq '[.[] | {slug, status, version, verify_jwt, updated_at}]' > "$OUT/functions.json" 2>&1

q() {  # q <name> <sql>  — single SELECT statements only
  jq -n --arg q "$2" '{query:$q}' | curl -s "${H[@]}" -X POST "$API/projects/$REF/database/query" -d @- > "$OUT/$1.json"
}
q tables "select c.relname as table, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'safe\_%' order by 1"
q columns "select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name like 'safe\_%' order by table_name, ordinal_position"
q policies "select tablename, policyname, cmd, roles, permissive, qual, with_check from pg_policies where schemaname='public' and tablename like 'safe\_%'"
q grants "select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges from information_schema.role_table_grants where table_schema='public' and table_name like 'safe\_%' and grantee in ('anon','authenticated','public') group by 1,2 order by 1,2"
q indexes "select tablename, indexname, indexdef from pg_indexes where schemaname='public' and tablename like 'safe\_%' order by 1,2"
q constraints "select conrelid::regclass::text as table, conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid::regclass::text like 'safe\_%' order by 1,2"
q triggers "select event_object_table, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers where event_object_table like 'safe\_%'"
q routines "select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname ilike '%safe%' or p.proname ilike '%attempt%' or p.proname ilike '%participant%')"
q counts "select 'safe_participants' as t, count(*) from safe_participants union all select 'safe_attempts', count(*) from safe_attempts union all select 'safe_events', count(*) from safe_events union all select 'safe_private_config', count(*) from safe_private_config"
q recent "select 'safe_participants' as t, count(*) filter (where (to_jsonb(x)->>'created_at')::timestamptz > now() - interval '48 hours') as last_48h, max(to_jsonb(x)->>'created_at') as latest from safe_participants x union all select 'safe_attempts', count(*) filter (where (to_jsonb(x)->>'created_at')::timestamptz > now() - interval '48 hours'), max(to_jsonb(x)->>'created_at') from safe_attempts x union all select 'safe_events', count(*) filter (where (to_jsonb(x)->>'created_at')::timestamptz > now() - interval '48 hours'), max(to_jsonb(x)->>'created_at') from safe_events x"
q ci_rows "select 'safe_participants' as t, count(*) from safe_participants x where to_jsonb(x)::text like '%ci-live-check%' union all select 'safe_attempts', count(*) from safe_attempts x where to_jsonb(x)::text like '%ci-live-check%' union all select 'safe_events', count(*) from safe_events x where to_jsonb(x)::text like '%ci-live-check%'"
q config_flag "select to_jsonb(c)->'accepting_entries' as accepting_entries from safe_private_config c"
q other_tables "select count(*) as tables_in_public from information_schema.tables where table_schema='public'"

# function source (for code review) — downloaded via the CLI, falls back to the raw API body
mkdir -p "$OUT/fn"
( cd "$OUT/fn" && npx -y supabase@latest functions download safe-api --project-ref "$REF" --use-api > ../fn-download.log 2>&1 ) || true
if ! ls -R "$OUT/fn" | grep -q '\.ts'; then
  curl -s "${H[@]}" "$API/projects/$REF/functions/safe-api/body" -o "$OUT/fn/safe-api.body"
fi

# encrypt everything with the reviewer's public key (hybrid RSA + AES)
tar czf work.tgz "$OUT"
openssl rand -out key.bin 32
openssl enc -aes-256-cbc -pbkdf2 -salt -in work.tgz -out results-supabase/audit.tgz.enc -pass file:key.bin
openssl pkeyutl -encrypt -pubin -inkey ci/supabase/results-pubkey.pem -pkeyopt rsa_padding_mode:oaep -in key.bin -out results-supabase/audit.key.enc
rm -f key.bin work.tgz
echo "Encrypted audit written: $(du -h results-supabase/audit.tgz.enc | cut -f1)" >> "$STATUS"
