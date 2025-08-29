// Interactive Word Learning JavaScript

class WordLearningApp {
    constructor() {
        this.wordIndex = {};
        this.lemmaIndex = {};
        this.wordToLemma = {};
        this.wordFamilies = {};
        this.sentences = {};
        this.currentSelectedWord = null;
        this.currentSelectedLemma = null;
        this.sidebar = null;
        // Tooltip removed - was causing positioning issues
        // Always show both word family and exact usage information
        
        this.init();
    }
    
    async init() {
        await this.loadData();
        this.setupDOM();
        this.bindEvents();
        console.log('Enhanced Word Learning App initialized');
        console.log(`Loaded ${Object.keys(this.wordIndex).length} unique words`);
        console.log(`Loaded ${Object.keys(this.lemmaIndex).length} unique lemmas`);
    }
    
    async loadData() {
        try {
            // Load word index
            const wordResponse = await fetch('../data/word_index.json');
            this.wordIndex = await wordResponse.json();
            
            // Load lemma index
            const lemmaResponse = await fetch('../data/lemma_index.json');
            this.lemmaIndex = await lemmaResponse.json();
            
            // Load word-to-lemma mapping
            const wordToLemmaResponse = await fetch('../data/word_to_lemma.json');
            this.wordToLemma = await wordToLemmaResponse.json();
            
            // Load word families
            const familiesResponse = await fetch('../data/word_families.json');
            this.wordFamilies = await familiesResponse.json();
            
            // Load sentences
            const sentencesResponse = await fetch('../data/sentences.json');
            this.sentences = await sentencesResponse.json();
            
            console.log('Enhanced data loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
            // Fallback: create empty structures
            this.wordIndex = {};
            this.lemmaIndex = {};
            this.wordToLemma = {};
            this.wordFamilies = {};
            this.sentences = {};
        }
    }
    
    setupDOM() {
        // Create sidebar
        this.sidebar = document.createElement('div');
        this.sidebar.id = 'word-sidebar';
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => this.closeSidebar();
        
        // Create sidebar content
        const sidebarContent = document.createElement('div');
        sidebarContent.id = 'sidebar-content';
        
        // No initial content needed - will be populated when word is selected
        
        this.sidebar.appendChild(closeBtn);
        this.sidebar.appendChild(sidebarContent);
        
        // Add sidebar to reading-layout if it exists, otherwise body
        const readingLayout = document.querySelector('.reading-layout');
        if (readingLayout) {
            readingLayout.appendChild(this.sidebar);
        } else {
            document.body.appendChild(this.sidebar);
        }
        
        // Tooltip removed - sidebar provides all necessary information
    }
    
    bindEvents() {
        // Add event listeners to all word spans
        const words = document.querySelectorAll('.word');
        
        words.forEach(word => {
            word.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleWordClick(word);
            });
            
            // Removed tooltip event listeners - sidebar provides all information
        });
        
        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.sidebar.contains(e.target) && !e.target.classList.contains('word')) {
                this.closeSidebar();
            }
        });
        
        // Keyboard shortcuts - use capture phase to intercept before any other handlers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation(); // Prevent any other ESC handlers from running
                if (this.sidebar && this.sidebar.classList.contains('open')) {
                    this.closeSidebar();
                }
                // If sidebar is closed, do nothing but prevent any navigation
            }
        }, true); // Use capture phase to run before other handlers
    }
    
    handleWordClick(wordElement) {
        const word = wordElement.dataset.word;
        const lemma = wordElement.dataset.lemma || this.wordToLemma[word] || word;
        const sentenceId = wordElement.dataset.sentenceId;
        
        // Clear previous selection
        this.clearWordSelection();
        
        // Select current word
        wordElement.classList.add('selected');
        this.currentSelectedWord = word;
        this.currentSelectedLemma = lemma;
        
        // Highlight based on current mode
        // Always show lemma (word family) instances
        this.highlightLemmaInstances(lemma);
        
        // Update sidebar
        this.updateSidebar(word, lemma, sentenceId);
        
        // Open sidebar
        this.openSidebar();
    }
    
    // Removed toggle functionality - always show comprehensive information
    
    highlightLemmaInstances(targetLemma) {
        document.querySelectorAll('.word').forEach(word => {
            const wordLemma = word.dataset.lemma || this.wordToLemma[word.dataset.word] || word.dataset.word;
            if (wordLemma === targetLemma) {
                word.classList.add('highlight-all');
            }
        });
    }
    
    clearWordSelection() {
        document.querySelectorAll('.word.selected').forEach(word => {
            word.classList.remove('selected');
        });
        
        document.querySelectorAll('.word.highlight-all').forEach(word => {
            word.classList.remove('highlight-all');
        });
    }
    
    highlightWordInstances(targetWord) {
        document.querySelectorAll('.word').forEach(word => {
            if (word.dataset.word === targetWord) {
                word.classList.add('highlight-all');
            }
        });
    }
    
    updateSidebar(word, lemma, currentSentenceId) {
        const wordData = this.wordIndex[word] || [];
        const lemmaData = this.lemmaIndex[lemma] || [];
        const wordFamily = this.wordFamilies[lemma] || {};
        const currentSentence = this.sentences[currentSentenceId];
        
        const wordFrequency = wordData.length;
        const lemmaFrequency = lemmaData.length;
        const wordForms = wordFamily.forms || [word];
        
        // Calculate frequency level based on lemma (word family) frequency
        const displayFrequency = lemmaFrequency;
        let frequencyLevel = 'bajo';
        if (displayFrequency > 20) frequencyLevel = 'alto';
        else if (displayFrequency > 5) frequencyLevel = 'medio';
        
        const sidebarContent = document.getElementById('sidebar-content');
        
        // Clear all existing content
        sidebarContent.innerHTML = '';
        
        // Main title - show word and lemma
        const titleContainer = document.createElement('div');
        titleContainer.className = 'word-title-container';
        
        const mainTitle = document.createElement('h2');
        mainTitle.textContent = word;
        titleContainer.appendChild(mainTitle);
        
        if (word !== lemma) {
            const lemmaInfo = document.createElement('div');
            lemmaInfo.className = 'lemma-info';
            lemmaInfo.textContent = `Lema: ${lemma}`;
            titleContainer.appendChild(lemmaInfo);
        }
        
        sidebarContent.appendChild(titleContainer);
        
        // Frequency section
        const freqSection = this.createWordInfoSection(
            'Frecuencia de la Familia de Palabras'
        );
        
        const progressDiv = document.createElement('div');
        progressDiv.className = 'word-progress';
        
        const progressCircle = document.createElement('div');
        progressCircle.className = 'progress-circle';
        progressCircle.textContent = displayFrequency;
        
        const progressText = document.createElement('span');
        progressText.textContent = 'apariciones totales de la familia';
        
        progressDiv.appendChild(progressCircle);
        progressDiv.appendChild(progressText);
        
        // Always show exact word frequency if different from lemma frequency
        if (wordFrequency !== lemmaFrequency) {
            const exactFreqText = document.createElement('div');
            exactFreqText.className = 'exact-freq-info';
            exactFreqText.textContent = `(${wordFrequency} as "${word}")`;
            progressDiv.appendChild(exactFreqText);
        }
        
        const freqBar = document.createElement('div');
        freqBar.className = 'frequency-bar';
        const freqFill = document.createElement('div');
        freqFill.className = 'frequency-fill';
        freqFill.style.width = Math.min(displayFrequency * 2, 100) + '%';
        freqBar.appendChild(freqFill);
        
        const freqLevel = document.createElement('p');
        const freqStrong = document.createElement('strong');
        freqStrong.textContent = 'Nivel de frecuencia: ';
        freqLevel.appendChild(freqStrong);
        freqLevel.appendChild(document.createTextNode(frequencyLevel));
        
        freqSection.appendChild(progressDiv);
        freqSection.appendChild(freqBar);
        freqSection.appendChild(freqLevel);
        sidebarContent.appendChild(freqSection);
        
        // Word family section (if applicable)
        if (wordForms.length > 1) {
            const familySection = this.createWordInfoSection('Familia de Palabras');
            
            const formsContainer = document.createElement('div');
            formsContainer.className = 'word-forms-container';
            
            wordForms.forEach(form => {
                const formElement = document.createElement('span');
                formElement.className = 'word-form';
                if (form === word) {
                    formElement.classList.add('current-word');
                }
                formElement.textContent = form;
                formElement.onclick = () => this.highlightWordForm(form);
                formsContainer.appendChild(formElement);
            });
            
            familySection.appendChild(formsContainer);
            sidebarContent.appendChild(familySection);
        }
        
        // Current context section
        const contextSection = this.createWordInfoSection('Contexto Actual');
        const contextSentence = this.createExampleSentence(currentSentence.text, word, currentSentence.file);
        contextSection.appendChild(contextSentence);
        sidebarContent.appendChild(contextSection);
        
        // Other examples section
        const examplesTitle = 'Todos los Ejemplos de la Familia';
        const examplesSection = this.createWordInfoSection(examplesTitle);
        
        // Add clipboard button to examples section header
        const examplesHeader = examplesSection.querySelector('h3');
        const clipboardBtn = document.createElement('button');
        clipboardBtn.className = 'clipboard-btn';
        clipboardBtn.innerHTML = '📋';
        clipboardBtn.title = 'Copiar ejemplos para ChatGPT';
        clipboardBtn.onclick = () => this.copyExamplesToClipboard(lemma, word, currentSentenceId);
        examplesHeader.appendChild(clipboardBtn);
        
        const examplesContainer = document.createElement('div');
        examplesContainer.className = 'example-sentences';
        
        // Always show word family examples
        this.addLemmaExampleSentences(examplesContainer, lemma, currentSentenceId);
        
        examplesSection.appendChild(examplesContainer);
        sidebarContent.appendChild(examplesSection);
    }
    
    highlightWordForm(targetForm) {
        // Clear current highlighting
        this.clearWordSelection();
        
        // Highlight all instances of the target form
        document.querySelectorAll('.word').forEach(word => {
            if (word.dataset.word === targetForm) {
                word.classList.add('highlight-all');
            }
        });
    }
    
    addLemmaExampleSentences(container, lemma, excludeSentenceId) {
        const lemmaData = this.lemmaIndex[lemma] || [];
        
        // Get up to 8 different examples from word family
        const sentenceIds = [...new Set(lemmaData.map(item => item.sentence_id))]
            .filter(id => id !== excludeSentenceId)
            .slice(0, 8);
        
        if (sentenceIds.length === 0) {
            const noExamples = document.createElement('p');
            noExamples.textContent = 'No se encontraron otros ejemplos.';
            container.appendChild(noExamples);
            return;
        }
        
        sentenceIds.forEach(sentenceId => {
            const sentence = this.sentences[sentenceId];
            if (sentence) {
                // Find which word form appears in this sentence
                const wordsInSentence = lemmaData.filter(item => item.sentence_id === sentenceId);
                const wordForm = wordsInSentence.length > 0 ? wordsInSentence[0].word : lemma;
                
                const exampleSentence = this.createExampleSentence(sentence.text, wordForm, sentence.file);
                container.appendChild(exampleSentence);
            }
        });
    }
    
    createWordInfoSection(title) {
        const section = document.createElement('div');
        section.className = 'word-info';
        
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.appendChild(heading);
        
        return section;
    }
    
    createExampleSentence(sentenceText, targetWord, fileName) {
        const sentenceDiv = document.createElement('div');
        sentenceDiv.className = 'example-sentence';
        
        // Highlight the target word in the sentence
        const highlightedText = this.highlightWordInText(sentenceText, targetWord);
        sentenceDiv.appendChild(highlightedText);
        
        const context = document.createElement('div');
        context.className = 'context';
        context.textContent = 'De: ' + fileName;
        sentenceDiv.appendChild(context);
        
        return sentenceDiv;
    }
    
    highlightWordInText(text, targetWord) {
        const container = document.createElement('div');
        
        // Simple case-insensitive search without regex word boundaries
        const lowerText = text.toLowerCase();
        const lowerTarget = targetWord.toLowerCase();
        
        let currentIndex = 0;
        let foundIndex;
        
        while ((foundIndex = lowerText.indexOf(lowerTarget, currentIndex)) !== -1) {
            // Check if this is actually a whole word (simple boundary check)
            const charBefore = foundIndex > 0 ? lowerText[foundIndex - 1] : ' ';
            const charAfter = foundIndex + lowerTarget.length < lowerText.length ? 
                             lowerText[foundIndex + lowerTarget.length] : ' ';
            
            // Consider it a word if bounded by non-letter characters
            const isWordBoundary = !/[a-záéíóúüñ]/.test(charBefore) && !/[a-záéíóúüñ]/.test(charAfter);
            
            if (isWordBoundary) {
                // Add text before the match
                if (foundIndex > currentIndex) {
                    container.appendChild(document.createTextNode(text.slice(currentIndex, foundIndex)));
                }
                
                // Add highlighted match (preserve original case)
                const highlight = document.createElement('span');
                highlight.className = 'highlight';
                highlight.textContent = text.slice(foundIndex, foundIndex + lowerTarget.length);
                container.appendChild(highlight);
                
                currentIndex = foundIndex + lowerTarget.length;
            } else {
                currentIndex = foundIndex + 1; // Try next position
            }
        }
        
        // Add remaining text
        if (currentIndex < text.length) {
            container.appendChild(document.createTextNode(text.slice(currentIndex)));
        }
        
        // If no matches found, just add the original text
        if (currentIndex === 0) {
            container.appendChild(document.createTextNode(text));
        }
        
        return container;
    }
    
    addExampleSentences(container, word, excludeSentenceId) {
        const wordData = this.wordIndex[word] || [];
        
        // Get up to 5 different examples
        const sentenceIds = [...new Set(wordData.map(item => item.sentence_id))]
            .filter(id => id !== excludeSentenceId)
            .slice(0, 5);
        
        if (sentenceIds.length === 0) {
            const noExamples = document.createElement('p');
            noExamples.textContent = 'No se encontraron otros ejemplos.';
            container.appendChild(noExamples);
            return;
        }
        
        sentenceIds.forEach(sentenceId => {
            const sentence = this.sentences[sentenceId];
            if (sentence) {
                const exampleSentence = this.createExampleSentence(sentence.text, word, sentence.file);
                container.appendChild(exampleSentence);
            }
        });
    }
    
    // Tooltip methods removed - sidebar provides comprehensive information on click
    
    openSidebar() {
        this.sidebar.classList.add('open');
        
        // Toggle main content class for new layout
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.add('sidebar-open');
        }
    }
    
    closeSidebar() {
        this.sidebar.classList.remove('open');
        
        // Force reflow to ensure transform is applied
        this.sidebar.offsetHeight; // Trigger reflow
        
        // Toggle main content class for new layout  
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.remove('sidebar-open');
        }
        
        this.clearWordSelection();
        this.currentSelectedWord = null;
        this.currentSelectedLemma = null;
    }
    
    // Utility methods for future features
    markWordAsLearned(word) {
        // Store in localStorage or send to backend
        const learnedWords = JSON.parse(localStorage.getItem('learnedWords') || '[]');
        if (!learnedWords.includes(word)) {
            learnedWords.push(word);
            localStorage.setItem('learnedWords', JSON.stringify(learnedWords));
        }
    }
    
    isWordLearned(word) {
        const learnedWords = JSON.parse(localStorage.getItem('learnedWords') || '[]');
        return learnedWords.includes(word);
    }
    
    copyExamplesToClipboard(lemma, word, currentSentenceId) {
        try {
            // Get all sentence examples for this lemma (not just displayed ones)
            const lemmaData = this.lemmaIndex[lemma] || [];
            const wordFamily = this.wordFamilies[lemma] || {};
            const wordForms = wordFamily.forms || [word];
            
            // Get all unique sentence IDs
            const allSentenceIds = [...new Set(lemmaData.map(item => item.sentence_id))];
            
            // Create example sentences list
            const examples = [];
            allSentenceIds.forEach(sentenceId => {
                const sentence = this.sentences[sentenceId];
                if (sentence) {
                    // Clean the text of HTML markup
                    const cleanText = sentence.text.replace(/<[^>]*>/g, '');
                    examples.push(`• ${cleanText}`);
                }
            });
            
            // Create the LLM prompt
            const wordFormsText = wordForms.length > 1 ? wordForms.join(', ') : word;
            const prompt = `Soy estudiante de español y estoy aprendiendo por inmersión total. Estoy tratando de entender intuitivamente la palabra "${lemma}" y sus formas (${wordFormsText}) sin recibir definiciones directas en inglés.

Aquí tienes ejemplos de cómo se usa esta palabra en contexto:

${examples.join('\n')}

Responde SOLAMENTE en español, usando un español sencillo. Aunque puedes ayudarme con explicaciones directas si es necesario, prefiero liderar el descubrimiento. No respondas a estas instrucciones - simplemente pregúntame directamente qué pienso que significa esta palabra "${lemma}".`;
            
            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(prompt).then(() => {
                    this.showClipboardFeedback(true);
                }).catch(() => {
                    this.fallbackCopyToClipboard(prompt);
                });
            } else {
                this.fallbackCopyToClipboard(prompt);
            }
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            this.showClipboardFeedback(false);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            this.showClipboardFeedback(successful);
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.showClipboardFeedback(false);
        }
        
        document.body.removeChild(textArea);
    }
    
    showClipboardFeedback(success) {
        const btn = document.querySelector('.clipboard-btn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = success ? '✅' : '❌';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1500);
        }
    }
    
    getWordStats() {
        return {
            totalWords: Object.keys(this.wordIndex).length,
            totalOccurrences: Object.values(this.wordIndex).reduce((sum, arr) => sum + arr.length, 0),
            learnedWords: JSON.parse(localStorage.getItem('learnedWords') || '[]').length
        };
    }
}

// Initialize the app when the page loads
let wordApp;
document.addEventListener('DOMContentLoaded', () => {
    wordApp = new WordLearningApp();
});

// Expose globally for debugging
window.wordApp = wordApp;
