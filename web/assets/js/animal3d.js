// A small three.js stage for one animated animal in the animal card.
// One renderer is reused; models load on demand and play their first clip.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = new GLTFLoader();

export function createViewer(canvas) {
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
	renderer.setClearColor(0x000000, 0);
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 100);
	camera.position.set(3.2, 1.4, 3.6);

	scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6b66, 2.2));
	const sun = new THREE.DirectionalLight(0xffffff, 2.4);
	sun.position.set(3, 5, 2);
	scene.add(sun);

	const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({
		map: shadowTexture(),
		transparent: true,
		depthWrite: false,
	}));
	shadow.rotation.x = -Math.PI / 2;
	scene.add(shadow);

	const controls = new OrbitControls(camera, canvas);
	controls.enablePan = false;
	controls.enableDamping = !still;
	controls.minDistance = 2.5;
	controls.maxDistance = 9;
	controls.autoRotate = !still;
	controls.autoRotateSpeed = 1.2;
	controls.addEventListener('start', () => (controls.autoRotate = false));
	controls.addEventListener('change', () => still && draw());

	const timer = new THREE.Timer();
	let current = null;
	let token = 0;
	let running = false;

	new ResizeObserver(resize).observe(canvas.parentElement);

	function resize() {
		const w = canvas.parentElement.clientWidth;
		const h = canvas.parentElement.clientHeight;
		if (!w || !h) return;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		draw();
	}

	function draw() {
		renderer.render(scene, camera);
	}

	function loop(timestamp) {
		timer.update(timestamp);
		const dt = timer.getDelta();
		const t = timer.getElapsed();
		if (current) {
			current.mixer.update(dt);
			if (current.flying) current.root.position.y = current.baseY + Math.sin(t * 2) * 0.06;
		}
		controls.update(dt);
		draw();
	}

	async function show(entry) {
		const mine = ++token;
		clear();
		const gltf = await loader.loadAsync(entry.url);
		if (mine !== token) return false;

		const root = gltf.scene;
		root.traverse((o) => {
			if (!o.isMesh) return;
			o.frustumCulled = false;
			o.material = o.material.clone();
			o.material.flatShading = false;
			if (entry.stripes) paintStripes(o.material, entry.stripes);
		});

		// Fit: about 2 units long, standing on (or hovering over) the ground.
		const box = new THREE.Box3().setFromObject(root);
		const size = box.getSize(new THREE.Vector3());
		const scale = 2 / Math.max(size.x, size.y, size.z);
		root.scale.setScalar(scale);
		box.setFromObject(root);
		const centre = box.getCenter(new THREE.Vector3());
		root.position.x -= centre.x;
		root.position.z -= centre.z;
		root.position.y -= box.min.y;
		if (entry.flying) root.position.y += 0.35;

		const height = box.max.y - box.min.y;
		controls.target.set(0, root.position.y + height / 2 - (entry.flying ? 0.2 : 0), 0);
		shadow.scale.setScalar(entry.flying ? 0.7 : 1.1);
		controls.autoRotate = !still;

		const mixer = new THREE.AnimationMixer(root);
		if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
		mixer.update(still ? 0.3 : 0);

		scene.add(root);
		current = { root, mixer, flying: !!entry.flying, baseY: root.position.y };
		resize();
		start();
		return true;
	}

	function start() {
		if (still) {
			draw();
			return;
		}
		if (running) return;
		running = true;
		renderer.setAnimationLoop(loop);
	}

	function stop() {
		token++;
		running = false;
		renderer.setAnimationLoop(null);
		clear();
	}

	function clear() {
		if (!current) return;
		scene.remove(current.root);
		current.mixer.stopAllAction();
		current.root.traverse((o) => {
			if (o.isMesh) {
				o.geometry.dispose();
				o.material.dispose();
			}
		});
		current = null;
	}

	return { show, stop };
}

// paintStripes swaps a model's colours for zebra stripes along its length,
// running round the legs below the belly. Works on the morphed position.
function paintStripes(material, density) {
	material.vertexColors = false;
	material.color.set(0xffffff);
	material.roughness = 0.85;
	material.metalness = 0;
	material.onBeforeCompile = (shader) => {
		shader.uniforms.density = { value: density };
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vStripe;')
			.replace('#include <project_vertex>', 'vStripe = transformed;\n#include <project_vertex>');
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vStripe;\nuniform float density;')
			.replace(
				'#include <color_fragment>',
				`#include <color_fragment>
				float body = vStripe.z + sin(vStripe.y * 0.045) * 9.0;
				float legs = vStripe.y * 1.6;
				float leg = smoothstep(70.0, 85.0, vStripe.y);
				float band = mix(legs, body, leg) * density;
				float s = smoothstep(0.42, 0.58, abs(fract(band) - 0.5) * 2.0);
				diffuseColor.rgb = mix(vec3(0.05), vec3(0.93, 0.92, 0.88), s);`,
			);
	};
	material.needsUpdate = true;
}

function shadowTexture() {
	const c = document.createElement('canvas');
	c.width = c.height = 128;
	const g = c.getContext('2d');
	const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	grad.addColorStop(0, 'rgba(0,0,0,0.35)');
	grad.addColorStop(1, 'rgba(0,0,0,0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, 128, 128);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
