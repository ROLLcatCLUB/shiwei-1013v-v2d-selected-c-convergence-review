const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const OUT_DIR = path.resolve(__dirname, "..");
const SCREENSHOT_DIR = path.join(OUT_DIR, "screenshots");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const HTML_FILE = "v2d_selected_C_converged_teacher_notebook_workbench.html";
const SOURCE_PATH = `outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY/${HTML_FILE}`;

const VIEWPORTS = [
  { id: "1366", width: 1366, height: 768, deviceScaleFactor: 1 },
  { id: "1600", width: 1600, height: 1000, deviceScaleFactor: 1 },
  { id: "2560", width: 2560, height: 1440, deviceScaleFactor: 1 }
];

const FORBIDDEN_TEACHER_TERMS = [
  "affected_fields",
  "downstream_dirty_fields",
  "preview_delta",
  "static only",
  "preview only",
  "preview_only",
  "formal_apply",
  "小教判断区"
];

const REQUIRED_RENDER_SLOTS = [
  "app-topbar",
  "render-stage",
  "active-render-layer",
  "left-unit-tree",
  "lesson-body",
  "teaching-process",
  "right-rail",
  "bottom-xiaojiao"
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function browserPath() {
  if (fs.existsSync(EDGE)) return EDGE;
  if (fs.existsSync(CHROME)) return CHROME;
  throw new Error("Neither Microsoft Edge nor Chrome was found for screenshot capture");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const rawPath = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
    const target = path.resolve(ROOT, path.normalize(rawPath));
    if (!target.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const ext = path.extname(target).toLowerCase();
      const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".png" ? "image/png" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

function requestJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${method} ${url} -> ${res.statusCode}: ${body.slice(0, 160)}`));
          return;
        }
        resolve(body ? JSON.parse(body) : {});
      });
    });
    req.on("error", reject);
    req.end();
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result || {});
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  waitForEvent(method, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const event = this.events.find((item) => item.method === method);
        if (event || Date.now() - started > timeoutMs) {
          clearInterval(timer);
          resolve(event || null);
        }
      }, 50);
    });
  }

  close() {
    try { this.ws.close(); } catch (_) {}
  }
}

async function waitForDebugger(port) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      return await requestJson(`http://127.0.0.1:${port}/json/version`);
    } catch (_) {
      await sleep(200);
    }
  }
  throw new Error("remote debugging endpoint did not start");
}

async function evaluate(client, expression) {
  return client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 15000
  });
}

function caseList() {
  return VIEWPORTS.map((viewport) => ({
    id: `v2d_selected_C_${viewport.id}`,
    direction: "C",
    source_path: SOURCE_PATH,
    screenshot: `screenshots/v2d_selected_C_${viewport.id}.png`,
    viewport
  }));
}

async function captureCase(client, staticPort, item) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: item.viewport.width,
    height: item.viewport.height,
    deviceScaleFactor: item.viewport.deviceScaleFactor,
    mobile: false
  });
  client.events = [];
  const url = `http://127.0.0.1:${staticPort}/${item.source_path}?review=v2d-capture-${item.viewport.id}`;
  await client.send("Page.navigate", { url });
  await client.waitForEvent("Page.loadEventFired", 18000);
  await sleep(2600);
  await evaluate(client, "document.fonts && document.fonts.ready ? document.fonts.ready : true").catch(() => {});
  await evaluate(client, "window.scrollTo(0, 0)");
  await sleep(300);

  const metricsResult = await evaluate(client, `(async () => {
    if (typeof window.__R220B_BIND_SHELL_LAYER_MARKERS__ === "function") window.__R220B_BIND_SHELL_LAYER_MARKERS__();
    const rect = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom)
      };
    };
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && r.width > 0 && r.height > 0;
    };
    const slot = (id) => {
      const node = typeof window.resolveRenderSlot === "function" ? window.resolveRenderSlot(id) : null;
      return node ? { found: true, rect: rect(node), text: (node.innerText || "").slice(0, 160) } : { found: false };
    };
    const layer = (id) => {
      const node = typeof window.resolveShellLayer === "function" ? window.resolveShellLayer(id) : null;
      return node ? { found: true, rect: rect(node) } : { found: false };
    };
    const visibleText = document.body?.innerText || "";
    const forbiddenVisible = ${JSON.stringify(FORBIDDEN_TEACHER_TERMS)}.filter((term) => visibleText.includes(term));
    const accessibleWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, template, [data-audit-only='true'], [hidden], [aria-hidden='true']")) return NodeFilter.FILTER_REJECT;
        const text = node.nodeValue || "";
        if (!text.trim()) return NodeFilter.FILTER_REJECT;
        let cursor = parent;
        while (cursor && cursor !== document.body) {
          const style = getComputedStyle(cursor);
          if (style.display === "none" || style.visibility === "hidden") return NodeFilter.FILTER_REJECT;
          cursor = cursor.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let accessibleText = "";
    while (accessibleWalker.nextNode()) accessibleText += accessibleWalker.currentNode.nodeValue + "\\n";
    const forbiddenAccessible = ${JSON.stringify(FORBIDDEN_TEACHER_TERMS)}.filter((term) => accessibleText.includes(term));

    const allToolButtons = Array.from(document.querySelectorAll("#toolRail .tool-btn"));
    const visibleToolButtons = allToolButtons.filter(visible);
    const visiblePrimaryButtons = Array.from(document.querySelectorAll("#toolRail .v2-tool-group[data-v2-tier='primary'] .tool-btn")).filter(visible);
    const toolRail = document.querySelector("#toolRail");
    const toolRailRect = rect(toolRail);
    const buttonRects = visibleToolButtons.map(rect).filter(Boolean);
    const rowBands = [];
    buttonRects.forEach((r) => {
      const existing = rowBands.find((y) => Math.abs(y - r.y) <= 6);
      if (existing === undefined) rowBands.push(r.y);
    });
    const toolRows = rowBands.length;
    const primaryData = visiblePrimaryButtons.map((button) => {
      const label = button.querySelector(".tool-label");
      const labelText = (label?.textContent || button.textContent || "").trim();
      const br = rect(button);
      const lr = rect(label);
      return {
        tool: button.getAttribute("data-tool") || "",
        text: labelText,
        button_rect: br,
        label_rect: lr,
        label_nowrap: label ? getComputedStyle(label).whiteSpace === "nowrap" : true,
        has_svg_icon: Boolean(button.querySelector("svg.v2b-tool-svg"))
      };
    });

    const rail = document.querySelector(".courseware-rail");
    const railActions = Array.from(document.querySelectorAll(".v2c-rail-actions button")).filter(visible);
    const impactItems = Array.from(document.querySelectorAll(".v2c-impact-list li")).filter(visible);
    const impactText = (document.querySelector(".v2c-impact-summary")?.innerText || "").trim();
    const bottom = document.querySelector(".xiaobei-chat-entry");
    const scene = document.querySelector(".nb-scene");
    const binder = document.querySelector(".nb-binder");
    const panel = document.querySelector(".nb-panel");
    const workspace = document.querySelector(".nb-workspace");
    const header = document.querySelector(".nb-workspace .nb-hero");
    const activeNode = document.querySelector(".nb-panel .nb-tree-button.active, .nb-panel [data-v2-current-lesson='true'], .nb-panel .nb-node.active");
    const quietNode = document.querySelector(".nb-panel .nb-tree-button:not(.active):not([data-v2-current-lesson='true']), .nb-panel .nb-node:not(.active)");
    const binderRect = rect(binder);
    const panelRect = rect(panel);
    const workspaceRect = rect(workspace);
    const bottomRect = rect(bottom);
    const sceneRect = rect(scene);
    const railRect = rect(rail);
    const notebookRim = binderRect && panelRect && workspaceRect ? {
      binder_to_panel: Math.round(binderRect.bottom - panelRect.bottom),
      binder_to_workspace: Math.round(binderRect.bottom - workspaceRect.bottom),
      binder_to_right_rail: railRect ? Math.round(railRect.bottom - binderRect.bottom) : null,
      binder_to_bottom_xiaojiao: bottomRect ? Math.round(bottomRect.y - binderRect.bottom) : null,
      binder_background_color: binder ? getComputedStyle(binder).backgroundColor : "",
      binder_border_bottom: binder ? getComputedStyle(binder).borderBottom : "",
      workspace_background_color: workspace ? getComputedStyle(workspace).backgroundColor : "",
      workspace_border_bottom: workspace ? getComputedStyle(workspace).borderBottom : ""
    } : {};
    const workspaceStyle = workspace ? getComputedStyle(workspace) : null;
    const canvasStyle = document.querySelector(".canvas-stage") ? getComputedStyle(document.querySelector(".canvas-stage")) : null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      title: document.title,
      current_shell: document.documentElement.getAttribute("data-r220b-current-shell") || document.body?.getAttribute("data-r220b-current-shell") || "",
      r220b_shell_binding: document.documentElement.getAttribute("data-r220b-shell-layer-slot-ownership-binding") || document.body?.getAttribute("data-r220b-shell-layer-slot-ownership-binding") || "",
      derived_v2_polish: document.documentElement.getAttribute("data-1013v-v2-r97b-polish") === "true",
      derived_v2a_polish: document.documentElement.getAttribute("data-1013v-v2a-2k-responsive") === "true",
      derived_v2b_polish: document.documentElement.getAttribute("data-1013v-v2b-full-width-toolbar") === "true",
      derived_v2c_polish: document.documentElement.getAttribute("data-1013v-v2c-visual-direction") === "true",
      derived_v2d_polish: document.documentElement.getAttribute("data-1013v-v2d-selected-c-convergence") === "true",
      primary_direction: document.documentElement.getAttribute("data-1013v-v2d-primary-direction") || "",
      stability_reference: document.documentElement.getAttribute("data-1013v-v2d-stability-reference") || "",
      v2d_derived_preview: document.body?.getAttribute("data-1013v-v2d-derived-preview") === "true",
      toolbar_policy: document.body?.getAttribute("data-1013v-v2d-toolbar-policy") || "",
      has_ownership_map: Boolean(window.__R220B_SHELL_SLOT_OWNERSHIP_MAP__),
      has_resolve_shell_layer: typeof window.resolveShellLayer === "function",
      has_resolve_render_slot: typeof window.resolveRenderSlot === "function",
      shell_layers: {
        app_shell: layer("app-shell"),
        workspace_shell: layer("workspace-shell"),
        render_surface: layer("render-surface"),
        lesson_content_renderer: layer("lesson-content-renderer"),
        right_rail: layer("right-rail"),
        bottom_xiaojiao: layer("bottom-xiaojiao")
      },
      render_slots: Object.fromEntries(${JSON.stringify(REQUIRED_RENDER_SLOTS)}.map((id) => [id.replace(/-/g, "_"), slot(id)])),
      layout: {
        scene: sceneRect,
        binder: binderRect,
        left_panel: panelRect,
        lesson_workspace: workspaceRect,
        lesson_header: rect(header),
        right_rail: railRect,
        bottom_xiaojiao: bottomRect,
        notebook_inner_bottom_rim: notebookRim,
        workspace_width_ratio: workspaceRect ? Number((workspaceRect.width / window.innerWidth).toFixed(3)) : null,
        scene_full_width: Boolean(sceneRect && sceneRect.x <= 42 && sceneRect.right >= window.innerWidth - 80),
        right_rail_reaches_right: Boolean(railRect && railRect.right >= window.innerWidth - 260)
      },
      visual_contract: {
        toolbar_kept_expanded: toolRail?.getAttribute("data-v2d-toolbar-kept-expanded") === "true",
        toolbar_rows: toolRows,
        toolbar_rect: toolRailRect,
        total_tool_buttons: allToolButtons.length,
        visible_tool_buttons: visibleToolButtons.length,
        visible_primary_buttons: primaryData,
        visible_primary_count: visiblePrimaryButtons.length,
        primary_all_single_line: primaryData.every((item) => item.text && item.label_nowrap && item.button_rect && item.button_rect.height <= 38 && (!item.label_rect || item.label_rect.height <= 19)),
        primary_all_svg_icons: primaryData.every((item) => item.has_svg_icon),
        paper_grid_background: workspaceStyle?.backgroundImage || "",
        canvas_grid_background: canvasStyle?.backgroundImage || "",
        paper_background_color: workspaceStyle?.backgroundColor || "",
        left_panel_opacity: panel ? Number(getComputedStyle(panel).opacity) : null,
        quiet_left_node_opacity: quietNode ? Number(getComputedStyle(quietNode).opacity) : null,
        active_left_node_opacity: activeNode ? Number(getComputedStyle(activeNode).opacity) : null,
        right_rail_summary_present: Boolean(document.querySelector(".v2c-impact-summary[data-v2d-teacher-margin-note='true']")),
        right_rail_summary_item_count: impactItems.length,
        right_rail_action_count: railActions.length,
        right_rail_copy_ok: impactText.includes("这份教案将影响") && impactText.includes("课堂大屏") && impactText.includes("学习单") && impactText.includes("评价点"),
        bottom_system_bar: bottom?.getAttribute("data-v2d-system-intent-bar") === "true",
        bottom_height: bottomRect?.height || 0,
        xiaojiao_placeholder: document.querySelector(".chat-input")?.getAttribute("placeholder") || ""
      },
      forbidden_visible_terms: forbiddenVisible,
      forbidden_accessible_terms: forbiddenAccessible,
      body_text_sample: visibleText.slice(0, 1000)
    };
  })()`);

  const metrics = metricsResult.result.value;
  const screenshotResult = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  const screenshotPath = path.join(OUT_DIR, item.screenshot);
  fs.writeFileSync(screenshotPath, Buffer.from(screenshotResult.data, "base64"));
  const screenshotSize = pngSize(screenshotPath);

  const shellLayersFound = Object.values(metrics.shell_layers).every((entry) => entry.found);
  const renderSlotsFound = Object.values(metrics.render_slots).every((entry) => entry.found);
  const vc = metrics.visual_contract;
  const rim = metrics.layout.notebook_inner_bottom_rim || {};
  const widePass = item.viewport.width < 1800 || (
    metrics.layout.scene_full_width === true &&
    metrics.layout.right_rail_reaches_right === true &&
    metrics.layout.lesson_workspace &&
    metrics.layout.lesson_workspace.width >= (item.viewport.width >= 2400 ? 1350 : 980)
  );
  const notebookRimOk =
    rim.binder_to_panel >= 12 &&
    rim.binder_to_workspace >= 12 &&
    rim.binder_to_bottom_xiaojiao >= 18 &&
    typeof rim.binder_border_bottom === "string" &&
    rim.binder_border_bottom.includes("rgba(95, 84, 56");
  const pass = metrics.current_shell === "R97B" &&
    metrics.r220b_shell_binding === "true" &&
    metrics.derived_v2_polish === true &&
    metrics.derived_v2a_polish === true &&
    metrics.derived_v2b_polish === true &&
    metrics.derived_v2c_polish === true &&
    metrics.derived_v2d_polish === true &&
    metrics.primary_direction === "C_NOTEBOOK_PAPER" &&
    metrics.stability_reference === "A_TEACHER_WORKBENCH" &&
    metrics.v2d_derived_preview === true &&
    metrics.toolbar_policy === "kept-expanded-by-human-request" &&
    metrics.has_ownership_map === true &&
    metrics.has_resolve_shell_layer === true &&
    metrics.has_resolve_render_slot === true &&
    shellLayersFound &&
    renderSlotsFound &&
    metrics.forbidden_visible_terms.length === 0 &&
    metrics.forbidden_accessible_terms.length === 0 &&
    screenshotSize.width === item.viewport.width &&
    screenshotSize.height === item.viewport.height &&
    fs.statSync(screenshotPath).size > 25000 &&
    vc.toolbar_kept_expanded === true &&
    vc.visible_tool_buttons >= 10 &&
    vc.toolbar_rows <= 2 &&
    vc.primary_all_single_line === true &&
    vc.primary_all_svg_icons === true &&
    vc.paper_grid_background.includes("rgba(46, 101, 78") &&
    vc.paper_grid_background.includes("0.02") &&
    vc.canvas_grid_background.includes("rgba(99, 103, 76") &&
    vc.canvas_grid_background.includes("0.02") &&
    vc.paper_background_color === "rgb(255, 253, 247)" &&
    vc.left_panel_opacity <= 0.76 &&
    vc.quiet_left_node_opacity <= 0.55 &&
    vc.active_left_node_opacity >= 0.98 &&
    vc.right_rail_summary_present === true &&
    vc.right_rail_summary_item_count === 3 &&
    vc.right_rail_action_count <= 2 &&
    vc.right_rail_copy_ok === true &&
    vc.bottom_system_bar === true &&
    vc.bottom_height >= 56 &&
    vc.bottom_height <= 64 &&
    notebookRimOk &&
    widePass;

  return {
    ...item,
    url,
    screenshot_bytes: fs.statSync(screenshotPath).size,
    screenshot_dimensions: screenshotSize,
    dom_metrics: metrics,
    pass
  };
}

async function main() {
  ensureDir(SCREENSHOT_DIR);
  const staticServer = await startStaticServer();
  const staticPort = staticServer.address().port;
  const browserPort = await getFreePort();
  const profileDir = path.join(OUT_DIR, ".browser-profile");
  fs.rmSync(profileDir, { recursive: true, force: true });
  const browser = spawn(browserPath(), [
    "--headless=new",
    `--remote-debugging-port=${browserPort}`,
    `--user-data-dir=${profileDir}`,
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });

  const manifest = {
    stage: "1013V_VISUAL_SYSTEM_POLISH_LINE",
    phase: "V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY",
    build_stage: "1013V_V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY",
    current_visual_baseline: "R97B",
    human_selected_direction: "C_NOTEBOOK_PAPER",
    stability_reference: "A_TEACHER_WORKBENCH",
    toolbar_policy: "kept-expanded-by-human-request",
    formal_apply: "NOT_READY",
    source_v2c_modified: false,
    started_at: new Date().toISOString(),
    cases: []
  };

  let client = null;
  try {
    await waitForDebugger(browserPort);
    const targets = await requestJson(`http://127.0.0.1:${browserPort}/json`);
    const page = targets.find((target) => target.type === "page") || targets[0];
    client = new CDPClient(page.webSocketDebuggerUrl);
    await client.open();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    for (const item of caseList()) {
      const result = await captureCase(client, staticPort, item);
      manifest.cases.push(result);
    }
  } finally {
    if (client) client.close();
    try { browser.kill(); } catch (_) {}
    staticServer.close();
  }

  manifest.finished_at = new Date().toISOString();
  manifest.case_count = manifest.cases.length;
  manifest.fail_count = manifest.cases.filter((item) => !item.pass).length;
  manifest.pass = manifest.fail_count === 0 && manifest.case_count === VIEWPORTS.length;

  fs.writeFileSync(path.join(OUT_DIR, "screenshot_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "visual_smoke_result.json"), JSON.stringify({
    visual_smoke_completed: true,
    stage: manifest.stage,
    phase: manifest.phase,
    case_count: manifest.case_count,
    fail_count: manifest.fail_count,
    pass: manifest.pass,
    screenshots: manifest.cases.map((item) => item.screenshot)
  }, null, 2), "utf8");

  console.log(JSON.stringify({
    pass: manifest.pass,
    case_count: manifest.case_count,
    fail_count: manifest.fail_count,
    cases: manifest.cases.map((item) => ({
      id: item.id,
      pass: item.pass,
      screenshot: item.screenshot,
      visible_tools: item.dom_metrics.visual_contract.visible_tool_buttons,
      toolbar_rows: item.dom_metrics.visual_contract.toolbar_rows,
      right_rail_actions: item.dom_metrics.visual_contract.right_rail_action_count,
      bottom_height: item.dom_metrics.visual_contract.bottom_height,
      binder_to_workspace: item.dom_metrics.layout.notebook_inner_bottom_rim.binder_to_workspace
    }))
  }, null, 2));
  if (!manifest.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
