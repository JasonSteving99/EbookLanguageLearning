// Chapter Navigation JavaScript

class ChapterNavigator {
    constructor() {
        this.tocData = [];
        this.currentChapter = null;
        this.bookId = null;
        this.init();
    }
    
    async init() {
        await this.loadTOCData();
        this.detectCurrentChapter();
        this.addNavigationUI();
        this.trackReadingProgress();
    }
    
    async loadTOCData() {
        try {
            const response = await fetch('../../data/table_of_contents.json');
            if (response.ok) {
                this.tocData = await response.json();
            }
        } catch (error) {
            console.error('Error loading TOC data:', error);
        }
    }
    
    detectCurrentChapter() {
        // Get current filename from URL
        const currentFile = window.location.pathname.split('/').pop();
        
        // Find current chapter in TOC data
        this.currentChapter = this.tocData.find(item => 
            item.href === currentFile
        );
        
        if (this.currentChapter) {
            // Try to detect book ID from path or use fallback
            const pathParts = window.location.pathname.split('/');
            const bookIndex = pathParts.findIndex(part => part === 'book');
            if (bookIndex >= 0 && pathParts[bookIndex + 1]) {
                this.bookId = pathParts[bookIndex + 1];
            } else {
                this.bookId = 'el-marciano'; // Fallback
            }
        }
    }
    
    addNavigationUI() {
        if (!this.currentChapter) return;
        
        // Create layout container and wrap existing content
        this.createLayoutContainer();
        
        // Create navigation containers
        const topNav = document.createElement('div');
        topNav.className = 'chapter-navigation top';
        topNav.innerHTML = this.generateNavigationHTML();
        
        const bottomNav = document.createElement('div');
        bottomNav.className = 'chapter-navigation bottom';
        bottomNav.innerHTML = this.generateNavigationHTML();
        
        // Add navigation to main content area (not body)
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            // Position relative to main content
            mainContent.style.position = 'relative';
            mainContent.appendChild(topNav);
            mainContent.appendChild(bottomNav);
        } else {
            // Fallback to body
            document.body.appendChild(topNav);
            document.body.appendChild(bottomNav);
        }
        
        // Add event listeners
        this.attachNavigationEvents();
        
        // Add keyboard shortcuts
        this.addKeyboardShortcuts();
    }
    
    createLayoutContainer() {
        const body = document.body;
        
        // Create layout wrapper
        const layoutWrapper = document.createElement('div');
        layoutWrapper.className = 'reading-layout';
        
        // Create main content wrapper
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        
        // Move all existing body content to main content wrapper
        while (body.firstChild) {
            mainContent.appendChild(body.firstChild);
        }
        
        // Add main content to layout wrapper
        layoutWrapper.appendChild(mainContent);
        
        // Add layout wrapper back to body
        body.appendChild(layoutWrapper);
        
        // Store reference for sidebar toggling
        this.mainContent = mainContent;
    }
    
    generateNavigationHTML() {
        const currentIndex = this.tocData.findIndex(item => item.href === this.currentChapter.href);
        const prevChapter = currentIndex > 0 ? this.tocData[currentIndex - 1] : null;
        const nextChapter = currentIndex < this.tocData.length - 1 ? this.tocData[currentIndex + 1] : null;
        
        const tocUrl = `../../book/${this.bookId}/`;
        
        // Calculate chapter numbering for progress display
        const chapterWords = ['Chapter ', 'Capítulo ', 'Chapitre '];
        const numberedChapters = this.tocData.filter(item => 
            item.type === 'chapter' && 
            chapterWords.some(word => item.title.startsWith(word))
        );
        const totalChapters = numberedChapters.length;
        
        // Find current chapter number
        let currentChapterNum = 0;
        if (this.currentChapter.type === 'chapter' && 
            chapterWords.some(word => this.currentChapter.title.startsWith(word))) {
            currentChapterNum = numberedChapters.findIndex(ch => ch.href === this.currentChapter.href) + 1;
        }
        
        // Progress display logic
        let progressText;
        if (currentChapterNum > 0) {
            progressText = `${currentChapterNum} de ${totalChapters}`;
        } else {
            // For front/back matter, show position in full TOC
            progressText = `${currentIndex + 1} de ${this.tocData.length}`;
        }
        
        return `
            <div class="nav-container">
                <div class="nav-left">
                    ${prevChapter ? `
                        <a href="${prevChapter.href}" class="nav-btn nav-prev" data-href="${prevChapter.href}">
                            <span class="nav-arrow">←</span>
                            <span class="nav-text">
                                <div class="nav-label">Anterior</div>
                                <div class="nav-title">${prevChapter.title}</div>
                            </span>
                        </a>
                    ` : '<div class="nav-placeholder"></div>'}
                </div>
                
                <div class="nav-center">
                    <a href="${tocUrl}" class="nav-btn nav-toc">
                        <span class="nav-icon">📖</span>
                        <span class="nav-text">Índice</span>
                    </a>
                    <div class="nav-progress">
                        <span class="current-chapter">${this.currentChapter.title}</span>
                        <div class="progress-indicator">
                            ${progressText}
                        </div>
                    </div>
                </div>
                
                <div class="nav-right">
                    ${nextChapter ? `
                        <a href="${nextChapter.href}" class="nav-btn nav-next" data-href="${nextChapter.href}">
                            <span class="nav-text">
                                <div class="nav-label">Siguiente</div>
                                <div class="nav-title">${nextChapter.title}</div>
                            </span>
                            <span class="nav-arrow">→</span>
                        </a>
                    ` : '<div class="nav-placeholder"></div>'}
                </div>
            </div>
        `;
    }
    
    attachNavigationEvents() {
        // Add click tracking for progress
        const navButtons = document.querySelectorAll('.nav-btn[data-href]');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetHref = e.currentTarget.getAttribute('data-href');
                this.markChapterAsRead(this.currentChapter.href);
                // Navigation will happen naturally via the href
            });
        });
        
        // Mark current chapter as started
        this.markChapterAsStarted(this.currentChapter.href);
    }
    
    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only activate if not in an input field
            if (e.target.tagName.toLowerCase() === 'input' || 
                e.target.tagName.toLowerCase() === 'textarea' ||
                e.target.isContentEditable) {
                return;
            }
            
            const currentIndex = this.tocData.findIndex(item => item.href === this.currentChapter.href);
            
            switch(e.key) {
                case 'ArrowLeft':
                case 'p':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        window.location.href = this.tocData[currentIndex - 1].href;
                    }
                    break;
                case 'ArrowRight':
                case 'n':
                    e.preventDefault();
                    if (currentIndex < this.tocData.length - 1) {
                        window.location.href = this.tocData[currentIndex + 1].href;
                    }
                    break;
                case 't':
                    e.preventDefault();
                    window.location.href = `../../book/${this.bookId}/`;
                    break;
            }
        });
    }
    
    markChapterAsStarted(chapterHref) {
        const progress = this.loadProgress();
        if (progress.currentChapter !== chapterHref) {
            progress.currentChapter = chapterHref;
            this.saveProgress(progress);
        }
    }
    
    markChapterAsRead(chapterHref) {
        const progress = this.loadProgress();
        if (!progress.completedChapters.includes(chapterHref)) {
            progress.completedChapters.push(chapterHref);
            this.saveProgress(progress);
        }
    }
    
    loadProgress() {
        const saved = localStorage.getItem(`reading-progress-${this.bookId}`);
        return saved ? JSON.parse(saved) : {
            completedChapters: [],
            currentChapter: null,
            percentage: 0
        };
    }
    
    saveProgress(progress) {
        localStorage.setItem(`reading-progress-${this.bookId}`, JSON.stringify(progress));
    }
    
    trackReadingProgress() {
        // Track scroll progress to automatically mark as completed
        let hasScrolled = false;
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            hasScrolled = true;
            
            // Clear existing timeout
            clearTimeout(scrollTimeout);
            
            // Set a new timeout to check if user has stopped scrolling
            scrollTimeout = setTimeout(() => {
                if (hasScrolled) {
                    const scrollPercent = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
                    
                    // Mark as read if scrolled to 80% of the page
                    if (scrollPercent > 0.8) {
                        this.markChapterAsRead(this.currentChapter.href);
                    }
                }
            }, 1000);
        });
        
        // Also mark as read when leaving the page
        window.addEventListener('beforeunload', () => {
            this.markChapterAsRead(this.currentChapter.href);
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChapterNavigator();
});

// Show keyboard shortcut help
console.log(`
📚 Atajos de Navegación de Capítulos:
• ← o P: Capítulo anterior
• → o N: Capítulo siguiente  
• T: Índice
`);