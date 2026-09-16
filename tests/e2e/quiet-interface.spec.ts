import { expect, test, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";

const CONTACT_ALIAS = "micah [at] nexusneural [dot] net";
const runtimeErrors = new WeakMap<Page, string[]>();

function app(page: Page) {
  return page.locator(".site-shell");
}

function terminal(page: Page) {
  return app(page).locator(".quiet-terminal");
}

function commandInput(page: Page) {
  return app(page).getByLabel("Terminal command");
}

function interfaceSurface(page: Page) {
  return app(page).locator(".quiet-interface");
}

function outputText(page: Page) {
  return app(page).locator(".quiet-terminal-output");
}

function phaseLabel(page: Page) {
  return app(page).locator(".quiet-terminal-chrome strong");
}

function commandHint(page: Page) {
  return app(page).locator(".quiet-terminal-hint");
}

function promptText(page: Page) {
  return app(page).locator(".quiet-terminal-prompt");
}

function canvas(page: Page) {
  return page.locator("canvas.quiet-canvas");
}

async function waitForTerminalReady(page: Page) {
  await expect(commandInput(page)).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 10_000 }).toBe("quiet-command-input");
}

async function waitForMilestone(page: Page) {
  await page.waitForTimeout(24);
  await expect(terminal(page)).not.toHaveAttribute("aria-busy", "true", { timeout: 5_000 });
}

async function submitCommand(page: Page, command: string) {
  const input = commandInput(page);
  await expect(input).not.toHaveAttribute("aria-disabled", "true", { timeout: 5_000 });
  await input.focus();
  await input.fill(command);
  await input.press("Enter");
  await expect(input).toHaveValue("");
}

async function runCommand(page: Page, command: string) {
  await submitCommand(page, command);
  await waitForMilestone(page);
}

async function buildBoundaryImage(page: Page, options: { wrongToken?: boolean; useHint?: boolean } = {}) {
  for (const command of ["systemctl start interface", "cat carrier", "cat trace"]) await runCommand(page, command);
  if (options.wrongToken) await runCommand(page, "echo dark > signal");
  if (options.useHint) await runCommand(page, "cat fragment");
  await runCommand(page, "echo lumen > signal");
  await runCommand(page, "make signal");
}

async function enterBoundary(page: Page, options: { wrongToken?: boolean; useHint?: boolean } = {}) {
  await buildBoundaryImage(page, options);
  for (const command of [
    "sha256sum -c boundary.img.sha256",
    "mount -o ro boundary.img /mnt/boundary",
    "cd /mnt/boundary/inside"
  ]) {
    await runCommand(page, command);
  }
}

async function completeRelease(page: Page, options: { wrongToken?: boolean; useHint?: boolean } = {}) {
  await enterBoundary(page, options);
  await runCommand(page, "./release");
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(8);
}

async function canvasPng(page: Page): Promise<Buffer> {
  const dataUrl = await canvas(page).evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error("quiet canvas is not a canvas element");
    return element.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function nonGroundPixels(image: Buffer): Promise<number> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let pixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (Math.abs(data[offset] - 2) + Math.abs(data[offset + 1] - 7) + Math.abs(data[offset + 2] - 5) > 12) pixels += 1;
  }
  return pixels;
}

async function changedPixels(first: Buffer, second: Buffer): Promise<number> {
  const firstRaw = await sharp(first).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const secondRaw = await sharp(second).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(firstRaw.info.width).toBe(secondRaw.info.width);
  expect(firstRaw.info.height).toBe(secondRaw.info.height);
  let changed = 0;
  for (let offset = 0; offset < firstRaw.data.length; offset += firstRaw.info.channels) {
    const difference =
      Math.abs(firstRaw.data[offset] - secondRaw.data[offset]) +
      Math.abs(firstRaw.data[offset + 1] - secondRaw.data[offset + 1]) +
      Math.abs(firstRaw.data[offset + 2] - secondRaw.data[offset + 2]);
    if (difference > 30) changed += 1;
  }
  return changed;
}

async function captureScene(page: Page, testInfo: TestInfo, name: string): Promise<Buffer> {
  await expect(canvas(page)).toHaveAttribute("data-scene", name);
  await page.waitForTimeout(60);
  const image = await canvasPng(page);
  await testInfo.attach(`scene-${name}`, { body: image, contentType: "image/png" });
  return image;
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitForTerminalReady(page);
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

test("quiet interface remains the complete default surface", async ({ page, isMobile }) => {
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(commandInput(page)).toBeFocused();
  await expect(outputText(page)).toContainText("mount: /surface [ro]");
  await expect(outputText(page)).toContainText("interface.service: inactive");
  await expect(app(page).locator("#selected-work")).toHaveCount(0);
  await expect(app(page).locator("a")).toHaveCount(0);
  await expect(canvas(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute("data-render-mode", isMobile ? "mobile" : "desktop");
  await expect(nonGroundPixels(await canvasPng(page))).resolves.toBeGreaterThan(isMobile ? 80 : 200);
  await expectNoHorizontalOverflow(page);
});

test("milestone commands set aria-busy and Escape settles them", async ({ page }) => {
  await submitCommand(page, "systemctl start interface");
  await expect(terminal(page)).toHaveAttribute("aria-busy", "true");
  await expect(commandInput(page)).toHaveAttribute("aria-disabled", "true");
  await commandInput(page).press("Escape");
  await expect(terminal(page)).toHaveAttribute("aria-busy", "false");
  await expect(commandInput(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(phaseLabel(page)).toHaveText("observing");
  await expect(canvas(page)).toHaveAttribute("data-scene", "observing");
});

test("Escape clears ordinary input and hidden shell responses remain intentional", async ({ page }) => {
  const input = commandInput(page);
  await input.fill("unsubmitted");
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await runCommand(page, "exit");
  await expect(outputText(page)).toContainText("no enclosing shell detected");
  await runCommand(page, "whoami");
  await expect(outputText(page)).toContainText("operator identity:");
  await runCommand(page, "sudo release");
  await expect(outputText(page)).toContainText("permission model rejected");
});

test("autocomplete, palette, history, clear, and invalid input work", async ({ page }) => {
  const input = commandInput(page);
  await input.fill("sys");
  await input.press("Tab");
  await expect(input).toHaveValue("systemctl start interface");
  await input.press("Escape");

  await input.press("?");
  const palette = page.locator(".quiet-palette");
  const paletteList = palette.getByRole("listbox");
  await expect(palette).toBeVisible();
  await expect(paletteList).toBeFocused();
  await expect(palette.getByText("show available commands")).toBeVisible();
  await palette.press("l");
  await expect(palette).toBeHidden();
  await expect(outputText(page)).toContainText("README");

  await runCommand(page, "florb --quiet");
  await expect(outputText(page)).toContainText("florb: command not found");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).not.toHaveAttribute("aria-invalid", "true", { timeout: 2_000 });
  await input.press("ArrowUp");
  await expect(input).toHaveValue("florb --quiet");
  await input.press("ArrowDown");
  await expect(input).toHaveValue("");

  await input.press("Control+L");
  await expect(outputText(page)).toHaveText("");
});

test("filesystem discovery reaches the decoded signal", async ({ page }) => {
  await runCommand(page, "systemctl start interface");
  await expect(promptText(page)).toHaveText("operator:~$");
  await expect(page.locator("#quiet-terminal-prompt-full")).toHaveText("operator:/surface$");

  await runCommand(page, "ls -la");
  await expect(outputText(page)).toContainText("carrier@ -> carrier.sample");
  await expect(outputText(page)).toContainText("trace@ -> trace.path");
  await runCommand(page, "tree");
  await expect(outputText(page)).toContainText("operator.log");
  await runCommand(page, "readlink carrier");
  await expect(outputText(page)).toContainText("carrier.sample");
  await runCommand(page, "file carrier.sample");
  await expect(outputText(page)).toContainText("scrambled five-slot signal");
  await runCommand(page, "journalctl -u interface");
  await expect(outputText(page)).toContainText("mounted /surface");

  const input = commandInput(page);
  await input.fill("cat ca");
  await input.press("Tab");
  await expect(input).toHaveValue("cat carrier");
  await input.press("Enter");
  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");
  await runCommand(page, "cat trace");
  await expect(outputText(page)).toContainText("route: 3 -> 5 -> 2 -> 4 -> 1");
  await expect(phaseLabel(page)).toHaveText("decoding");
  await expect(interfaceSurface(page)).toHaveAttribute("data-signal", "writable");
});

test("boundary image route enforces checksum and mount gates", async ({ page }) => {
  await buildBoundaryImage(page);
  await expect(phaseLabel(page)).toHaveText("image-built");
  await expect(outputText(page)).toContainText("boundary.img.sha256");
  await expect(interfaceSurface(page)).toHaveAttribute("data-boundary", "built");

  await runCommand(page, "cat boundary.img");
  await expect(outputText(page)).toContainText("quiet-interface boundary image v1");
  await expect(outputText(page)).toContainText("trace=3,5,2,4,1");
  await runCommand(page, "sha256sum boundary.img");
  await expect(outputText(page)).toContainText("4744576e715495b3e147065029de1eb1eb06dde97ed4fcf728d31ced59ba2c37");

  await runCommand(page, "mount boundary.img /mnt/boundary");
  await expect(outputText(page)).toContainText("image has not been verified");
  await expect(interfaceSurface(page)).toHaveAttribute("data-boundary", "built");
  await runCommand(page, "sha256sum -c boundary.img");
  await expect(outputText(page)).toContainText("no properly formatted checksum lines found");
  await runCommand(page, "sha256sum -c boundary.img.sha256");
  await expect(outputText(page)).toContainText("boundary.img: OK");
  await expect(interfaceSurface(page)).toHaveAttribute("data-boundary", "verified");

  await runCommand(page, "mount -o rw boundary.img /mnt/boundary");
  await expect(outputText(page)).toContainText("only read-only mode is supported");
  await runCommand(page, "mount -o ro boundary.img /mnt/boundary");
  await expect(outputText(page)).toContainText("inside/ and inside/release are now readable");
  await expect(phaseLabel(page)).toHaveText("mounted");
  await expect(interfaceSurface(page)).toHaveAttribute("data-boundary", "mounted");
  await runCommand(page, "ls /mnt/boundary/inside");
  await expect(outputText(page)).toContainText("release*");
});

test("progressive verification hints stop at exact syntax", async ({ page }) => {
  await buildBoundaryImage(page);
  await runCommand(page, "sha256sum -c boundary.img");
  await page.waitForTimeout(2_700);
  await expect(commandHint(page)).toHaveText("boundary.img has an unverified manifest");

  await runCommand(page, "sha256sum -c boundary.img");
  await page.waitForTimeout(2_700);
  await expect(commandHint(page)).toHaveText("manual: man sha256sum");

  await runCommand(page, "sha256sum -c boundary.img");
  await page.waitForTimeout(2_700);
  await expect(commandHint(page)).toHaveText("try: sha256sum -c boundary.img.sha256");
});

test("partial progress restores with a terse summary and no command history", async ({ page }) => {
  await buildBoundaryImage(page);
  await page.reload();
  await waitForTerminalReady(page);
  await expect(phaseLabel(page)).toHaveText("image-built");
  await expect(outputText(page)).toContainText("local session restored");
  await expect(outputText(page)).toContainText("stage: image-built");
  await expect(promptText(page)).toHaveText("operator:~$");
  await runCommand(page, "history");
  await expect(outputText(page)).toContainText("history: empty");
  await runCommand(page, "help");
  await expect(outputText(page)).toContainText("sha256sum");
  await expect(outputText(page)).toContainText("mount");
});

test("release wave finishes before the ceremony reveals contact and the solve record", async ({ page, isMobile }, testInfo) => {
  await page.waitForTimeout(2_700);
  await expect(commandHint(page)).toHaveText("try: help");
  await runCommand(page, "contact");
  await expect(outputText(page)).toContainText("outside channel unavailable");
  await expect(outputText(page)).not.toContainText(CONTACT_ALIAS);

  await enterBoundary(page);
  const insideScene = await canvasPng(page);
  await submitCommand(page, "./release");
  await expect(terminal(page)).toHaveAttribute("aria-busy", "true");
  await expect(outputText(page)).not.toContainText("release accepted");
  await expect(page.locator('.sr-only[role="status"]')).not.toContainText("congratulations, operator");
  await page.waitForTimeout(850);
  const releaseWave = await canvasPng(page);
  await testInfo.attach("release-wave", { body: releaseWave, contentType: "image/png" });
  await expect(changedPixels(insideScene, releaseWave)).resolves.toBeGreaterThan(isMobile ? 120 : 500);
  await expect(outputText(page)).not.toContainText("release accepted");
  await waitForMilestone(page);

  await expect(phaseLabel(page)).toHaveText("outside");
  await expect(interfaceSurface(page)).toHaveAttribute("data-boundary", "detached");
  await expect(outputText(page)).toContainText("release accepted");
  await expect(outputText(page)).toContainText("boundary detached");
  await expect(outputText(page)).toContainText("operator path verified");
  await expect(outputText(page)).toContainText("congratulations, operator");
  await expect(outputText(page)).toContainText("you found the outside");
  await expect(outputText(page)).toContainText(`contact: ${CONTACT_ALIAS}`);
  await expect(outputText(page)).toContainText("the operator was not inside the machine");
  await expect(outputText(page)).toContainText("local solve record:");
  await expect(outputText(page)).toContainText("hints: 0");
  await expect(outputText(page)).toContainText("signal integrity: unbroken");
  await expect(commandHint(page)).toHaveText("");

  await page.reload();
  await waitForTerminalReady(page);
  await expect(outputText(page)).toContainText("outside namespace restored");
  await expect(outputText(page)).toContainText("operator recognized");
});

test("assisted release records attempts and omits perfect-run status", async ({ page }) => {
  await completeRelease(page, { wrongToken: true, useHint: true });
  await expect(outputText(page)).toContainText("signal attempts: 2");
  await expect(outputText(page)).toContainText("hints: 1");
  await expect(outputText(page)).not.toContainText("signal integrity: unbroken");
});

test("the optional afterimage unlocks only after file identification", async ({ page }) => {
  await completeRelease(page);
  await runCommand(page, "ls -la");
  await expect(outputText(page)).toContainText(".afterimage");
  await runCommand(page, "xxd -r -p .afterimage");
  await expect(outputText(page)).toContainText("xxd: command not found");
  await runCommand(page, "file .afterimage");
  await expect(outputText(page)).toContainText("hexadecimal bytes");
  await runCommand(page, "xxd -r -p .afterimage");
  await expect(outputText(page)).toContainText("thank you for looking closely.");
});

test("reset clears saved progress even when storage operations fail", async ({ page }) => {
  await buildBoundaryImage(page);
  await runCommand(page, "reset");
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(promptText(page)).toHaveText("operator:/$");
  await page.reload();
  await waitForTerminalReady(page);
  await expect(phaseLabel(page)).toHaveText("dormant");

  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("storage unavailable", "SecurityError");
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException("storage unavailable", "SecurityError");
    };
  });
  await runCommand(page, "systemctl start interface");
  await runCommand(page, "reset");
  await expect(phaseLabel(page)).toHaveText("dormant");
});

test("reduced-motion scenes are stable, nonblank, and structurally distinct", async ({ page, isMobile }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await waitForTerminalReady(page);
  await expect(canvas(page)).toHaveAttribute("data-motion", "reduced");

  const scenes: Buffer[] = [];
  scenes.push(await captureScene(page, testInfo, "dormant"));
  await runCommand(page, "systemctl start interface");
  await runCommand(page, "cat carrier");
  await runCommand(page, "cat trace");
  scenes.push(await captureScene(page, testInfo, "decoding"));
  await runCommand(page, "echo lumen > signal");
  scenes.push(await captureScene(page, testInfo, "signal-locked"));
  await runCommand(page, "make signal");
  scenes.push(await captureScene(page, testInfo, "image-built"));
  await runCommand(page, "sha256sum -c boundary.img.sha256");
  scenes.push(await captureScene(page, testInfo, "image-verified"));
  await runCommand(page, "mount -o ro boundary.img /mnt/boundary");
  scenes.push(await captureScene(page, testInfo, "mounted"));
  await runCommand(page, "cd /mnt/boundary/inside");
  scenes.push(await captureScene(page, testInfo, "inside"));
  await runCommand(page, "./release");
  scenes.push(await captureScene(page, testInfo, "outside"));

  for (const scene of scenes) await expect(nonGroundPixels(scene)).resolves.toBeGreaterThan(isMobile ? 60 : 180);
  for (let index = 1; index < scenes.length; index += 1) {
    await expect(changedPixels(scenes[index - 1] ?? scenes[0], scenes[index] ?? scenes[0])).resolves.toBeGreaterThan(isMobile ? 80 : 300);
  }
  await expect(canvas(page)).toHaveAttribute("aria-hidden", "true");
  await expect(outputText(page)).toContainText("congratulations, operator");
});

test("mobile canvas uses the reduced render budget and keeps input reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only viewport check");
  await expect(canvas(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute("data-render-mode", "mobile");
  const dimensions = await canvas(page).evaluate((element) => ({
    backingWidth: element instanceof HTMLCanvasElement ? element.width : 0,
    cssWidth: element.getBoundingClientRect().width
  }));
  expect(dimensions.backingWidth / dimensions.cssWidth).toBeLessThanOrEqual(1.26);

  const keyStrip = page.locator(".quiet-terminal-keys");
  await expect(keyStrip).toBeVisible();
  await expect(keyStrip.getByRole("button", { name: "Complete command" })).toBeVisible();
  await buildBoundaryImage(page);
  await expect(interfaceSurface(page)).toHaveAttribute("data-signal", "locked");
  await expect(commandInput(page)).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test("long command rows and deep prompts stay inside the terminal", async ({ page }) => {
  await buildBoundaryImage(page);
  await runCommand(page, "sha256sum -c boundary.img.sha256");
  await runCommand(page, "mount -o ro boundary.img /mnt/boundary");
  await runCommand(page, "cd /mnt/boundary/inside");
  await expect(promptText(page)).toHaveText("operator:.../inside$");
  await expect(page.locator("#quiet-terminal-prompt-full")).toHaveText("operator:/mnt/boundary/inside$");
  await runCommand(page, "help");
  await expectNoHorizontalOverflow(page);
  const rowsFit = await page.locator('[data-layout="command-row"]').evaluateAll((rows) =>
    rows.every((row) => row.scrollWidth <= row.clientWidth + 1)
  );
  expect(rowsFit).toBe(true);
});

test("legacy portfolio and removed public routes stay absent", async ({ page }) => {
  await page.goto("/#selected-work");
  await expect(app(page).locator("#selected-work")).toHaveCount(0);
  await expect(app(page).locator(".quiet-terminal")).toBeVisible();
  const response = await page.request.get("/notes/");
  expect(response.status()).toBe(404);
  const [sitemap, agentBrief] = await Promise.all([page.request.get("/sitemap.xml"), page.request.get("/llms.txt")]);
  expect(await sitemap.text()).not.toContain("/notes");
  const publicAgentCopy = await agentBrief.text();
  expect(publicAgentCopy).not.toMatch(/TradePlane|DrawParty|codex-action|selected work|case stud/i);
  expect(publicAgentCopy).not.toContain(CONTACT_ALIAS);
});

test("no-JavaScript fallback explains the limited state", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await context.newPage();
  await noScriptPage.goto(baseURL ?? "/");
  const fallback = noScriptPage.locator(".quiet-js-fallback");
  await expect(fallback.getByText("operator channel unavailable")).toBeVisible();
  await expect(fallback.getByText("the interface requires a local JavaScript runtime")).toBeVisible();
  await context.close();
});
