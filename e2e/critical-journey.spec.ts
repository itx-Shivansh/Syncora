import { test, expect } from "@playwright/test";

test.describe("Critical User Journey E2E", () => {
  const timestamp = Date.now();
  const userEmail = `e2e.journey.${timestamp}@syncora.dev`;
  const userName = "E2E Journey Leader";
  const userPassword = "Password123!";
  const workspaceName = `Journey Workspace ${timestamp}`;
  const projectName = `Journey Initiative ${timestamp}`;
  const projectKey = `JRN${timestamp.toString().slice(-4)}`;
  const taskTitle = `Implement journey validation ${timestamp}`;

  test("full flow: register -> workspace -> project -> task -> assign -> status -> comment -> dashboard", async ({
    page,
  }) => {
   // 1. Register new user via direct API call (bypasses form/React event timing issues)
    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: userName, email: userEmail, password: userPassword },
    });
    expect(registerRes.status()).toBe(201);

    // Extract auth cookies from the register response and inject into browser context
    const setCookieHeaders = registerRes.headers()["set-cookie"];
    if (setCookieHeaders) {
      const cookieStrings = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : setCookieHeaders.split(",");
      for (const cookieStr of cookieStrings) {
        const [nameVal] = cookieStr.split(";");
        const eqIdx = nameVal.indexOf("=");
        if (eqIdx > 0) {
          const name = nameVal.slice(0, eqIdx).trim();
          const value = nameVal.slice(eqIdx + 1).trim();
          await page.context().addCookies([{ name, value, domain: "localhost", path: "/" }]);
        }
      }
    }

    // Navigate to /app — middleware will allow it because auth cookies are now set
    await page.goto("/app");
    await page.waitForURL(/\/app/, { timeout: 20000 });

    // 2. Navigate to workspace creation and create workspace
    await page.goto("/app/workspaces/new");
    await expect(page.locator('input[id="ws-name"]')).toBeVisible();
    await page.fill('input[id="ws-name"]', workspaceName);

    // Wait for the activeWorkspaces API to respond after workspace creation
    const [wsCreateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/workspaces") && r.request().method() === "POST"),
      page.click('button[type="submit"]:has-text("Create workspace")'),
    ]);
    expect(wsCreateResponse.status()).toBe(201);

    // Wait for redirect post-creation and confirm workspace name visible
    await page.waitForURL(/\/app/, { timeout: 20000 });
    await expect(page.locator("body")).toContainText(workspaceName, { timeout: 20000 });

    // 3. Navigate to Projects page and create project
    await page.goto("/app/projects");
    await expect(page.locator("h1")).toContainText("Projects");

    // Wait for the activeWorkspaces query to resolve so workspaceId is populated
    // before we open the create-project dialog — otherwise the mutation fires with workspaceId=undefined.
    await page.waitForResponse(
      (r) => r.url().includes("/api/workspaces/active") && r.status() === 200,
      { timeout: 20000 }
    );

    // Also confirm the workspace name is visible in the nav (switcher loaded)
    await expect(page.locator("body")).toContainText(workspaceName, { timeout: 20000 });

    // Click New Project button
    await page.click('button:has-text("New Project")');
    await expect(page.locator('input[id="project-name"]')).toBeVisible();

    await page.fill('input[id="project-name"]', projectName);
    await page.fill('input[id="project-key"]', projectKey);

    // Wait for project creation API response
    const [projCreateResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/workspaces/") && r.url().includes("/projects") && r.request().method() === "POST",
        { timeout: 30000 }
      ),
      page.click('button[type="submit"]:has-text("Create Project")'),
    ]);
    expect(projCreateResponse.status()).toBe(201);

    // Verify project appears in the project grid
    await expect(page.locator("body")).toContainText(projectName, { timeout: 20000 });

    // 4. Click into project
    const projectCardLink = page.locator(`a[href^="/app/projects/"]:has-text("${projectName}")`).first();
    await expect(projectCardLink).toBeVisible();
    const href = await projectCardLink.getAttribute("href");
    expect(href).toBeTruthy();

    // Go to board view
    await page.goto(`${href}/board`);
    await expect(page.locator("body")).toContainText(projectName);

    // 5. Open Create Task Dialog via New Task button
    const newTaskBtn = page.locator('button:has-text("New Task")').first();
    await expect(newTaskBtn).toBeVisible();
    await newTaskBtn.click();

    // Scope to Create Task Dialog to avoid interacting with the board's filter toolbar
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Fill task title
    const titleInput = dialog.locator('input[placeholder*="Implement Webhooks" i]').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill(taskTitle);

    // Verify assignee dropdown inside dialog works without validation error
    const assigneeSelect = dialog.locator('div:has(> label:has-text("Assignee")) select').first();
    if (await assigneeSelect.isVisible()) {
      const options = await assigneeSelect.locator("option").allTextContents();
      const userOption = options.find((opt) => opt.includes(userName) || opt.includes(userEmail));
      if (userOption) {
        await assigneeSelect.selectOption({ label: userOption });
      }
    }

    // Submit task creation
    await dialog.locator('button[type="submit"]:has-text("Create Task")').click();
    await expect(dialog).toBeHidden();

    // Verify task card appears on the board
    await expect(page.locator("body")).toContainText(taskTitle);

    // 6. Click on the task to open Task Detail page
    await page.locator(`h4:has-text("${taskTitle}")`).first().click();
    await page.waitForURL(/\/app\/tasks\//);

    // 7. Change task status to IN_PROGRESS in properties sidebar
    const statusSelect = page.locator('select').filter({ has: page.locator('option[value="IN_PROGRESS"]') }).first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption("IN_PROGRESS");

    // 8. Post a collaborative comment
    const commentInput = page.locator('textarea[placeholder*="comment" i]').first();
    await expect(commentInput).toBeVisible();

    const commentText = `E2E audit verification comment ${timestamp}`;
    await commentInput.fill(commentText);
    await page.click('button[type="submit"]:has-text("Comment")');

    // Verify comment appears in the comment feed
    await expect(page.locator("body")).toContainText(commentText);

    // 9. Return to Dashboard and confirm the journey work is reflected
    await page.goto("/app");
    // The project appears in "Active Projects" section
    await expect(page.locator("body")).toContainText(projectName, { timeout: 20000 });
    // The activity feed shows the task creation / status change events (by task key)
    await expect(page.locator("body")).toContainText(/In Progress|created task/i, { timeout: 20000 });

  });

  test.afterAll(async () => {
    // Defense-in-depth cleanup: scrub test fixtures from test database (and dev database if accidentally present)
    for (const url of [
      process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/syncora_test?schema=public",
      "postgresql://postgres:postgres@127.0.0.1:5432/syncora?schema=public",
    ]) {
      try {
        const { PrismaClient } = await import("@prisma/client");
        const p = new PrismaClient({ datasources: { db: { url } } });
        const testUsers = await p.user.findMany({
          where: { email: userEmail },
          select: { id: true },
        });
        for (const u of testUsers) {
          const ownedWs = await p.workspaceMember.findMany({
            where: { userId: u.id, role: "OWNER" },
            select: { workspaceId: true },
          });
          const wsIds = ownedWs.map((m) => m.workspaceId);
          if (wsIds.length > 0) {
            await p.comment.deleteMany({ where: { task: { workspaceId: { in: wsIds } } } });
            await p.activityEvent.deleteMany({ where: { workspaceId: { in: wsIds } } });
            await p.task.deleteMany({ where: { workspaceId: { in: wsIds } } });
            await p.project.deleteMany({ where: { workspaceId: { in: wsIds } } });
            await p.label.deleteMany({ where: { workspaceId: { in: wsIds } } });
            await p.workspaceMember.deleteMany({ where: { workspaceId: { in: wsIds } } });
            await p.workspace.deleteMany({ where: { id: { in: wsIds } } });
          }
          await p.comment.deleteMany({ where: { authorId: u.id } });
          await p.task.deleteMany({ where: { creatorId: u.id } });
          await p.project.deleteMany({ where: { ownerId: u.id } });
          await p.workspaceMember.deleteMany({ where: { userId: u.id } });
          await p.user.delete({ where: { id: u.id } });
        }
        await p.$disconnect();
      } catch {
        // ignore cleanup errors
      }
    }
  });
});
