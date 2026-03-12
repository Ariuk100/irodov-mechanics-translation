import './style.css'

let bookStructure = null;
let currentChapter = null;
let lastBook = null;
let lastChapterId = null;
let lastSectionId = null;

const sidebarContent = document.querySelector('#toc');
const bookContainer = document.querySelector('#book-content');
const chapterTitle = document.querySelector('#chapter-title');
const sidebar = document.querySelector('#sidebar');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const sidebarOverlay = document.querySelector('#sidebar-overlay');
const sidebarClose = document.querySelector('#sidebar-close');

function openMobileSidebar() {
  sidebar.classList.add('active');
  sidebarOverlay.classList.add('active');
}

function closeMobileSidebar() {
  sidebar.classList.remove('active');
  sidebarOverlay.classList.remove('active');
}

// Initialize the app
async function init() {
  try {
    // Sidebar toggle logic
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) sidebar.classList.add('collapsed');

    sidebarToggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        // Утсан дээр: overlay + active
        if (sidebar.classList.contains('active')) {
          closeMobileSidebar();
        } else {
          openMobileSidebar();
        }
      } else {
        // Desktop дээр: collapsed логик
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
      }
    });

    // Overlay дарахад хаагдана
    sidebarOverlay.addEventListener('click', closeMobileSidebar);

    // X товч дарахад хаагдана
    if (sidebarClose) {
      sidebarClose.addEventListener('click', closeMobileSidebar);
    }

    // Collapse All Logic
    const collapseAllBtn = document.getElementById('collapse-all-btn');
    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const expandedItems = sidebarContent.querySelectorAll('.expanded');
            expandedItems.forEach(item => item.classList.remove('expanded'));
        });
    }

    // Register Fix Button Logic
    const registerFixBtn = document.getElementById('register-fix-btn');
    if (registerFixBtn) {
        registerFixBtn.addEventListener('click', () => {
            const currentPath = currentChapter ? (currentChapter.folder ? `${currentChapter.folder}/${currentChapter.id}` : currentChapter.id) : 'home';
            alert(`Засвар бүртгэх функцийг удахгүй нэмнэ.\nОдоогийн байршил: ${currentPath}`);
        });
    }

    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}data/library.json?v=${Date.now()}`);
    bookStructure = await response.json();
    
    renderSidebar();
    
    // Load home page by default
    loadHomePage();
    
    // Make logo click go to home page
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', (e) => {
        if (e.target.closest('#collapse-all-btn') || e.target.closest('#sidebar-close')) return;
        loadHomePage();
        if (window.innerWidth <= 768) {
            closeMobileSidebar();
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
    if (bookContainer) bookContainer.innerHTML = '<p class="error">Failed to load content. Please check console.</p>';
  }
}

function renderSidebar() {
  if (!sidebarContent) return;
  sidebarContent.innerHTML = '';
  if (!bookStructure.books) return;

  // --- 3 Category Filter Tabs ---
  const tabsEl = document.createElement('div');
  tabsEl.className = 'sidebar-cat-tabs';
  tabsEl.innerHTML = `
    <button class="sidebar-cat-btn active" data-cat="book">📚 Ном</button>
    <button class="sidebar-cat-btn" data-cat="problems">🧮 Бодлого</button>
    <button class="sidebar-cat-btn" data-cat="olympiad">🏆 Олимпиад</button>
  `;
  sidebarContent.appendChild(tabsEl);

  function filterSidebarByCategory(cat) {
    sidebarContent.querySelectorAll('.book-group').forEach(el => {
      el.style.display = (el.dataset.category === cat) ? '' : 'none';
    });
  }

  tabsEl.querySelectorAll('.sidebar-cat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      tabsEl.querySelectorAll('.sidebar-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterSidebarByCategory(btn.dataset.cat);
    });
  });

  bookStructure.books.forEach(book => {
    // Determine category
    const bookCat = book.category || (book.type === 'olympiad_series' ? 'olympiad' : 'book');

    // Book Container
    const bookEl = document.createElement('div');
    bookEl.className = 'book-group';
    bookEl.dataset.category = bookCat;
    // Initially show only "book" category
    if (bookCat !== 'book') bookEl.style.display = 'none';
    
    // Book Header
    const bookHeader = document.createElement('div');
    bookHeader.className = 'book-header';
    // Add SVG Icon
    const iconSvg = `<svg class="book-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
    
    bookHeader.innerHTML = `${iconSvg} <h2 class="book-title-text">${book.title}</h2>`;
    bookHeader.onclick = () => {
        const isExpanded = bookEl.classList.contains('expanded');
        // Бусад бүх номыг хаана
        sidebarContent.querySelectorAll('.book-group').forEach(el => el.classList.remove('expanded'));
        // Өмнө хаалттай байсан бол нээнэ
        if (!isExpanded) {
            bookEl.classList.add('expanded');
        }
    };
    bookEl.appendChild(bookHeader); // Add header to book container

    // Chapters Container
    const chaptersContainer = document.createElement('div');
    chaptersContainer.className = 'book-chapters';

    // olympiad_series: chapters are clickable items (CPHOS 28, CPHOS 27...), no sub-sections
    if (book.type === 'olympiad_series') {
      const iconSvgOly = `<svg class="book-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"></path></svg>`;
      // Override book icon in header (already set above, but we want trophy for olympiad)
      bookHeader.innerHTML = `${iconSvgOly} <h2 class="book-title-text">${book.title}</h2>`;
      book.chapters.forEach((chapter) => {
        const chapterItem = document.createElement('div');
        chapterItem.className = 'sidebar-item chapter-link olympiad-series-chapter';
        chapterItem.dataset.id = chapter.id;
        chapterItem.innerHTML = `<div class="chapter-header"><h3><span class="ch-num">🏆</span> <span>${chapter.title}</span></h3></div>`;
        chapterItem.onclick = (e) => {
          e.stopPropagation();
          // Mark active
          chaptersContainer.querySelectorAll('.olympiad-series-chapter').forEach(el => el.classList.remove('active-chapter'));
          chapterItem.classList.add('active-chapter');
          loadOlympiadChapter(book, chapter.id);
          if (window.innerWidth <= 768) closeMobileSidebar();
        };
        chaptersContainer.appendChild(chapterItem);
      });
    } else if (book.type === 'olympiad') {
      // Kept for legacy - shouldn't appear now
      book.chapters.forEach((chapter) => {
        const tabItem = document.createElement('li');
        tabItem.className = 'section-link olympiad-tab-link';
        tabItem.dataset.id = chapter.id;
        tabItem.innerHTML = `<span class="sec-title">${chapter.title}</span>`;
        tabItem.onclick = (e) => {
          e.stopPropagation();
          if (window.innerWidth <= 768) closeMobileSidebar();
        };
        chaptersContainer.appendChild(tabItem);
      });
    } else {
      book.chapters.forEach((chapter, index) => {
        const chapterEl = document.createElement('div');
        chapterEl.className = 'sidebar-item chapter-link';
        chapterEl.dataset.id = chapter.id;
        
        const chapterNum = `${index + 1}.`;
        const chapterName = chapter.title;

        const headerEl = document.createElement('div');
        headerEl.className = 'chapter-header';
        headerEl.innerHTML = `<h3><span class="ch-num">${chapterNum}</span> <span>${chapterName}</span></h3>`;
        headerEl.onclick = (e) => {
            const isActive = chapterEl.classList.contains('expanded');
            chaptersContainer.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('expanded'));
            if (!isActive) {
                chapterEl.classList.add('expanded');
            }
        };
        chapterEl.appendChild(headerEl);
        
        if (chapter.sections) {
          const sectionsList = document.createElement('ul');
          sectionsList.className = 'chapter-sections';
          
          chapter.sections.forEach(section => {
            const sectionItem = document.createElement('li');
            sectionItem.className = 'section-link';
            sectionItem.dataset.id = section.id;
            
            const match = section.title.match(/^(§\s*\d+\.\d+\.?|\d+\.\d+\.?)\s*(.*)$/);
            const num = match ? match[1] : (section.id.includes('problems') ? '?' : '');
            const title = match ? match[2] : section.title;

            if (book.id === 'irodov_problems') {
                 sectionItem.classList.add('is-problems-section');
            }

            sectionItem.innerHTML = `<span class="sec-num">${num}</span><span class="sec-title">${title}</span>`;
            sectionItem.onclick = (e) => {
              e.stopPropagation();
              loadChapter(book, chapter.id, section.id);
              if (window.innerWidth <= 768) closeMobileSidebar();
            };
            sectionsList.appendChild(sectionItem);
          });
          chapterEl.appendChild(sectionsList);
        }
        chaptersContainer.appendChild(chapterEl);
      });
    }
    
    bookEl.appendChild(chaptersContainer);
    sidebarContent.appendChild(bookEl);
  });
}

function loadHomePage() {
  currentChapter = null;
  if (chapterTitle) chapterTitle.textContent = "Физикийн Номын Сан";

  document.querySelectorAll('.section-link.active').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.sidebar-item.active-chapter').forEach(item => item.classList.remove('active-chapter'));
  hideOlympiadHeaderTabs();

  const bookIconSvg = `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
  const probIconSvg = `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  const olyIconSvg  = `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"></path></svg>`;

  const categories = { book: [], problems: [], olympiad: [] };
  if (bookStructure && bookStructure.books) {
    bookStructure.books.forEach(book => {
      const cat = book.category || (book.type === 'olympiad_series' ? 'olympiad' : 'book');
      if (categories[cat]) categories[cat].push(book);
    });
  }

  function buildGrid(books, catKey) {
    let g = '';
    books.forEach(book => {
      const isOlympiad = book.type === 'olympiad_series' || catKey === 'olympiad';
      let clickHandler = '';
      if (isOlympiad) {
        const firstChapter = book.chapters[0];
        clickHandler = `onclick="window._openBookContent('${book.id}');"`;
      } else {
        clickHandler = `onclick="window._openBookContent('${book.id}');"`;
      }
      const icon = catKey === 'olympiad' ? olyIconSvg : catKey === 'problems' ? probIconSvg : bookIconSvg;
      const badge = isOlympiad ? '<span class="olimpiad-badge">Олимпиад</span>' : '';
      const desc  = isOlympiad ? `${book.chapters.length} тэмцээн` : `${book.chapters.length} бүлэгтэй`;
      g += `<div class="book-card${isOlympiad?' olympiad-card':''}" ${clickHandler}>
        <div class="book-card-icon">${icon}</div>
        ${badge}
        <h3 class="book-card-title">${book.title}</h3>
        <p class="book-card-desc">${desc}</p>
      </div>`;
    });
    return g;
  }

  const html = `
    <div class="home-page">
      <div class="home-header-content">
        <h2>Тавтай морилно уу!</h2>
        <p>И.Е. Иродовын болон бусад физикийн сурах бичиг, бодлогын хураамжуудаас сонгон уншина уу.</p>
      </div>
      <div class="home-category-tabs">
        <button class="home-cat-btn active" data-cat="book">📚 Ном</button>
        <button class="home-cat-btn" data-cat="problems">🧮 Бодлого</button>
        <button class="home-cat-btn" data-cat="olympiad">🏆 Олимпиад</button>
      </div>
      <div class="home-category-section" data-cat="book"><div class="book-grid">${buildGrid(categories.book,'book')}</div></div>
      <div class="home-category-section" data-cat="problems" style="display:none"><div class="book-grid">${buildGrid(categories.problems,'problems')}</div></div>
      <div class="home-category-section" data-cat="olympiad" style="display:none"><div class="book-grid">${buildGrid(categories.olympiad,'olympiad')}</div></div>
    </div>`;

  if (bookContainer) bookContainer.innerHTML = html;

  document.querySelectorAll('.home-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.home-cat-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.home-category-section').forEach(s => s.style.display = 'none');
      btn.classList.add('active');
      document.querySelector(`.home-category-section[data-cat="${btn.dataset.cat}"]`).style.display = '';
    });
  });
}

// Global: open regular book (expand sidebar + load first chapter/section)
window._openBookContent = function(bookId) {
  const book = bookStructure.books.find(b => b.id === bookId);
  if (!book || !book.chapters || book.chapters.length === 0) return;

  // Determine this book's category and switch sidebar tab to match
  const bookCat = book.category || (book.type === 'olympiad_series' ? 'olympiad' : 'book');
  const tabsEl = sidebarContent.querySelector('.sidebar-cat-tabs');
  if (tabsEl) {
    tabsEl.querySelectorAll('.sidebar-cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === bookCat);
    });
    // Show only books of this category
    sidebarContent.querySelectorAll('.book-group').forEach(el => {
      el.style.display = (el.dataset.category === bookCat) ? '' : 'none';
    });
  }

  // Expand the book group in sidebar
  sidebarContent.querySelectorAll('.book-group').forEach(el => el.classList.remove('expanded'));
  
  // Find and expand the target book
  const bookGroups = sidebarContent.querySelectorAll('.book-group');
  bookGroups.forEach(group => {
    const title = group.querySelector('.book-title-text');
    if (title && title.textContent.trim() === book.title) {
      group.style.display = ''; // ensure it's visible
      group.classList.add('expanded');
    }
  });

  // Load the first content part
  const firstChapter = book.chapters[0];
  if (book.type === 'olympiad_series') {
    loadOlympiadChapter(book, firstChapter.id);
  } else if (firstChapter.sections && firstChapter.sections.length > 0) {
    loadChapter(book, firstChapter.id, firstChapter.sections[0].id);
  } else {
    loadChapter(book, firstChapter.id);
  }
  
  if (window.innerWidth <= 768) closeMobileSidebar();
};

// Global: open olympiad series (expand sidebar + load first chapter)
window._openOlympiadSeries = function(bookId, chapterId) {
  const book = bookStructure.books.find(b => b.id === bookId);
  if (!book) return;
  // Expand the book group in sidebar
  sidebarContent.querySelectorAll('.book-group').forEach(el => el.classList.remove('expanded'));
  sidebarContent.querySelectorAll('.book-header h2').forEach(h => {
    if (h.textContent.trim() === book.title) {
      h.closest('.book-group').classList.add('expanded');
    }
  });
  loadOlympiadChapter(book, chapterId);
};

// Helper: hide olympiad header tabs when not on an olympiad page
function hideOlympiadHeaderTabs() {
  const el = document.getElementById('olympiad-header-tabs');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}

// Load an olympiad chapter (shows tabs: Туршилт / Онол) — tabs appear in the main header
async function loadOlympiadChapter(book, chapterId, activeTabId = null) {
  const chapter = book.chapters.find(c => c.id === chapterId);
  if (!chapter || !chapter.tabs) return;

  const firstTab = activeTabId
    ? chapter.tabs.find(t => t.id === activeTabId) || chapter.tabs[0]
    : chapter.tabs[0];

  lastBook = book;
  if (chapterTitle) chapterTitle.textContent = chapter.title;

  // Mark active in sidebar
  sidebarContent.querySelectorAll('.olympiad-series-chapter').forEach(el => el.classList.remove('active-chapter'));
  const activeChEl = sidebarContent.querySelector(`.olympiad-series-chapter[data-id="${chapterId}"]`);
  if (activeChEl) activeChEl.classList.add('active-chapter');

  // --- Inject tabs into HEADER ---
  const headerTabsEl = document.getElementById('olympiad-header-tabs');
  if (headerTabsEl) {
    headerTabsEl.style.display = '';
    headerTabsEl.innerHTML = chapter.tabs.map(tab => {
      const isActive = tab.id === firstTab.id;
      return `<button class="olympiad-tab-btn${isActive ? ' active' : ''}" data-tab-id="${tab.id}" data-chapter-id="${chapterId}">${tab.title}</button>`;
    }).join('');

    headerTabsEl.querySelectorAll('.olympiad-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        headerTabsEl.querySelectorAll('.olympiad-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadOlympiadTabContent(book, chapter, btn.dataset.tabId);
      });
    });
  }

  // --- Render content area (no tabs here) ---
  if (bookContainer) {
    bookContainer.innerHTML = `
      <div class="olympiad-page">
        <div class="olympiad-content" id="olympiad-content-area"><p class="loading-msg">Ачааллаж байна...</p></div>
      </div>`;
  }

  // Load first tab content
  await loadOlympiadTabContent(book, chapter, firstTab.id);
}

async function loadOlympiadTabContent(book, chapter, tabId) {
  const tab = chapter.tabs.find(t => t.id === tabId);
  if (!tab) return;

  const contentArea = document.getElementById('olympiad-content-area');
  if (!contentArea) return;
  contentArea.innerHTML = '<p class="loading-msg">Ачааллаж байна...</p>';

  try {
    const baseUrl = import.meta.env.BASE_URL;
    const fileUrl = `${baseUrl}data/${tab.folder}/${tab.file}?v=${Date.now()}`;
    const response = await fetch(fileUrl);
    const data = await response.json();

    contentArea.innerHTML = '';
    
    // Check if data is array (new format) or object (old format)
    if (Array.isArray(data)) {
       const tableContainer = renderOlympiadTable(data);
       contentArea.appendChild(tableContainer);
    } else if (data && data.body && Array.isArray(data.body)) {
       data.body.forEach(item => {
         const el = createContentElement(item);
         if (el) contentArea.appendChild(el);
       });
    } else {
       console.warn('Olympiad data format not recognized or empty:', data);
       contentArea.innerHTML = '<p class="error">Энэ хэсэгт агуулга одоогоор байхгүй байна.</p>';
    }

    setTimeout(() => {
      document.getElementById('book-content')?.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') window.MathJax.typesetPromise([contentArea]);
    }, 100);
  } catch (err) {
    console.error('Olympiad tab load error:', err);
    contentArea.innerHTML = '<p class="error">Агуулга ачаалахад алдаа гарлаа.</p>';
  }
}

function renderOlympiadTable(problems) {
  const container = document.createElement('div');
  container.className = 'olympiad-table-container';

  problems.forEach(prob => {
    // Main Problem Block
    const probBlock = document.createElement('div');
    probBlock.className = 'olympiad-problem-block';

    const headerWrap = document.createElement('div');
    headerWrap.className = 'olympiad-problem-header';

    const titleEl = document.createElement('h3');
    titleEl.innerHTML = prob.title;
    headerWrap.appendChild(titleEl);

    if (prob.points) {
        const ptsEl = document.createElement('span');
        ptsEl.className = 'score-badge';
        ptsEl.textContent = `${prob.points} оноо`;
        headerWrap.appendChild(ptsEl);
    }
    probBlock.appendChild(headerWrap);

    // Main Problem Content
    if (prob.content && prob.content.length > 0) {
      const contentEl = document.createElement('div');
      contentEl.className = 'olympiad-problem-content';
      contentEl.innerHTML = prob.content.join('');
      probBlock.appendChild(contentEl);
    }

    // Main Problem Solution Button & Row
    if (prob.solution) {
      appendSolutionRow(probBlock, prob.solution, 'Ерөнхий бодолт');
    }

    // Sub Problems
    if (prob.subProblems && prob.subProblems.length > 0) {
      prob.subProblems.forEach(subProb => {
        const subBlock = document.createElement('div');
        subBlock.className = 'olympiad-subproblem-block';

        const subHeaderWrap = document.createElement('div');
        subHeaderWrap.className = 'olympiad-subproblem-header';
        
        const subTitleEl = document.createElement('h4');
        subTitleEl.innerHTML = subProb.title;
        subHeaderWrap.appendChild(subTitleEl);

        if (subProb.points) {
          const subPtsEl = document.createElement('span');
          subPtsEl.className = 'score-badge sub-score';
          subPtsEl.textContent = `${subProb.points} оноо`;
          subHeaderWrap.appendChild(subPtsEl);
        }
        subBlock.appendChild(subHeaderWrap);

        if (subProb.content && subProb.content.length > 0) {
          const subContentEl = document.createElement('div');
          subContentEl.className = 'olympiad-subproblem-content';
          subContentEl.innerHTML = subProb.content.join('');
          subBlock.appendChild(subContentEl);
        }

        if (subProb.solution) {
          appendSolutionRow(subBlock, subProb.solution, 'Дэд бодолт');
        }

        probBlock.appendChild(subBlock);
      });
    }
    
    container.appendChild(probBlock);
  });

  return container;
}

function appendSolutionRow(parentElement, solutionHtml, btnLabel) {
  const btnWrap = document.createElement('div');
  btnWrap.className = 'solution-btn-wrap';

  const btn = document.createElement('button');
  btn.className = 'btn-view-solution';
  btn.innerText = btnLabel + ' харах';
  btnWrap.appendChild(btn);

  const solRow = document.createElement('div');
  solRow.className = 'solution-row hidden';
  solRow.innerHTML = solutionHtml;
  
  btn.addEventListener('click', () => {
    solRow.classList.toggle('hidden');
    if (solRow.classList.contains('hidden')) {
      btn.innerText = btnLabel + ' харах';
    } else {
      btn.innerText = btnLabel + ' хураах';
    }
  });

  parentElement.appendChild(btnWrap);
  parentElement.appendChild(solRow);
}

async function loadChapter(book, chapterId, sectionId = null) {
  hideOlympiadHeaderTabs();
  try {
    const chapterInfo = book.chapters.find(c => c.id === chapterId);
    if (!chapterInfo) return;

    lastBook = book;
    lastChapterId = chapterId;
    lastSectionId = sectionId;

    // Determine what file to load
    let fileToLoad = null;

    const baseUrl = import.meta.env.BASE_URL;
    if (chapterInfo.folder && sectionId) {
      const section = chapterInfo.sections.find(s => s.id === sectionId);
      if (section && section.file) {
        fileToLoad = `${baseUrl}data/${chapterInfo.folder}/${section.file}`;
      }
    } else if (chapterInfo.file) {
        fileToLoad = `${baseUrl}data/chapters/${chapterInfo.file}`;
    } else if (chapterInfo.folder && !sectionId && chapterInfo.sections.length > 0) {
        const firstSec = chapterInfo.sections[0];
        fileToLoad = `${baseUrl}data/${chapterInfo.folder}/${firstSec.file}`;
        sectionId = firstSec.id;
    }

    // Identify if this is the "Problems" section for styling
    if (!fileToLoad) {
        console.warn("No file content mapped for this section.");
        // Optional: notify user visually if clicking unfinished sections
        if (sectionId) alert("Энэ хэсгийн агуулга одоогоор бэлэн болоогүй байна.");
        return;
    }

    // Identify if this is the "Problems" section for styling
    document.getElementById('book-content').className = '';

    const response = await fetch(`${fileToLoad}?v=${Date.now()}`);
    const data = await response.json();
    currentChapter = { ...chapterInfo, ...data }; 
    
    renderContent(data);
    
    // Highlight sidebar
    updateSidebarActiveState(chapterId, sectionId);

    // Scroll logic
    setTimeout(() => {
       window.scrollTo({ top: 0, behavior: 'smooth' });
       
      if (window.MathJax) {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') window.MathJax.typesetPromise();
      }
    }, 100);

  } catch (error) {
    console.error('Failed to load chapter:', error);
  }
}

function updateSidebarActiveState(chapterId, sectionId) {
    document.querySelectorAll('.section-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-chapter'));
    
    const chEl = document.querySelector(`.sidebar-item[data-id="${chapterId}"]`);
    if (chEl) {
        chEl.classList.add('active-chapter');
        // Ensure it's expanded
        chEl.classList.add('expanded');
    }

    if (sectionId) {
        // Find specifically within the active chapter if possible, or global query
        const secEl = chEl ? chEl.querySelector(`.section-link[data-id="${sectionId}"]`) : null;
        if (secEl) secEl.classList.add('active');
    }
}


function renderContent(data) {
  if (!bookContainer) return;
  if (chapterTitle) chapterTitle.textContent = data.title;
  bookContainer.innerHTML = '';
  
  data.body.forEach(item => {
    const el = createContentElement(item);
    if (el) bookContainer.appendChild(el);
  });
}

function createContentElement(item) {
  switch (item.type) {
    case 'text':
      const p = document.createElement('p');
      if (item.value.includes('Бодолт') || item.value.trim().startsWith('<b>Бодолт') || 
          item.value.includes('Шийдэл') || item.value.trim().startsWith('<b>Шийдэл')) {
          p.className = 'solution-text';
      }
      p.innerHTML = formatText(item.value);
      return p;
    case 'header':
      const h2 = document.createElement('h2');
      if (item.id) h2.id = item.id;
      h2.innerHTML = formatText(item.value); // Use formatText for potentially embedded formatting
      return h2;
    case 'note':
      const div = document.createElement('div');
      div.className = 'note-box';
      div.innerHTML = formatText(item.value);
      return div;
    case 'problem':
      const problemDiv = document.createElement('div');
      problemDiv.className = 'problem-container';
      
      // Points extraction for the MAIN problem
      let mainTitleHtml = item.title || '';
      const mainPointMatch = mainTitleHtml.match(/\((\d+\s*оноо)\)/i);
      let mainPointBadge = '';
      if (mainPointMatch) {
          mainPointBadge = `<span class="score-badge main-score">${mainPointMatch[1]}</span>`;
          mainTitleHtml = mainTitleHtml.replace(mainPointMatch[0], '').trim();
      }

      let problemHeaderHTML = `<div class="problem-header"><strong>${item.number || ''} ${mainTitleHtml}</strong>${mainPointBadge}</div>`;
      problemDiv.innerHTML = problemHeaderHTML;

      const statementContainer = document.createElement('div');
      statementContainer.className = 'problem-statement';
      problemDiv.appendChild(statementContainer);

      const rawStatementParts = Array.isArray(item.statement) ? item.statement : [{ type: 'text', value: item.statement }];
      // Support both 'solution' and 'answer' fields; if neither exists use empty array
      const rawSolutionSource = item.solution ?? item.answer;
      const rawSolutionParts = Array.isArray(rawSolutionSource)
        ? rawSolutionSource
        : (rawSolutionSource != null ? [{ type: 'text', value: rawSolutionSource }] : []);

      // --- Math-Aware Robust Splitting Logic ---
      const partIdPattern = /([A-Za-z]\.\d+\.\d+|[A-Za-z]\.\d+|[0-9]\.[0-9]|[0-9]\.[0-9]+|[0-9]+)/;
      const partHeaderRegex = new RegExp(`^[\\s\\*]*[\\(\\[（]?${partIdPattern.source}[\\)\\]）]?[\\s\\*]*(?::|\\s|$)`);

      function splitBlocks(blocks) {
          const result = [];
          const items = Array.isArray(blocks) ? blocks : [{ type: 'text', value: blocks }];
          items.forEach(block => {
              if (!block || block.type !== 'text' || !block.value) {
                  if (block) result.push(block);
                  return;
              }
              // Normalize both literal \n (backslash + n) and actual newlines
              const normalizedValue = block.value.replace(/\\n/g, '\n');
              const lines = normalizedValue.split('\n');
              let currentText = "";
              let insideMath = false;
              
              lines.forEach((line) => {
                  const trimmedLine = line.trim();
                  
                  // Toggle math block state to avoid splitting inside formulas
                  if (trimmedLine.startsWith('$$')) {
                      if (trimmedLine.length <= 2 || !trimmedLine.endsWith('$$')) {
                          insideMath = !insideMath;
                      }
                  } else if (trimmedLine.startsWith('\\[')) {
                      insideMath = true;
                  } else if (trimmedLine.endsWith('\\]')) {
                      insideMath = false;
                  }

                  // Only split if NOT inside a math block and matches header pattern
                  if (!insideMath && trimmedLine.match(partHeaderRegex)) {
                      if (currentText.trim() !== "" || result.length > 0) {
                          if (currentText.trim() !== "") result.push({ type: 'text', value: currentText.trim() });
                          currentText = line;
                      } else {
                          currentText = (currentText ? currentText + "\n" : "") + line;
                      }
                  } else {
                      currentText = (currentText ? currentText + "\n" : "") + line;
                  }
              });
              if (currentText.trim() !== "") {
                  result.push({ type: 'text', value: currentText.trim() });
              }
          });
          return result;
      }

      const statementParts = splitBlocks(rawStatementParts);
      const solutionParts = splitBlocks(rawSolutionParts);

      let parts = [];
      let currentPart = { statement: [], solution: [], id: null, points: null };
      
      statementParts.forEach((part) => {
          if (part.type === 'text') {
              const match = part.value.match(partHeaderRegex);
              if (match) {
                  if (currentPart.statement.length > 0 || currentPart.id !== null) {
                      parts.push(currentPart);
                  }
                  
                  const partId = match[1];
                  const subPointMatch = part.value.match(/\((\d+\s*оноо)\)/i);
                  let subPoints = null;
                  let cleanText = part.value;
                  if (subPointMatch) {
                      subPoints = subPointMatch[1];
                      cleanText = cleanText.replace(subPointMatch[0], '').trim();
                  }

                  currentPart = { 
                      id: partId, 
                      statement: [{ type: 'text', value: cleanText }], 
                      solution: [], 
                      points: subPoints 
                  };
              } else {
                  currentPart.statement.push(part);
              }
          } else {
              currentPart.statement.push(part);
          }
      });
      if (currentPart.statement.length > 0 || currentPart.id !== null) parts.push(currentPart);

      // --- Associate Solutions ---
      let currentPartIndex = -1;
      solutionParts.forEach(sol => {
          if (sol.type === 'text') {
              if (!sol.value) return; // skip undefined/null values
              const match = sol.value.match(partHeaderRegex);
              if (match) {
                  const solId = match[1];
                  const idx = parts.findIndex(p => p.id === solId);
                  if (idx !== -1) {
                      currentPartIndex = idx;
                  } else if (currentPartIndex < parts.length - 1) {
                      // Fallback: If we can't match ID, increment index if it makes sense
                      // This helps for cases like (1), (2) vs 1, 2
                      currentPartIndex++;
                  }
              }
          }
          
          if (currentPartIndex === -1 && parts.length > 0) {
              parts[0].solution.push(sol);
          } else if (currentPartIndex >= 0 && currentPartIndex < parts.length) {
              parts[currentPartIndex].solution.push(sol);
          }
      });

      // --- Render Parts ---
      parts.forEach((part, index) => {
          const partDiv = document.createElement('div');
          partDiv.className = 'problem-part-block';
          
          const partStatementDiv = document.createElement('div');
          partStatementDiv.className = 'part-statement';
          
          if (part.points) {
              const badge = document.createElement('span');
              badge.className = 'score-badge sub-score';
              badge.textContent = part.points;
              partStatementDiv.appendChild(badge);
          }

          part.statement.forEach(block => {
              const el = createBlockElement(block);
              if (el) partStatementDiv.appendChild(el);
          });
          partDiv.appendChild(partStatementDiv);

          if (part.solution && part.solution.length > 0) {
              const solBtn = document.createElement('button');
              solBtn.className = 'btn-toggle btn-part-solution';
              solBtn.innerText = parts.length > 1 ? `Хэсэг ${part.id || index + 1} бодолт` : 'Бодолт харах';
              
              const solContentDiv = document.createElement('div');
              solContentDiv.className = 'part-solution-content hidden';
              
              part.solution.forEach(solBlock => {
                  const el = createBlockElement(solBlock);
                  if (el) solContentDiv.appendChild(el);
              });

              solBtn.onclick = () => {
                  solContentDiv.classList.toggle('hidden');
                  solBtn.classList.toggle('active');
                  if (!solContentDiv.classList.contains('hidden') && window.MathJax) {
                      // Use a slight delay to ensure the DOM is painted
                      setTimeout(() => {
                          if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') window.MathJax.typesetPromise([solContentDiv]).catch((err) => console.log('MathJax error:', err));
                      }, 10);
                  }
              };

              partDiv.appendChild(solBtn);
              partDiv.appendChild(solContentDiv);
          }
          statementContainer.appendChild(partDiv);
      });

      // Explicitly typeset the whole problem container after building it
      if (window.MathJax) {
          setTimeout(() => {
              if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') window.MathJax.typesetPromise([problemDiv]);
          }, 0);
      }

      // Helper for problem blocks
      function createBlockElement(block) {
          if (block.type === 'text') {
              const d = document.createElement('div');
              d.className = 'text-block tex2jax_process';
              d.innerHTML = formatText(block.value);
              return d;
          } else if (block.type === 'image') {
              const baseUrl = import.meta.env.BASE_URL;
              let imgSrc = block.src || block.value || '';
              if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
              if (imgSrc.startsWith('images/')) imgSrc = imgSrc.substring(7);
              const div = document.createElement('div');
              div.className = 'image-container';
              div.innerHTML = `<img src="${baseUrl}images/${imgSrc}" alt="${block.caption || ''}">${block.caption ? `<p class="caption">${block.caption}</p>` : ''}`;
              return div;
          } else if (block.type === 'equation') {
              const eq = document.createElement('div');
              eq.className = 'equation-wrapper';
              const eqLabel = block.tag ? `<span class="equation-tag">(${block.tag})</span>` : '';
              eq.innerHTML = `\\[ ${block.value} \\] ${eqLabel}`;
              return eq;
          }
          return null;
      }

      return problemDiv;

    case 'section':
      const sec = document.createElement('section');
      sec.id = item.id;
      sec.innerHTML = `<h2>${item.title}</h2>`;
      item.body.forEach(innerItem => {
        const innerEl = createContentElement(innerItem);
        if (innerEl) sec.appendChild(innerEl);
      });
      return sec;
    case 'subsection':
      const sub = document.createElement('div');
      sub.className = 'subsection';
      sub.innerHTML = `<h3>${item.title}</h3>`;
      item.body.forEach(innerItem => {
        const innerEl = createContentElement(innerItem);
        if (innerEl) sub.appendChild(innerEl);
      });
      return sub;
    case 'equation':
      const eq = document.createElement('div');
      eq.className = 'equation-wrapper';
      const eqLabel = item.tag ? `<span class="equation-tag">(${item.tag})</span>` : '';
      eq.innerHTML = `\\[ ${item.value} \\] ${eqLabel}`;
      return eq;
    case 'image':
      const container = document.createElement('div');
      container.className = 'image-container';
      const baseUrl = import.meta.env.BASE_URL;
      let imgSrc = item.src || item.value;
      if (!imgSrc) return null;
      if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
      if (imgSrc.startsWith('images/')) imgSrc = imgSrc.substring(7);
      const finalSrc = `${baseUrl}images/${imgSrc}`;
      container.innerHTML = `
        <img src="${finalSrc}" alt="${item.caption || ''}">
        ${item.caption ? `<p class="caption">${item.caption}</p>` : ''}
      `;
      return container;
    default:
      return null;
  }
}

function formatText(text) {
  if (!text) return '';
  
  if (Array.isArray(text)) {
      return text.map(t => {
          if (t.type === 'text') return formatText(t.value);
          if (t.type === 'equation') {
              const eqLabel = t.tag ? `<span class="equation-tag">(${t.tag})</span>` : '';
              return `<div class="equation-wrapper tex2jax_process">\\[ ${t.value} \\] ${eqLabel}</div>`;
          }
          if (t.type === 'image') {
              const baseUrl = import.meta.env.BASE_URL;
              let imgSrc = t.src || t.value;
              if (imgSrc && imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
              if (imgSrc && imgSrc.startsWith('images/')) imgSrc = imgSrc.substring(7);
              return `<div class="image-container"><img src="${baseUrl}images/${imgSrc}" alt="${t.caption || ''}">${t.caption ? `<p class="caption">${t.caption}</p>` : ''}</div>`;
          }
          return '';
      }).join('');
  }
  
  if (typeof text !== 'string') return '';

  // 1. Normalize Newlines (handles both JSON literals and real newlines)
  let str = text.replace(/\\n/g, '\n');

  // 2. Escape HTML special characters (CRITICAL to preserve \ and {})
  // We avoid aggressive escaping of quotes/apos to keep it simple
  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 3. Table support (Markdown style)
  if (str.includes('|')) {
      const lines = str.split('\n');
      let i = 0;
      let resultParts = [];
      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1) {
          let tableLines = [];
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            tableLines.push(lines[i]);
            i++;
          }
          let isFirstDataRow = true;
          let tableHtml = '<div class="table-wrapper tex2jax_process"><table class="md-table">';
          tableLines.forEach(tline => {
            if (/^[|\s:-]+$/.test(tline)) return; 
            const cells = tline.split('|').slice(1, -1);
            tableHtml += '<tr>';
            cells.forEach(cell => {
              const tag = isFirstDataRow ? 'th' : 'td';
              tableHtml += `<${tag}>${formatText(cell.trim())}</${tag}>`;
            });
            tableHtml += '</tr>';
            isFirstDataRow = false;
          });
          tableHtml += '</table></div>';
          resultParts.push(tableHtml);
        } else {
          resultParts.push(line);
          i++;
        }
      }
      str = resultParts.join('\n');
  }

  // 4. Basic Markdown Bold/Italic (Simple version that doesn't mess with symbols)
  str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');

  return str;
}

init();

if (import.meta.hot) {
  import.meta.hot.on('json-update', () => {
    if (lastBook && lastChapterId) {
      console.log('JSON updated, re-loading current section...');
      loadChapter(lastBook, lastChapterId, lastSectionId);
    } else {
      // If at home, we might want to re-load library.json too
      init();
    }
  });
}
