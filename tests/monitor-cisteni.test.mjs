import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dekoduj, htmlNaText, odkazyPrehledu, otisk, verzePravidel, jeHtml } from '../scripts/monitor/cisteni.mjs';

const PRAVIDLA = { obsah: '#krouzky_detail', odstranitRadky: ['^Volná místa\\b'] };

function detailDdm({ cas = 'ÚT 16:00-17:00', mista = 'Poslední 3 místa', menu = 'Domů' } = {}) {
  return `<html><head><title>x</title><script>var a=1;</script></head><body>
<nav><a href="/">${menu}</a></nav>
<div id="krouzky_detail"><h1>Latino Kids</h1>
<div class="box"><p>Taneční kroužek pro děti.</p></div>
<div class="box"><table>
<tr class="radek"><td class="color_02 bold">Termín</td><td>${cas}</td></tr>
<tr class="radek"><td class="color_02 bold">Volná místa</td><td><span class="bold" style="color: green;">${mista}</span></td></tr>
</table></div></div>
<footer>Patička ${menu}</footer></body></html>`;
}

test('detail DDM: změna volných míst nemění otisk', () => {
  const a = htmlNaText(detailDdm({ mista: 'Poslední 3 místa' }), PRAVIDLA);
  const b = htmlNaText(detailDdm({ mista: 'Obsazeno' }), PRAVIDLA);
  assert.equal(otisk(a), otisk(b));
  assert.ok(!a.includes('Volná místa'));
  assert.ok(a.includes('Termín ÚT 16:00-17:00'));
});

test('detail DDM: změna času mění otisk', () => {
  const a = htmlNaText(detailDdm({ cas: 'ÚT 16:00-17:00' }), PRAVIDLA);
  const b = htmlNaText(detailDdm({ cas: 'ÚT 16:30-17:30' }), PRAVIDLA);
  assert.notEqual(otisk(a), otisk(b));
});

test('menu a patička se ignorují', () => {
  const a = htmlNaText(detailDdm({ menu: 'Domů' }));
  const b = htmlNaText(detailDdm({ menu: 'Úvod' }));
  assert.equal(a, b);
});

test('windows-1250 podle hlavičky i podle meta', () => {
  const slovo = Buffer.from([0x9e, 0x6c, 0x75, 0x9d, 0x6f, 0x75, 0xe8, 0x6b, 0xfd]);
  assert.equal(dekoduj(slovo, 'text/html; charset=windows-1250'), 'žluťoučký');
  const telo = Buffer.concat([Buffer.from('<html><head><meta charset="windows-1250"></head><body>'), slovo]);
  assert.ok(dekoduj(telo, 'text/html').endsWith('žluťoučký'));
  const telo2 = Buffer.concat([
    Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=windows-1250">'),
    slovo,
  ]);
  assert.ok(dekoduj(telo2, null).endsWith('žluťoučký'));
  assert.equal(dekoduj(Buffer.from('žluťoučký', 'utf8'), 'text/html'), 'žluťoučký');
});

test('odkazyPrehledu vrací absolutní, unikátní, seřazené odkazy podle vzoru', () => {
  const html = `<a href="./krouzky/1000-latino-kids">a</a><a href="./krouzky/999-hip-hop">b</a>
<a href="./krouzky/1000-latino-kids#x">c</a><a href="/kontakty">d</a>`;
  const odkazy = odkazyPrehledu(html, 'https://www.ddmhorice.cz/krouzky', '^https://www\\.ddmhorice\\.cz/krouzky/\\d+-');
  assert.deepEqual(odkazy, [
    'https://www.ddmhorice.cz/krouzky/1000-latino-kids',
    'https://www.ddmhorice.cz/krouzky/999-hip-hop',
  ]);
});

test('verzePravidel se mění se změnou pravidel', () => {
  assert.equal(verzePravidel(undefined), verzePravidel({}));
  assert.notEqual(verzePravidel(PRAVIDLA), verzePravidel({ obsah: '#x' }));
  assert.match(verzePravidel(PRAVIDLA), /^[0-9a-f]{64}$/);
});

test('jeHtml', () => {
  assert.equal(jeHtml('text/html; charset=utf-8'), true);
  assert.equal(jeHtml('application/xhtml+xml'), true);
  assert.equal(jeHtml('image/jpeg'), false);
  assert.equal(jeHtml(null), false);
});

test('HTML entity se dekódují a NBSP je mezera', () => {
  const pravidla = { odstranitRadky: ['^Volná místa\\b'] };
  const entity = '<body><div>Volná&nbsp;m&iacute;sta Obsazeno</div><div>Term&iacute;n A &amp; B</div></body>';
  const znaky = '<body><div>Volná místa Obsazeno</div><div>Termín A & B</div></body>';
  const text = htmlNaText(entity, pravidla);
  assert.equal(text, 'Termín A & B');
  assert.equal(otisk(text), otisk(htmlNaText(znaky, pravidla)));
  assert.equal(htmlNaText('<p>V&aacute;clav</p>'), 'Václav');
});

test('stránka celá v <form> se nevyprázdní', () => {
  const text = htmlNaText('<body><form><div>Rozvrh</div><div>ÚT 16:00</div></form></body>');
  assert.equal(text, 'Rozvrh\nÚT 16:00');
});
