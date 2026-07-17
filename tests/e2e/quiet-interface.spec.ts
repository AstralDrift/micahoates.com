import { expect, test, type Page } from "@playwright/test";

const CONTACT_ALIAS = "hello [at] micahoates [dot] com";

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

async function enterInterface(page: Page) {
  const input = commandInput(page);

  try {
    await input.waitFor({ state: "visible", timeout: 2_000 });
    await waitForTerminalReady(page);
    return;
  } catch {
    // Brand surface is showing — open the interface explicitly.
  }

  await app(page).getByRole("button", { name: "Enter interface", exact: true }).click();
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
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(app(page).locator(".brand-name")).toHaveText("Micah Oates");
});

test("brand surface is the default readable entry", async ({ page }) => {
  await expect(app(page).locator(".brand-name")).toBeVisible();
  await expect(app(page).locator(".brand-headline")).toContainText("Systems that survive");
  await expect(app(page).getByRole("button", { name: "Enter interface", exact: true })).toBeVisible();
  await expect(app(page).locator("#selected-work")).toContainText("codex-action-guard");
  await expect(commandInput(page)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("enter interface via CTA and return via Escape", async ({ page }) => {
  await enterInterface(page);
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(page.locator("canvas.quiet-canvas")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(app(page).locator(".brand-name")).toBeVisible();
  await expect(commandInput(page)).toHaveCount(0);
});

test("enter interface via keyboard and exit via command", async ({ page, isMobile }) => {
  test.skip(isMobile, "key i is unreliable on mobile browser projects");

  await page.keyboard.press("i");
  await waitForTerminalReady(page);

  await runCommand(page, "exit");
  await expect(app(page).locator(".brand-name")).toBeVisible({ timeout: 3000 });
  await expect(commandInput(page)).toHaveCount(0);
});

test("starts as a focused keyboard interface with canvas artifact", async ({ page }) => {
  await enterInterface(page);
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(commandInput(page)).toBeFocused();
  await expect(commandInput(page)).toHaveAttribute("placeholder", "command");
  await expect(promptText(page)).toHaveText("operator:/$");
  await expect(page.locator("canvas.quiet-canvas")).toBeVisible();
  await expect(outputText(page)).toContainText("SYSTEM INTERFACE");
  await expect(outputText(page)).toContainText("operator input required");
  await expect(outputText(page)).toContainText("channel opened from surface");
  await expectNoHorizontalOverflow(page);
});

test("hash deep-link opens interface mode", async ({ page }) => {
  await page.goto("/#interface");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitForTerminalReady(page);
  await expect(outputText(page)).toContainText("channel opened from surface");
  await expect(page).toHaveURL(/#interface/);
});

test("node deep-link opens chapter channel", async ({ page }) => {
  await page.goto("/#interface/signal");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitForTerminalReady(page);
  await expect(outputText(page)).toContainText("channel: signal");
  await expect(outputText(page)).toContainText("hard gates remain");
  await expect(page).toHaveURL(/#interface\/signal/);
});

test("schematic node enters interface chapter", async ({ page }) => {
  await app(page).getByRole("button", { name: "Enter interface at carrier chapter" }).click();
  await waitForTerminalReady(page);
  await expect(outputText(page)).toContainText("channel: carrier");
  await expect(page).toHaveURL(/#interface\/carrier/);
});

test("case study and notes are reachable", async ({ page }) => {
  await expect(app(page).locator(".case-study")).toContainText("codex-action-guard");
  await expect(app(page).locator(".case-study")).toContainText("Trust boundary");
  await page.goto("/notes/trust-boundaries/");
  await expect(page.getByRole("heading", { name: "Trust boundaries around agents" })).toBeVisible();
});

test("autocomplete, palette, history, clear, and invalid input work", async ({ page }) => {
  await enterInterface(page);
  const input = commandInput(page);

  await input.fill("sy");
  await input.press("Tab");
  await expect(input).toHaveValue("systemctl start interface");

  await input.press("?");
  await expect(page.locator(".quiet-palette")).toBeHidden();
  await input.fill("systemctl start interface");

  await input.press("Enter");
  await expect(phaseLabel(page)).toHaveText("observation");
  await expect(outputText(page)).toContainText("new file available: carrier");
  await expect(promptText(page)).toHaveText("operator:/surface$");

  await runCommand(page, "florb");
  await expect(outputText(page)).toContainText("input not recognized");

  await input.press("ArrowUp");
  await expect(input).toHaveValue("florb");
  await input.press("ArrowDown");
  await expect(input).toHaveValue("");

  await input.press("?");
  await expect(page.locator(".quiet-palette")).toBeVisible();
  await page.locator(".quiet-palette").press("Escape");
  await expect(page.locator(".quiet-palette")).toBeHidden();

  await runCommand(page, "reset");
  await input.press("?");
  await expect(page.locator(".quiet-palette")).toBeVisible();
  await page.locator(".quiet-palette").press("l");
  await expect(outputText(page)).toContainText("README");

  await runCommand(page, "clear");
  await expect(outputText(page)).toHaveText("");
});

test("shell affordances support filesystem-style discovery", async ({ page }) => {
  await enterInterface(page);
  const input = commandInput(page);

  await runCommand(page, "systemctl start interface");

  await runCommand(page, "ls -la");
  await expect(outputText(page)).toContainText("-r--r--r--");
  await expect(outputText(page)).toContainText("carrier.sample");

  await runCommand(page, "tree");
  await expect(outputText(page)).toContainText("|-- carrier.sample");
  await expect(outputText(page)).toContainText("`-- operator.log");

  await runCommand(page, "file carrier.sample");
  await expect(outputText(page)).toContainText("scrambled five-slot signal");

  await runCommand(page, "man cat");
  await expect(outputText(page)).toContainText("MAN cat");
  await expect(outputText(page)).toContainText("read virtual files");

  await input.fill("cat ca");
  await input.press("Tab");
  await expect(input).toHaveValue("cat carrier");
  await input.press("Enter");
  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");

  await runCommand(page, "history");
  await expect(outputText(page)).toContainText("systemctl start interface");
  await expect(outputText(page)).toContainText("cat carrier");
});

test("signal puzzle gates boundary assembly", async ({ page }) => {
  await enterInterface(page);
  await runCommand(page, "systemctl start interface");

  for (const command of ["ls", "cat carrier", "cat trace"]) {
    await runCommand(page, command);
  }

  await expect(outputText(page)).toContainText("carrier");
  await expect(outputText(page)).toContainText("sample: 1:N  2:M  3:L  4:E  5:U");
  await expect(outputText(page)).toContainText("route: 3 -> 5 -> 2 -> 4 -> 1");

  await runCommand(page, "make signal");
  await expect(outputText(page)).toContainText("required: echo <token> > signal");

  await runCommand(page, "align");
  await expect(outputText(page)).toContainText("try: echo <token> > signal");

  await runCommand(page, "echo lux > signal");
  await expect(outputText(page)).toContainText("alignment rejected");
  await expect(outputText(page)).toContainText("attempts: 1");

  await runCommand(page, "cat fragment");
  await expect(outputText(page)).toContainText("follow trace order across carrier sample");

  await runCommand(page, "echo lumen > signal");
  await expect(outputText(page)).toContainText("signal decoded");

  await runCommand(page, "make signal");
  await expect(phaseLabel(page)).toHaveText("boundary");
  await expect(outputText(page)).toContainText("boundary located");

  for (const command of ["cd boundary", "cd inside", "./release"]) {
    await runCommand(page, command);
  }

  await expect(phaseLabel(page)).toHaveText("outside");
  await expect(outputText(page)).toContainText("the operator was not inside the machine");
  await expect(outputText(page)).not.toContainText("signal integrity: unbroken");
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
  await page.waitForTimeout(1000);
  await expect(commandHint(page)).toHaveText("");

  await page.reload();
  await enterInterface(page);
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
  await expect(app(page).locator(".brand-name")).toBeVisible({ timeout: 3000 });
});

test("mobile viewport keeps command input reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only viewport check");

  await enterInterface(page);
  await expect(commandInput(page)).toBeFocused();
  await expectNoHorizontalOverflow(page);

  for (const command of [
    "systemctl start interface",
    "cat carrier",
    "cat trace",
    "echo lumen > signal",
    "make signal"
  ]) {
    await runCommand(page, command);
  }

  await expect(phaseLabel(page)).toHaveText("boundary");
  await expect(commandInput(page)).toBeInViewport();
});

test("no-JavaScript fallback explains the limited state", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(baseURL ?? "/");
  const fallback = page.locator(".quiet-js-fallback");
  await expect(fallback.getByText("Micah Oates")).toBeVisible();
  await expect(fallback.getByText("enable JavaScript for the full surface and interface")).toBeVisible();

  await context.close();
});
