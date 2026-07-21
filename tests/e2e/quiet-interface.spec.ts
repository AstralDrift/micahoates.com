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

async function waitForTerminalReady(page: Page) {
  await expect(commandInput(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("quiet-command-input");
}

async function runCommand(page: Page, command: string) {
  const input = commandInput(page);
  await input.focus();
  await input.fill(command);
  await input.press("Enter");
}

async function completeRelease(page: Page, options: { useHint?: boolean; wrongToken?: boolean } = {}) {
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
  const overflow = await page.evaluate(
    () => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
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

test("starts as a focused keyboard interface with a dormant service", async ({ page, isMobile }) => {
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(commandInput(page)).toBeFocused();
  await expect(commandInput(page)).toHaveAttribute("placeholder", "command");
  await expect(promptText(page)).toHaveText("operator:/$");
  const canvas = page.locator("canvas.quiet-canvas");
  await (isMobile ? expect(canvas).toBeHidden() : expect(canvas).toBeVisible());
  await expect(outputText(page)).toContainText("surface / mounted read-only");
  await expect(outputText(page)).toContainText("interface.service: inactive");
  await expect(outputText(page)).toContainText("keyboard channel ready");
  await expect(outputText(page)).not.toHaveAttribute("aria-live");
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

test("completion, palette, history, clear, and shell errors are tactile", async ({ page }) => {
  const input = commandInput(page);

  await input.fill("sys");
  await input.press("Tab");
  await expect(input).toHaveValue("systemctl start interface");
  await input.press("Escape");
  await expect(input).toHaveValue("");

  await input.press("?");
  const palette = page.locator(".quiet-palette");
  await expect(palette).toBeVisible();
  await expect(palette.getByText("show available commands")).toBeVisible();
  await palette.press("l");
  await expect(palette).toBeHidden();
  await expect(outputText(page)).toContainText("README");
  await expect(input).toBeFocused();

  await input.press("?");
  await palette.press("ArrowDown");
  await palette.press("Enter");
  await expect(outputText(page)).toContainText("MAN help");

  await runCommand(page, "florb --quiet");
  await expect(outputText(page)).toContainText("florb: command not found");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.press("ArrowUp");
  await expect(input).toHaveValue("florb --quiet");
  await input.press("ArrowDown");
  await expect(input).toHaveValue("");

  await input.press("Control+L");
  await expect(outputText(page)).toHaveText("");
});

test("filesystem commands agree about paths, links, and service state", async ({ page }) => {
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

test("invalid paths return consistent shell errors", async ({ page }) => {
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
  for (const command of ["systemctl start interface", "cat carrier", "cat trace"]) {
    await runCommand(page, command);
  }

  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");
  await expect(outputText(page)).toContainText("route: 3 -> 5 -> 2 -> 4 -> 1");

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

  await runCommand(page, "make signal");
  await expect(phaseLabel(page)).toHaveText("boundary");
  await expect(outputText(page)).toContainText("[3/3] mount boundary");
  await runCommand(page, "cd boundary");
  await expect(outputText(page)).toContainText("inside/ is now readable");
  await runCommand(page, "cd inside");
  await expect(promptText(page)).toHaveText("operator:/surface/boundary/inside$");
  await runCommand(page, "cd ..");
  await expect(promptText(page)).toHaveText("operator:/surface/boundary$");
});

test("release is conclusive, persists, and keeps contact gated", async ({ page }) => {
  await runCommand(page, "contact");
  await expect(outputText(page)).toContainText("outside channel unavailable");
  await expect(outputText(page)).not.toContainText(CONTACT_ALIAS);

  await completeRelease(page);
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
  await expect(outputText(page)).toContainText("outside namespace restored");
  await expect(outputText(page)).toContainText("operator recognized");
  await expect(promptText(page)).toHaveText("operator:/outside$");
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
  await expect(outputText(page)).toContainText("fields: platform / devops / software / ai systems");
  await runCommand(page, "cd .surface");
  await expect(promptText(page)).toHaveText("operator:/surface$");
  await runCommand(page, "whoami");
  await expect(outputText(page)).toContainText("supplied by keyboard");
});

test("mobile key strip keeps history and submission reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only viewport check");

  await expect(commandInput(page)).toBeFocused();
  await expectNoHorizontalOverflow(page);
  const keyStrip = page.locator(".quiet-terminal-keys");
  await expect(keyStrip).toBeVisible();
  await expect(keyStrip.getByRole("button", { name: "Complete command" })).toBeVisible();
  const terminalCompositing = await app(page).locator(".quiet-terminal").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor
    };
  });
  expect(terminalCompositing.backgroundColor).toBe("rgb(3, 8, 6)");
  await expect(page.locator("canvas.quiet-canvas")).toBeHidden();

  await runCommand(page, "pwd");
  await keyStrip.getByRole("button", { name: "Previous command" }).click();
  await expect(commandInput(page)).toHaveValue("pwd");
  await keyStrip.getByRole("button", { name: "Run command" }).click();
  await expect(commandInput(page)).toBeInViewport();
  await expectNoHorizontalOverflow(page);
});

test("reduced motion keeps the puzzle legible and stateful", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await waitForTerminalReady(page);
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  for (const command of ["systemctl start interface", "cat carrier", "cat trace"]) {
    await runCommand(page, command);
  }
  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");
  await expect(outputText(page)).toContainText("route: 3 -> 5 -> 2 -> 4 -> 1");
  const canvas = page.locator("canvas.quiet-canvas");
  await (isMobile ? expect(canvas).toBeHidden() : expect(canvas).toBeVisible());
  await expectNoHorizontalOverflow(page);
});

test("no-JavaScript fallback explains the limited state", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await context.newPage();

  await noScriptPage.goto(baseURL ?? "/");
  const fallback = noScriptPage.locator(".quiet-js-fallback");
  await expect(fallback.getByText("scripting unavailable")).toBeVisible();
  await expect(fallback.getByText("enable JavaScript to continue")).toBeVisible();

  await context.close();
});
