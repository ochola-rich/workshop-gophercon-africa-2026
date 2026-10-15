// The globe: dotted land, a glassy rim, and a dot per country with sightings.
// Dots are HTML buttons laid over the canvas, so they work with a keyboard
// and screen readers; wheel.js opens the animal wheel when one is chosen.
import { mount } from '/assets/js/threejs.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const R = 1.6;
const WORLD = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const places = JSON.parse(document.getElementById('globe-data')?.textContent || '[]') || [];

mount('globe', function ({ THREE, scene, camera, renderer, canvas, colour, still }) {
	const toVec = (lat, lng, r) => {
		const la = (lat * Math.PI) / 180;
		const ln = (lng * Math.PI) / 180;
		return new THREE.Vector3(r * Math.cos(la) * Math.sin(ln), r * Math.sin(la), r * Math.cos(la) * Math.cos(ln));
	};

	const accent = colour('--amber', '#E8A33D');
	const land = colour('--globe-land', '#9A9A96');
	const line = colour('--globe-line', '#2A2A2A');

	// Body: a near-black ball with a soft glass rim, like a bubble.
	scene.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), new THREE.MeshBasicMaterial({ color: '#0C0C0C' })));
	scene.add(rim(THREE, R * 1.002, 2.6, 0.55, THREE.FrontSide));
	scene.add(rim(THREE, R * 1.14, 4.0, 0.35, THREE.BackSide));

	// Graticule every 30 degrees.
	const grid = [];
	for (let lat = -60; lat <= 60; lat += 30) {
		for (let lng = 0; lng < 360; lng += 3) grid.push(toVec(lat, lng, R * 1.001), toVec(lat, lng + 3, R * 1.001));
	}
	for (let lng = 0; lng < 360; lng += 30) {
		for (let lat = -90; lat < 90; lat += 3) grid.push(toVec(lat, lng, R * 1.001), toVec(lat + 3, lng, R * 1.001));
	}
	scene.add(
		new THREE.LineSegments(
			new THREE.BufferGeometry().setFromPoints(grid),
			new THREE.LineBasicMaterial({ color: line, transparent: true, opacity: 0.5 }),
		),
	);

	loadLand(THREE, toVec, land, line).then((objects) => {
		objects.forEach((o) => scene.add(o));
		requestRender();
	});

	// A dot and a short spike per place, the spike as tall as it's busy.
	const max = Math.max(1, ...places.map((p) => p.count));
	const dotGeo = new THREE.SphereGeometry(0.014, 12, 12);
	const dotMat = new THREE.MeshBasicMaterial({ color: accent });
	const spikeMat = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.8 });
	const anchors = places.map((p) => {
		const at = toVec(p.lat, p.lng, R * 1.003);
		const dot = new THREE.Mesh(dotGeo, dotMat);
		dot.position.copy(at);
		scene.add(dot);
		const tip = toVec(p.lat, p.lng, R * (1.02 + 0.12 * Math.sqrt(p.count / max)));
		scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([at, tip]), spikeMat));
		return tip;
	});

	// HTML markers over the canvas.
	const layer = document.querySelector('[data-markers]');
	const markers = places.map((p, i) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'marker';
		b.dataset.place = String(i);
		b.style.setProperty('--s', String(0.5 + 0.7 * Math.sqrt(p.count / max)));
		const kinds = p.animals.length;
		const name = p.region ? p.region + ', ' + p.country : p.country;
		b.setAttribute('aria-label', name + ': ' + p.count + ' sightings of ' + kinds + (kinds === 1 ? ' animal' : ' animals'));
		const label = document.createElement('span');
		label.className = 'marker__label';
		label.textContent = name;
		b.append(label);
		layer?.append(b);
		return b;
	});

	camera.position.copy(toVec(8, 22, 7));
	const controls = new OrbitControls(camera, canvas);
	controls.enablePan = false;
	controls.enableZoom = false;
	controls.enableDamping = !still;
	controls.rotateSpeed = 0.5;
	controls.autoRotate = !still;
	controls.autoRotateSpeed = 0.35;
	controls.addEventListener('start', () => (controls.autoRotate = false));
	controls.addEventListener('change', () => still && requestRender());

	// Flying: the camera swings round to face a place.
	let flight = null;
	const home = 4.9;
	flyTo(camera.position.clone().normalize(), home, 1.8);

	function flyTo(dir, dist, seconds) {
		flight = {
			from: camera.position.clone().normalize(),
			to: dir.clone().normalize(),
			d0: camera.position.length(),
			d1: dist,
			t: 0,
			seconds,
		};
		if (still) {
			step(1e9);
			requestRender();
		}
	}

	function step(delta) {
		if (!flight) return;
		flight.t = Math.min(1, flight.t + delta / flight.seconds);
		const e = 1 - Math.pow(1 - flight.t, 3);
		const q = new THREE.Quaternion().setFromUnitVectors(flight.from, flight.to);
		const dir = flight.from.clone().applyQuaternion(new THREE.Quaternion().slerp(q, e));
		camera.position.copy(dir.multiplyScalar(flight.d0 + (flight.d1 - flight.d0) * e));
		camera.lookAt(0, 0, 0);
		if (flight.t >= 1) flight = null;
	}

	// Zoom by buttons rather than the scroll wheel, so the page still scrolls.
	const NEAR = 2.2;
	const FAR = 6.5;
	let rest = home;
	document.querySelectorAll('[data-zoom]').forEach((b) => {
		b.addEventListener('click', () => {
			const d = camera.position.length() * (b.dataset.zoom === 'in' ? 0.72 : 1.38);
			rest = Math.min(FAR, Math.max(NEAR, d));
			controls.autoRotate = false;
			flyTo(camera.position.clone().normalize(), rest, 0.35);
		});
	});

	window.addEventListener('place:open', (e) => {
		const p = places[e.detail.index];
		if (!p) return;
		controls.autoRotate = false;
		rest = camera.position.length();
		markers.forEach((m, i) => m.classList.toggle('is-active', i === e.detail.index));
		flyTo(toVec(p.lat, p.lng, 1), Math.min(rest, 2.9), 1.1);
	});
	window.addEventListener('place:close', () => {
		markers.forEach((m) => m.classList.remove('is-active'));
		flyTo(camera.position.clone().normalize(), rest, 0.9);
	});

	// Keep each marker over its spike, hidden when it's round the back.
	const v = new THREE.Vector3();
	const eye = new THREE.Vector3();
	function placeMarkers() {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		eye.copy(camera.position).normalize();
		anchors.forEach((a, i) => {
			const m = markers[i];
			const facing = v.copy(a).normalize().dot(eye) > 0.22;
			if (facing !== !m.classList.contains('is-behind')) {
				m.classList.toggle('is-behind', !facing);
				m.tabIndex = facing ? 0 : -1;
				m.setAttribute('aria-hidden', facing ? 'false' : 'true');
			}
			if (!facing) return;
			v.copy(a).project(camera);
			m.style.transform = 'translate(' + ((v.x + 1) / 2) * w + 'px,' + ((1 - v.y) / 2) * h + 'px)';
		});
	}

	function requestRender() {
		placeMarkers();
		renderer.render(scene, camera);
	}

	return function (time, delta) {
		if (flight) step(delta);
		else controls.update(delta);
		placeMarkers();
	};
});

// rim is a fresnel glow: bright at the edge, clear in the middle.
function rim(THREE, radius, power, strength, side) {
	return new THREE.Mesh(
		new THREE.SphereGeometry(radius, 96, 96),
		new THREE.ShaderMaterial({
			side,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			uniforms: { power: { value: power }, strength: { value: strength } },
			vertexShader: `
				varying vec3 vNormal;
				varying vec3 vView;
				void main() {
					vec4 mv = modelViewMatrix * vec4(position, 1.0);
					vNormal = normalize(normalMatrix * normal);
					vView = normalize(-mv.xyz);
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: `
				uniform float power;
				uniform float strength;
				varying vec3 vNormal;
				varying vec3 vView;
				void main() {
					float d = abs(dot(vNormal, vView));
					float f = ${side === THREE.BackSide ? 'pow(clamp(d * 2.1, 0.0, 1.0), power)' : 'pow(1.0 - d, power)'};
					gl_FragColor = vec4(vec3(0.92, 0.92, 0.9), f * strength);
				}`,
		}),
	);
}

// loadLand turns the world atlas into a field of dots and faint borders.
async function loadLand(THREE, toVec, land, line) {
	try {
		const [{ feature, mesh }, { geoContains }, topo] = await Promise.all([
			import('topojson-client'),
			import('d3-geo'),
			fetch(WORLD).then((r) => r.json()),
		]);
		const shape = feature(topo, topo.objects.land);
		const dots = [];
		for (let lat = -84; lat <= 84; lat += 1.5) {
			const ring = Math.max(1, Math.round(240 * Math.cos((lat * Math.PI) / 180)));
			for (let k = 0; k < ring; k++) {
				const lng = -180 + (360 * k) / ring;
				if (geoContains(shape, [lng, lat])) dots.push(toVec(lat, lng, R * 1.002));
			}
		}
		const points = new THREE.Points(
			new THREE.BufferGeometry().setFromPoints(dots),
			new THREE.PointsMaterial({ color: land, size: 0.016, sizeAttenuation: true, transparent: true, opacity: 0.85 }),
		);

		const borders = [];
		mesh(topo, topo.objects.countries, (a, b) => a !== b).coordinates.forEach((arc) => {
			for (let i = 1; i < arc.length; i++) {
				borders.push(toVec(arc[i - 1][1], arc[i - 1][0], R * 1.0025), toVec(arc[i][1], arc[i][0], R * 1.0025));
			}
		});
		const lines = new THREE.LineSegments(
			new THREE.BufferGeometry().setFromPoints(borders),
			new THREE.LineBasicMaterial({ color: line, transparent: true, opacity: 0.9 }),
		);
		return [points, lines];
	} catch (err) {
		console.warn('globe: no land outlines', err);
		return [];
	}
}
