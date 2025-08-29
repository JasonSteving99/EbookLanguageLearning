// Spanish Learning Library JavaScript

class LibraryManager {
    constructor() {
        this.books = [];
        this.init();
    }
    
    async init() {
        await this.loadBooks();
        this.renderBooks();
        console.log('Library loaded with', this.books.length, 'books');
    }
    
    async loadBooks() {
        // Dynamically discover books by scanning the book directory structure
        try {
            const availableBooks = await this.discoverBooks();
            this.books = availableBooks;
        } catch (error) {
            console.error('Error loading books:', error);
            this.books = [];
        }
    }
    
    async discoverBooks() {
        const books = [];
        
        try {
            // Try to get a list of available books by checking common book directories
            // Since we can't directly list directories in the browser, we'll try common book IDs
            const potentialBooks = await this.findAvailableBooks();
            
            for (const bookInfo of potentialBooks) {
                try {
                    // Try to load the book's TOC to get metadata
                    const tocResponse = await fetch(`book/${bookInfo.id}/index.html`);
                    if (tocResponse.ok) {
                        const tocHtml = await tocResponse.text();
                        const bookData = this.extractBookMetadata(tocHtml, bookInfo.id);
                        
                        if (bookData) {
                            books.push({
                                ...bookData,
                                stats: await this.loadBookStats(bookInfo.id)
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Could not load book ${bookInfo.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error discovering books:', error);
        }
        
        return books;
    }
    
    async findAvailableBooks() {
        // Since we can't list directories directly in the browser,
        // we'll try to detect books by checking for data files and common patterns
        const potentialBooks = [];
        
        try {
            // Check if we have a table of contents file that might list books
            const tocResponse = await fetch('data/table_of_contents.json');
            if (tocResponse.ok) {
                const tocData = await tocResponse.json();
                // Extract book ID from the first file path
                if (tocData.length > 0) {
                    // Try to determine book ID from file structure or use a fallback
                    const bookId = this.inferBookIdFromToc(tocData);
                    potentialBooks.push({ id: bookId });
                }
            }
        } catch (error) {
            console.warn('Could not load TOC data:', error);
        }
        
        // Fallback: try common book IDs if no data files found
        if (potentialBooks.length === 0) {
            const commonIds = ['el-marciano', 'book', 'default'];
            for (const id of commonIds) {
                potentialBooks.push({ id });
            }
        }
        
        return potentialBooks;
    }
    
    inferBookIdFromToc(tocData) {
        // Try to infer book ID from TOC structure
        // Look for patterns in file names or use fallback
        if (tocData.length > 0 && tocData[0].href) {
            // If files suggest a Spanish book, use a Spanish-themed ID
            const firstFile = tocData[0].href.toLowerCase();
            if (firstFile.includes('section') || firstFile.includes('cap')) {
                return 'libro'; // Generic Spanish book ID
            }
        }
        return 'el-marciano'; // Fallback to known working ID
    }
    
    extractBookMetadata(tocHtml, bookId) {
        try {
            // Parse the TOC HTML to extract book metadata
            const parser = new DOMParser();
            const doc = parser.parseFromString(tocHtml, 'text/html');
            
            // Extract title
            const titleElement = doc.querySelector('.book-meta h2, h1');
            const title = titleElement ? titleElement.textContent.trim() : this.generateTitleFromId(bookId);
            
            // Extract author
            const authorElement = doc.querySelector('.author, .book-meta .author');
            const author = authorElement ? authorElement.textContent.trim() : 'Autor desconocido';
            
            // Try to find cover image
            const coverElement = doc.querySelector('.toc-book-cover, .book-cover img');
            const coverImage = coverElement ? coverElement.src || coverElement.getAttribute('src') : this.getDefaultCoverPath(bookId);
            
            return {
                id: bookId,
                title: title,
                author: author,
                language: 'Español',
                coverImage: coverImage,
                description: `Libro interactivo para aprendizaje de español.`
            };
        } catch (error) {
            console.error(`Error extracting metadata for ${bookId}:`, error);
            return null;
        }
    }
    
    generateTitleFromId(bookId) {
        // Convert book ID to a readable title
        return bookId.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    getDefaultCoverPath(bookId) {
        // Try common cover image locations
        return 'images/cover.jpg'; // Fallback to common location
    }
    
    async loadBookStats(bookId) {
        try {
            // Load book statistics from data files
            // For multi-book support, we might need book-specific data directories later
            const [sentences, wordIndex, lemmaIndex, tocData] = await Promise.all([
                this.loadJSON('data/sentences.json'),
                this.loadJSON('data/word_index.json'),
                this.loadJSON('data/lemma_index.json'),
                this.loadJSON('data/table_of_contents.json')
            ]);
            
            // Count chapters from TOC data (more reliable than parsing sentences)
            let chapterCount = 0;
            if (tocData && tocData.length > 0) {
                chapterCount = tocData.filter(item => 
                    item.type === 'chapter' || 
                    (item.href && item.href.toLowerCase().includes('section'))
                ).length;
            }
            
            // Fallback: count from sentences if TOC data unavailable
            if (chapterCount === 0 && sentences) {
                const chapterFiles = Object.keys(sentences).filter(id => 
                    id.startsWith('Section') && id.includes('.xhtml')
                );
                chapterCount = new Set(chapterFiles.map(id => 
                    id.split('_')[0] // Get just the file part
                )).size;
            }
            
            return {
                chapters: chapterCount,
                totalWords: wordIndex ? Object.keys(wordIndex).length : 0,
                totalLemmas: lemmaIndex ? Object.keys(lemmaIndex).length : 0,
                totalSentences: sentences ? Object.keys(sentences).length : 0,
                progress: this.getReadingProgress(bookId)
            };
        } catch (error) {
            console.error('Error loading book stats:', error);
            return {
                chapters: 0,
                totalWords: 0,
                totalLemmas: 0,
                totalSentences: 0,
                progress: { completedChapters: [], currentChapter: null, percentage: 0 }
            };
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
    
    getReadingProgress(bookId) {
        const progress = localStorage.getItem(`reading-progress-${bookId}`);
        return progress ? JSON.parse(progress) : { completedChapters: [], currentChapter: null, percentage: 0 };
    }
    
    renderBooks() {
        const booksGrid = document.getElementById('books-grid');
        const emptyLibrary = document.getElementById('empty-library');
        
        if (this.books.length === 0) {
            booksGrid.style.display = 'none';
            emptyLibrary.style.display = 'block';
            return;
        }
        
        booksGrid.innerHTML = '';
        emptyLibrary.style.display = 'none';
        
        this.books.forEach(book => {
            const bookCard = this.createBookCard(book);
            booksGrid.appendChild(bookCard);
        });
    }
    
    createBookCard(book) {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.onclick = () => this.openBook(book.id);
        
        card.innerHTML = `
            <div class="book-cover">
                <img src="${book.coverImage}" alt="${book.title} cover" 
                     onerror="this.src='data:image/svg+xml;base64,${this.getPlaceholderImage(book.title)}'">
                <div class="book-overlay">
                    <div class="book-overlay-content">
                        <div style="font-weight: 600;">Click to read</div>
                        <div style="font-size: 0.9rem; margin-top: 0.25rem;">Interactive Spanish learning</div>
                    </div>
                </div>
            </div>
            
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <div class="book-author">${book.author}</div>
                
                <div class="book-stats">
                    <div class="book-chapters">${book.stats.chapters} chapters</div>
                    <div class="book-language">${book.language}</div>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${book.stats.progress.percentage}%"></div>
                </div>
                
                <div class="word-stats">
                    <div class="word-stat">
                        <div class="word-stat-number">${book.stats.totalWords.toLocaleString()}</div>
                        <div class="word-stat-label">Words</div>
                    </div>
                    <div class="word-stat">
                        <div class="word-stat-number">${book.stats.totalLemmas.toLocaleString()}</div>
                        <div class="word-stat-label">Lemmas</div>
                    </div>
                    <div class="word-stat">
                        <div class="word-stat-number">${book.stats.totalSentences.toLocaleString()}</div>
                        <div class="word-stat-label">Sentences</div>
                    </div>
                </div>
                
                <div class="book-actions">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); libraryManager.openBook('${book.id}')">
                        ${book.stats.progress.percentage > 0 ? 'Continue Reading' : 'Start Reading'}
                    </button>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); libraryManager.showBookInfo('${book.id}')">
                        Info
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    getPlaceholderImage(title) {
        // Create a simple SVG placeholder if cover image fails to load
        const svg = `
            <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="400" fill="#4a90e2"/>
                <text x="150" y="200" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">
                    ${title}
                </text>
                <text x="150" y="230" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Arial" font-size="14">
                    Spanish Learning
                </text>
            </svg>
        `;
        return btoa(svg);
    }
    
    openBook(bookId) {
        // Navigate to the book's table of contents
        window.location.href = `book/${bookId}/`;
    }
    
    showBookInfo(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;
        
        // For now, just show an alert with book info
        // Later this can be a proper modal
        alert(`
📖 ${book.title}
✍️ Author: ${book.author}
🌍 Language: ${book.language}
📚 Chapters: ${book.stats.chapters}
📝 Words: ${book.stats.totalWords.toLocaleString()}
🔤 Unique Lemmas: ${book.stats.totalLemmas.toLocaleString()}
📄 Sentences: ${book.stats.totalSentences.toLocaleString()}
📊 Progress: ${book.stats.progress.percentage}%

${book.description || 'Interactive Spanish learning with word analysis and lemmatization.'}
        `);
    }
    
    // Utility method to refresh book stats (useful after reading sessions)
    async refreshBookStats(bookId) {
        const bookIndex = this.books.findIndex(b => b.id === bookId);
        if (bookIndex !== -1) {
            this.books[bookIndex].stats = await this.loadBookStats(bookId);
            this.renderBooks();
        }
    }
}

// Initialize library when page loads
let libraryManager;
document.addEventListener('DOMContentLoaded', () => {
    libraryManager = new LibraryManager();
});

// Refresh stats when returning from reading (if coming from a book page)
window.addEventListener('focus', () => {
    if (libraryManager && document.referrer.includes('/book/')) {
        // Delay refresh to allow for data updates
        setTimeout(() => {
            libraryManager.books.forEach(book => {
                libraryManager.refreshBookStats(book.id);
            });
        }, 1000);
    }
});

// Expose globally for debugging
window.libraryManager = libraryManager;