'use strict';
// Dung bao cao Word (docx) cho De 38 - Expense Tracker.
// Chay trong container Node (xem scripts/build-report.sh). Output: docs/report/Bao_cao_De38_*.docx

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, ImageRun, TableOfContents, PageBreak, Footer, PageNumber,
  LevelFormat, VerticalAlign, TabStopType, PageBorderDisplay, PageBorderOffsetFrom, PageBorderZOrder,
  UnderlineType,
} = require('docx');

const ROOT = process.env.ROOT || '/work';
const IMG = path.join(ROOT, 'docs/evidence/images');
const OUT = path.join(ROOT, 'docs/report/Bao_cao_De38_Hoang_Van_Tam_DTC245200419.docx');

const FONT = 'Times New Roman';
const SZ = 26; // 13pt than van ban (giong file mau)
const CM = 567; // 1 cm = 567 DXA
const CONTENT_W_CM = 16.5; // A4 21cm - le trai 3 - le phai 1.5 (giong file mau)
const FIG_MAX_H_PX = 360; // ~9.5 cm, chieu cao anh toi da (file mau 9.6-11.3 cm)
const CONTENT_W_DXA = CONTENT_W_CM * CM;
const CONTENT_W_PX = Math.round((CONTENT_W_CM / 2.54) * 96); // ~605px

// ---------- helpers ----------
function runs(parts, base = {}) {
  if (typeof parts === 'string') parts = [parts];
  return parts.map((p) => {
    if (typeof p === 'string') return new TextRun({ text: p, font: FONT, size: SZ, ...base });
    return new TextRun({
      text: p.text, font: p.code ? 'Consolas' : FONT, size: p.code ? SZ - 4 : SZ,
      bold: p.bold, italics: p.italic, ...base,
    });
  });
}
const P = (parts, opts = {}) => new Paragraph({
  children: runs(parts), alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { before: 0, after: opts.after ?? 100, line: 252 }, // file mau: doan van gian dong don
  ...opts.extra,
});
const Center = (text, opts = {}) => new Paragraph({
  children: runs([{ text, bold: opts.bold, italic: opts.italic }], opts.size ? { size: opts.size } : {}),
  alignment: AlignmentType.CENTER, spacing: { after: opts.after ?? 120, line: 312 },
});
// Chu thich hinh/bang giong style Caption cua file mau: 9pt, mau 44546A, canh giua, keepNext
const Caption = (text) => new Paragraph({
  children: [new TextRun({ text, font: FONT, size: 18, color: '44546A' })],
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200, line: 240 },
});
const H1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { before: 0, after: 240 } });
const H2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });
const H3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } });
const Blank = () => new Paragraph({ children: [], spacing: { after: 0 } });
const Break = () => new Paragraph({ children: [new PageBreak()] });

const Bullets = (items) => items.map((it) => new Paragraph({
  children: runs(it), numbering: { reference: 'bullets', level: 0 },
  spacing: { after: 60, line: 312 }, alignment: AlignmentType.JUSTIFIED,
}));

function Code(lines) {
  return lines.map((l, i) => new Paragraph({
    children: [new TextRun({ text: l, font: 'Consolas', size: 18 })],
    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
    spacing: { before: i === 0 ? 80 : 0, after: i === lines.length - 1 ? 140 : 0, line: 252 },
  }));
}

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function Fig(file, caption, opts = {}) {
  const full = path.join(IMG, file);
  if (!fs.existsSync(full)) {
    console.warn('THIEU ANH:', full);
    return [P([{ text: `[Thiếu ảnh ${file}]`, italic: true }], { align: AlignmentType.CENTER }), Caption(caption)];
  }
  const buf = fs.readFileSync(full);
  const { w, h } = pngSize(buf);
  const maxW = Math.round(CONTENT_W_PX * (opts.scale || 1));
  const maxH = opts.maxH || FIG_MAX_H_PX;
  let width = maxW; let height = Math.round((h / w) * width);
  if (height > maxH) { height = maxH; width = Math.round((w / h) * height); }
  return [
    new Paragraph({
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width, height } })],
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 }, keepNext: true,
    }),
    Caption(caption),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(parts, width, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: runs(parts, { size: 21, bold: opts.bold }), alignment: opts.align || AlignmentType.LEFT,
      spacing: { before: 0, after: 0, line: 252 },
    })],
    width: { size: width, type: WidthType.DXA }, borders,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    verticalAlign: VerticalAlign.CENTER, margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}
function Tbl(headers, rows, widthsCm, opts = {}) {
  const widths = widthsCm.map((c) => Math.round(c * CM));
  const total = widths.reduce((a, b) => a + b, 0);
  const t = new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell([{ text: h, bold: true }], widths[i], { fill: 'E5E7EB' })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, widths[i], { align: opts.center && opts.center.includes(i) ? AlignmentType.CENTER : undefined })) })),
    ],
  });
  const out = [t];
  if (opts.caption) out.push(Caption(opts.caption));
  else out.push(new Paragraph({ children: [], spacing: { after: 120 } }));
  return out;
}

// ---------- NOI DUNG ----------
// Trang bia theo khung mau: khung vien, logo ICTU, thong tin GVHD/SV ben trai
const LOGO = path.join(ROOT, 'docs/report/logo-ictu.png');
const coverInfo = (label, value) => new Paragraph({
  children: runs([`${label}: `, value], { size: 26 }),
  alignment: AlignmentType.LEFT, indent: { left: 1.2 * CM }, spacing: { before: 0, after: 40, line: 276 },
});
const cover = [
  new Paragraph({
    children: [new TextRun({ text: 'TRƯỜNG ĐH CNTT & TRUYỀN THÔNG', font: FONT, size: 28, bold: true, underline: { type: UnderlineType.SINGLE } })],
    alignment: AlignmentType.CENTER, spacing: { before: 200, after: 120 },
  }),
  Center('KHOA CÔNG NGHỆ THÔNG TIN', { bold: true, size: 28, after: 900 }),
  ...(fs.existsSync(LOGO) ? [new Paragraph({
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(LOGO), transformation: { width: 170, height: 170 } })],
    alignment: AlignmentType.CENTER, spacing: { after: 900 },
  })] : []),
  Center('BÁO CÁO', { bold: true, size: 36, after: 240 }),
  Center('HỌC PHẦN TRIỂN KHAI & QUẢN TRỊ HỆ THỐNG PHẦN MỀM', { bold: true, size: 28, after: 500 }),
  Center('ĐỀ TÀI:', { bold: true, size: 30, after: 400 }),
  Center('Hệ thống Quản lý Chi tiêu / Expense Tracker', { bold: true, size: 30, after: 1100 }),
  coverInfo('Giảng viên hướng dẫn', 'Lê Khánh Dương'),
  coverInfo('Sinh viên thực hiện', 'Hoàng Văn Tâm'),
  coverInfo('Mã sinh viên', 'DTC245200419'),
  coverInfo('Lớp', 'CNTT K23K'),
];

const loiNoiDau = [
  new Paragraph({ text: 'LỜI NÓI ĐẦU', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
  P('Báo cáo trình bày kết quả triển khai Đề 38 – Hệ thống Quản lý Chi tiêu (Expense Tracker) của sinh viên Hoàng Văn Tâm. Hệ thống là ứng dụng web theo dõi chi tiêu cá nhân và gia đình, cho phép ghi nhận giao dịch thu và chi, quản lý danh mục, xem báo cáo theo tháng và xu hướng sáu tháng gần nhất. Dữ liệu được lưu trong PostgreSQL và quản trị bằng pgAdmin. Toàn bộ dịch vụ được đóng gói bằng Docker Compose, có Nginx làm reverse proxy với HTTPS tự ký, Prometheus và Grafana giám sát container, web server và database, Loki và Promtail thu thập log tập trung, cùng nhiều lớp hardening.'),
  P('Trọng tâm của bài thực hành là chứng minh ứng dụng hoạt động cùng hạ tầng vận hành. Vì vậy, bên cạnh mã nguồn và cấu hình, báo cáo đưa vào ảnh chụp giao diện thật, lịch sử GitHub, kết quả truy vấn metrics, ba truy vấn LogQL và các phép kiểm tra bảo mật. Dữ liệu kiểm chứng được thu trong hai ngày 23 và 24 tháng 10 năm 2026 trên máy Windows 11 với Docker Desktop; các số liệu trong báo cáo là ảnh chụp tại thời điểm kiểm tra, không phải kết quả benchmark.'),
  P('Qua quá trình triển khai, ứng dụng kết nối được PostgreSQL; các thao tác thêm, sửa, xóa giao dịch được lưu vào database và đối chiếu được trong pgAdmin; Nginx phục vụ HTTPS bằng chứng chỉ tự ký; Prometheus thu thập dữ liệu từ bốn nguồn; Grafana hiển thị dashboard và truy vấn được log của Nginx và ứng dụng trong Loki. Các biện pháp hardening và quy trình backup, phục hồi được kiểm tra riêng và ghi lại kết quả.'),
  P('Em xin cảm ơn thầy Lê Khánh Dương đã hướng dẫn học phần Triển khai và Quản trị hệ thống phần mềm. Thông qua đề tài, em có cơ hội hệ thống hóa quy trình từ đóng gói ứng dụng, triển khai dịch vụ, giám sát, thu thập log đến kiểm tra kết quả và trình bày minh chứng. Những giới hạn còn tồn tại được nêu rõ trong phần kết luận.'),
  Blank(),
  new Paragraph({ children: runs([{ text: 'Sinh viên thực hiện', bold: true }]), alignment: AlignmentType.RIGHT, indent: { right: 1.5 * CM } }),
  new Paragraph({ children: runs(['Hoàng Văn Tâm']), alignment: AlignmentType.RIGHT, indent: { right: 1.5 * CM } }),
];

const mucLuc = [
  new Paragraph({ children: runs([{ text: 'MỤC LỤC', bold: true }], { size: 32 }), alignment: AlignmentType.CENTER, pageBreakBefore: true, spacing: { after: 240 } }),
  new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-2' }),
  P([{ text: 'Mục lục được tạo tự động: nếu Word hỏi "cập nhật trường", chọn Có để hiện số trang.', italic: true }], { align: AlignmentType.LEFT, }),
];

const phan1 = [
  H1('PHẦN 1. GIỚI THIỆU TỔNG QUAN HỆ THỐNG'),
  H2('1.1. Mục tiêu và phạm vi đề tài'),
  P('Quản lý chi tiêu là nhu cầu thường xuyên của cá nhân và hộ gia đình: ghi lại các khoản thu, chi theo ngày, phân loại theo danh mục và tổng hợp cuối tháng để biết tiền đã đi đâu. Đề 38 yêu cầu xây dựng một ứng dụng web giải quyết nhu cầu này với ba nhóm chức năng: giao dịch, danh mục và báo cáo; dữ liệu lưu trong PostgreSQL và quản trị bằng pgAdmin. Ứng dụng có luồng đọc và ghi đều được bảo vệ bằng đăng nhập, sau đó được triển khai cùng các thành phần vận hành theo yêu cầu chung của học phần.'),
  P('Mục tiêu kỹ thuật gồm: quản lý toàn bộ mã nguồn và cấu hình trên GitHub với tài khoản đặt theo mã sinh viên; chạy ứng dụng, PostgreSQL và pgAdmin bằng Docker Compose; tiếp nhận truy cập qua Nginx reverse proxy có HTTPS và security headers; giám sát container, web server và database bằng Prometheus cùng Grafana; thu log bằng Loki và Promtail rồi truy vấn bằng LogQL; áp dụng nhiều lớp hardening. Mỗi yêu cầu phải được thể hiện bằng thao tác và minh chứng thật.'),
  P('Ứng dụng dùng Node.js 24, Express 4 và EJS, kết nối PostgreSQL 17 bằng thư viện pg. Đề bài gợi ý Node.js hoặc Python; em chọn Node.js vì cùng một ngôn ngữ cho server và kiểm thử, image Alpine nhỏ và dễ cấu hình chạy không root. Phạm vi demo gồm một tài khoản quản trị, một instance ứng dụng, dữ liệu mẫu ba tháng gần nhất và các giao dịch được thêm trong quá trình kiểm thử.'),
  ...Tbl(['Yêu cầu', 'Cách đáp ứng trong hệ thống'], [
    ['GitHub', 'Repository công khai DTC245200419/Expense_Tracker_De38, README hướng dẫn chạy, ba commit mốc và các commit sửa lỗi phát sinh'],
    ['Ứng dụng và dữ liệu', 'Expense Tracker (giao dịch, danh mục, báo cáo), PostgreSQL 17 và pgAdmin 4'],
    ['Reverse proxy', 'Nginx HTTP 8080 chuyển hướng 301 sang HTTPS 8443 tự ký; security headers'],
    ['Monitoring', 'cAdvisor, nginx-exporter, postgres-exporter, Prometheus và Grafana với dashboard 13 panel'],
    ['Logging', 'Log JSON của app và Nginx, Promtail, Loki và ba truy vấn LogQL'],
    ['Hardening', 'Non-root, read-only rootfs, cap_drop ALL, mạng internal, least-privilege DB, secrets ngẫu nhiên, scrypt, CSRF, rate limit, headers'],
  ], [4, 12], { caption: 'Bảng 1.1. Yêu cầu đề bài và cách đáp ứng' }),

  H2('1.2. Môi trường thực nghiệm'),
  P('Máy thực nghiệm chạy Windows 11 Home, 16 GB RAM, Docker Desktop 4.96.3 với backend WSL2 (Ubuntu). Docker Engine phiên bản 29.9.2 và Docker Compose v5.6.1 được dùng để chạy Linux containers. Docker Desktop mặc định dùng containerd image store, điều này ảnh hưởng đến cAdvisor và được xử lý ở mục 5.3. Các script vận hành viết bằng Bash và chạy trong Git Bash; không cài Node.js, PostgreSQL hay OpenSSL trên máy host vì mọi công việc đều thực hiện trong container.'),
  P('Toàn bộ cổng publish ra host đều bind 127.0.0.1 để phục vụ demo cục bộ: website 8080/8443, pgAdmin 8081, Prometheus 9090, Grafana 3000. PostgreSQL, Loki, cAdvisor và các exporter không publish cổng. Mật khẩu của PostgreSQL, tài khoản ứng dụng, exporter, admin web, pgAdmin và Grafana được sinh ngẫu nhiên bằng script setup vào file .env, file này nằm trong .gitignore và không xuất hiện trong báo cáo.'),

  H2('1.3. Kiến trúc và luồng hoạt động'),
  ...Fig('h1-1-kien-truc.png', 'Hình 1.1. Kiến trúc hệ thống theo các file Docker Compose và bốn mạng bridge'),
  P('Luồng truy cập bắt đầu từ trình duyệt tới Nginx. Khi bật TLS, yêu cầu HTTP ở cổng 8080 được chuyển hướng 301 sang HTTPS 8443. Nginx chuyển tiếp request tới app:3000 trong mạng web kèm các header X-Forwarded-For và X-Forwarded-Proto. Express xác định route, kiểm tra phiên đăng nhập và CSRF token nếu là thao tác ghi, kiểm tra dữ liệu đầu vào rồi gọi repository thực hiện truy vấn SQL tham số hóa tới PostgreSQL trong mạng database. Kết quả được render bằng EJS và trả về qua Nginx.'),
  P('Luồng metrics tách khỏi luồng người dùng. Prometheus scrape cAdvisor, nginx-exporter, postgres-exporter và chính nó mỗi 15 giây. cAdvisor đọc cgroup của Docker Engine để lấy CPU, RAM, network của từng container; nginx-exporter đọc stub_status của Nginx qua cổng 8082 nội bộ; postgres-exporter đăng nhập PostgreSQL bằng tài khoản chỉ có quyền pg_monitor để đọc pg_stat_database. Grafana lấy dữ liệu từ Prometheus bằng PromQL.'),
  P('Luồng logging bắt đầu từ file app.log của ứng dụng và access.log, error.log của Nginx trên hai named volume; Promtail đọc các file này ở chế độ chỉ đọc và đẩy lên Loki, Grafana Explore truy vấn bằng LogQL (chi tiết ở mục 4.3).'),

  H2('1.4. Các dịch vụ, mạng và dữ liệu lưu trữ'),
  ...Tbl(['Dịch vụ', 'Image', 'Cổng host', 'Vai trò'], [
    ['app', 'node:24-alpine (build)', 'Không publish', 'Website Expense Tracker, kết nối PostgreSQL'],
    ['postgres', 'postgres:17.4-alpine', 'Không publish', 'Lưu users, categories, transactions, sessions'],
    ['pgadmin', 'dpage/pgadmin4:9.2', '8081', 'Quản trị PostgreSQL'],
    ['nginx', 'nginxinc/nginx-unprivileged:1.28-alpine', '8080, 8443', 'Reverse proxy, TLS, headers'],
    ['cadvisor', 'ghcr.io/google/cadvisor:0.55.1', 'Không publish', 'Metrics container'],
    ['nginx-exporter', 'nginx/nginx-prometheus-exporter:1.4.1', 'Không publish', 'Đọc stub_status của Nginx'],
    ['postgres-exporter', 'postgres-exporter:v0.17.1', 'Không publish', 'Metrics PostgreSQL'],
    ['prometheus', 'prom/prometheus:v3.2.1', '9090', 'Thu thập time series, alert rules'],
    ['grafana', 'grafana/grafana:11.6.0', '3000', 'Dashboard và Explore'],
    ['loki', 'grafana/loki:3.4.2', 'Không publish', 'Lưu trữ log tập trung'],
    ['promtail', 'grafana/promtail:3.4.2', 'Không publish', 'Thu gom log từ volume'],
    ['init-perms, init-logging', 'busybox:1.37.0', 'Không có mạng', 'Chuẩn bị quyền volume rồi thoát'],
  ], [3.2, 5.3, 2.5, 5], { caption: 'Bảng 1.2. Các dịch vụ trong Docker Compose' }),
  P('Có bốn mạng bridge: web nối Nginx, app và nginx-exporter; database được đánh dấu internal và chỉ nối PostgreSQL, app, pgAdmin, postgres-exporter; management chỉ có pgAdmin, cần thiết vì mạng internal không publish được cổng ra host; monitoring nối các dịch vụ observability. PostgreSQL không publish cổng 5432 ra host, mọi truy cập đều đi qua pgAdmin hoặc lệnh docker compose exec.'),
  P('Dữ liệu PostgreSQL nằm trong volume postgres_data; log nằm trong app_logs và nginx_logs; Prometheus, Grafana, Loki và positions của Promtail dùng volume riêng. Do đó restart hoặc build lại container app không làm mất giao dịch. Hai container init dùng busybox chạy chown cho volume vì app chạy UID 1000, Nginx chạy UID 101 và Loki/Promtail chạy UID 10001; trạng thái Exited (0) của chúng là kết quả mong đợi, không phải lỗi.'),
];

const phan2 = [
  H1('PHẦN 2. QUẢN LÝ MÃ NGUỒN VÀ TRIỂN KHAI'),
  H2('2.1. Repository và cấu trúc mã nguồn'),
  P('Mã nguồn được quản lý tại repository công khai của tài khoản GitHub DTC245200419, đặt theo mã sinh viên như đề yêu cầu. Source ứng dụng, Dockerfile, schema khởi tạo, bốn file Compose, cấu hình Nginx, Prometheus, Grafana, Loki, Promtail, scripts vận hành và minh chứng đều nằm trong repository. README hướng dẫn sinh secrets, chạy theo giai đoạn, truy cập dịch vụ, kiểm tra kết quả và bảng lỗi đã gặp.'),
  P([{ text: 'https://github.com/DTC245200419/Expense_Tracker_De38', bold: true }], { align: AlignmentType.CENTER, }),
  ...Fig('h2-1-github-repo.png', 'Hình 2.1. Repository Expense_Tracker_De38 trên GitHub'),
  P('Thư mục app chứa server Express (src), các view EJS (views), CSS (public) và tests. Thư mục db/init chứa schema cùng script tạo tài khoản PostgreSQL; nginx chứa cấu hình HTTP và TLS; monitoring chứa cấu hình scrape, alert rules và provisioning Grafana; logging chứa Loki, Promtail và datasource; scripts chứa setup, compose wrapper, tls, smoke test, backup, restore-test, make-traffic, evidence và screenshots; docs/evidence lưu minh chứng. File .gitignore loại trừ .env, private key, backup SQL, node_modules và file log vì chúng chứa mật khẩu hoặc dữ liệu vận hành.'),

  H2('2.2. Ba commit mốc và quy trình quản lý thay đổi'),
  ...Tbl(['Mốc', 'Hash', 'Nội dung chính'], [
    ['Commit 1', 'e5fb867', 'Ứng dụng Expense Tracker, PostgreSQL, pgAdmin, Nginx reverse proxy, HTTPS và hardening cơ bản'],
    ['Commit 2', '158cfb2', 'Prometheus, Grafana, cAdvisor, nginx-exporter, postgres-exporter, dashboard và alert rules'],
    ['Commit 3', '44a5fce', 'Loki, Promtail, datasource Loki và các truy vấn LogQL'],
  ], [2.5, 2.5, 11], { caption: 'Bảng 2.1. Ba commit mốc theo yêu cầu đề bài' }),
  ...Fig('h2-2-github-commits.png', 'Hình 2.2. Lịch sử commit trên nhánh main'),
  P('Ba commit mốc có tập tin và nội dung kỹ thuật riêng, tương ứng tiến trình được yêu cầu. Các chỉnh sửa phát hiện khi chạy thật (cAdvisor trên Docker Desktop, header lặp, script TLS trên Git Bash, mật khẩu cho pg_dump) được ghi ở các commit tiếp theo kèm mô tả rõ nguyên nhân, không sửa lại lịch sử để tạo minh chứng giả. Hash đầy đủ có thể kiểm tra trực tiếp trên GitHub.'),
  ...Code(['git log --oneline', 'git check-ignore .env certs/server.key backups/expense-20261023-141119.sql', 'git ls-remote origin refs/heads/main']),

  H2('2.3. Đóng gói và khởi chạy bằng Docker Compose'),
  P('Dockerfile dùng image node:24-alpine, cài dependencies bằng npm ci từ package-lock.json để tái lập đúng phiên bản, copy source, views, public rồi chuyển sang USER node trước khi chạy server. Ứng dụng kết nối PostgreSQL thật bằng pg; không dùng dữ liệu giả trong container triển khai. Bộ test HTTP có repository thay thế chỉ phục vụ kiểm thử độc lập.'),
  ...Code([
    'FROM node:24-alpine', 'ENV NODE_ENV=production', 'WORKDIR /app',
    'COPY package.json package-lock.json ./', 'RUN npm ci --omit=dev --no-audit --no-fund',
    'COPY src ./src', 'COPY views ./views', 'COPY public ./public',
    'RUN mkdir -p /app/logs && chown -R node:node /app', 'USER node', 'CMD ["node", "src/server.js"]',
  ]),
  P('Hệ thống được tách thành bốn file Compose tương ứng ba giai đoạn và một override TLS. Script setup sinh mật khẩu ngẫu nhiên bằng bộ sinh số mật mã và từ chối ghi đè .env đã có. Compose wrapper ghép đúng các file theo giai đoạn để không gõ nhầm.'),
  ...Code([
    'sh scripts/setup.sh                      # sinh .env',
    'sh scripts/compose.sh 1 up -d --build    # app + postgres + pgadmin + nginx',
    'sh scripts/compose.sh 2 up -d --build    # + cadvisor, exporters, prometheus, grafana',
    'sh scripts/compose.sh 3 up -d --build    # + loki, promtail',
    'sh scripts/tls.sh && sh scripts/compose.sh tls up -d   # bat HTTPS tu ky',
  ]),
  P('PostgreSQL có healthcheck pg_isready. App chỉ khởi động sau khi database healthy và init-perms đã chuẩn bị quyền volume (depends_on với condition service_healthy và service_completed_successfully). Nginx chờ app healthy. Trong lần thực nghiệm, 11 container ở trạng thái Up, các dịch vụ có healthcheck đều healthy, hai container init Exited (0).'),
  ...Fig('compose-ps-terminal.png', 'Hình 2.3. Kết quả docker compose up và ps -a trong Git Bash', { scale: 0.8, maxH: 400 }),

  H2('2.4. Cơ sở dữ liệu của ứng dụng'),
  ...Tbl(['Bảng', 'Nội dung lưu trữ'], [
    ['users', 'Tài khoản đăng nhập: username, password_hash (scrypt), display_name'],
    ['categories', 'Danh mục thu/chi: name, kind (income/expense), color; unique (name, kind)'],
    ['transactions', 'Giao dịch: category_id, kind, amount (numeric 14,2 > 0), occurred_on, note, user_id; index theo ngày và danh mục'],
    ['sessions', 'Phiên đăng nhập theo định dạng connect-pg-simple: sid, sess, expire; index trên expire'],
  ], [3, 13], { caption: 'Bảng 2.2. Các bảng trong database expense' }),
  P('Schema và dữ liệu mẫu (10 danh mục, 17 giao dịch của ba tháng gần nhất) được tạo tự động lần đầu bởi entrypoint của PostgreSQL. Script 02-roles.sh tạo hai tài khoản: expense_app chỉ có SELECT, INSERT, UPDATE, DELETE trên các bảng và quyền dùng sequence; expense_exporter chỉ có vai trò pg_monitor. Quyền CREATE trên schema public bị thu hồi khỏi PUBLIC. Tài khoản postgres chỉ dùng cho pgAdmin và backup. Khi bảng users còn trống, ứng dụng tạo tài khoản admin từ biến môi trường với mật khẩu dài ít nhất 12 ký tự.'),

  H2('2.5. Giao diện và chức năng ứng dụng'),
  ...Fig('h2-4-web-login.png', 'Hình 2.4. Trang đăng nhập có CSRF token', { maxH: 280 }),
  P('Route /login cung cấp biểu mẫu có CSRF token ẩn. Khi nhập sai mật khẩu, ứng dụng trả HTTP 401 và ghi sự kiện login_failed vào log JSON; sai quá 5 lần trong 5 phút trả 429 và ghi login_rate_limited. Khi đúng, session được regenerate để chống session fixation rồi lưu vào bảng sessions của PostgreSQL. Mật khẩu được băm bằng scrypt với salt ngẫu nhiên 16 byte và so sánh bằng timingSafeEqual.'),
  ...Fig('h2-3-web-dashboard.png', 'Hình 2.5. Trang tổng quan: tổng thu, tổng chi, xu hướng sáu tháng, chi nhiều nhất và giao dịch gần đây'),
  P('Trang tổng quan đọc dữ liệu tháng hiện tại từ PostgreSQL: tổng thu, tổng chi, chênh lệch, số giao dịch, năm danh mục chi nhiều nhất và tám giao dịch gần nhất. Biểu đồ xu hướng sáu tháng được vẽ bằng SVG ngay trong EJS, không dùng thư viện ngoài nên tuân thủ Content-Security-Policy default-src self.'),
  ...Fig('h2-5-web-transactions.png', 'Hình 2.6. Trang giao dịch: biểu mẫu thêm, danh sách lọc theo tháng, nút sửa và xóa'),
  P('Trang giao dịch cho phép thêm giao dịch mới, lọc theo tháng và loại, phân trang 20 dòng, sửa và xóa. Loại thu hay chi được lấy theo danh mục để tránh nhập lệch. Mọi thao tác ghi đều cần CSRF token hợp lệ; dữ liệu đầu vào được kiểm tra số tiền dương, định dạng ngày, danh mục tồn tại và độ dài ghi chú. Trong ca thực nghiệm đã thêm giao dịch "Mua máy tính" 5.000.000 đồng, sửa "Tiền thuê phòng" từ 3.500.000 thành 3.600.000 đồng và tạo rồi xóa một bản ghi thử; các thay đổi này xuất hiện ngay trong pgAdmin ở mục 2.6.'),
  ...Fig('h2-6-web-reports.png', 'Hình 2.7. Trang báo cáo theo tháng: chi và thu theo danh mục, xu hướng sáu tháng', { maxH: 360 }),
  P('Trang báo cáo tổng hợp theo tháng được chọn: tổng thu, tổng chi, tiết kiệm, tỷ lệ chi trên thu, phân bổ chi và thu theo danh mục kèm phần trăm, cùng bảng sáu tháng gần nhất. Các truy vấn dùng SUM, GROUP BY và date_trunc của PostgreSQL với tham số hóa.'),

  H2('2.6. Kiểm tra PostgreSQL bằng pgAdmin'),
  ...Fig('pgadmin-statistics.png', 'Hình 2.8. pgAdmin kết nối PostgreSQL và hiển thị thống kê bốn bảng của database expense'),
  P('pgAdmin được truy cập tại http://localhost:8081, server "Expense PostgreSQL (De 38)" được khai báo sẵn qua servers.json và kết nối service postgres trong mạng database. Tab Statistics cho thấy bốn bảng với số dòng thực: categories 10, transactions 18 (17 mẫu cộng 1 giao dịch thêm từ web), users 1, sessions 1. Cổng pgAdmin chỉ bind 127.0.0.1; PostgreSQL không publish cổng ra host.'),
  ...Fig('pgadmin-query.png', 'Hình 2.9. Truy vấn JOIN trong Query Tool: giao dịch thêm trên web nằm trong PostgreSQL', { scale: 0.9 }),
  P('Kết quả truy vấn cho thấy giao dịch "Mua máy tính" và giá trị "Tiền thuê phòng" đã sửa nằm cùng dữ liệu thật trong PostgreSQL, không chỉ tồn tại trên giao diện. Khi đăng nhập pgAdmin bằng tài khoản expense_app, các chức năng tạo hay xóa bảng bị giới hạn vì tài khoản này không có CREATE/ALTER/DROP; đây là kết quả phân quyền có chủ đích.'),
];

const phan3 = [
  H1('PHẦN 3. NGINX VÀ HARDENING HỆ THỐNG'),
  H2('3.1. Reverse proxy và security headers'),
  P('Nginx là điểm tiếp nhận lưu lượng duy nhất của website trên host. App chỉ expose cổng nội bộ 3000 và không có ánh xạ cổng ra ngoài. Nginx dùng image unprivileged chạy UID 101, cấu hình pid và thư mục tạm trong /tmp để root filesystem có thể đặt chỉ đọc. Trong mạng web, Nginx dùng DNS service app để chuyển tiếp request kèm các header Host, X-Real-IP, X-Forwarded-For và X-Forwarded-Proto.'),
  ...Code([
    'location / {', '  proxy_pass http://app_upstream;', '  proxy_hide_header X-Content-Type-Options;',
    '  proxy_hide_header X-Frame-Options;', '  proxy_hide_header Referrer-Policy;', '  proxy_hide_header Strict-Transport-Security;',
    '  proxy_set_header Host $host;', '  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '  proxy_set_header X-Forwarded-Proto $scheme;', '}',
  ]),
  P('Trong lượt kiểm tra đầu, một số security headers bị lặp vì Helmet trong ứng dụng và Nginx cùng trả chúng, và X-Frame-Options có hai giá trị khác nhau (SAMEORIGIN và DENY). Cấu hình được chỉnh để Nginx ẩn bản từ upstream và giữ giá trị duy nhất, đồng thời Helmet được đặt frameguard deny cho thống nhất. Content-Security-Policy tiếp tục do ứng dụng tạo vì phụ thuộc vào nội dung trang.'),
  ...Tbl(['Header', 'Giá trị đã kiểm tra', 'Mục đích'], [
    ['X-Content-Type-Options', 'nosniff', 'Hạn chế suy đoán kiểu nội dung'],
    ['X-Frame-Options', 'DENY', 'Chặn nhúng trang vào frame (clickjacking)'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin', 'Giảm thông tin referrer sang origin khác'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()', 'Tắt API nhạy cảm của trình duyệt'],
    ['Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; ...", 'Giới hạn nguồn script, style, ảnh'],
    ['Strict-Transport-Security', 'max-age=86400; includeSubDomains', 'Bật trong chế độ HTTPS'],
  ], [4.5, 6, 5.5], { caption: 'Bảng 3.1. Security headers trả về qua Nginx' }),
  P('Nginx ẩn phiên bản bằng server_tokens off, giới hạn request body 16 KB, đặt timeout đọc header và body 10 giây, và có stub_status riêng tại cổng 8082 chỉ cho phép dải địa chỉ mạng Docker. Cổng status không publish ra host; nginx-exporter truy cập nội bộ để lấy chỉ số kết nối và request.'),

  H2('3.2. HTTPS tự ký và cookie bảo mật'),
  P('Hệ thống dùng chứng chỉ RSA 3072 bit, SHA-256, hiệu lực 30 ngày, SAN gồm localhost và 127.0.0.1. Nginx hỗ trợ TLS 1.2 và 1.3 với bộ mã ECDHE, lắng nghe cổng 8443. Khối HTTP ở cổng 8080 trả 301 sang https://localhost:8443. Chứng chỉ và private key nằm trong thư mục certs được .gitignore loại trừ. File compose.tls.yaml ghi đè COOKIE_SECURE=true cho app và mount chứng chỉ chỉ đọc vào Nginx.'),
  ...Code([
    'sh scripts/tls.sh', 'sh scripts/compose.sh tls up -d',
    'sh scripts/smoke.sh https://127.0.0.1:8443 certs/server.crt   # dung chinh server.crt lam CA',
  ]),
  ...Fig('web-reports-https.png', 'Hình 3.1. Website truy cập qua HTTPS cổng 8443; trình duyệt cảnh báo vì chứng chỉ tự ký', { scale: 0.95 }),
  ...Tbl(['Ca kiểm tra HTTPS', 'Kết quả thực tế'], [
    ['GET http://127.0.0.1:8080/', 'HTTP 301, Location https://127.0.0.1:8443/'],
    ['GET /health qua TLS', 'HTTP 200, status UP, database CONNECTED'],
    ['Smoke test với server.crt làm CA', '16/16 PASS: headers, 404, access control, CSRF, đăng nhập sai/đúng, cookie'],
    ['Cookie expense.sid', 'Secure=TRUE, HttpOnly, SameSite=Lax'],
    ['Truy cập /transactions không có session', 'HTTP 302 về /login, ghi access_denied'],
    ['POST /login thiếu CSRF token', 'HTTP 403, ghi csrf_denied'],
    ['Header Server', 'Chỉ "nginx", không lộ phiên bản'],
  ], [6.5, 9.5], { caption: 'Bảng 3.2. Kết quả kiểm tra HTTPS và kiểm soát truy cập' }),
  P('Chứng chỉ tự ký phù hợp buổi demo tại localhost nên trình duyệt hiển thị "Không bảo mật" dù kết nối đã mã hóa. Để vận hành công khai cần tên miền, chứng chỉ do CA tin cậy cấp và quy trình gia hạn. Smoke test không tắt xác minh chứng chỉ mà dùng chính server.crt làm CA cục bộ, nhờ đó kiểm tra được cả chuỗi tin cậy.'),

  H2('3.3. Bảo vệ tài khoản và dữ liệu ứng dụng'),
  ...Bullets([
    'Mật khẩu băm scrypt (N=16384, r=8, p=1) với salt ngẫu nhiên 16 byte; so sánh bằng timingSafeEqual để tránh timing attack.',
    'Session lưu trong PostgreSQL, thời hạn một giờ, gia hạn khi hoạt động, tự dọn phiên hết hạn mỗi 5 phút; regenerate khi đăng nhập; hủy khi đổi mật khẩu.',
    'CSRF token theo mẫu synchronizer token cho mọi POST; thiếu hoặc sai trả 403.',
    'Giới hạn đăng nhập sai 5 lần trong 5 phút theo cặp IP và username, trả 429 kèm sự kiện login_rate_limited.',
    'Kiểm tra đầu vào: số tiền dương tối đa 10^12, ngày đúng định dạng, danh mục tồn tại, tên danh mục 2–64 ký tự, mã màu #RRGGBB, ghi chú tối đa 255 ký tự.',
    'Toàn bộ SQL dùng tham số $1, $2…; EJS escape khi hiển thị; test tự động xác nhận ghi chú chứa thẻ script được escape.',
    'Logger không ghi body, mật khẩu, cookie hay session id; chỉ ghi sự kiện, đường dẫn, mã trạng thái, IP và username.',
  ]),

  H2('3.4. Hardening container, mạng và cơ sở dữ liệu'),
  ...Tbl(['Biện pháp', 'Cấu hình và kết quả kiểm chứng'], [
    ['Non-root', 'App: uid=1000(node); Nginx: uid=101(nginx); Loki/Promtail: 10001 (kết quả docker compose exec … id)'],
    ['Root filesystem chỉ đọc', 'App và Nginx ReadonlyRootfs=true; ghi log qua volume, /tmp qua tmpfs'],
    ['Giảm quyền tiến trình', 'cap_drop=[ALL], no-new-privileges=true cho app, nginx, exporters, prometheus, grafana, loki, promtail; PostgreSQL chỉ thêm 5 cap cần thiết'],
    ['Cô lập database', 'Mạng de38-expense_database Internal=true; PortBindings của postgres rỗng'],
    ['Giới hạn phạm vi truy cập host', 'Website, pgAdmin, Prometheus, Grafana bind 127.0.0.1'],
    ['Least privilege PostgreSQL', 'expense_app: SELECT, INSERT, UPDATE, DELETE trên 4 bảng; expense_exporter: pg_monitor; REVOKE CREATE ON SCHEMA public'],
    ['Xác thực mạnh', 'POSTGRES_INITDB_ARGS bật scram-sha-256 cho cả kết nối host và local'],
    ['Secrets riêng', 'Mật khẩu hex 24–64 ký tự sinh ngẫu nhiên; .env, server.key, backup không vào Git'],
    ['Giới hạn tài nguyên', 'App giới hạn 256 MB RAM; request body 16 KB'],
  ], [4.5, 11.5], { caption: 'Bảng 3.3. Các biện pháp hardening và minh chứng' }),
  ...Code([
    'docker compose exec app id        # uid=1000(node) gid=1000(node)',
    'docker inspect -f "{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}}" de38-expense-app-1   # true [ALL]',
    'docker network inspect -f "{{.Internal}}" de38-expense_database   # true',
  ]),
  P('Không phải mọi container có cùng mức hạn chế. Init containers cần root để chown volume rồi thoát; cAdvisor dùng privileged và mount hệ thống để đọc metrics; pgAdmin chạy user riêng nhưng không cap_drop vì entrypoint cần thêm quyền; tài khoản exporter có quyền đọc thống kê toàn cụm theo vai trò pg_monitor. Các ngoại lệ này được nêu rõ thay vì khẳng định toàn bộ hệ thống ở cùng một mức.'),
];

const phan4 = [
  H1('PHẦN 4. GIÁM SÁT VÀ LOG TẬP TRUNG'),
  H2('4.1. Cấu hình Prometheus và các exporter'),
  P('Prometheus thu metrics theo mô hình pull với scrape_interval và evaluation_interval 15 giây, giữ dữ liệu 7 ngày trong volume riêng. Bốn job được khai báo tĩnh theo tên service trong mạng monitoring. Alert rules kiểm tra target mất kết nối (up == 0), pg_up == 0, nginx_up == 0, container dùng quá 400 MB RAM và PostgreSQL vượt 50 kết nối; bài chưa tích hợp Alertmanager để gửi thông báo ra ngoài.'),
  ...Code([
    'scrape_configs:',
    '  - job_name: prometheus',
    '    static_configs: [{ targets: ["prometheus:9090"] }]',
    '  - job_name: cadvisor',
    '    static_configs: [{ targets: ["cadvisor:8080"] }]',
    '  - job_name: nginx',
    '    static_configs: [{ targets: ["nginx-exporter:9113"] }]',
    '  - job_name: postgres',
    '    static_configs: [{ targets: ["postgres-exporter:9187"] }]',
  ]),
  ...Fig('h4-1-prometheus-targets.png', 'Hình 4.1. Bốn targets Prometheus ở trạng thái UP'),
  P('API /api/v1/targets xác nhận cả bốn job đều UP; truy vấn nginx_up và pg_up bằng 1 chứng tỏ exporter còn kết nối được dịch vụ đích; cAdvisor nhìn thấy 11 container của stack, khớp với docker compose ps.'),

  H2('4.2. Dashboard Grafana và dữ liệu container, web, database'),
  ...Fig('h4-2-grafana-dashboard.png', 'Hình 4.2. Dashboard Expense Tracker – Containers, Web, Database trong folder De 38', { maxH: 430 }),
  P('Grafana được provision tự động datasource Prometheus (uid prometheus) và dashboard từ JSON, không cần thao tác tay. Dashboard có 13 panel: bốn stat phía trên (Targets UP = 4, Nginx UP = 1, PostgreSQL UP = 1, số kết nối database), CPU và RAM theo container, network RX/TX, request/giây và kết nối đang hoạt động của Nginx, transactions/giây và rows fetched/inserted/updated/deleted của PostgreSQL, kích thước database, tổng request qua Nginx và số container đang chạy.'),
  ...Tbl(['PromQL', 'Ý nghĩa', 'Giá trị lúc lấy mẫu'], [
    ['count(up == 1)', 'Số target scrape thành công', '4'],
    ['nginx_up / pg_up', 'Exporter kết nối được Nginx / PostgreSQL', '1 / 1'],
    ['sum(rate(nginx_http_requests_total[2m]))', 'Tốc độ request qua Nginx', 'Khoảng 0,40 request/giây'],
    ['sum(pg_stat_database_numbackends{datname="expense"})', 'Kết nối PostgreSQL đang mở', '3'],
    ['count(container_last_seen{name=~"de38-expense-.*"})', 'Container của stack mà cAdvisor thấy', '11'],
    ['sum by (name)(rate(container_cpu_usage_seconds_total[2m]))*100', 'CPU mỗi container, % của một lõi', 'Dưới 2% mỗi container'],
  ], [7, 5.5, 3.5], { caption: 'Bảng 4.1. Các truy vấn PromQL và giá trị quan sát' }),
  P('Đồ thị CPU tính theo phần trăm của một lõi nên container nhiều luồng có thể vượt 100%. RAM dùng working set bytes. Các con số trên là snapshot khi kiểm tra, không phải cam kết hiệu năng. Khi chạy script make-traffic, panel request/giây và rows fetched tăng rõ rệt như thấy ở cuối đồ thị.'),

  H2('4.3. Thiết kế hệ thống log tập trung'),
  P('Nginx ghi access log dạng JSON (escape=json) gồm thời gian ISO 8601, địa chỉ client, method, path, status, bytes, request_time, upstream_time và user agent. Ứng dụng ghi các sự kiện http_request, login_success, login_failed, login_rate_limited, csrf_denied, access_denied, transaction_created/updated/deleted, category_created/deleted vào app.log, mỗi dòng một JSON có time, level, service, event. Logger không ghi body, mật khẩu, cookie hay session id.'),
  ...Code([
    'scrape_configs:',
    '  - job_name: nginx-access',
    '    static_configs:',
    '      - targets: [localhost]',
    '        labels: { job: nginx, service: expense-tracker, __path__: /logs/nginx/access.log }',
    '    pipeline_stages:',
    '      - json: { expressions: { time: time, status: status } }',
    '      - timestamp: { source: time, format: RFC3339 }',
  ]),
  P('Promtail có thêm job nginx-error và application (nhãn job=app). Positions lưu vị trí đọc trong volume riêng để tiếp tục đúng offset khi restart. Hai volume log được mount :ro nên Promtail không thể sửa log nguồn. Loki chạy single binary với TSDB schema v13, lưu filesystem trong named volume, retention 7 ngày, auth_enabled false vì chỉ trong mạng nội bộ và không publish cổng; Grafana truy vấn qua datasource Loki (uid loki) được provision kèm.'),
  P('Promtail đã hết vòng đời hỗ trợ theo thông báo của Grafana Labs. Bài vẫn dùng Promtail vì đề yêu cầu rõ Loki + Promtail; hướng chuyển đổi dài hạn là Grafana Alloy với cùng mô hình nhãn.'),

  H2('4.4. LogQL xem log truy cập Nginx'),
  ...Code(['{job="nginx"}']),
  ...Fig('h4-4-logql-nginx.png', 'Hình 4.3. Truy vấn access log Nginx trên Grafana Explore', { maxH: 360 }),
  P('Selector job="nginx" chọn stream access log mà Promtail gắn nhãn. Mỗi dòng cho thấy thời điểm, method, path, status và thời gian xử lý của request thật đi qua reverse proxy. Khi demo cần đặt time range bao phủ thời điểm vừa tạo request; nếu không có kết quả, kiểm tra lần lượt file log nguồn, quyền đọc volume, trạng thái Promtail, endpoint push của Loki và nhãn job.'),

  H2('4.5. LogQL lọc request lỗi HTTP'),
  ...Code(['{job="nginx"} | json | status >= 400']),
  ...Fig('h4-5-logql-status-400.png', 'Hình 4.4. Lọc access log có mã HTTP từ 400 trở lên', { maxH: 360 }),
  P('Pipeline json giải mã các trường, sau đó so sánh trường status theo giá trị số. Kết quả gồm 404 của đường dẫn /not-found-demo, 403 do thiếu CSRF token hoặc chưa đăng nhập và 401 khi sai mật khẩu. Để điều tra sự cố, quản trị viên xem path và request_time rồi đối chiếu với log ứng dụng, thay vì coi mọi mã từ 400 trở lên đều là lỗi máy chủ.'),

  H2('4.6. LogQL tìm sự kiện đăng nhập thất bại'),
  ...Code(['{job="app"} | json | event="login_failed"']),
  ...Fig('h4-6-logql-login-failed.png', 'Hình 4.5. Sự kiện login_failed của ứng dụng trong Loki', { maxH: 360 }),
  P('Query chọn log ứng dụng, parse JSON và lọc đúng event login_failed. Ca thực nghiệm nhập sai mật khẩu với CSRF token hợp lệ, nhận HTTP 401 và tạo sự kiện tương ứng có username, IP và thời gian, không chứa mật khẩu đã nhập. Cần phân biệt sự kiện này với csrf_denied khi thiếu token và login_rate_limited khi vượt số lần thử; chúng giúp giải thích vì sao một lần đăng nhập bị từ chối.'),
  ...Tbl(['Query', 'Sự kiện tạo thử', 'Dòng trả về (limit 50, 2 giờ)'], [
    ['{job="nginx"}', 'Truy cập trang chủ, CSS, health, báo cáo', '50 (đạt giới hạn)'],
    ['{job="nginx"} | json | status >= 400', '404 demo, 403 CSRF/access control, 401', '50 (đạt giới hạn)'],
    ['{job="app"} | json | event="login_failed"', 'Đăng nhập sai có token hợp lệ', '10'],
  ], [6, 6, 4], { caption: 'Bảng 4.2. Kết quả ba truy vấn LogQL qua API của Loki' }),
];

const phan5 = [
  H1('PHẦN 5. KIỂM THỬ VẬN HÀNH VÀ ĐỐI CHIẾU'),
  H2('5.1. Kết quả kiểm thử chức năng và tích hợp'),
  ...Tbl(['Ca kiểm thử', 'Kết quả thực tế', 'Đánh giá'], [
    ['Unit và HTTP tests (node --test)', '12/12 pass: scrypt, validation, headers, redirect, CSRF 403, 401/302, rate limit 429, CRUD, escape XSS, 404, logout', 'Đạt'],
    ['Compose cấu hình', 'docker compose config hợp lệ cho cả 4 file; 14/14 service lên', 'Đạt'],
    ['Health và kết nối DB', '/health trả UP, database CONNECTED qua Nginx', 'Đạt'],
    ['Đăng nhập admin', 'Đúng mật khẩu vào tổng quan; sai mật khẩu 401 và sự kiện login_failed', 'Đạt'],
    ['CRUD thực tế', 'Thêm, sửa, xóa giao dịch và danh mục; dữ liệu lưu PostgreSQL, đối chiếu pgAdmin', 'Đạt'],
    ['Quyền truy cập và CSRF', 'Chưa đăng nhập 302 về /login; POST thiếu CSRF 403', 'Đạt'],
    ['Nginx và TLS', 'Smoke test HTTP 15/15 và HTTPS 16/16 PASS với CA cục bộ', 'Đạt'],
    ['Monitoring', '4 targets UP; nginx_up và pg_up = 1; 11 container có metrics', 'Đạt'],
    ['Logging', '3 LogQL query trả status success và có kết quả', 'Đạt'],
    ['Hardening', 'UID, read-only, cap_drop, mạng internal, PortBindings rỗng, grants được kiểm tra', 'Đạt'],
    ['Backup và phục hồi', 'Số dòng và checksum md5 ba bảng khớp giữa nguồn và bản phục hồi', 'Đạt'],
  ], [4.5, 9.5, 2], { caption: 'Bảng 5.1. Kết quả kiểm thử', center: [2] }),
  P('Tests độc lập dùng repository giả và MemoryStore nên không đủ để khẳng định PostgreSQL hoạt động. Vì vậy báo cáo bổ sung kiểm tra trên container thật bằng smoke test, thao tác trình duyệt, pgAdmin, API của Prometheus và Loki. Khi stack vừa khởi động, một số request hết thời gian chờ 15 giây do image đang tải; sau khi các dịch vụ healthy, toàn bộ kiểm tra đều PASS.'),

  H2('5.2. Backup, phục hồi và bảo toàn dữ liệu'),
  P('Script backup.sh chạy pg_dump trong container PostgreSQL và ghi file SQL vào thư mục backups nằm ngoài Git. Script restore-test.sh tạo database expense_restore_test riêng, từ chối nếu tên đó đã tồn tại, nhập dump, so sánh số dòng và checksum md5 của toàn bộ nội dung từng bảng rồi xóa database thử. Cách này không chạm vào database đang phục vụ website.'),
  ...Code(['sh scripts/backup.sh', 'sh scripts/restore-test.sh backups/expense-20261023-141119.sql']),
  ...Tbl(['Bảng', 'Số dòng nguồn', 'Số dòng phục hồi', 'Checksum md5 (khớp)'], [
    ['users', '1', '1', 'c52df0eb4342588aaaeac9a69ad0eccf'],
    ['categories', '10', '10', '38e74656b5f3a51548de4315a19a13f5'],
    ['transactions', '17', '17', 'f5210b16c40063f902160c7c89af83f6'],
  ], [3, 3, 3.2, 6.8], { caption: 'Bảng 5.2. Đối chiếu dữ liệu nguồn và bản phục hồi (lần backup 23/10/2026)', center: [1, 2] }),
  P('Bảng sessions thay đổi theo request nên không dùng làm tiêu chí dữ liệu ổn định. Sau khi build lại container app nhiều lần và bật TLS, các giao dịch vẫn còn trong PostgreSQL vì dữ liệu nằm trong named volume. Bài không dùng lệnh down -v; lệnh này xóa volume và chỉ dùng khi muốn làm lại từ đầu.'),

  H2('5.3. Các lỗi gặp và cách xử lý'),
  ...Tbl(['Hiện tượng', 'Nguyên nhân và cách xử lý'], [
    ['cAdvisor chỉ có series id="/" và log "failed to identify the read-write layer ID"', 'Docker Desktop dùng containerd image store (driver overlayfs), cAdvisor v0.52 không đọc được. Đổi sang ghcr.io/google/cadvisor:0.55.1'],
    ['Grafana không khởi động: "create mountpoint … read-only file system"', 'Mount thêm một file vào thư mục provisioning đã mount :ro. Mount cả thư mục datasources (Prometheus + Loki) thay thế'],
    ['X-Frame-Options trả SAMEORIGIN trong test, Strict-Transport-Security lặp hai lần', 'Helmet và Nginx cùng đặt header. Cấu hình Helmet frameguard deny và proxy_hide_header trên Nginx'],
    ['Script tls.sh lỗi "Can\'t open … for writing" trên Git Bash', 'OpenSSL của Windows không ghi được đường dẫn có dấu tiếng Việt và Git Bash đổi -subj thành đường dẫn. Tạo trong thư mục tạm, dùng cygpath và MSYS_NO_PATHCONV'],
    ['pg_dump và psql trong container hỏi mật khẩu rồi treo', 'auth-local=scram-sha-256 bắt buộc mật khẩu cả socket cục bộ. Script truyền PGPASSWORD từ biến môi trường của container'],
    ['CSS không tải khi mở http://localhost:8080', 'Helmet thêm upgrade-insecure-requests. Chỉ bật directive này khi COOKIE_SECURE=true'],
    ['Giao dịch "Lương" bị ghi là Chi', 'Biểu mẫu cho chọn loại độc lập với danh mục. Sửa để loại thu/chi lấy theo danh mục và cập nhật dữ liệu lệch'],
    ['Thống kê pgAdmin hiện Live tuples 0', 'Bộ đếm chưa cập nhật sau khi PostgreSQL khởi động lại. Chạy ANALYZE rồi làm mới'],
  ], [6, 10], { caption: 'Bảng 5.3. Lỗi gặp trong quá trình chạy thật và cách xử lý' }),

  H2('5.4. Đối chiếu yêu cầu và kịch bản demo'),
  ...Tbl(['Yêu cầu đề bài', 'Minh chứng trong báo cáo'], [
    ['Quản lý mã nguồn trên GitHub, tài khoản theo MSSV, 3 commit, README', 'Hình 2.1, 2.2; Bảng 2.1'],
    ['Ứng dụng web + PostgreSQL + pgAdmin', 'Hình 2.4 đến 2.9; Bảng 2.2'],
    ['Nginx reverse proxy, HTTPS hoặc security headers', 'Mục 3.1, 3.2; Hình 3.1; Bảng 3.1, 3.2'],
    ['Prometheus + Grafana giám sát container, web, DB', 'Hình 4.1, 4.2; Bảng 4.1'],
    ['Loki + Promtail, 2–3 truy vấn LogQL', 'Hình 4.3 đến 4.5; Bảng 4.2'],
    ['Hardening 3–4 biện pháp', 'Mục 3.3, 3.4; Bảng 3.3 (9 biện pháp)'],
    ['Báo cáo và demo hoàn chỉnh', 'Bìa thông tin sinh viên, kiến trúc, ảnh thật, kiểm thử, backup, bảng lỗi'],
  ], [8, 8], { caption: 'Bảng 5.4. Đối chiếu yêu cầu đề bài' }),
  P('Kịch bản demo bắt đầu bằng GitHub và README, chỉ rõ ba commit mốc và cấu trúc source. Tiếp theo mở website qua Nginx HTTPS, đăng nhập, thêm hoặc sửa một giao dịch và đối chiếu trong pgAdmin. Mở Prometheus Targets, xác nhận bốn job UP rồi trình bày các panel container, web và database trong Grafana. Phần log tạo một request 404 và một lần đăng nhập sai, sau đó chạy ba truy vấn LogQL trong Explore. Phần hardening trình bày UID của app, inspect mạng database và quyền của expense_app. Cuối cùng giải thích backup và phục hồi thử cùng kết quả checksum. Khi demo không mở .env, private key hoặc cửa sổ có mật khẩu lên màn hình.'),
];

const ketLuan = [
  H1('KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN'),
  P('Đề tài đã triển khai được hệ thống quản lý chi tiêu cá nhân trên Docker Compose, kết nối PostgreSQL và quản trị dữ liệu bằng pgAdmin. Nginx tiếp nhận truy cập qua reverse proxy, cung cấp HTTPS tự ký và security headers. Mã nguồn cùng cấu hình được đưa lên GitHub với tài khoản theo mã sinh viên, ba commit mốc có nội dung riêng và README hướng dẫn tái lập.'),
  P('Hệ thống giám sát thu được metrics của 11 container, Nginx và PostgreSQL. Prometheus có bốn targets UP; Grafana hiển thị dashboard với dữ liệu thực. Loki và Promtail tập trung log ứng dụng và Nginx; ba truy vấn LogQL trả về đúng loại sự kiện. Các biện pháp hardening được kiểm chứng bằng UID, inspect và quyền PostgreSQL. Backup được phục hồi vào database thử với số dòng và checksum khớp.'),
  P('Giới hạn của bài gồm một tài khoản quản trị, một instance ứng dụng, rate limit lưu trong bộ nhớ, chứng chỉ tự ký chỉ dùng demo, chưa có Alertmanager gửi cảnh báo ra ngoài, chưa quét CVE cho từng image, chưa kiểm thử tải kéo dài, chưa có CI/CD và log file chưa có rotation tự động. Ứng dụng chưa có tính năng nhiều người dùng với ngân sách riêng, xuất Excel hay nhắc nhở định kỳ.'),
  P('Hướng phát triển ưu tiên là bổ sung tài khoản cho từng thành viên gia đình và ngân sách theo danh mục, thêm Alertmanager với kênh thông báo, quét lỗ hổng image bằng Trivy trong CI, chuyển Promtail sang Grafana Alloy, dùng chứng chỉ CA tin cậy khi có tên miền và thêm log rotation. Với nhiều instance, cần rate limit chia sẻ trạng thái và cân bằng tải phía Nginx.'),
  P('Qua thực nghiệm, việc thấy container ở trạng thái Up chưa đủ để kết luận hệ thống hoạt động; cần kiểm tra lần lượt chức năng web, dữ liệu trong database, metrics, sự kiện trong log và quyền thực tế của tiến trình. Đó chính là nội dung cốt lõi của quy trình triển khai và quản trị mà đề tài hướng tới.'),
];

const taiLieu = [
  H1('TÀI LIỆU THAM KHẢO'),
  ...[
    ['[1]', 'Docker. Compose file reference. https://docs.docker.com/reference/compose-file/'],
    ['[2]', 'Docker. Control startup and shutdown order in Compose. https://docs.docker.com/compose/how-tos/startup-order/'],
    ['[3]', 'PostgreSQL Global Development Group. PostgreSQL 17 Documentation. https://www.postgresql.org/docs/17/'],
    ['[4]', 'pgAdmin Development Team. pgAdmin 4 Documentation. https://www.pgadmin.org/docs/'],
    ['[5]', 'Nginx. Module ngx_http_proxy_module. https://nginx.org/en/docs/http/ngx_http_proxy_module.html'],
    ['[6]', 'Prometheus. Querying basics (PromQL). https://prometheus.io/docs/prometheus/latest/querying/basics/'],
    ['[7]', 'Grafana Labs. LogQL: Log query language. https://grafana.com/docs/loki/latest/query/'],
    ['[8]', 'Grafana Labs. Promtail agent. https://grafana.com/docs/loki/latest/send-data/promtail/'],
    ['[9]', 'Google. cAdvisor – Analyzes resource usage of running containers. https://github.com/google/cadvisor'],
    ['[10]', 'Prometheus Community. postgres_exporter. https://github.com/prometheus-community/postgres_exporter'],
    ['[11]', 'OWASP. Cross-Site Request Forgery Prevention Cheat Sheet. https://cheatsheetseries.owasp.org/'],
    ['[12]', 'Hoàng Văn Tâm. Source và cấu hình Expense Tracker Đề 38. https://github.com/DTC245200419/Expense_Tracker_De38'],
  ].map(([n, t]) => new Paragraph({
    children: runs([{ text: `${n}\t`, bold: true }, t]), tabStops: [{ type: TabStopType.LEFT, position: 1 * CM }],
    indent: { left: 1 * CM, hanging: 1 * CM }, spacing: { after: 100, line: 300 }, alignment: AlignmentType.LEFT,
  })),
  Blank(),
  P('Tài liệu yêu cầu học phần: Đề 38 Hệ thống Quản lý Chi tiêu / Expense Tracker; yêu cầu chung gồm GitHub, Docker Compose, PostgreSQL/pgAdmin, Nginx reverse proxy, Prometheus/Grafana, Loki/Promtail/LogQL và hardening. Các kết quả thực nghiệm trong báo cáo được ghi ngày 23 và 24/10/2026.'),
];

// ---------- DOCUMENT ----------
const doc = new Document({
  creator: 'Hoàng Văn Tâm',
  title: 'Báo cáo Đề 38 – Hệ thống Quản lý Chi tiêu (Expense Tracker)',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: SZ } } },
    paragraphStyles: [
      // Giong file mau: Heading 1 18pt dam, Heading 2 16pt, Heading 3 14pt, mau den
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 36, bold: true, color: '000000' }, paragraph: { spacing: { before: 360, after: 80 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 32, bold: false, color: '000000' }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 28, bold: false, color: '000000' }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 1 * CM, hanging: 0.5 * CM } } } }] }],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 2 * CM, bottom: 2 * CM, left: 3 * CM, right: 1.5 * CM },
          // Khung vien trang bia (giong khung mau)
          borders: {
            pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE, zOrder: PageBorderZOrder.FRONT },
            pageBorderTop: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 24 },
            pageBorderBottom: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 24 },
            pageBorderLeft: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 24 },
            pageBorderRight: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 24 },
          },
        },
      },
      children: cover,
    },
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 2 * CM, bottom: 2 * CM, left: 3 * CM, right: 1.5 * CM }, pageNumbers: { start: 1 } },
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] }),
      },
      children: [
        ...loiNoiDau,
        ...mucLuc, ...phan1, ...phan2, ...phan3, ...phan4, ...phan5, ...ketLuan, ...taiLieu,
      ],
    },
  ],
});

// Heading "LỜI NÓI ĐẦU" khong can page break vi da sang section moi
doc.sections; // no-op

Packer.toBuffer(doc).then((buf) => {
  let target = OUT;
  try {
    fs.writeFileSync(target, buf);
  } catch (err) {
    if (err.code !== 'EACCES' && err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
    // File dang mo trong Word -> ghi sang ten khac
    target = OUT.replace(/\.docx$/, '_moi.docx');
    fs.writeFileSync(target, buf);
    console.log('File goc dang mo trong Word, da ghi sang file moi.');
  }
  console.log('Da tao', target, `${(buf.length / 1024 / 1024).toFixed(2)} MB`);
});
