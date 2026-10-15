// Which species have a 3D model, keyed by scientific name as in facts.go.
// To add one: drop a .glb with an animation into web/assets/models/ and
// add a line here. `stripes` paints zebra stripes on the model (higher is
// narrower); `note` explains a stand-in model.
const horse = '/assets/models/horse.glb';
const ROME = 'three.js examples (ro.me, MIT)';

export const MODELS = {
	'Phoenicopterus roseus': { url: '/assets/models/flamingo.glb', flying: true, credit: ROME },
	'Ara macao': { url: '/assets/models/parrot.glb', flying: true, credit: ROME, note: 'Stand-in: a generic parrot' },
	'Equus quagga': { url: horse, stripes: 0.075, credit: ROME, note: 'Stand-in: a horse with zebra stripes' },
	'Equus grevyi': { url: horse, stripes: 0.12, credit: ROME, note: 'Stand-in: a horse with zebra stripes' },
	'Equus zebra': { url: horse, stripes: 0.09, credit: ROME, note: 'Stand-in: a horse with zebra stripes' },
};

export function modelFor(scientific) {
	return MODELS[scientific] || null;
}
