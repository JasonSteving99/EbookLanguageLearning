// Table of Contents JavaScript

class TOCManager {
    constructor() {
        this.bookId = typeof bookId !== 'undefined' ? bookId : 'el-marciano';
        this.tocData = [];
        this.progress = this.loadProgress();
        this.init();
    }
    
    async init() {
        await this.loadBookStats();
        this.renderTOC();
        this.updateProgressDisplay();
        console.log('TOC loaded with', this.tocData.length, 'chapters');
    }
    
    async loadBookStats() {
        try {
            const [wordIndex, lemmaIndex] = await Promise.all([
                this.loadJSON('../../data/word_index.json'),
                this.loadJSON('../../data/lemma_index.json')
            ]);
            
            // Update stats display
            const wordCount = Object.keys(wordIndex).length;
            const lemmaCount = Object.keys(lemmaIndex).length;
            
            document.getElementById('word-count').textContent = wordCount.toLocaleString();
            document.getElementById('lemma-count').textContent = lemmaCount.toLocaleString();
        } catch (error) {
            console.error('Error loading book stats:', error);
        }
    }
    
    async loadJSON(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to load ${path}`);
            return await response.json();
        } catch (error) {
            console.error(`Error loading ${path}:`, error);
            return {};
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
    
    saveProgress() {
        localStorage.setItem(`reading-progress-${this.bookId}`, JSON.stringify(this.progress));
    }
    
    renderTOC() {
        const tocList = document.getElementById('toc-list');
        
        // Use embedded data if available, otherwise generate fallback
        if (typeof tocData !== 'undefined' && tocData.length > 0) {
            this.tocData = tocData;
        } else if (this.tocData.length === 0) {
            // Generate fallback TOC from available documents
            this.generateFallbackTOC();
        }
        
        tocList.innerHTML = '';
        
        // Group sections by type
        const frontMatter = this.tocData.filter(item => item.type === 'front_matter');
        const chapters = this.tocData.filter(item => item.type === 'chapter');
        const backMatter = this.tocData.filter(item => item.type === 'back_matter');
        
        // Render front matter
        if (frontMatter.length > 0) {
            this.renderSection(tocList, 'Front Matter', frontMatter, false);
        }
        
        // Render main chapters
        if (chapters.length > 0) {
            this.renderSection(tocList, 'Chapters', chapters, true);
        }
        
        // Render back matter
        if (backMatter.length > 0) {
            this.renderSection(tocList, 'Additional Content', backMatter, false);
        }
        
        // If nothing rendered, show error message
        if (tocList.children.length === 0) {
            tocList.innerHTML = '<div style="color: red; padding: 1rem;">Error: No TOC sections found</div>';
        }
    }
    
    renderSection(container, sectionTitle, items, numbered) {
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'toc-section-header';
        sectionHeader.textContent = sectionTitle;
        container.appendChild(sectionHeader);
        
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'toc-section';
        
        items.forEach((item, index) => {
            const tocItem = this.createTOCItem(item, numbered ? index : -1);
            sectionContainer.appendChild(tocItem);
        });
        
        container.appendChild(sectionContainer);
    }
    
    generateFallbackTOC() {
        // Create TOC entries for Section files
        const sections = [];
        for (let i = 1; i <= 29; i++) {
            const sectionNum = String(i).padStart(4, '0');
            sections.push({
                title: `Chapter ${i}`,
                href: `Section${sectionNum}.xhtml`,
                id: `section${sectionNum}`,
                order: i - 1
            });
        }
        this.tocData = sections;
    }
    
    createTOCItem(chapter, index) {
        const item = document.createElement('a');
        item.className = 'toc-item';
        item.href = `../../documents/${chapter.href}`;
        
        const isCompleted = this.progress.completedChapters.includes(chapter.href);
        const isCurrent = this.progress.currentChapter === chapter.href;
        
        if (isCompleted) item.classList.add('completed');
        if (isCurrent) item.classList.add('current');
        
        const progressText = isCompleted ? '✓' : (isCurrent ? '→' : '');
        
        // Only show numbering for chapters (when index >= 0)
        const numberPart = index >= 0 ? `<span class="toc-item-number">${index + 1}.</span>` : '';
        
        item.innerHTML = `
            ${numberPart}
            <span class="toc-item-title">${chapter.title}</span>
            <span class="toc-item-progress ${isCompleted ? 'completed' : ''}">${progressText}</span>
        `;
        
        // Track reading progress when chapter is opened
        item.addEventListener('click', () => {
            this.markChapterAsStarted(chapter.href);
        });
        
        return item;
    }
    
    markChapterAsStarted(chapterHref) {
        this.progress.currentChapter = chapterHref;
        this.updateProgress();
    }
    
    markChapterAsCompleted(chapterHref) {
        if (!this.progress.completedChapters.includes(chapterHref)) {
            this.progress.completedChapters.push(chapterHref);
        }
        
        // If this was the current chapter, clear it
        if (this.progress.currentChapter === chapterHref) {
            this.progress.currentChapter = null;
        }
        
        this.updateProgress();
    }
    
    updateProgress() {
        // Count only formatted chapters (Chapter X, Capítulo X, etc.)
        const chapterWords = ['Chapter ', 'Capítulo ', 'Chapitre '];
        const totalChapters = this.tocData.filter(item => 
            item.type === 'chapter' && 
            chapterWords.some(word => item.title.startsWith(word))
        ).length;
        const completedCount = this.progress.completedChapters.length;
        this.progress.percentage = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;
        
        this.saveProgress();
        this.updateProgressDisplay();
        this.renderTOC(); // Re-render to update visual states
    }
    
    updateProgressDisplay() {
        const progressText = document.getElementById('progress-text');
        if (progressText) {
            const completed = this.progress.completedChapters.length;
            // Count only formatted chapters for display
            const chapterWords = ['Chapter ', 'Capítulo ', 'Chapitre '];
            const total = this.tocData.filter(item => 
                item.type === 'chapter' && 
                chapterWords.some(word => item.title.startsWith(word))
            ).length;
            progressText.textContent = `${this.progress.percentage}% complete (${completed}/${total} chapters)`;
        }
    }
}

// Initialize when page loads
let tocManager;
document.addEventListener('DOMContentLoaded', () => {
    tocManager = new TOCManager();
});

// Expose globally for debugging
window.tocManager = tocManager;