import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const CONTACT_ALIAS = "hello [at] micahoates [dot] com";
const runtimeErrors = new WeakMap<Page, string[]>();

function app(page: Page) {
  return page.locator(".site-shell");
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

async function enterInterface(page: Page) {
  await waitForTerminalReady(page);
}

async function waitForTerminalReady(page: Page) {
  await expect(commandInput(page)).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 10_000 })
    .toBe("quiet-command-input");
}

async function runCommand(page: Page, command: string) {
  const input = commandInput(page);
  await input.focus();
  await input.fill(command);
  await input.press("Enter");
}

async function completeRelease(page: Page, options: { useHint?: boolean; wrongToken?: boolean } = {}) {
  await enterInterface(page);
  for (const command of ["systemctl start interface", "cat carrier", "cat trace"]) {
    await runCommand(page, command);
  }
  if (options.wrongToken) await runCommand(page, "echo lux > signal");
  if (options.useHint) await runCommand(page, "cat fragment");
  for (const command of ["echo lumen > signal", "make signal", "cd boundary", "cd inside", "./release"]) {
    await runCommand(page, command);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      }))
    )
    .toEqual(
      expect.objectContaining({
        bodyScrollWidth: expect.any(Number),
        innerWidth: expect.any(Number),
        scrollWidth: expect.any(Number)
      })
    );

  const overflow = await page.evaluate(
    () => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(8);
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

test("quiet interface is the complete default surface", async ({ page, isMobile }) => {
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(commandInput(page)).toBeFocused();
  await expect(outputText(page)).toContainText("mount: /surface [ro]");
  await expect(outputText(page)).toContainText("interface.service: inactive");
  await expect(outputText(page)).toContainText("stdin: operator channel");
  await expect(app(page).locator("#selected-work")).toHaveCount(0);
  await expect(app(page).locator("a")).toHaveCount(0);
  const canvas = page.locator("canvas.quiet-canvas");
  await (isMobile ? expect(canvas).toBeHidden() : expect(canvas).toBeVisible());
  await expectNoHorizontalOverflow(page);
});

test("Escape clears input and exit finds no enclosing shell", async ({ page }) => {
  const input = commandInput(page);
  await input.fill("unsubmitted");
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await runCommand(page, "exit");
  await expect(outputText(page)).toContainText("no enclosing shell detected");
  await expect(commandInput(page)).toBeFocused();
});

test("starts as a focused keyboard interface with canvas artifact", async ({ page, isMobile }) => {
  await enterInterface(page);
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(commandInput(page)).toBeFocused();
  await expect(commandInput(page)).toHaveAttribute("placeholder", "command");
  await expect(promptText(page)).toHaveText("operator:/$");
  const canvas = page.locator("canvas.quiet-canvas");
  await (isMobile ? expect(canvas).toBeHidden() : expect(canvas).toBeVisible());
  await expect(outputText(page)).toContainText("mount: /surface [ro]");
  await expect(outputText(page)).toContainText("interface.service: inactive");
  await expect(outputText(page)).toContainText("stdin: operator channel");
  await expectNoHorizontalOverflow(page);
});

test("desktop terminal remains present in composited frames", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop compositor check");

  for (const command of ["systemctl start interface", "cat carrier", "cat trace", "echo lumen > signal"]) {
    await runCommand(page, command);
  }

  const terminalBounds = await app(page).locator(".quiet-terminal").boundingBox();
  expect(terminalBounds).not.toBeNull();
  if (!terminalBounds) return;

  const clip = {
    x: Math.floor(terminalBounds.x),
    y: Math.floor(terminalBounds.y),
    width: Math.floor(terminalBounds.width),
    height: Math.floor(terminalBounds.height)
  };

  for (let frame = 0; frame < 8; frame += 1) {
    await page.waitForTimeout(60);
    const screenshot = await page.screenshot({ clip });
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let foregroundPixels = 0;
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const luminance = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (luminance > 40) foregroundPixels += 1;
    }
    expect(foregroundPixels).toBeGreaterThan(5_000);
  }
});

test("legacy portfolio hashes cannot reveal a second surface", async ({ page }) => {
  await page.goto("/#selected-work");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitForTerminalReady(page);
  await expect(app(page).locator("#selected-work")).toHaveCount(0);
  await expect(app(page).locator(".quiet-terminal")).toBeVisible();
});

test("removed public content routes are no longer exported", async ({ page }) => {
  const response = await page.request.get("/notes/");
  expect(response.status()).toBe(404);
  await expect(app(page).locator('a[href^="/notes"]')).toHaveCount(0);

  const [sitemap, agentBrief] = await Promise.all([
    page.request.get("/sitemap.xml"),
    page.request.get("/llms.txt")
  ]);
  expect(await sitemap.text()).not.toContain("/notes");
  const publicAgentCopy = await agentBrief.text();
  expect(publicAgentCopy).not.toMatch(/TradePlane|DrawParty|codex-action|selected work|case stud/i);
  expect(publicAgentCopy).not.toContain(CONTACT_ALIAS);
});

test("reduced motion preserves every puzzle clue and state transition", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await waitForTerminalReady(page);

  const canvas = page.locator("canvas.quiet-canvas");
  await expect(canvas).toHaveAttribute("data-motion", "full");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-motion", "reduced");

  for (const command of ["systemctl start interface", "cat carrier", "cat trace"]) {
    await runCommand(page, command);
  }

  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");
  await expect(outputText(page)).toContainText("route: 3 -> 5 -> 2 -> 4 -> 1");

  for (const command of [
    "echo lumen > signal",
    "make signal",
    "cd boundary",
    "cd inside",
    "./release"
  ]) {
    await runCommand(page, command);
  }

  await expect(outputText(page)).toContainText("the operator was not inside the machine");
  await expect(phaseLabel(page)).toHaveText("outside");
  await expect(commandInput(page)).toBeFocused();
  await (isMobile ? expect(canvas).toBeHidden() : expect(canvas).toBeVisible());
  await expectNoHorizontalOverflow(page);
});

test("autocomplete, palette, history, clear, and invalid input work", async ({ page }) => {
  await enterInterface(page);
  const input = commandInput(page);

  await input.fill("sys");
  await input.press("Tab");
  await expect(input).toHaveValue("systemctl start interface");
  await input.press("Escape");
  await expect(input).toHaveValue("");

  await input.press("?");
  const palette = page.locator(".quiet-palette");
  const paletteList = palette.getByRole("listbox");
  await expect(palette).toBeVisible();
  await expect(paletteList).toBeFocused();
  await expect(paletteList).toHaveAttribute("aria-activedescendant", "quiet-palette-option-0");
  await expect(palette.getByText("show available commands")).toBeVisible();
  await palette.press("l");
  await expect(palette).toBeHidden();
  await expect(outputText(page)).toContainText("README");
  await expect(input).toBeFocused();

  await input.press("?");
  await expect(paletteList).toBeFocused();
  await palette.press("ArrowDown");
  await expect(paletteList).toHaveAttribute("aria-activedescendant", "quiet-palette-option-1");
  await palette.press("Enter");
  await expect(outputText(page)).toContainText("MAN help");

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

test("shell affordances support filesystem-style discovery", async ({ page }) => {
  await enterInterface(page);
  const input = commandInput(page);
  await runCommand(page, "systemctl start interface");
  await expect(promptText(page)).toHaveText("operator:/surface$");

  await runCommand(page, "ls -la");
  await expect(outputText(page)).toContainText("-r--r--r--");
  await expect(outputText(page)).toContainText("carrier@ -> carrier.sample");
  await expect(outputText(page)).toContainText("trace@ -> trace.path");

  await runCommand(page, "tree");
  await expect(outputText(page)).toContainText("|-- carrier@ -> carrier.sample");
  await expect(outputText(page)).toContainText("operator.log");

  await runCommand(page, "readlink carrier");
  await expect(outputText(page)).toContainText("carrier.sample");
  await runCommand(page, "file carrier.sample");
  await expect(outputText(page)).toContainText("scrambled five-slot signal");
  await runCommand(page, "systemctl status interface");
  await expect(outputText(page)).toContainText("loaded: loaded (/surface)");
  await runCommand(page, "journalctl -u interface");
  await expect(outputText(page)).toContainText("mounted /surface");

  await input.fill("cat ca");
  await input.press("Tab");
  await expect(input).toHaveValue("cat carrier");
  await input.press("Enter");
  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");

  await runCommand(page, "cd /");
  await expect(promptText(page)).toHaveText("operator:/$");
  await runCommand(page, "cd surface");
  await runCommand(page, "cd ..");
  await runCommand(page, "pwd");
  await expect(promptText(page)).toHaveText("operator:/$");
  await expect(outputText(page).locator("p").last()).toHaveText("/");
});

test("signal puzzle gates boundary assembly", async ({ page }) => {
  await enterInterface(page);
  await runCommand(page, "systemctl start interface");
  await runCommand(page, "cat missing.file");
  await expect(outputText(page)).toContainText("cat: missing.file: no such file or directory");
  await runCommand(page, "file missing.file");
  await expect(outputText(page)).toContainText("missing.file: cannot open: no such file or directory");
  await runCommand(page, "cd missing");
  await expect(outputText(page)).toContainText("cd: missing: no such directory");
  await runCommand(page, "readlink carrier.sample");
  await expect(outputText(page)).toContainText("readlink: carrier.sample: invalid argument");
});

test("signal puzzle gates assembly and records useful failures", async ({ page }) => {
  await enterInterface(page);
  for (const command of ["systemctl start interface", "cat carrier", "cat trace"]) {
    await runCommand(page, command);
  }

  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");
  await expect(outputText(page)).toContainText("route: 3 -> 5 -> 2 -> 4 -> 1");
  await expect(interfaceSurface(page)).toHaveAttribute("data-carrier", "sampled");
  await expect(interfaceSurface(page)).toHaveAttribute("data-trace", "resolved");

  await runCommand(page, "make signal");
  await expect(outputText(page)).toContainText("make: *** [signal] unresolved. Stop.");
  await runCommand(page, "align");
  await expect(outputText(page)).toContainText("signal: empty write refused");
  await runCommand(page, "echo lux > signal");
  await runCommand(page, "echo dark > signal");
  await expect(outputText(page)).toContainText("signal: write error: checksum mismatch");
  await expect(outputText(page)).toContainText("journal updated");
  await runCommand(page, "journalctl -u interface");
  await expect(outputText(page)).toContainText("rejected 2 writes; inspect fragment");

  await runCommand(page, "cat fragment");
  await expect(outputText(page)).toContainText("follow trace order across carrier sample");
  await runCommand(page, "echo lumen > signal");
  await expect(outputText(page)).toContainText("5 bytes written to signal");
  await runCommand(page, "cat signal");
  await expect(outputText(page)).toContainText("lumen");
  await expect(interfaceSurface(page)).toHaveAttribute("data-signal", "locked");

  await runCommand(page, "make signal");
  await expect(phaseLabel(page)).toHaveText("boundary");
  await expect(outputText(page)).toContainText("[3/3] mount boundary");
  await expect(interfaceSurface(page)).toHaveAttribute("data-boundary", "located");
  await runCommand(page, "cd boundary");
  await expect(outputText(page)).toContainText("inside/ is now readable");
  await expect(interfaceSurface(page)).toHaveAttribute("data-boundary", "open");
  await runCommand(page, "cd inside");
  await expect(promptText(page)).toHaveText("operator:/surface/boundary/inside$");
  await runCommand(page, "cd ..");
  await expect(promptText(page)).toHaveText("operator:/surface/boundary$");
});

test("release path gates and then reveals the contact alias", async ({ page }) => {
  await enterInterface(page);
  await runCommand(page, "contact");
  await expect(outputText(page)).toContainText("outside channel unavailable");
  await expect(outputText(page)).not.toContainText(CONTACT_ALIAS);

  for (const command of [
    "systemctl start interface",
    "cat carrier",
    "cat trace",
    "echo lumen > signal",
    "make signal",
    "cd boundary",
    "cd inside",
    "./release"
  ]) {
    await runCommand(page, command);
  }

  await expect(phaseLabel(page)).toHaveText("outside");
  await expect(outputText(page)).toContainText("name: micah oates");
  await expect(outputText(page)).toContainText(`contact: ${CONTACT_ALIAS}`);
  await expect(outputText(page)).toContainText("the operator was not inside the machine");
  await expect(outputText(page)).toContainText("signal integrity: unbroken");
  await expect(outputText(page).locator("p")).toHaveCount(8);
  await page.waitForTimeout(2800);
  await expect(commandHint(page)).toHaveText("");

  await page.reload();
  await waitForTerminalReady(page);
  await expect(outputText(page)).toContainText("operator recognized");
  await page.waitForTimeout(1000);
  await expect(commandHint(page)).toHaveText("");

  await runCommand(page, "whoami");
  await expect(outputText(page)).toContainText("operator identity:");

  await runCommand(page, "agi");
  await expect(outputText(page)).toContainText("confidence: marketing artifact");

  await runCommand(page, "sudo release");
  await expect(outputText(page)).toContainText("permission model rejected");

  await runCommand(page, "exit");
  await expect(outputText(page)).toContainText("no enclosing shell detected");
  await expect(commandInput(page)).toBeFocused();
});

test("release and reset survive unavailable browser storage", async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("storage unavailable", "SecurityError");
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException("storage unavailable", "SecurityError");
    };
  });

  await completeRelease(page);
  await expect(phaseLabel(page)).toHaveText("outside");
  await expect(outputText(page)).toContainText("release accepted");

  await runCommand(page, "reset");
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(promptText(page)).toHaveText("operator:/$");
});

test("post-release surface rewards link inspection without becoming a portfolio", async ({ page }) => {
  await completeRelease(page, { wrongToken: true });
  await expect(outputText(page)).not.toContainText("signal integrity: unbroken");
  await runCommand(page, "ls -la");
  await expect(outputText(page)).toContainText(".surface@ -> /surface");
  await runCommand(page, "readlink .surface");
  await expect(outputText(page)).toContainText("/surface");
  await runCommand(page, "cat record");
  await expect(outputText(page)).toContainText("origin: /surface");
  await runCommand(page, "cd .surface");
  await expect(promptText(page)).toHaveText("operator:/surface$");
  await runCommand(page, "whoami");
  await expect(outputText(page)).toContainText("supplied by keyboard");
});

test("mobile key strip keeps history and submission reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only viewport check");

  await enterInterface(page);
  await expect(commandInput(page)).toBeFocused();
  await expectNoHorizontalOverflow(page);
  const keyStrip = page.locator(".quiet-terminal-keys");
  await expect(keyStrip).toBeVisible();
  await expect(page.locator(".quiet-mobile-instrument")).toBeVisible();
  await expect(keyStrip.getByRole("button", { name: "Complete command" })).toBeVisible();
  const terminalCompositing = await app(page).locator(".quiet-terminal").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor
    };
  });
  expect(terminalCompositing.backgroundColor).toBe("rgb(2, 7, 5)");
  await expect(page.locator("canvas.quiet-canvas")).toBeHidden();

  for (const command of [
    "systemctl start interface",
    "cat carrier",
    "cat trace",
    "echo lumen > signal",
    "make signal"
  ]) {
    await runCommand(page, command);
  }
  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");
  await expect(outputText(page)).toContainText("route: 3 -> 5 -> 2 -> 4 -> 1");
  await expect(interfaceSurface(page)).toHaveAttribute("data-signal", "locked");
  const canvas = page.locator("canvas.quiet-canvas");
  await (isMobile ? expect(canvas).toBeHidden() : expect(canvas).toBeVisible());
  await expectNoHorizontalOverflow(page);
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
