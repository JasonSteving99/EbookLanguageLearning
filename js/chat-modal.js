// Chat Modal Component for Word Learning
class ChatModal {
    constructor() {
        this.modal = null;
        this.messagesContainer = null;
        this.inputField = null;
        this.sendButton = null;
        this.currentWord = null;
        this.conversationHistory = [];
        this.isLoading = false;
        
        this.createModal();
    }
    
    createModal() {
        // Create modal backdrop
        this.modal = document.createElement('div');
        this.modal.id = 'chat-modal';
        this.modal.className = 'chat-modal';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'chat-modal-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'chat-modal-header';
        
        const title = document.createElement('h3');
        title.textContent = 'Conversación sobre la palabra';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'chat-modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.close();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Messages container
        this.messagesContainer = document.createElement('div');
        this.messagesContainer.className = 'chat-messages';
        
        // Input section
        const inputSection = document.createElement('div');
        inputSection.className = 'chat-input-section';
        
        this.inputField = document.createElement('textarea');
        this.inputField.className = 'chat-input';
        this.inputField.placeholder = 'Escribe tu mensaje...';
        this.inputField.rows = 2;
        
        this.sendButton = document.createElement('button');
        this.sendButton.className = 'chat-send-btn';
        this.sendButton.textContent = 'Enviar';
        this.sendButton.onclick = () => this.sendMessage();
        
        inputSection.appendChild(this.inputField);
        inputSection.appendChild(this.sendButton);
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(this.messagesContainer);
        modalContent.appendChild(inputSection);
        this.modal.appendChild(modalContent);
        
        // Add to document
        document.body.appendChild(this.modal);
        
        // Event listeners
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.close();
            }
        });
        
        // Monitor sidebar state changes to adjust modal layout
        this.setupSidebarObserver();
    }
    
    open(word) {
        this.currentWord = word;
        this.conversationHistory = [];
        
        // Update title
        const title = this.modal.querySelector('.chat-modal-header h3');
        title.textContent = `Conversación sobre la palabra: "${word}"`;
        
        // Clear messages
        this.messagesContainer.innerHTML = '';
        
        // Show modal
        this.modal.classList.add('show');
        
        // Focus input
        setTimeout(() => {
            this.inputField.focus();
        }, 300);
        
        // Send initial greeting message automatically
        this.sendMessage('Hola! ¿Qué piensas que significa esta palabra?');
    }
    
    // Helper method to check if WordLearningApp is ready
    isWordAppReady() {
        return window.wordApp && 
               window.wordApp.wordIndex && 
               Object.keys(window.wordApp.wordIndex).length > 0;
    }
    
    close() {
        this.modal.classList.remove('show');
        this.currentWord = null;
        this.conversationHistory = [];
        this.inputField.value = '';
    }
    
    async sendMessage(messageText = null) {
        const message = messageText || this.inputField.value.trim();
        if (!message || this.isLoading) return;
        
        // Clear input (only if not auto-message)
        if (!messageText) {
            this.inputField.value = '';
        }
        
        // Add user message to UI (only if not auto-message)
        if (!messageText) {
            this.addMessage(message, 'user');
            this.conversationHistory.push({ role: 'user', content: message });
        }
        
        // Show loading
        this.setLoading(true);
        const loadingMessage = this.addMessage('...', 'assistant', true);
        
        try {
            // Send to backend
            const response = await fetch(`/chat/word/${encodeURIComponent(this.currentWord)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversation_history: this.conversationHistory,
                    model: 'gpt-oss:20b'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Remove loading message
            loadingMessage.remove();
            
            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';
            let messageElement = null;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.message && data.message.content) {
                                assistantMessage += data.message.content;
                                
                                // Create or update message element
                                if (!messageElement) {
                                    messageElement = this.addMessage(assistantMessage, 'assistant');
                                } else {
                                    this.updateMessageContent(messageElement, assistantMessage);
                                }
                                
                                // Auto-scroll to bottom
                                this.scrollToBottom();
                            }
                            
                            // Check if message is complete
                            if (data.done) {
                                this.conversationHistory.push({ role: 'assistant', content: assistantMessage });
                                break;
                            }
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            loadingMessage.remove();
            this.addMessage('Error: No se pudo conectar con el servicio de chat.', 'error');
        } finally {
            this.setLoading(false);
        }
    }
    
    addMessage(content, role, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        
        if (isLoading) {
            messageDiv.classList.add('loading');
        }
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Make assistant messages interactive, but not user messages or loading
        if (role === 'assistant' && !isLoading) {
            this.setInteractiveContent(messageContent, content);
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        this.messagesContainer.appendChild(messageDiv);
        
        this.scrollToBottom();
        return messageDiv;
    }
    
    updateMessageContent(messageElement, content) {
        const messageContent = messageElement.querySelector('.message-content');
        const isAssistantMessage = messageElement.classList.contains('assistant');
        
        if (isAssistantMessage) {
            this.setInteractiveContent(messageContent, content);
        } else {
            messageContent.textContent = content;
        }
    }
    
    setInteractiveContent(container, text) {
        // Clear existing content
        container.innerHTML = '';
        
        
        // Process text to make words clickable
        const processedContent = this.processTextForInteraction(text);
        container.appendChild(processedContent);
    }
    
    processTextForInteraction(text) {
        const fragment = document.createDocumentFragment();
        
        // Split text into words and spaces/punctuation
        const tokens = text.split(/(\s+|[.,!?;:()¿¡"«»—–\-])/);
        
        tokens.forEach(token => {
            if (/^\s+$/.test(token) || /^[.,!?;:()¿¡"«»—–\-]+$/.test(token)) {
                // Whitespace or punctuation - add as text
                fragment.appendChild(document.createTextNode(token));
            } else if (token.trim()) {
                // Word - make it clickable if it exists in our word data
                const cleanWord = token.toLowerCase().trim();
                
                // Check if word exists in our data
                const exists = this.wordExistsInData(cleanWord);
                
                // Only make words clickable if they exist in the book data
                if (this.isWordAppReady() && exists) {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'word clickable-chat-word';
                    wordSpan.textContent = token;
                    wordSpan.dataset.word = cleanWord;
                    
                    // Get lemma if available
                    const lemma = window.wordApp.wordToLemma[cleanWord] || cleanWord;
                    wordSpan.dataset.lemma = lemma;
                    
                    // Add dummy paragraphId to prevent errors (chat context doesn't have paragraphs)
                    wordSpan.dataset.paragraphId = 'chat-context';
                    
                    // Add click handler to open sidebar
                    wordSpan.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.isWordAppReady()) {
                            window.wordApp.handleWordClick(wordSpan);
                        }
                    });
                    
                    fragment.appendChild(wordSpan);
                } else {
                    // Word not in data - add as regular text
                    fragment.appendChild(document.createTextNode(token));
                }
            }
        });
        
        return fragment;
    }
    
    wordExistsInData(word) {
        if (!this.isWordAppReady()) {
            return false;
        }
        
        // Check if word exists in word index or lemma index
        return !!window.wordApp.wordIndex[word] || 
               !!window.wordApp.lemmaIndex[word] ||
               !!window.wordApp.wordToLemma[word];
    }
    
    setLoading(loading) {
        this.isLoading = loading;
        this.sendButton.disabled = loading;
        this.inputField.disabled = loading;
        
        if (loading) {
            this.sendButton.textContent = 'Enviando...';
        } else {
            this.sendButton.textContent = 'Enviar';
        }
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    setupSidebarObserver() {
        // Create observer to watch for sidebar state changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const sidebar = document.getElementById('word-sidebar');
                    if (sidebar) {
                        const isSidebarOpen = sidebar.classList.contains('open');
                        
                        // Adjust modal layout based on sidebar state
                        if (this.modal.classList.contains('show')) {
                            if (isSidebarOpen) {
                                this.modal.classList.add('sidebar-active');
                            } else {
                                this.modal.classList.remove('sidebar-active');
                            }
                        }
                    }
                }
            });
        });
        
        // Observe the sidebar for class changes
        setTimeout(() => {
            const sidebar = document.getElementById('word-sidebar');
            if (sidebar) {
                observer.observe(sidebar, { 
                    attributes: true, 
                    attributeFilter: ['class'] 
                });
            }
        }, 1000); // Wait for WordLearningApp to initialize
    }
}

// Create global instance
window.chatModal = new ChatModal();