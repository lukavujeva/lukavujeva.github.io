/*
	CV viewer: renders the PDF linked by #cv-pdf into #cv-pages as page images
	that fit the article width. Mobile browsers can't show a PDF in an iframe,
	so this keeps the CV readable everywhere. To update the CV, just change the
	href of the #cv-pdf link in index.html.
*/

(function() {

	var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/',
		PDFJS_SRI = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==';

	var link = document.getElementById('cv-pdf'),
		container = document.getElementById('cv-pages');

	if (!link || !container || !window.ResizeObserver || !window.Promise)
		return;

	var pdf = null,
		renderedWidth = 0,
		renderId = 0,
		timer = null;

	// Load pdf.js only once the CV article is actually opened.
	function loadPdf() {
		if (!pdf)
			pdf = new Promise(function(resolve, reject) {
				var script = document.createElement('script');
				script.src = PDFJS + 'pdf.min.js';
				script.integrity = PDFJS_SRI;
				script.crossOrigin = 'anonymous';
				script.referrerPolicy = 'no-referrer';
				script.onload = resolve;
				script.onerror = reject;
				document.head.appendChild(script);
			}).then(function() {
				pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
				return pdfjsLib.getDocument(link.href).promise;
			});

		return pdf;
	}

	function renderPage(page, width) {
		// On touch screens, render extra pixels so the CV stays sharp when pinch-zoomed.
		var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
			ratio = Math.max(window.devicePixelRatio || 1, touch ? 1600 / width : 0),
			viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width }),
			wrapper = document.createElement('div'),
			canvas = document.createElement('canvas');

		wrapper.style.cssText = 'position: relative; margin-bottom: 1.5rem; border-radius: 4px; overflow: hidden; background: #fff;';
		canvas.style.cssText = 'display: block; width: 100%; height: auto;';
		canvas.width = Math.floor(viewport.width * ratio);
		canvas.height = Math.floor(viewport.height * ratio);
		wrapper.appendChild(canvas);

		// Keep the PDF's hyperlinks clickable on top of the page image.
		var links = page.getAnnotations().then(function(annotations) {
			annotations.forEach(function(a) {
				if (a.subtype !== 'Link' || !a.url)
					return;

				var r = viewport.convertToViewportRectangle(a.rect),
					el = document.createElement('a');

				el.href = a.url;
				el.target = '_blank';
				el.rel = 'noopener';
				el.style.cssText = 'position: absolute; border: 0;'
					+ 'left: ' + (Math.min(r[0], r[2]) / viewport.width * 100) + '%;'
					+ 'top: ' + (Math.min(r[1], r[3]) / viewport.height * 100) + '%;'
					+ 'width: ' + (Math.abs(r[2] - r[0]) / viewport.width * 100) + '%;'
					+ 'height: ' + (Math.abs(r[3] - r[1]) / viewport.height * 100) + '%;';
				wrapper.appendChild(el);
			});
		});

		var render = page.render({
			canvasContext: canvas.getContext('2d'),
			viewport: viewport,
			transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null
		}).promise;

		return Promise.all([render, links]).then(function() { return wrapper; });
	}

	function renderAll(width) {
		var id = ++renderId;

		if (!container.firstChild)
			container.innerHTML = '<p>Loading CV&hellip;</p>';

		loadPdf().then(function(doc) {
			var pages = [];

			for (var n = 1; n <= doc.numPages; n++)
				pages.push(doc.getPage(n).then(function(page) { return renderPage(page, width); }));

			return Promise.all(pages);
		}).then(function(wrappers) {
			if (id !== renderId)
				return;

			container.innerHTML = '';
			wrappers.forEach(function(wrapper) { container.appendChild(wrapper); });
		}).catch(function() {
			container.innerHTML = '<p>The CV could not be displayed here, but you can still download it above.</p>';
		});
	}

	// The article is hidden until opened, and pages only need re-rendering
	// (for sharpness) when the width changes, e.g. on rotating a phone.
	new ResizeObserver(function() {
		var width = Math.floor(container.clientWidth);

		if (width === 0 || width === renderedWidth)
			return;

		clearTimeout(timer);
		timer = setTimeout(function() {
			renderedWidth = width;
			renderAll(width);
		}, renderedWidth ? 250 : 0);
	}).observe(container);

})();
