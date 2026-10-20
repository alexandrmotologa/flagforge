import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve(process.cwd(), 'docs', 'images');
const FRAMES_DIR = path.resolve(process.cwd(), '.temp_frames');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function run() {
  console.log('Launching browser for screenshots and animated demo...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:4900', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2000));

  console.log('Capturing Screenshot 1: Rollout Studio...');
  await page.screenshot({ path: path.join(OUT_DIR, 'flagforge-1.png'), fullPage: false });

  let frameIdx = 0;
  const captureFrame = async (durationMs = 500) => {
    const framePath = path.join(FRAMES_DIR, `frame_${String(frameIdx++).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath, fullPage: false });
    await new Promise((r) => setTimeout(r, durationMs));
  };

  // Record initial view
  await captureFrame(400);
  await captureFrame(400);

  // Switch to Simulator tab
  console.log('Capturing Screenshot 2: Blast Simulator...');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Blast Simulator')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, 'flagforge-2.png'), fullPage: false });
  await captureFrame(600);
  await captureFrame(600);

  // Switch to Scanner tab
  console.log('Capturing Screenshot 3: Dead Flag Scanner...');
  const navButtons = await page.$$('button');
  for (const b of navButtons) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Dead Flag Scanner')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));

  // Click Scan Codebase
  const scanBtn = await page.$('button');
  const allBtns = await page.$$('button');
  for (const b of allBtns) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Scan Codebase AST')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, 'flagforge-3.png'), fullPage: false });
  await captureFrame(600);
  await captureFrame(600);

  // Switch to Playground tab
  console.log('Capturing Screenshot 4: OpenFeature Playground...');
  const navButtons2 = await page.$$('button');
  for (const b of navButtons2) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('OpenFeature SDKs')) {
      await b.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, 'flagforge-4.png'), fullPage: false });
  await captureFrame(600);
  await captureFrame(600);

  await browser.close();
  console.log('All screenshots captured successfully.');

  // Render animated GIF via ffmpeg
  console.log('Generating animated demo GIF with ffmpeg...');
  const gifOut = path.join(OUT_DIR, 'flagforge_demo.gif');
  try {
    execSync(
      `ffmpeg -y -framerate 1.5 -i "${FRAMES_DIR}\\frame_%04d.png" -vf "fps=10,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${gifOut}"`,
      { stdio: 'inherit' }
    );
    console.log('Demo GIF successfully created at:', gifOut);
  } catch (err) {
    console.error('Error rendering GIF:', err.message);
  }

  // Cleanup temp frames
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}

run().catch(console.error);
