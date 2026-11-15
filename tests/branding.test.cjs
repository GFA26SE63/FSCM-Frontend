const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Branding Assets: all required branding image files exist in src/assets/branding', () => {
  const brandingDir = path.resolve(__dirname, '../src/assets/branding');
  assert.ok(fs.existsSync(brandingDir), 'Branding directory must exist');

  const requiredFiles = ['fscm-logo.png', 'fscm-app-icon.png', 'fscm-splash-logo.png'];
  for (const file of requiredFiles) {
    const filePath = path.join(brandingDir, file);
    assert.ok(fs.existsSync(filePath), `Required branding file ${file} must exist`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 0, `Branding file ${file} must not be empty`);
  }
});

test('Branding Favicon: public directory contains updated favicon files and index.html references favicon.png', () => {
  const publicFaviconPng = path.resolve(__dirname, '../public/favicon.png');
  const publicFaviconIco = path.resolve(__dirname, '../public/favicon.ico');
  assert.ok(fs.existsSync(publicFaviconPng), 'public/favicon.png must exist');
  assert.ok(fs.existsSync(publicFaviconIco), 'public/favicon.ico must exist');

  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert.ok(indexHtml.includes('href="/favicon.png"'), 'index.html must reference /favicon.png');
});

test('Branding Sidebar: displays fscm-logo with object-fit: contain and proper alt text', () => {
  const sidebarCode = fs.readFileSync(
    path.resolve(__dirname, '../src/app/layout/Sidebar.tsx'),
    'utf8',
  );

  assert.ok(sidebarCode.includes('fscm-logo.png'), 'Sidebar must reference fscm-logo.png');
  assert.ok(sidebarCode.includes('alt="FSCM Logo"'), 'Sidebar logo must have alt text');
  assert.ok(sidebarCode.includes('brand-logo-img'), 'Sidebar logo must use brand-logo-img class');

  const layoutCss = fs.readFileSync(
    path.resolve(__dirname, '../src/app/layout/layout.css'),
    'utf8',
  );
  assert.ok(layoutCss.includes('.brand-logo-img'), 'layout.css must define .brand-logo-img');
  assert.ok(layoutCss.includes('object-fit: contain'), 'Logo image must preserve aspect ratio via object-fit: contain');
});

test('Branding LoginPage: displays fscm-logo on login card with object-fit: contain and proper layout', () => {
  const loginCode = fs.readFileSync(
    path.resolve(__dirname, '../src/app/pages/LoginPage.tsx'),
    'utf8',
  );

  assert.ok(loginCode.includes('fscm-logo.png'), 'LoginPage must reference fscm-logo.png');
  assert.ok(loginCode.includes('alt="FSCM Logo"'), 'LoginPage logo must have alt text');
  assert.ok(loginCode.includes("objectFit: 'contain'"), 'LoginPage logo must specify objectFit: contain');
  assert.ok(loginCode.includes('FSCM Portal'), 'LoginPage must preserve portal title');
});

