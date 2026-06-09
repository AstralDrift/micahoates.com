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

async function waitForTerminalReady(page: Page) {
  await expect(commandInput(page)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
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
    .toEqual(expect.objectContaining({
      bodyScrollWidth: expect.any(Number),
      innerWidth: expect.any(Number),
      scrollWidth: expect.any(Number)
    }));

  const overflow = await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitForTerminalReady(page);
});

test("starts as a focused keyboard interface with canvas artifact", async ({ page }) => {
  await expect(phaseLabel(page)).toHaveText("dormant");
  await expect(commandInput(page)).toBeFocused();
  await expect(commandInput(page)).toHaveAttribute("placeholder", "command");
  await expect(page.locator("canvas.quiet-canvas")).toBeVisible();
  await expect(outputText(page)).toContainText("SYSTEM INTERFACE");
  await expect(outputText(page)).toContainText("operator input required");
  await expectNoHorizontalOverflow(page);
});

test("autocomplete, palette, history, clear, and invalid input work", async ({ page }) => {
  const input = commandInput(page);

  await input.fill("wa");
  await input.press("Tab");
  await expect(input).toHaveValue("wake");

  await input.press("?");
  await expect(page.locator(".quiet-palette")).toBeHidden();
  await input.fill("wake");

  await input.press("Enter");
  await expect(phaseLabel(page)).toHaveText("observation");
  await expect(outputText(page)).toContainText("new directive available: listen");

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
  await page.locator(".quiet-palette").press("w");
  await expect(phaseLabel(page)).toHaveText("observation");

  await runCommand(page, "clear");
  await expect(outputText(page)).toHaveText("");
});

test("release path gates and then reveals the contact alias", async ({ page }) => {
  await runCommand(page, "contact");
  await expect(outputText(page)).toContainText("outside channel unavailable");
  await expect(outputText(page)).not.toContainText(CONTACT_ALIAS);

  for (const command of ["wake", "listen", "trace", "make signal", "open boundary", "enter", "release"]) {
    await runCommand(page, command);
  }

  await expect(phaseLabel(page)).toHaveText("outside");
  await expect(outputText(page)).toContainText("name: micah oates");
  await expect(outputText(page)).toContainText(`contact: ${CONTACT_ALIAS}`);
  await expect(outputText(page)).toContainText("the operator was not inside the machine");

  await page.reload();
  await expect(outputText(page)).toContainText("operator recognized");

  await runCommand(page, "whoami");
  await expect(outputText(page)).toContainText("operator identity:");

  await runCommand(page, "agi");
  await expect(outputText(page)).toContainText("confidence: marketing artifact");

  await runCommand(page, "sudo release");
  await expect(outputText(page)).toContainText("permission model rejected");

  await runCommand(page, "exit");
  await expect(outputText(page)).toContainText("no enclosing shell detected");
});

test("mobile viewport keeps command input reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only viewport check");

  await expect(commandInput(page)).toBeFocused();
  await expectNoHorizontalOverflow(page);

  for (const command of ["wake", "listen", "trace", "make signal"]) {
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
  await expect(fallback.getByText("scripting unavailable")).toBeVisible();
  await expect(fallback.getByText("enable JavaScript to continue")).toBeVisible();

  await context.close();
});
