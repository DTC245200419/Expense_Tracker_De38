# Đề 38 – Hệ thống Quản lý Chi tiêu (Expense Tracker)

Học phần **Triển khai & Quản trị Hệ thống Phần mềm** – Trường ĐH CNTT & Truyền thông, ĐH Thái Nguyên.

| | |
|---|---|
| Sinh viên | Hoàng Văn Tâm |
| Mã sinh viên | DTC245200419 |
| Lớp | CNTTK23K |
| GitHub | https://github.com/hvantam0908-netizen |

Ứng dụng web theo dõi chi tiêu cá nhân / gia đình: **giao dịch** (thu/chi), **danh mục**, **báo cáo** theo tháng và xu hướng 6 tháng. Toàn bộ hệ thống chạy bằng **Docker Compose**, gồm ứng dụng Node.js, PostgreSQL + pgAdmin, Nginx reverse proxy (HTTPS tự ký), Prometheus + Grafana, Loki + Promtail và các biện pháp hardening.

## 1. Kiến trúc

```
Trình duyệt ──HTTP 8080 / HTTPS 8443──▶ Nginx (reverse proxy, security headers, TLS)
                                            │  mạng "web"
                                            ▼
                                       app (Node.js + Express + EJS) :3000
                                            │  mạng "database" (internal)
                                            ▼
                          PostgreSQL 17 ◀── pgAdmin :8081 (mạng database + management)

Giám sát:  cAdvisor ─┐
           nginx-exporter ─┼──▶ Prometheus :9090 ──▶ Grafana :3000 (dashboard + Explore)
           postgres-exporter ─┘                        ▲
Log:       app.log + access.log/error.log ──▶ Promtail ──▶ Loki ─┘ (LogQL)
```

| Dịch vụ | Image | Cổng host (bind 127.0.0.1) | Vai trò |
|---|---|---|---|
| app | build `./app` (node:24-alpine) | không publish | Website + trang quản lý, kết nối PostgreSQL |
| postgres | postgres:17.4-alpine | không publish | Lưu users, categories, transactions, sessions |
| pgadmin | dpage/pgadmin4:9.2 | 8081 | Công cụ quản trị DB |
| nginx | nginxinc/nginx-unprivileged:1.28-alpine | 8080, 8443 (TLS) | Reverse proxy, headers, HTTPS |
| cadvisor | gcr.io/cadvisor/cadvisor:v0.52.1 | không publish | Metrics container |
| nginx-exporter | nginx/nginx-prometheus-exporter:1.4.1 | không publish | Đọc stub_status |
| postgres-exporter | prometheuscommunity/postgres-exporter:v0.17.1 | không publish | Metrics PostgreSQL |
| prometheus | prom/prometheus:v3.2.1 | 9090 | Thu thập metrics, alert rules |
| grafana | grafana/grafana:11.6.0 | 3000 | Dashboard, Explore LogQL |
| loki | grafana/loki:3.4.2 | không publish | Lưu log tập trung |
| promtail | grafana/promtail:3.4.2 | không publish | Thu gom log từ volume |
| init-perms, init-logging | busybox:1.37.0 | không có mạng | Chuẩn bị quyền volume rồi thoát (Exited 0) |

Bốn mạng bridge: `web` (nginx ↔ app ↔ nginx-exporter), `database` (**internal**, chỉ postgres ↔ app ↔ pgadmin ↔ postgres-exporter), `management` (pgAdmin publish cổng), `monitoring` (observability).

## 2. Yêu cầu máy

- Docker Desktop (Windows/macOS) hoặc Docker Engine + Compose v2 (Linux).
- Git. Trên Windows dùng **Git Bash** để chạy các script `.sh` (hoặc dùng `.ps1` tương đương).
- Không cần cài Node.js hay PostgreSQL trên máy: mọi thứ chạy trong container.

## 3. Chạy hệ thống

```bash
# 1) Sinh .env với mật khẩu ngẫu nhiên (không commit file này)
sh scripts/setup.sh            # hoặc: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

# 2) Giai đoạn 1 – app + PostgreSQL + pgAdmin + Nginx          (commit 1)
sh scripts/compose.sh 1 up -d --build

# 3) Giai đoạn 2 – thêm Prometheus + Grafana + exporters        (commit 2)
sh scripts/compose.sh 2 up -d --build

# 4) Giai đoạn 3 – thêm Loki + Promtail                          (commit 3)
sh scripts/compose.sh 3 up -d --build
sh scripts/compose.sh 3 ps -a

# 5) (tuỳ chọn) HTTPS tự ký
sh scripts/tls.sh
sh scripts/compose.sh tls up -d --build
```

Tương đương không dùng wrapper:

```bash
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml -f compose.tls.yaml up -d --build
```

### Địa chỉ truy cập

| Dịch vụ | URL | Tài khoản |
|---|---|---|
| Website | http://localhost:8080 (→ https://localhost:8443 khi bật TLS) | `admin` / `ADMIN_PASSWORD` trong `.env` |
| Health | http://localhost:8080/health | – |
| pgAdmin | http://localhost:8081 | `PGADMIN_EMAIL` / `PGADMIN_PASSWORD`; server **Expense PostgreSQL** đã khai báo sẵn, mật khẩu DB = `POSTGRES_PASSWORD` |
| Prometheus | http://localhost:9090/targets | – |
| Grafana | http://localhost:3000 | `admin` / `GRAFANA_ADMIN_PASSWORD` |

Mật khẩu nằm trong `.env` – không chụp màn hình file này khi làm minh chứng.

## 4. Ứng dụng

- **Stack**: Node.js 24, Express 4, EJS, `pg`, `express-session` + `connect-pg-simple` (session lưu trong PostgreSQL), Helmet.
- **Chức năng**: đăng nhập; tổng quan tháng (thu, chi, chênh lệch, top chi, xu hướng 6 tháng); CRUD giao dịch (lọc theo tháng/loại, phân trang); CRUD danh mục (màu, thu/chi); báo cáo theo danh mục và theo tháng; đổi mật khẩu.
- **CSDL** (`db/init/01-schema.sql`): `users`, `categories`, `transactions`, `sessions`; có dữ liệu mẫu 3 tháng gần nhất.
- **Tài khoản DB** (`db/init/02-roles.sh`): `expense_app` chỉ có SELECT/INSERT/UPDATE/DELETE; `expense_exporter` chỉ có `pg_monitor`; `postgres` (superuser) chỉ dùng cho pgAdmin/backup.
- **Kiểm thử độc lập** (không cần DB):

```bash
docker run --rm -v "$PWD/app:/app" -w /app node:24-alpine sh -c "npm install --no-audit --no-fund && npm test"
```

## 5. Nginx và hardening

- Nginx chạy image **unprivileged** (UID 101), root filesystem **read-only**, `cap_drop: ALL`, `no-new-privileges`.
- Reverse proxy `proxy_pass http://app:3000`, truyền `X-Forwarded-*`; ẩn header trùng từ Helmet; `server_tokens off`; giới hạn body 16 KB.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` (từ app), `Strict-Transport-Security` (khi TLS).
- HTTPS tự ký RSA 3072 / SHA-256 / 30 ngày, SAN `localhost` + `127.0.0.1`; HTTP 8080 → 301 HTTPS 8443; TLS 1.2/1.3.
- App: user `node` (1000), read-only rootfs + tmpfs, `cap_drop: ALL`, giới hạn RAM 256 MB; mật khẩu **scrypt** + salt, so sánh `timingSafeEqual`; CSRF token; session regenerate khi đăng nhập; cookie `HttpOnly` + `SameSite=Lax` + `Secure` (TLS); rate limit đăng nhập sai; validate input; SQL tham số hoá; EJS escape.
- PostgreSQL: không publish cổng 3306/5432, chỉ trong mạng `internal`; `scram-sha-256`; least-privilege roles; `cap_drop ALL` + chỉ thêm 5 cap cần thiết.
- Bí mật sinh ngẫu nhiên vào `.env`; `.env`, `certs/*.key`, `backups/*.sql` nằm trong `.gitignore`.

Kiểm tra nhanh:

```bash
sh scripts/smoke.sh                                       # HTTP
sh scripts/smoke.sh https://127.0.0.1:8443 certs/server.crt   # HTTPS, dùng chính cert làm CA
docker compose exec app id                                # uid=1000(node)
docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}}' de38-expense-app-1
docker network inspect -f '{{.Internal}}' de38-expense_database
```

## 6. Giám sát (Prometheus + Grafana)

- `monitoring/prometheus.yml`: 4 jobs `prometheus`, `cadvisor`, `nginx`, `postgres`; scrape 15 s; retention 7 ngày; alert rules trong `alert.rules.yml` (`ExporterDown`, `PostgresDown`, `NginxDown`, …).
- Grafana được provision sẵn datasource **Prometheus** (uid `prometheus`) và dashboard **Expense Tracker – Containers, Web, Database** (folder *De 38*): trạng thái targets/nginx/postgres, CPU-RAM-network theo container, request/s và kết nối Nginx, transactions/s và rows của PostgreSQL, kích thước DB.
- PromQL mẫu:

```promql
up
nginx_up
pg_up
sum(rate(nginx_http_requests_total[2m]))
sum(pg_stat_database_numbackends{datname="expense"})
sum by (name) (rate(container_cpu_usage_seconds_total{name=~"de38-expense-.*"}[2m])) * 100
```

Tạo tải để đồ thị có dữ liệu: `sh scripts/make-traffic.sh`.

## 7. Log tập trung (Loki + Promtail)

- Nginx ghi access log **JSON** vào volume `nginx_logs`; app ghi sự kiện JSON (`http_request`, `login_success`, `login_failed`, `csrf_denied`, `login_rate_limited`, `access_denied`, `transaction_*`, `category_*`) vào volume `app_logs`. Không ghi mật khẩu, cookie, session id.
- Promtail mount hai volume **chỉ đọc**, gắn nhãn `job=nginx | nginx-error | app`, đẩy lên Loki (không publish cổng; auth tắt vì chỉ trong mạng nội bộ).
- `compose.logging.yaml` thay thư mục datasources của Grafana bằng `logging/grafana-datasources/` (Prometheus + Loki).
- Grafana → **Explore** → datasource **Loki**. Các truy vấn LogQL dùng trong báo cáo:

```logql
{job="nginx"}
{job="nginx"} | json | status >= 400
{job="app"} | json | event="login_failed"
sum by (status) (count_over_time({job="nginx"} | json [5m]))
{job="app"} | json | event=~"transaction_.*"
```

## 8. Backup / phục hồi

```bash
sh scripts/backup.sh                                   # backups/expense-YYYYMMDD-HHMMSS.sql
sh scripts/restore-test.sh backups/expense-....sql     # nhập vào DB expense_restore_test và so sánh
docker compose exec postgres dropdb -U postgres expense_restore_test
```

## 9. Thu thập minh chứng cho báo cáo

`sh scripts/evidence.sh` lưu vào `docs/evidence/`: trạng thái container, targets Prometheus, snapshot metrics, kết quả 3 LogQL, kiểm tra hardening. Chụp thêm màn hình: website, pgAdmin, Prometheus Targets, dashboard Grafana, Explore Loki, GitHub commits.

## 10. Lịch sử commit mốc

| Mốc | Nội dung |
|---|---|
| Commit 1 | Ứng dụng Expense Tracker, PostgreSQL, pgAdmin, Nginx reverse proxy + security headers/TLS, hardening cơ bản |
| Commit 2 | Prometheus, Grafana, cAdvisor, nginx-exporter, postgres-exporter, dashboard, alert rules |
| Commit 3 | Loki, Promtail, datasource Loki, truy vấn LogQL |

## 11. Dừng / xoá

```bash
sh scripts/compose.sh tls down          # dừng, giữ dữ liệu (volumes)
sh scripts/compose.sh tls down -v       # XOÁ cả dữ liệu – chỉ dùng khi muốn làm lại từ đầu
```
