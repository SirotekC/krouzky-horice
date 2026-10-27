import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kapacitaZHtml, parsujKapacitu, popisKapacity, stejnaKapacita } from '../scripts/monitor/kapacita.mjs';

const PRAVIDLA = { obsah: '#krouzky_detail', kapacita: { radek: '^Volná místa\\b' } };

function detailDdm(mista) {
  return `<html><body><div id="krouzky_detail"><table>
<tr class="radek"><td class="color_02 bold">Termín</td><td>ÚT 16:00-17:00</td></tr>
${mista == null ? '' : `<tr class="radek"><td class="color_02 bold">Volná místa</td><td><span class="bold" style="color: green;">${mista}</span></td></tr>`}
</table></div></body></html>`;
}

test('parsujKapacitu: hodnoty z webu DDM', () => {
  assert.deepEqual(parsujKapacitu('Volno'), { stav: 'volno' });
  assert.deepEqual(parsujKapacitu('Obsazeno'), { stav: 'obsazeno' });
  assert.deepEqual(parsujKapacitu('Přijímáme náhradníky'), { stav: 'nahradnici' });
  assert.deepEqual(parsujKapacitu('Poslední místo'), { stav: 'posledni', volna_mista: 1 });
  assert.deepEqual(parsujKapacitu('Poslední místo!'), { stav: 'posledni', volna_mista: 1 });
  assert.deepEqual(parsujKapacitu('Poslední 3 místa'), { stav: 'posledni', volna_mista: 3 });
  assert.deepEqual(parsujKapacitu('Posledních 5 míst'), { stav: 'posledni', volna_mista: 5 });
  assert.deepEqual(parsujKapacitu('Poslední místa'), { stav: 'posledni' });
});

test('parsujKapacitu: neznámá hodnota se zkrátí na 40 znaků', () => {
  const k = parsujKapacitu(`Kontaktujte ${'x'.repeat(100)}`);
  assert.equal(k.stav, null);
  assert.equal(k.neznama.length, 40);
});

test('kapacitaZHtml najde řádek „Volná místa“, bez něj vrátí null', () => {
  assert.deepEqual(kapacitaZHtml(detailDdm('Poslední 3 místa'), PRAVIDLA), { stav: 'posledni', volna_mista: 3 });
  assert.deepEqual(kapacitaZHtml(detailDdm('Obsazeno'), PRAVIDLA), { stav: 'obsazeno' });
  assert.equal(kapacitaZHtml(detailDdm(null), PRAVIDLA), null);
});

test('kapacitaZHtml: buňky zalomené na víc řádků (jako na skutečném webu DDM)', () => {
  const html = `<html><body><div id="krouzky_detail"><table>
          <tr class="radek">
            <td class="color_02 bold">Volná místa</td>
            <td><span class="bold" style="color: orange;">Obsazeno</span></td>
          </tr>
  </table><a href="/krouzky">zpět na kroužky</a></div></body></html>`;
  assert.deepEqual(kapacitaZHtml(html, PRAVIDLA), { stav: 'obsazeno' });
});

test('stejnaKapacita: počet míst rozhoduje jen u „posledni“', () => {
  assert.ok(stejnaKapacita({ stav: 'volno' }, { stav: 'volno' }));
  assert.ok(!stejnaKapacita({ stav: 'volno' }, { stav: 'obsazeno' }));
  assert.ok(!stejnaKapacita({ stav: 'volno' }, null));
  assert.ok(stejnaKapacita({ stav: 'posledni', volna_mista: 2 }, { stav: 'posledni', volna_mista: 2 }));
  assert.ok(!stejnaKapacita({ stav: 'posledni', volna_mista: 2 }, { stav: 'posledni', volna_mista: 3 }));
  assert.ok(!stejnaKapacita({ stav: null, neznama: 'x' }, { stav: 'volno' }));
});

test('popisKapacity', () => {
  assert.equal(popisKapacity({ stav: 'posledni', volna_mista: 1 }), 'poslední místo');
  assert.equal(popisKapacity({ stav: 'nahradnici' }), 'berou náhradníky');
  assert.equal(popisKapacity(null), 'neuvedeno');
  assert.equal(popisKapacity({ stav: null, neznama: 'Plno' }), 'neznámá hodnota „Plno“');
});
