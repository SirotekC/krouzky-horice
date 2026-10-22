import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsujRobots, robotsZOdpovedi } from '../scripts/monitor/robots.mjs';

const UA = 'KrouzkyHorice-monitor/1.0 (+https://sirotekc.github.io/krouzky-horice/o-projektu.html)';

test('DDM robots: náš UA nezakázán, crawlDelay 1', () => {
  const r = parsujRobots('Crawl-delay: 1\n\nUser-agent: MJ12Bot\nDisallow: /\n', UA);
  assert.equal(r.povoleno('/krouzky'), true);
  assert.equal(r.crawlDelay, 1);
});

test('Disallow pro * zakazuje, delší Allow povoluje', () => {
  const r = parsujRobots('User-agent: *\nDisallow: /soukrome\nAllow: /soukrome/verejne\n', UA);
  assert.equal(r.povoleno('/soukrome/tajne'), false);
  assert.equal(r.povoleno('/soukrome/verejne/a'), true);
  assert.equal(r.povoleno('/jinam'), true);
  assert.equal(r.crawlDelay, null);
});

test('při shodné délce vyhrává Allow; podpora * a $', () => {
  const r = parsujRobots('User-agent: *\nDisallow: /a\nAllow: /a\nDisallow: /*.pdf$\n', UA);
  assert.equal(r.povoleno('/a/x'), true);
  assert.equal(r.povoleno('/b/soubor.pdf'), false);
  assert.equal(r.povoleno('/b/soubor.pdf?x=1'), true);
});

test('skupina pro náš UA má přednost před *', () => {
  const text = 'User-agent: *\nDisallow: /\nCrawl-delay: 9\n\nUser-agent: KrouzkyHorice\nDisallow: /tajne\nCrawl-delay: 3\n';
  const r = parsujRobots(text, UA);
  assert.equal(r.povoleno('/krouzky'), true);
  assert.equal(r.povoleno('/tajne/x'), false);
  assert.equal(r.crawlDelay, 3);
});

test('prázdný Disallow nic nezakazuje', () => {
  const r = parsujRobots('User-agent: *\nDisallow:\n', UA);
  assert.equal(r.povoleno('/cokoli'), true);
});

test('429 = nedostupný (jako 5xx), ne „vše povoleno“', () => {
  const r = robotsZOdpovedi(429, null, UA);
  assert.equal(r.stav, 'nedostupny');
  assert.equal(r.pravidla, null);
});

test('404 = vše povoleno, 503 a síťová chyba = nedostupný', () => {
  const ok = robotsZOdpovedi(404, null, UA);
  assert.equal(ok.stav, 'ok');
  assert.equal(ok.pravidla.povoleno('/x'), true);
  assert.equal(robotsZOdpovedi(503, null, UA).stav, 'nedostupny');
  assert.equal(robotsZOdpovedi(null, null, UA).stav, 'nedostupny');
  const dvesta = robotsZOdpovedi(200, 'User-agent: *\nDisallow: /x\n', UA);
  assert.equal(dvesta.stav, 'ok');
  assert.equal(dvesta.pravidla.povoleno('/x'), false);
});
