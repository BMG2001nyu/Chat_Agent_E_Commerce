/**
 * PartSelect Chat Agent — Full Loom Demo Recording
 * Run: node scripts/record-demo.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', 'demo-output');
fs.mkdirSync(OUT_DIR, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function slowType(page, text, delayMs = 45) {
  const input = page.locator('input[placeholder="Ask about refrigerator or dishwasher parts..."]');
  await input.click();
  await input.fill('');
  for (const char of text) {
    await input.pressSequentially(char);
    await wait(delayMs);
  }
}

async function sendMessage(page, text, typeDelay = 45) {
  await slowType(page, text, typeDelay);
  await wait(600);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.typing-indicator', { state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForSelector('.typing-indicator', { state: 'hidden', timeout: 90000 });
  await wait(2000);
}

async function scrollMsgTo(page, position = 'bottom') {
  const el = page.locator('.messages-container');
  if (position === 'bottom') {
    await el.evaluate((c) => c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }));
  } else {
    await el.evaluate((c) => c.scrollTo({ top: 0, behavior: 'smooth' }));
  }
  await wait(900);
}

async function freshPage(context) {
  const page = await context.newPage();
  await page.goto(BASE);
  await page.evaluate(() => localStorage.removeItem('ps_cart'));
  await page.reload();
  await wait(1500);
  return page;
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1440,860', '--window-position=0,0'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 860 },
    recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 860 } },
  });

  // ═══════════════════════════════════════════════════════════
  // SCENE 1 — UI Overview & Branding
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 1: UI Overview');
  const page = await context.newPage();
  await page.goto(BASE);
  await page.evaluate(() => localStorage.removeItem('ps_cart'));
  await page.reload();
  await wait(2500);

  // Hover over each capability pill
  for (const txt of ['Catalog search', 'Model compatibility', 'Repair guidance', 'Order support']) {
    await page.locator(`.capability-list span:has-text("${txt}")`).hover();
    await wait(700);
  }
  await wait(1000);

  // Hover over quick action buttons
  for (const btn of ['Ice maker not working', 'Dishwasher not draining', 'Check compatibility', 'Installation help', 'Dishes not getting clean', 'Track my order']) {
    await page.locator(`.quick-action-btn:has-text("${btn}")`).hover();
    await wait(500);
  }
  await wait(1500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 2 — Model Memory: auto-extract model from conversation
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 2: Model number memory');
  await sendMessage(
    page,
    'My Whirlpool refrigerator model WRS325SDHZ01 has stopped making ice. What parts could be causing this?',
    38
  );

  // Show model indicator appeared in sidebar
  await page.locator('.model-indicator').hover();
  await wait(2000);

  // Scroll up to show full response text
  await scrollMsgTo(page, 'top');
  await wait(2500);

  // Scroll down to show product cards
  await scrollMsgTo(page, 'bottom');
  await wait(2500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 3 — Add All to Cart
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 3: Add all to cart');
  const addAllBtn = page.locator('button[class="add-all-btn"]').first();
  await addAllBtn.hover();
  await wait(1200);
  await addAllBtn.click();
  await wait(1000);

  // Pan to cart summary showing updated count
  await page.locator('.cart-summary').hover();
  await wait(2500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 4 — Persistent Cart: reload & cart survives
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 4: Cart persistence');
  await page.reload();
  await wait(3000);
  await page.locator('.cart-summary').hover();
  await wait(3000);

  // ═══════════════════════════════════════════════════════════
  // SCENE 5 — Installation Guide (required prompt #1)
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 5: Installation guide');
  await sendMessage(page, 'How can I install part number PS11752778?', 38);
  await scrollMsgTo(page, 'top');
  await wait(2000);
  // Slow scroll through guide
  const msgContainer = page.locator('.messages-container');
  for (let i = 1; i <= 5; i++) {
    await msgContainer.evaluate((c, pct) => c.scrollTo({ top: c.scrollHeight * pct, behavior: 'smooth' }), i * 0.2);
    await wait(1000);
  }
  await wait(2000);

  // ═══════════════════════════════════════════════════════════
  // SCENE 6 — Compatibility: NOT compatible (required prompt #2)
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 6: Compatibility — not compatible');
  await sendMessage(page, 'Is part PS11752778 compatible with my WDT780SAEM1 model?', 38);
  await scrollMsgTo(page, 'bottom');
  await wait(3500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 7 — Model Memory Across Turns
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 7: Model memory across turns');
  await page.close();
  const page2 = await freshPage(context);

  await sendMessage(page2, 'I have a WDT780SAEM1 dishwasher. Is part PS11747476 compatible?', 38);
  await scrollMsgTo(page2, 'bottom');
  await wait(2000);

  // Show model stored in sidebar
  await page2.locator('.model-indicator').hover();
  await wait(1500);

  // Ask follow-up WITHOUT repeating model
  await sendMessage(page2, 'What about part PS11752778 — is that also compatible with my model?', 38);
  await scrollMsgTo(page2, 'bottom');
  await wait(3500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 8 — Dishwasher Not Draining (required prompt #3)
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 8: Dishwasher not draining');
  await page2.close();
  const page3 = await freshPage(context);

  await sendMessage(page3, 'My dishwasher has standing water in the bottom after every cycle. It is not draining at all.', 38);
  await scrollMsgTo(page3, 'top');
  await wait(2000);
  await scrollMsgTo(page3, 'bottom');
  await wait(3000);

  // ═══════════════════════════════════════════════════════════
  // SCENE 9 — Order Tracking (lowercase input)
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 9: Order tracking');
  await sendMessage(page3, 'track my order ps-100422', 42);
  await scrollMsgTo(page3, 'bottom');
  await wait(3500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 10 — Scope Enforcement: dryer refused
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 10: Scope enforcement');
  await sendMessage(page3, 'My dryer stopped heating. Can you help me fix it?', 42);
  await scrollMsgTo(page3, 'bottom');
  await wait(3500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 11 — Dishes Not Getting Clean → correct spray arm diagnosis
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 11: Dishes not clean → spray arm');
  await page3.close();
  const page4 = await freshPage(context);

  await sendMessage(page4, 'My dishes are not getting clean even after a complete wash cycle. What should I check?', 38);
  await scrollMsgTo(page4, 'top');
  await wait(2000);
  await scrollMsgTo(page4, 'bottom');
  await wait(3500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 12 — Numeric part number resolves automatically
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 12: Numeric part number');
  await sendMessage(page4, 'Can you give me the installation steps for part 11752778?', 42);
  await scrollMsgTo(page4, 'bottom');
  await wait(3500);

  // ═══════════════════════════════════════════════════════════
  // SCENE 13 — Malformed payload returns 400 (API robustness)
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Scene 13: API validation demo');
  await page4.close();
  const page5 = await freshPage(context);

  // Type the ice maker quick action for a clean final demo
  await page5.locator('.quick-action-btn:has-text("Ice maker not working")').hover();
  await wait(800);
  await page5.locator('.quick-action-btn:has-text("Ice maker not working")').click();
  await page5.waitForSelector('.typing-indicator', { state: 'visible', timeout: 8000 }).catch(() => {});
  await page5.waitForSelector('.typing-indicator', { state: 'hidden', timeout: 90000 });
  await wait(2000);

  await scrollMsgTo(page5, 'top');
  await wait(1500);
  await scrollMsgTo(page5, 'bottom');
  await wait(2000);

  // Add single item to cart
  await page5.locator('.product-list .product-card:first-child button:has-text("Add to Cart")').click();
  await wait(1000);
  await page5.locator('.cart-summary').hover();
  await wait(3000);

  // ─── Hold final frame ──────────────────────────────────
  await wait(3000);

  await context.close();
  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'));
  console.log('\n✅ Recording complete!');
  console.log(`📁 Saved: ${path.join(OUT_DIR, files[0])}`);
  console.log(`📐 Size: ${(fs.statSync(path.join(OUT_DIR, files[0])).size / 1024 / 1024).toFixed(1)} MB`);
  console.log('\nTo convert to MP4 (if ffmpeg is available):');
  console.log(`   ffmpeg -i "${path.join(OUT_DIR, files[0])}" -c:v libx264 demo-recording.mp4\n`);
})();
