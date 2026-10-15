// The animal wheel: pick a place, then swing round a ring of the animals seen
// there, GTA weapon-wheel style, and open one for its facts and sightings.
// Everything from GBIF goes in through textContent or checked URLs only.
import { modelFor } from '/assets/js/models.js';

const places = JSON.parse(document.getElementById('globe-data')?.textContent || '[]') || [];
const wheel = document.querySelector('[data-wheel]');

const STATUS = {
	LC: 'Least Concern',
	NT: 'Near Threatened',
	VU: 'Vulnerable',
	EN: 'Endangered',
	CR: 'Critically Endangered',
	DD: 'Data Deficient',
};
const SVG = 'http://www.w3.org/2000/svg';
const OUTER = 96;
const INNER = 56;

if (wheel) {
	const $ = (sel) => wheel.querySelector(sel);
	const ring = $('[data-ring]');
	const items = $('[data-items]');
	const detail = $('[data-detail]');
	const dial = $('.wheel__dial');

	let place = null;
	let current = 0;
	let opener = null;

	// The 3D viewer loads the first time an animal with a model is opened.
	const modelCanvas = $('[data-model]');
	const modelStatus = $('[data-model-status]');
	const toggle = $('[data-toggle]');
	let viewer = null;
	let view = 'model';
	let shown = null;

	toggle.addEventListener('click', (e) => {
		const b = e.target.closest('[data-view]');
		if (!b) return;
		view = b.dataset.view;
		if (shown) fillMedia(shown);
	});

	document.addEventListener('click', (e) => {
		const b = e.target.closest('[data-place]');
		if (!b) return;
		if (b.classList.contains('place')) document.getElementById('globe')?.scrollIntoView({ behavior: 'smooth' });
		open(Number(b.dataset.place), b);
	});

	$('[data-close]').addEventListener('click', close);
	$('[data-back]').addEventListener('click', () => {
		hideDetail();
		focusItem(current);
	});
	wheel.addEventListener('click', (e) => {
		if (e.target === wheel) close();
	});

	dial.addEventListener('pointermove', (e) => {
		if (!detail.hidden) return;
		const i = indexAt(e);
		if (i !== null && i !== current) select(i);
	});
	dial.addEventListener('click', (e) => {
		const i = indexAt(e);
		if (i !== null) {
			select(i);
			showDetail();
		}
	});

	wheel.addEventListener('keydown', (e) => {
		if (!place) return;
		const n = place.animals.length;
		if (e.key === 'Escape') {
			e.preventDefault();
			if (!detail.hidden) {
				hideDetail();
				focusItem(current);
			} else close();
		} else if (e.target.closest('[data-items]') && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
			e.preventDefault();
			const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
			select((current + step + n) % n);
			focusItem(current);
		} else if (e.key === 'Tab') {
			trapFocus(e);
		}
	});

	function open(index, from) {
		place = places[index];
		if (!place) return;
		opener = from || document.activeElement;
		current = 0;
		build();
		hideDetail();
		wheel.hidden = false;
		document.documentElement.classList.add('is-wheel-open');
		requestAnimationFrame(() => wheel.classList.add('is-open'));
		window.dispatchEvent(new CustomEvent('place:open', { detail: { index } }));
		select(0);
		focusItem(0);
	}

	function close() {
		if (wheel.hidden) return;
		wheel.classList.remove('is-open');
		wheel.hidden = true;
		hideDetail();
		document.documentElement.classList.remove('is-wheel-open');
		window.dispatchEvent(new CustomEvent('place:close'));
		place = null;
		opener?.focus?.({ preventScroll: true });
	}

	function build() {
		const n = place.animals.length;
		ring.replaceChildren();
		items.replaceChildren();
		items.style.setProperty('--n', String(n));
		$('[data-country]').textContent = place.country;

		const span = 360 / n;
		const gap = n === 1 ? 0 : Math.min(2.4, span * 0.08);
		place.animals.forEach((a, i) => {
			const start = -90 + i * span + gap / 2;
			const end = start + span - gap;

			const seg = document.createElementNS(SVG, 'path');
			seg.setAttribute('d', n === 1 ? donut() : arc(start, end));
			if (n === 1) seg.setAttribute('fill-rule', 'evenodd');
			seg.setAttribute('class', 'wheel__seg');
			ring.append(seg);

			const mid = ((start + end) / 2) * (Math.PI / 180);
			const r = (OUTER + INNER) / 2 / 2;
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'wheel__item';
			b.setAttribute('role', 'option');
			b.tabIndex = -1;
			b.style.left = 50 + r * Math.cos(mid) + '%';
			b.style.top = 50 + r * Math.sin(mid) + '%';
			if (safeURL(a.photo)) {
				const img = document.createElement('img');
				img.src = a.photo;
				img.alt = '';
				img.loading = 'lazy';
				img.decoding = 'async';
				b.append(img);
			} else {
				const initial = document.createElement('span');
				initial.className = 'wheel__initial';
				initial.setAttribute('aria-hidden', 'true');
				initial.textContent = a.name.slice(0, 1);
				b.append(initial);
			}
			const label = document.createElement('span');
			label.className = 'visually-hidden';
			label.textContent = a.name + ', ' + plural(a.count, 'sighting');
			b.append(label);
			b.addEventListener('focus', () => select(i));
			b.addEventListener('mouseenter', () => detail.hidden && select(i));
			if (modelFor(a.scientific)) {
				const tag = document.createElement('span');
				tag.className = 'wheel__tag';
				tag.setAttribute('aria-hidden', 'true');
				tag.textContent = '3D';
				b.append(tag);
				label.textContent += ', has a 3D model';
			}
			b.addEventListener('click', (e) => {
				e.stopPropagation();
				select(i);
				showDetail();
			});
			items.append(b);
		});
	}

	function select(i) {
		current = i;
		const a = place.animals[i];
		ring.querySelectorAll('.wheel__seg').forEach((s, k) => s.classList.toggle('is-on', k === i));
		items.querySelectorAll('.wheel__item').forEach((b, k) => {
			b.classList.toggle('is-on', k === i);
			b.setAttribute('aria-selected', k === i ? 'true' : 'false');
			b.tabIndex = k === i ? 0 : -1;
		});
		$('[data-name]').textContent = a.name;
		$('[data-count]').textContent =
			plural(a.count, 'sighting') +
			(a.fact ? ' · ' + (STATUS[a.fact.status] || a.fact.status) : '') +
			(modelFor(a.scientific) ? ' · 3D' : '');
		if (!detail.hidden) fillDetail(a);
	}

	function focusItem(i) {
		items.querySelectorAll('.wheel__item')[i]?.focus({ preventScroll: true });
	}

	function showDetail() {
		fillDetail(place.animals[current]);
		detail.hidden = false;
		wheel.classList.add('has-detail');
		$('[data-dname]').focus({ preventScroll: true });
	}

	function hideDetail() {
		detail.hidden = true;
		wheel.classList.remove('has-detail');
		shown = null;
		viewer?.stop();
	}

	// fillMedia shows the 3D model when there is one and it's chosen, else the photo.
	function fillMedia(a) {
		shown = a;
		const entry = modelFor(a.scientific);
		const photo = $('[data-photo]');
		const hasPhoto = safeURL(a.photo);
		const use3d = !!entry && (view === 'model' || !hasPhoto);

		toggle.hidden = !(entry && hasPhoto);
		toggle.querySelectorAll('[data-view]').forEach((b) => {
			b.setAttribute('aria-pressed', String(b.dataset.view === (use3d ? 'model' : 'photo')));
		});
		$('[data-figure]').hidden = !entry && !hasPhoto;

		const credits = [];
		if (use3d) {
			credits.push('3D model: ' + entry.credit);
			if (entry.note) credits.push(entry.note);
		} else if (a.credit) {
			credits.push('Photo: ' + a.credit);
		}
		$('[data-credit]').textContent = credits.join(' · ');

		photo.hidden = use3d || !hasPhoto;
		if (hasPhoto) {
			photo.src = a.photo;
			photo.alt = 'A photo of a ' + a.name + ' seen in ' + place.country;
		} else {
			photo.removeAttribute('src');
		}

		modelCanvas.hidden = !use3d;
		if (!use3d) {
			modelStatus.hidden = true;
			viewer?.stop();
			return;
		}
		modelCanvas.setAttribute('role', 'img');
		modelCanvas.setAttribute('aria-label', 'An animated 3D model of a ' + a.name + '. Drag to turn it.');
		modelStatus.textContent = 'Loading 3D model…';
		modelStatus.hidden = false;
		loadViewer()
			.then((v) => v.show(entry))
			.then((ok) => {
				if (ok !== false) modelStatus.hidden = true;
			})
			.catch((err) => {
				console.warn('animal3d: not shown', err);
				modelStatus.textContent = '3D model unavailable.';
				modelCanvas.hidden = true;
				if (hasPhoto) photo.hidden = false;
			});
	}

	async function loadViewer() {
		if (!viewer) {
			const { createViewer } = await import('/assets/js/animal3d.js');
			viewer = viewer || createViewer(modelCanvas);
		}
		return viewer;
	}

	function fillDetail(a) {
		const set = (sel, text) => {
			const el = $(sel);
			el.textContent = text || '';
			if (el.tagName === 'DD') el.parentElement.hidden = !text;
			else el.hidden = !text;
		};
		if (shown !== a) fillMedia(a);

		const status = a.fact?.status;
		const badge = $('[data-status]');
		badge.textContent = status ? STATUS[status] || status : 'Status not listed';
		badge.dataset.level = status || '';

		set('[data-dname]', a.name);
		set('[data-scientific]', a.scientific);
		set('[data-swahili]', a.fact?.swahili ? 'Kiswahili: ' + a.fact.swahili : '');
		set('[data-fact]', a.fact?.fact || 'No field notes yet for this animal.');
		set('[data-size]', a.fact?.size);
		set('[data-family]', [a.family, a.order, a.class].filter(Boolean).join(' · '));
		set('[data-seen]', plural(a.count, 'sighting') + ' in ' + place.country);
		set('[data-individuals]', String(a.individuals));
		set('[data-last]', a.lastSeen);
		set('[data-first]', a.count > 1 ? a.firstSeen : '');

		const obs = $('[data-observers]');
		obs.replaceChildren(
			...(a.observers.length ? a.observers : ['Not recorded']).map((o) => {
				const li = document.createElement('li');
				li.textContent = o;
				return li;
			}),
		);

		const list = $('[data-sightings]');
		list.replaceChildren(
			...a.sightings.map((s) => {
				const li = document.createElement('li');
				const link = document.createElement('a');
				link.href = '#s-' + s.id;
				link.addEventListener('click', close);
				const date = document.createElement('span');
				date.className = 'detail__date';
				date.textContent = s.date;
				link.append(date, document.createTextNode(s.where));
				li.append(link);
				return li;
			}),
		);
	}

	// indexAt maps the pointer to the slice under it, ignoring the middle.
	function indexAt(e) {
		if (!place) return null;
		const box = ring.getBoundingClientRect();
		const x = e.clientX - (box.left + box.width / 2);
		const y = e.clientY - (box.top + box.height / 2);
		const scale = box.width / 200;
		if (Math.hypot(x, y) < INNER * scale * 0.9) return null;
		const deg = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
		return Math.floor(deg / (360 / place.animals.length)) % place.animals.length;
	}

	function trapFocus(e) {
		const focusable = [...wheel.querySelectorAll('button, a[href], [tabindex="0"], h2[tabindex]')].filter(
			(el) => !el.closest('[hidden]') && el.tabIndex >= 0,
		);
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}
}

function arc(a0, a1) {
	const p = (r, a) => {
		const t = (a * Math.PI) / 180;
		return (r * Math.cos(t)).toFixed(2) + ' ' + (r * Math.sin(t)).toFixed(2);
	};
	const big = a1 - a0 > 180 ? 1 : 0;
	return (
		'M ' + p(OUTER, a0) +
		' A ' + OUTER + ' ' + OUTER + ' 0 ' + big + ' 1 ' + p(OUTER, a1) +
		' L ' + p(INNER, a1) +
		' A ' + INNER + ' ' + INNER + ' 0 ' + big + ' 0 ' + p(INNER, a0) +
		' Z'
	);
}

function donut() {
	return (
		'M ' + OUTER + ' 0 A ' + OUTER + ' ' + OUTER + ' 0 1 1 ' + -OUTER + ' 0 A ' + OUTER + ' ' + OUTER + ' 0 1 1 ' + OUTER + ' 0 Z ' +
		'M ' + INNER + ' 0 A ' + INNER + ' ' + INNER + ' 0 1 0 ' + -INNER + ' 0 A ' + INNER + ' ' + INNER + ' 0 1 0 ' + INNER + ' 0 Z'
	);
}

function safeURL(u) {
	return typeof u === 'string' && /^https?:\/\//.test(u);
}

function plural(n, word) {
	return n + ' ' + word + (n === 1 ? '' : 's');
}
