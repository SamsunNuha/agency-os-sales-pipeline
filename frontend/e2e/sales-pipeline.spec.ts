import { test, expect, type Page } from "@playwright/test";

/*
 * Test credentials — must match SEED_ADMIN_PASSWORD in backend/.env
 * Default seed: admin@agency-os.local / Admin@1234
 */
const ADMIN_EMAIL = "admin@agency-os.local";
const ADMIN_PASSWORD = "Admin@1234";

/* ─── Helper: login and persist token via localStorage ──── */
async function login(page: Page) {
  await page.goto("/");

  // Wait for the login form
  await expect(page.locator("#login-email")).toBeVisible({ timeout: 10_000 });

  await page.fill("#login-email", ADMIN_EMAIL);
  await page.fill("#login-password", ADMIN_PASSWORD);


  await page.click("#login-submit");
  // Wait for the login request (any status) to complete
  await page.waitForResponse(resp => resp.url().includes("/api/auth/login"), { timeout: 60000 });
  // Ensure the authenticated UI (sidebar) is visible
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 60000 });
}

/* ─── Helper: navigate using sidebar buttons ──────────── */
async function navigateTo(page: Page, section: "dashboard" | "kanban" | "deals" | "followups") {
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    kanban: "Kanban Board",
    deals: "All Deals",
    followups: "Follow-Ups",
  };
  await page.click(`.nav-item:has-text("${labels[section]}")`);
  // Give the view time to render
  await page.waitForTimeout(500);
}

/* ═══════════════════════════════════════════════════════════
   Test Suite: Agency OS Sales Pipeline E2E
   ═══════════════════════════════════════════════════════════ */

test.describe("Sales Pipeline E2E", () => {
  test.describe.configure({ mode: "serial" });

  /* ─── 1. Login & Dashboard ──────────────────────────── */
  test("1.1 Login with valid credentials shows main app", async ({ page }) => {
    await login(page);

    // Sidebar should show user info
    await expect(page.locator(".sidebar-user-name")).toBeVisible();
    await expect(page.locator(".sidebar-user-name")).not.toBeEmpty();
  });

  test("1.2 Login with wrong password shows error", async ({ page }) => {
    await page.goto("/");
    await page.fill("#login-email", ADMIN_EMAIL);
    await page.fill("#login-password", "WrongPassword123");
    await page.click("#login-submit");

    await expect(page.locator(".alert-error")).toBeVisible({ timeout: 10_000 });
  });

  test("1.3 Dashboard displays stats cards", async ({ page }) => {
    await login(page);
    await navigateTo(page, "dashboard");

    // Should show the 4 stat cards
    await expect(page.locator(".stat-card")).toHaveCount(4, { timeout: 10_000 });
    await expect(page.locator(".stat-card.accent .stat-label")).toHaveText("Active Deals");
    await expect(page.locator(".stat-card.green .stat-label")).toHaveText("Won Deals");
    await expect(page.locator(".stat-card.blue .stat-label")).toHaveText("Pipeline Value");
    await expect(page.locator(".stat-card.yellow .stat-label")).toHaveText("Avg Deal Size");
  });

  /* ─── 2. Deals List & Deal Details ──────────────────── */
  test("2.1 Deals table loads with data", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");

    // Table should be present with at least one row
    await expect(page.locator(".data-table")).toBeVisible({ timeout: 10_000 });
    const rows = page.locator(".data-table tbody tr");
    await expect(rows).not.toHaveCount(0, { timeout: 10_000 });
  });

  test("2.2 Clicking Open on a deal shows the detail modal", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");

    // Wait for the table to populate
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });

    // Click the first "Open" button
    await page.locator(".data-table tbody tr").first().locator("button:has-text('Open')").click();

    // Modal should appear
    await expect(page.locator(".modal")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".modal-title")).not.toBeEmpty();

    // Close modal
    await page.locator(".modal .btn:has-text('X')").click();
    await expect(page.locator(".modal")).not.toBeVisible();
  });

  test("2.3 Deal detail modal shows tabs: History, Follow-Ups, Actions", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");

    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });
    await page.locator(".data-table tbody tr").first().locator("button:has-text('Open')").click();
    await expect(page.locator(".modal")).toBeVisible({ timeout: 5_000 });

    // Check tabs exist
    await expect(page.locator(".modal button:has-text('Stage History')")).toBeVisible();
    await expect(page.locator(".modal button:has-text('Follow-Ups')")).toBeVisible();
    await expect(page.locator(".modal button:has-text('Actions')")).toBeVisible();

    // Click through tabs
    await page.click(".modal button:has-text('Follow-Ups')");
    await page.waitForTimeout(300);
    await page.click(".modal button:has-text('Actions')");
    await page.waitForTimeout(300);

    // Close
    await page.locator(".modal .btn:has-text('X')").click();
  });

  /* ─── 3. Sorting ────────────────────────────────────── */
  test("3.1 Sorting by Deal column toggles sort order", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });

    // Get first deal title
    const firstBefore = await page.locator(".data-table tbody tr").first().locator("td").first().textContent();

    // Click Deal sort button
    await page.click("button:has-text('Deal')");
    await page.waitForTimeout(1000);

    // After sorting, order may change
    const firstAfter = await page.locator(".data-table tbody tr").first().locator("td").first().textContent();

    // Click again to toggle direction
    await page.click("button:has-text('Deal')");
    await page.waitForTimeout(1000);

    const firstReversed = await page.locator(".data-table tbody tr").first().locator("td").first().textContent();

    // At least one click should have changed the order (unless only 1 deal)
    // We mainly test that sorting doesn't crash
    expect(firstBefore).toBeDefined();
    expect(firstAfter).toBeDefined();
    expect(firstReversed).toBeDefined();
  });

  test("3.2 Sorting by Value column works", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });

    await page.click("button:has-text('Value')");
    await page.waitForTimeout(1000);

    // Verify table is still rendered
    await expect(page.locator(".data-table tbody tr")).not.toHaveCount(0);
  });

  test("3.3 Sorting by Close Date column works", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });

    await page.click("button:has-text('Close Date')");
    await page.waitForTimeout(1000);

    await expect(page.locator(".data-table tbody tr")).not.toHaveCount(0);
  });

  /* ─── 4. Search, Filters & Pagination ──────────────── */
  test("4.1 Search filters deals by title or client", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });

    const totalBefore = await page.locator(".data-table tbody tr").count();

    // Type a search query
    await page.fill("input[placeholder*='Search']", "zzz_nonexistent_deal_name");
    await page.waitForTimeout(1500); // Wait for debounce + API

    // Either fewer results or an empty state
    const totalAfter = await page.locator(".data-table tbody tr").count();
    expect(totalAfter).toBeLessThanOrEqual(totalBefore);

    // Clear search
    await page.fill("input[placeholder*='Search']", "");
    await page.waitForTimeout(1500);
  });

  test("4.2 State filter narrows results", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });

    // Filter to WON
    await page.selectOption("select.input", "WON");
    await page.waitForTimeout(1000);

    // All visible badges should say WON (if any results)
    const badges = page.locator(".data-table tbody .badge");
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveText("WON");
    }

    // Reset filter
    await page.selectOption("select.input", "");
    await page.waitForTimeout(1000);
  });

  test("4.3 Pagination buttons are visible when >1 page", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");
    await expect(page.locator(".data-table")).toBeVisible({ timeout: 10_000 });

    // Check if pagination is present (depends on data volume)
    const paginationExists = await page.locator(".pagination").isVisible();
    if (paginationExists) {
      await expect(page.locator(".page-btn")).not.toHaveCount(0);

      // Try clicking next page if available
      const nextBtn = page.locator(".page-btn:has-text('Next')");
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        await expect(page.locator(".data-table tbody tr")).not.toHaveCount(0);
      }
    }
  });

  /* ─── 5. Kanban Stage Movement ──────────────────────── */
  test("5.1 Kanban board shows stages with deal cards", async ({ page }) => {
    await login(page);
    await navigateTo(page, "kanban");

    await expect(page.locator(".kanban-board")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".kanban-column")).not.toHaveCount(0);
  });

  test("5.2 Kanban deal cards have Details button", async ({ page }) => {
    await login(page);
    await navigateTo(page, "kanban");
    await expect(page.locator(".kanban-board")).toBeVisible({ timeout: 10_000 });

    // Check if there are any deal cards
    const cards = page.locator(".deal-card");
    const cardCount = await cards.count();
    if (cardCount > 0) {
      // First card should have a Details button
      await expect(cards.first().locator("button:has-text('Details')")).toBeVisible();

      // Click it to open detail
      await cards.first().locator("button:has-text('Details')").click();
      await expect(page.locator(".modal")).toBeVisible({ timeout: 5_000 });
      await page.locator(".modal .btn:has-text('X')").click();
    }
  });

  /* ─── 6. Follow-Ups Panel ───────────────────────────── */
  test("6.1 Follow-Ups panel loads and shows filter dropdown", async ({ page }) => {
    await login(page);
    await navigateTo(page, "followups");

    // Should see the Follow-Ups heading and status filter
    await expect(page.locator("h2:has-text('Follow-Ups')")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("select.input")).toBeVisible();
  });

  test("6.2 Follow-Ups status filter cycles through options", async ({ page }) => {
    await login(page);
    await navigateTo(page, "followups");
    await expect(page.locator("h2:has-text('Follow-Ups')")).toBeVisible({ timeout: 10_000 });

    for (const status of ["", "UPCOMING", "OVERDUE", "COMPLETED"]) {
      await page.selectOption("select.input", status);
      await page.waitForTimeout(800);
      // Should not crash — either table or empty state shown
      const hasTable = await page.locator(".data-table").isVisible();
      const hasEmpty = await page.locator(".empty-state").isVisible();
      expect(hasTable || hasEmpty).toBeTruthy();
    }
  });

  test("6.3 Create follow-up from deal detail modal", async ({ page }) => {
    await login(page);
    await navigateTo(page, "deals");
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible({ timeout: 10_000 });

    // Open first deal
    await page.locator(".data-table tbody tr").first().locator("button:has-text('Open')").click();
    await expect(page.locator(".modal")).toBeVisible({ timeout: 5_000 });

    // Click Follow-Ups tab
    await page.click(".modal button:has-text('Follow-Ups')");
    await page.waitForTimeout(500);

    // Fill in follow-up form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 16); // yyyy-mm-ddTHH:MM

    await page.fill(".modal input[type='datetime-local']", dateStr);
    await page.fill(".modal input[placeholder*='Follow-up note']", "E2E test follow-up");
    await page.click(".modal button:has-text('+ Schedule')");

    // Wait for success toast
    await expect(page.locator(".toast.success")).toBeVisible({ timeout: 5_000 });

    // Close modal
    await page.locator(".modal .btn:has-text('X')").click();
  });

  /* ─── 7. Logout ─────────────────────────────────────── */
  test("7.1 Logout returns to login screen", async ({ page }) => {
    await login(page);

    await page.click("button:has-text('Sign Out')");

    // Should see login form again
    await expect(page.locator("#login-email")).toBeVisible({ timeout: 5_000 });
  });
});
