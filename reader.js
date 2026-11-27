(() => {
  'use strict';
  const storageKey = 'civil-law-reader-v1';
  const lectures = window.lectureTexts || {};
  const presentations = {};
  for (const [id, deck] of Object.entries(window.coursePresentations || {})) {
    presentations[id] = {
      title: lectures[id]?.title || deck.file,
      width: deck.width,
      height: deck.height,
      blocks: deck.slides.map((description, index) => ({
        id: `presentation-${id}-slide-${index + 1}`,
        number: index + 1,
        text: `${index + 1}-слайд`,
        description,
      })),
    };
  }
  const materials = { lecture: lectures, presentation: presentations };
  // Numeric keys are the bookmarks already saved by the lecture reader.
  const bookmarkKey = (material, id) => material === 'lecture' ? String(id) : `presentation-${id}`;
  const preferences = { fontSize: 18, bookmarks: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if ([16, 18, 20, 22, 24].includes(saved?.fontSize)) preferences.fontSize = saved.fontSize;
    for (const [material, documents] of Object.entries(materials)) {
      for (const [id, item] of Object.entries(documents)) {
        const key = bookmarkKey(material, id);
        if (!Array.isArray(saved?.bookmarks?.[key])) continue;
        const anchors = new Set(saved.bookmarks[key].map(anchor => item.legacyAnchors?.[anchor] || anchor));
        preferences.bookmarks[key] = item.blocks.filter(block => anchors.has(block.id)).map(block => block.id);
      }
    }
  } catch { /* Reading remains available without saved preferences. */ }

  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const bookmarkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4Z"/></svg>';
  const excerpt = block => {
    const text = block.text;
    return text.length > 100 ? `${text.slice(0, 100).trim()}…` : text;
  };
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); return true; }
    catch { return false; }
  };

  function bookmarkButton(block) {
    return `<button class="reader-bookmark" type="button" data-bookmark="${block.id}" aria-pressed="false" aria-label="Бетбелгіге сақтау: ${escape(excerpt(block))}">${bookmarkIcon}</button>`;
  }

  function lectureBlocks(lecture) {
    const listCounters = {};
    let blocks = '';
    let openList = null;
    for (const block of lecture.blocks) {
      const list = block.list;
      if (openList && (!list || list.id !== openList.id)) {
        blocks += `</${openList.ordered ? 'ol' : 'ul'}>`;
        openList = null;
      }
      if (list && !openList) {
        const start = (listCounters[list.id] ?? list.start - 1) + 1;
        blocks += list.ordered ? `<ol start="${start}">` : '<ul>';
        openList = list;
      }
      if (list) listCounters[list.id] = (listCounters[list.id] ?? list.start - 1) + 1;
      const tag = list ? 'li' : 'p';
      const marker = list ? ` data-list-marker="${escape(list.marker.replace(/%[1-9]/g, String(listCounters[list.id])))}"` : '';
      // Only source paragraphs and lists are rendered: no editorial headings or divisions.
      blocks += `<${tag} id="${block.id}" class="reader-paragraph" tabindex="-1" data-source-block${marker}><span class="reader-paragraph-text">${block.html}</span>${bookmarkButton(block)}</${tag}>`;
    }
    if (openList) blocks += `</${openList.ordered ? 'ol' : 'ul'}>`;
    return blocks;
  }

  function presentationBlocks(presentation, lessonId) {
    return presentation.blocks.map(block => `
      <figure class="reader-paragraph reader-slide" id="${block.id}" tabindex="-1" aria-labelledby="${block.id}-caption">
        <img class="reader-slide-image" src="assets/presentations/${lessonId}/${block.number}.webp"
          width="${presentation.width}" height="${presentation.height}" loading="${block.number === 1 ? 'eager' : 'lazy'}" decoding="async"
          alt="${escape(block.description || block.text)}">
        ${bookmarkButton(block)}
        <figcaption id="${block.id}-caption">${block.text}</figcaption>
      </figure>`).join('');
  }

  function render(container, lessonId, material = 'lecture') {
    const data = materials[material];
    const item = data[lessonId];
    const presenting = material === 'presentation';
    if (!item) {
      container.textContent = presenting ? 'Презентация жүктелмеді.' : 'Дәріс мәтіні жүктелмеді. Төмендегі Word немесе PDF нұсқасын ашыңыз.';
      return;
    }
    const key = bookmarkKey(material, lessonId);
    const controlPrefix = presenting ? 'presentation-reader' : 'reader';
    const blocks = presenting ? presentationBlocks(item, lessonId) : lectureBlocks(item);
    const description = presenting ? `${item.blocks.length} слайд` : `Шамамен ${Math.max(1, Math.ceil(item.words / 180))} минут`;

    container.innerHTML = `<div class="lecture-reader">
      <div class="reader-toolbar">
        <div><span class="reader-eyebrow">${presenting ? 'ПРЕЗЕНТАЦИЯ' : 'ДӘРІС МӘТІНІ'}</span><p>${description}</p></div>
        ${presenting ? '' : `<div class="reader-font-controls" role="group" aria-label="Мәтін өлшемі">
          <button type="button" data-font-change="-2" aria-label="Мәтінді кішірейту">A−</button>
          <button type="button" class="reader-font-reset" data-font-reset aria-label="Мәтін өлшемін қалпына келтіру"><span id="reader-font-value" data-font-value>${preferences.fontSize}</span> px</button>
          <button type="button" data-font-change="2" aria-label="Мәтінді үлкейту">A+</button>
        </div>`}
      </div>
      <div class="reader-navigation">
        <details class="reader-saved"><summary>${bookmarkIcon} Бетбелгілер <span id="${controlPrefix}-bookmark-count" data-bookmark-count>0</span></summary><div id="${controlPrefix}-bookmark-list" data-bookmark-list></div></details>
      </div>
      <p class="reader-announcement" role="status" aria-live="polite"></p>
      <article class="${presenting ? 'reader-slides' : 'reader-article reader-prose'}" aria-label="${escape(item.title)}">${blocks}</article>
    </div>`;
    const announcement = container.querySelector('.reader-announcement');

    function updateFont() {
      const reader = container.querySelector('.lecture-reader');
      reader.style.setProperty('--reader-font-size', `${preferences.fontSize}px`);
      reader.querySelector('[data-font-value]').textContent = preferences.fontSize;
      reader.querySelector('[data-font-change="-2"]').disabled = preferences.fontSize <= 16;
      reader.querySelector('[data-font-change="2"]').disabled = preferences.fontSize >= 24;
    }

    function updateBookmarks() {
      const bookmarks = Object.entries(data).flatMap(([id, item]) => item.blocks
        .filter(block => preferences.bookmarks[bookmarkKey(material, id)]?.includes(block.id))
        .map(block => ({ ...block, lessonId: id })));
      container.querySelector('[data-bookmark-count]').textContent = bookmarks.length;
      container.querySelector('[data-bookmark-list]').innerHTML = bookmarks.length ? `<ul>${bookmarks.map(block => `<li>
        <a href="lectures.html?lesson=${block.lessonId}${presenting ? '&amp;material=presentation' : ''}#${block.id}" ${Number(block.lessonId) === lessonId ? `data-reader-target="${block.id}"` : ''}><small>${block.lessonId}-${presenting ? 'презентация' : 'дәріс'}</small>${escape(excerpt(block))}</a>
        <button type="button" data-remove-bookmark="${block.id}" data-lesson-id="${block.lessonId}" aria-label="Бетбелгіні өшіру: ${escape(excerpt(block))}">×</button>
      </li>`).join('')}</ul>` : `<p class="reader-empty">Қажетті ${presenting ? 'слайдтың' : 'абзацтың'} жанындағы бетбелгі белгісін басыңыз. Сақталған үзінділер осында көрінеді.</p>`;
      for (const button of container.querySelectorAll('[data-bookmark]')) {
        const saved = preferences.bookmarks[key]?.includes(button.dataset.bookmark) || false;
        const block = item.blocks.find(block => block.id === button.dataset.bookmark);
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', `${saved ? 'Бетбелгіні өшіру' : 'Бетбелгіге сақтау'}: ${excerpt(block)}`);
        button.title = saved ? 'Бетбелгі сақталды' : 'Бетбелгіге сақтау';
      }
    }

    function goToParagraph(id) {
      const paragraph = document.getElementById(id);
      if (!paragraph || !container.contains(paragraph)) return;
      paragraph.focus({ preventScroll: true });
      paragraph.scrollIntoView({ block: 'start' });
    }

    // Assign the handler to replace it when moving between lectures.
    container.onclick = event => {
      const target = event.target.closest('button, a');
      if (!target || !container.contains(target)) return;
      if (target.hasAttribute('data-font-change') || target.hasAttribute('data-font-reset')) {
        preferences.fontSize = target.hasAttribute('data-font-reset') ? 18 : Math.max(16, Math.min(24, preferences.fontSize + Number(target.dataset.fontChange)));
        updateFont();
        save();
        announcement.textContent = `Мәтін өлшемі: ${preferences.fontSize} px.`;
      } else if (target.dataset.readerTarget) {
        event.preventDefault();
        goToParagraph(target.dataset.readerTarget);
      } else if (target.dataset.bookmark || target.dataset.removeBookmark) {
        const id = target.dataset.bookmark || target.dataset.removeBookmark;
        const owner = bookmarkKey(material, target.dataset.lessonId || lessonId);
        const saved = preferences.bookmarks[owner] || [];
        const removing = saved.includes(id);
        preferences.bookmarks[owner] = removing ? saved.filter(value => value !== id) : [...saved, id];
        const persistent = save();
        updateBookmarks();
        announcement.textContent = removing ? 'Бетбелгі өшірілді.' : persistent ? 'Бетбелгі сақталды.' : 'Бетбелгі осы сеансқа сақталды.';
        if (target.dataset.removeBookmark) container.querySelector('.reader-saved summary').focus();
      }
    };
    if (!presenting) updateFont();
    updateBookmarks();
    const requestedAnchor = window.location.hash.slice(1);
    const requestedParagraph = item.legacyAnchors?.[requestedAnchor] || requestedAnchor;
    if (item.blocks.some(block => block.id === requestedParagraph)) {
      requestAnimationFrame(() => goToParagraph(requestedParagraph));
    }
  }

  window.LectureReader = { render };
})();
