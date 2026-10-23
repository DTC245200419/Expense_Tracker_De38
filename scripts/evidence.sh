#!/usr/bin/env bash
# Thu thap minh chung dang JSON/text vao docs/evidence/ de dua vao bao cao.
# Chay:  sh scripts/evidence.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/evidence"
mkdir -p "$OUT"
envval() { grep -E "^$1=" "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }
PROMETHEUS_PORT="$(envval PROMETHEUS_PORT)"; GRAFANA_PORT="$(envval GRAFANA_PORT)"
GRAFANA_ADMIN_PASSWORD="$(envval GRAFANA_ADMIN_PASSWORD)"
PROM="http://127.0.0.1:${PROMETHEUS_PORT:-9090}"
GRAF="http://127.0.0.1:${GRAFANA_PORT:-3000}"
DC=(docker compose --project-directory "$ROOT" -f "$ROOT/compose.yaml" -f "$ROOT/compose.monitoring.yaml" -f "$ROOT/compose.logging.yaml")

echo "== Trang thai container ==";            "${DC[@]}" ps -a | tee "$OUT/compose-ps.txt"
echo "== Prometheus targets ==";              curl -s "$PROM/api/v1/targets" | tee "$OUT/prometheus-targets.json" >/dev/null && grep -o '"health":"[a-z]*"' "$OUT/prometheus-targets.json" | sort | uniq -c
echo "== Metric snapshot ==";
{
  for q in 'up' 'nginx_up' 'pg_up' 'sum(rate(nginx_http_requests_total[2m]))' 'sum(pg_stat_database_numbackends{datname="expense"})' 'count(container_last_seen{name=~"de38-expense-.*"})'; do
    printf '%s => ' "$q"; curl -s -G "$PROM/api/v1/query" --data-urlencode "query=$q" | tr -d '\n'; echo
  done
} | tee "$OUT/metrics-snapshot.txt"

echo "== LogQL qua Grafana datasource proxy (3 query) =="
NOW_NS=$(( $(date +%s) * 1000000000 )); START_NS=$(( NOW_NS - 3600 * 1000000000 ))
i=0
for q in '{job="nginx"}' '{job="nginx"} | json | status >= 400' '{job="app"} | json | event="login_failed"'; do
  i=$((i+1))
  curl -s -u "admin:${GRAFANA_ADMIN_PASSWORD:-admin}" -G "$GRAF/api/datasources/proxy/uid/loki/loki/api/v1/query_range" \
    --data-urlencode "query=$q" --data-urlencode "start=$START_NS" --data-urlencode "end=$NOW_NS" --data-urlencode "limit=10" \
    > "$OUT/logql-$i.json"
  printf '%-50s status=%s lines=%s\n' "$q" "$(grep -o '"status":"[a-z]*"' "$OUT/logql-$i.json" | head -1)" "$(grep -o '"values":\[\[' "$OUT/logql-$i.json" | wc -l)"
done

echo "== Hardening: uid, read-only, caps, mang internal, quyen DB =="
{
  echo "app id: $("${DC[@]}" exec -T app id)"
  echo "nginx id: $("${DC[@]}" exec -T nginx id)"
  echo "app ReadonlyRootfs: $(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' de38-expense-app-1)"
  echo "app CapDrop: $(docker inspect -f '{{.HostConfig.CapDrop}}' de38-expense-app-1)"
  echo "app SecurityOpt: $(docker inspect -f '{{.HostConfig.SecurityOpt}}' de38-expense-app-1)"
  echo "database network Internal: $(docker network inspect -f '{{.Internal}}' de38-expense_database)"
  echo "postgres PortBindings: $(docker inspect -f '{{.HostConfig.PortBindings}}' de38-expense-postgres-1)"
  echo "-- quyen expense_app --"
  "${DC[@]}" exec -T postgres psql -U postgres -d expense -Atc "SELECT grantee, table_name, string_agg(privilege_type, ',') FROM information_schema.role_table_grants WHERE grantee='expense_app' GROUP BY 1,2 ORDER BY 2"
  echo "-- role expense_exporter thuoc pg_monitor --"
  "${DC[@]}" exec -T postgres psql -U postgres -d expense -Atc "SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE u.rolname='expense_exporter'"
} | tee "$OUT/hardening-checks.txt"

echo "Da luu minh chung vao $OUT"
