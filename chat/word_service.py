import json
import os
from typing import Dict, List, Optional


class WordService:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.word_index = {}
        self.lemma_index = {}
        self.word_to_lemma = {}
        self.word_families = {}
        self.paragraphs = {}
        self._load_data()
    
    def _load_data(self):
        """Load all word learning data from JSON files"""
        try:
            # Load word index
            with open(os.path.join(self.data_dir, 'word_index.json'), 'r', encoding='utf-8') as f:
                self.word_index = json.load(f)
            
            # Load lemma index
            with open(os.path.join(self.data_dir, 'lemma_index.json'), 'r', encoding='utf-8') as f:
                self.lemma_index = json.load(f)
            
            # Load word-to-lemma mapping
            with open(os.path.join(self.data_dir, 'word_to_lemma.json'), 'r', encoding='utf-8') as f:
                self.word_to_lemma = json.load(f)
            
            # Load word families
            with open(os.path.join(self.data_dir, 'word_families.json'), 'r', encoding='utf-8') as f:
                self.word_families = json.load(f)
            
            # Load paragraphs
            with open(os.path.join(self.data_dir, 'paragraphs.json'), 'r', encoding='utf-8') as f:
                self.paragraphs = json.load(f)
                
            print(f"Loaded word data: {len(self.word_index)} words, {len(self.lemma_index)} lemmas")
            
        except Exception as e:
            print(f"Error loading word data: {e}")
            # Initialize empty structures on error
            self.word_index = {}
            self.lemma_index = {}
            self.word_to_lemma = {}
            self.word_families = {}
            self.paragraphs = {}
    
    def get_word_context(self, word: str, max_examples: int = 10) -> Optional[Dict]:
        """Get comprehensive context for a word including examples and family info"""
        # Get lemma for this word
        lemma = self.word_to_lemma.get(word, word)
        
        # Get word family info
        word_family = self.word_families.get(lemma, {})
        word_forms = word_family.get('forms', [word])
        
        # Get lemma data for examples
        lemma_data = self.lemma_index.get(lemma, [])
        
        if not lemma_data:
            return None
        
        # Get unique paragraph IDs, limited to max_examples
        paragraph_ids = list(set(item['paragraph_id'] for item in lemma_data))[:max_examples]
        
        # Collect examples
        examples = []
        for paragraph_id in paragraph_ids:
            paragraph = self.paragraphs.get(paragraph_id)
            if paragraph:
                # Clean HTML markup from text
                clean_text = paragraph['text'].replace('<[^>]*>', '').strip()
                examples.append(clean_text)
        
        return {
            'word': word,
            'lemma': lemma,
            'word_forms': word_forms,
            'examples': examples,
            'total_occurrences': len(lemma_data)
        }
    
    def create_system_prompt(self, word_context: Dict) -> str:
        """Create the Spanish learning system prompt for a word"""
        word = word_context['word']
        lemma = word_context['lemma']
        word_forms = word_context['word_forms']
        examples = word_context['examples']
        
        # Format word forms
        word_forms_text = ', '.join(word_forms) if len(word_forms) > 1 else word
        
        # Format examples
        formatted_examples = '\n'.join(f'• {example}' for example in examples)
        
        system_prompt = f"""Soy estudiante de español y estoy aprendiendo por inmersión total. Estoy tratando de entender intuitivamente la palabra "{lemma}" y sus formas ({word_forms_text}) sin recibir definiciones directas en inglés.

Aquí tienes ejemplos de cómo se usa esta palabra en contexto:

{formatted_examples}

Responde SOLAMENTE en español, usando un español sencillo. Aunque puedes ayudarme con explicaciones directas si es necesario, prefiero liderar el descubrimiento. No respondas a estas instrucciones - simplemente pregúntame directamente qué pienso que significa esta palabra "{lemma}"."""

        return system_prompt