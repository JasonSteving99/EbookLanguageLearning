import ebooklib
from ebooklib import epub
import pprint
import os
import re
import json
import spacy
from bs4 import BeautifulSoup, NavigableString

# Load Spanish language model
print("Loading Spanish NLP model...")
nlp = spacy.load("es_core_news_sm")
print("Spanish model loaded successfully!")

# Global data structures for word indexing
word_index = {}  # word -> [sentence_ids]
lemma_index = {}  # lemma -> [sentence_ids]
word_to_lemma = {}  # word -> lemma
sentences = {}   # sentence_id -> {text, file, paragraph, context}
sentence_counter = 0

# Configuration for different book types/languages
BOOK_CONFIG = {
    'front_matter_keywords': ['cubierta', 'titulo', 'autor', 'dedicatoria', 'sinopsis', 'info', 'cover', 'title', 'author', 'dedication', 'preface', 'introduction'],
    'back_matter_keywords': ['notas', 'notes', 'bibliography', 'index', 'appendix', 'glossary'],
    'front_matter_titles': ['presentación', 'mapa', 'introduction', 'preface', 'foreword', 'map'],
    'chapter_patterns': ['section', 'chapter', 'cap', 'ch'],
    'chapter_title_format': 'Capítulo {}',  # Format for numeric chapters
    'languages': {
        'es': {'chapter_word': 'Capítulo'},
        'en': {'chapter_word': 'Chapter'},
        'fr': {'chapter_word': 'Chapitre'}
    }
}

def classify_section_type(file_name, title, language='es'):
    """Classify a section as front_matter, chapter, or back_matter"""
    file_name_lower = file_name.lower()
    title_lower = title.lower()
    
    # Check for front matter keywords in filename
    if any(keyword in file_name_lower for keyword in BOOK_CONFIG['front_matter_keywords']):
        return "front_matter"
    
    # Check for back matter keywords in filename
    if any(keyword in file_name_lower for keyword in BOOK_CONFIG['back_matter_keywords']):
        return "back_matter"
    
    # Check for front matter titles
    if title_lower in BOOK_CONFIG['front_matter_titles']:
        return "front_matter"
    
    # Check for chapter patterns in filename
    if any(pattern in file_name_lower for pattern in BOOK_CONFIG['chapter_patterns']):
        return "chapter"
    
    # Default to chapter for numbered content
    return "chapter"

def format_chapter_title(title, language='es'):
    """Format chapter titles consistently"""
    if title.isdigit():
        chapter_word = BOOK_CONFIG['languages'].get(language, {}).get('chapter_word', 'Chapter')
        return f"{chapter_word} {title}"
    return title

def detect_book_language(book):
    """Detect book language from metadata"""
    try:
        language_meta = book.get_metadata('DC', 'language')
        if language_meta:
            lang_code = language_meta[0][0][:2]  # Get first two characters (e.g., 'es' from 'es-ES')
            return lang_code if lang_code in BOOK_CONFIG['languages'] else 'en'
    except:
        pass
    return 'en'  # Default to English

def generate_book_id(book):
    """Generate a book ID from metadata"""
    try:
        title_meta = book.get_metadata('DC', 'title')
        if title_meta:
            title = title_meta[0][0].lower()
            # Replace spaces and special characters with hyphens
            book_id = re.sub(r'[^\w\s-]', '', title)
            book_id = re.sub(r'[\s_]+', '-', book_id)
            return book_id
    except:
        pass
    return 'book'  # Fallback

def tokenize_text_with_spans(text, sentence_id, file_name):
    """
    Tokenize text using spaCy to extract words and lemmas, creating interactive spans
    """
    global nlp, word_index, lemma_index, word_to_lemma
    
    # Process text with spaCy
    doc = nlp(text)
    
    result = []
    last_end = 0
    word_position = 0
    
    for token in doc:
        # Add any text before this token (whitespace, punctuation not captured by spaCy)
        if token.idx > last_end:
            result.append(text[last_end:token.idx])
        
        # Check if this is a word (alphabetic characters) - include stop words for language learning
        if token.is_alpha:
            word_original = token.text
            word_lower = token.lower_
            lemma_lower = token.lemma_.lower()
            
            # Create span for the word with both word and lemma data
            span = f'<span class="word" data-word="{word_lower}" data-lemma="{lemma_lower}" data-sentence-id="{sentence_id}" data-position="{word_position}" data-file="{file_name}">{word_original}</span>'
            result.append(span)
            
            # Update word index
            if word_lower not in word_index:
                word_index[word_lower] = []
            word_index[word_lower].append({
                'sentence_id': sentence_id,
                'position': word_position,
                'file': file_name,
                'original': word_original,
                'lemma': lemma_lower
            })
            
            # Update lemma index
            if lemma_lower not in lemma_index:
                lemma_index[lemma_lower] = []
            lemma_index[lemma_lower].append({
                'sentence_id': sentence_id,
                'position': word_position,
                'file': file_name,
                'word': word_lower,
                'original': word_original
            })
            
            # Update word-to-lemma mapping
            word_to_lemma[word_lower] = lemma_lower
            
            word_position += 1
        else:
            # Not a word (punctuation, numbers, etc.) - keep as is
            result.append(token.text)
        
        last_end = token.idx + len(token.text)
    
    # Add any remaining text after the last token
    if last_end < len(text):
        result.append(text[last_end:])
    
    return ''.join(result)

def process_text_nodes(element, sentence_id, file_name):
    """
    Process all text nodes in an element, wrapping words with spans
    """
    global sentence_counter
    
    # Process direct text nodes
    for child in list(element.children):
        if isinstance(child, NavigableString):
            if child.strip():  # Only process non-empty text
                wrapped_text = tokenize_text_with_spans(str(child), sentence_id, file_name)
                # Replace the text node with the wrapped version
                soup_fragment = BeautifulSoup(wrapped_text, 'html.parser')
                child.replace_with(*soup_fragment.contents)
        elif hasattr(child, 'children'):
            # Recursively process child elements
            process_text_nodes(child, sentence_id, file_name)


def extract_toc_data(book):
    """Extract table of contents from EPUB"""
    toc_data = []
    
    # Get the navigation document (NCX or nav)
    nav_item = None
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_NAVIGATION:
            nav_item = item
            break
    
    # Fallback to spine order if no navigation found
    if not nav_item:
        print("No navigation document found, using spine order")
        spine_items = [book.get_item_with_id(item_id) for item_id, _ in book.spine]
        for i, item in enumerate(spine_items):
            if item and item.get_type() == ebooklib.ITEM_DOCUMENT:
                # Try to extract title from first h1, h2, or title tag
                try:
                    content = item.get_content().decode('utf-8')
                    soup = BeautifulSoup(content, 'html.parser')
                    
                    # Look for chapter title in various places
                    title = None
                    section_type = "chapter"  # Default type
                    
                    if soup.h1:
                        title = soup.h1.get_text().strip()
                    elif soup.h2:
                        title = soup.h2.get_text().strip()
                    elif soup.title:
                        title_text = soup.title.get_text().strip()
                        if ' - ' in title_text:
                            title = title_text.split(' - ')[-1]
                        else:
                            title = title_text
                    
                    # Determine section type based on filename and title
                    original_file_name = item.get_name()
                    file_name_for_classification = original_file_name.lower()
                    if any(x in file_name_for_classification for x in ['cubierta', 'titulo', 'autor', 'dedicatoria', 'sinopsis', 'info']):
                        section_type = "front_matter"
                    elif 'notas' in file_name_for_classification:
                        section_type = "back_matter"
                    elif file_name_for_classification.startswith('section'):
                        section_type = "chapter"
                        if not title or title == original_file_name:
                            # Extract chapter number from filename if possible
                            match = re.search(r'section(\d+)', file_name_for_classification)
                            if match:
                                chapter_num = int(match.group(1))
                                title = f"Capítulo {chapter_num}"
                            else:
                                title = f"Capítulo {i + 1}"
                    
                    if not title:
                        title = original_file_name.replace('.xhtml', '').replace('.html', '').title()
                    
                    toc_data.append({
                        'title': title,
                        'href': original_file_name,
                        'id': item.get_id(),
                        'order': i,
                        'type': section_type
                    })
                except Exception as e:
                    print(f"Error processing {item.get_name()}: {e}")
    else:
        print("Found navigation document, extracting TOC")
        try:
            nav_content = nav_item.get_content().decode('utf-8')
            
            # Check if this is NCX format (XML) or HTML navigation
            if '<ncx' in nav_content:
                # Parse NCX format
                nav_soup = BeautifulSoup(nav_content, 'xml')
                nav_points = nav_soup.find_all('navPoint')
                
                for i, nav_point in enumerate(nav_points):
                    nav_label = nav_point.find('navLabel')
                    content_tag = nav_point.find('content')
                    
                    if nav_label and content_tag:
                        title = nav_label.find('text').get_text().strip()
                        href = content_tag.get('src', '')
                        
                        if href and title:
                            # Extract filename for section type classification
                            original_file_name = href.split('/')[-1]  # Remove path prefix but preserve case
                            file_name_for_classification = original_file_name.lower()  # Only lowercase for classification
                            section_type = "chapter"  # Default type
                            
                            # Determine section type and format title (use lowercase for classification)
                            book_language = detect_book_language(book)
                            section_type = classify_section_type(file_name_for_classification, title, book_language)
                            title = format_chapter_title(title, book_language) if section_type == "chapter" else title
                            
                            toc_data.append({
                                'title': title,
                                'href': original_file_name,  # Use original case for href
                                'id': href.split('#')[0] if '#' in href else href,
                                'order': i,
                                'type': section_type
                            })
            else:
                # Parse HTML navigation
                nav_soup = BeautifulSoup(nav_content, 'html.parser')
                toc_nav = nav_soup.find('nav', {'epub:type': 'toc'}) or nav_soup.find('nav')
                
                if toc_nav:
                    links = toc_nav.find_all('a')
                    for i, link in enumerate(links):
                        href = link.get('href', '')
                        title = link.get_text().strip()
                        if href and title:
                            toc_data.append({
                                'title': title,
                                'href': href,
                                'id': href.split('#')[0] if '#' in href else href,
                                'order': i
                            })
        except Exception as e:
            print(f"Error parsing navigation document: {e}")
            # Fallback to spine order if navigation parsing fails
            print("Falling back to spine order due to navigation parsing error")
            spine_items = [book.get_item_with_id(item_id) for item_id, _ in book.spine]
            for i, item in enumerate(spine_items):
                if item and item.get_type() == ebooklib.ITEM_DOCUMENT:
                    try:
                        content = item.get_content().decode('utf-8')
                        soup = BeautifulSoup(content, 'html.parser')
                        
                        title = None
                        section_type = "chapter"
                        
                        if soup.h1:
                            title = soup.h1.get_text().strip()
                        elif soup.h2:
                            title = soup.h2.get_text().strip()
                        elif soup.title:
                            title_text = soup.title.get_text().strip()
                            if ' - ' in title_text:
                                title = title_text.split(' - ')[-1]
                            else:
                                title = title_text
                        
                        original_file_name = item.get_name()
                        file_name_for_classification = original_file_name.lower()
                        if any(x in file_name_for_classification for x in ['cubierta', 'titulo', 'autor', 'dedicatoria', 'sinopsis', 'info']):
                            section_type = "front_matter"
                        elif 'notas' in file_name_for_classification:
                            section_type = "back_matter"
                        elif file_name_for_classification.startswith('section'):
                            section_type = "chapter"
                            if not title or title == original_file_name:
                                match = re.search(r'section(\d+)', file_name_for_classification)
                                if match:
                                    chapter_num = int(match.group(1))
                                    title = f"Capítulo {chapter_num}"
                                else:
                                    title = f"Capítulo {i + 1}"
                        
                        if not title:
                            title = item.get_name().replace('.xhtml', '').replace('.html', '').title()
                        
                        toc_data.append({
                            'title': title,
                            'href': original_file_name,
                            'id': item.get_id(),
                            'order': i,
                            'type': section_type
                        })
                    except Exception as e2:
                        print(f"Error processing {item.get_name()}: {e2}")
    
    return toc_data

def generate_book_structure(book, toc_data, book_id, document_count):
    """Generate book directory structure and table of contents page"""
    
    # Extract metadata
    title_meta = book.get_metadata('DC', 'title')
    author_meta = book.get_metadata('DC', 'creator')
    
    title = title_meta[0][0] if title_meta else "Unknown Title"
    author = author_meta[0][0] if author_meta else "Unknown Author"
    
    # Count chapters that have formatted chapter titles (e.g., "Chapter X", "Capítulo X")
    chapter_count = len([
        item for item in toc_data 
        if item.get('type') == 'chapter' and 
        any(item.get('title', '').startswith(f"{lang_config['chapter_word']} ") 
            for lang_config in BOOK_CONFIG['languages'].values())
    ])
    
    # Create book directory
    book_dir = os.path.join('book', book_id)
    os.makedirs(book_dir, exist_ok=True)
    
    print(f"Creating book structure in: {book_dir}")
    
    # Generate TOC HTML
    toc_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Table of Contents</title>
    <link rel="stylesheet" href="../../styles/library.css">
    <link rel="stylesheet" href="../../styles/toc.css">
</head>
<body>
    <header class="toc-header">
        <div class="toc-nav">
            <a href="../../index.html" class="btn btn-secondary">← Library</a>
            <div class="book-title">
                <h1>{title}</h1>
                <p>{author}</p>
            </div>
            <div class="reading-stats" id="reading-stats">
                <span id="progress-text">0% complete</span>
            </div>
        </div>
    </header>

    <main class="toc-container">
        <div class="book-cover-section">
            <img src="../../images/cover.jpg" alt="{title} cover" class="toc-book-cover">
            <div class="book-meta">
                <h2>{title}</h2>
                <p class="author">{author}</p>
                <p class="description">Interactive Spanish language learning edition.</p>
                <div class="book-stats-detailed">
                    <div class="stat-item">
                        <span class="stat-number" id="chapter-count">{chapter_count}</span>
                        <span class="stat-label">Chapters</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number" id="word-count">0</span>
                        <span class="stat-label">Words</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number" id="lemma-count">0</span>
                        <span class="stat-label">Lemmas</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="toc-content">
            <h3>Table of Contents</h3>
            <div class="toc-list" id="toc-list">
                <!-- TOC entries will be loaded here -->
            </div>
        </div>
    </main>

    <script>
        // Embedded TOC data
        const tocData = {toc_data};
        const bookId = '{book_id}';
    </script>
    <script src="../../js/toc.js"></script>
</body>
</html>"""
    
    # Write TOC page
    toc_path = os.path.join(book_dir, 'index.html')
    with open(toc_path, 'w', encoding='utf-8') as f:
        f.write(toc_html.replace('{toc_data}', json.dumps(toc_data, ensure_ascii=False, indent=2)))
    
    print(f"Generated table of contents: {toc_path}")
    
    return book_dir

def main():
    # Create necessary directories
    os.makedirs('documents', exist_ok=True)
    os.makedirs('images', exist_ok=True) 
    os.makedirs('styles', exist_ok=True)
    os.makedirs('data', exist_ok=True)
    
    book = epub.read_epub('el_marciano.epub')
    
    print("=== EPUB METADATA ===")
    pprint.pprint({
        'title': book.get_metadata('DC', 'title'),
        'author': book.get_metadata('DC', 'creator'),
        'language': book.get_metadata('DC', 'language'),
        'identifier': book.get_metadata('DC', 'identifier'),
    })
    
    print("\n=== EXTRACTING TABLE OF CONTENTS ===")
    toc_data = extract_toc_data(book)
    print(f"Found {len(toc_data)} TOC entries:")
    for entry in toc_data[:10]:  # Show first 10
        print(f"  {entry['order'] + 1}. {entry['title']} → {entry['href']}")
    
    print("\n=== EPUB ITEMS ===")
    image_count = 0
    document_count = 0
    style_count = 0
    
    for item in book.get_items():
        print(f"ID: {item.get_id()}")
        print(f"Type: {item.get_type()}")
        print(f"File Name: {item.get_name()}")
        print(f"Media Type: {item.media_type}")
        
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            document_count += 1
            content = item.get_content().decode('utf-8')
            print(f"Content Preview (first 200 chars): {content[:200]}")
            
            # Get file name first
            file_name = item.get_name()
            if '/' in file_name:
                file_name = file_name.split('/')[-1]
            
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            
            # Process paragraphs and add word wrapping
            global sentence_counter
            paragraphs = soup.find_all('p')
            
            for p_index, paragraph in enumerate(paragraphs):
                # Create sentence ID and store paragraph metadata
                sentence_id = f"{file_name}_{p_index}"
                paragraph_text = paragraph.get_text()
                
                # Store sentence metadata
                sentences[sentence_id] = {
                    'text': paragraph_text,
                    'file': file_name,
                    'paragraph': p_index,
                    'context': paragraph_text[:100] + ('...' if len(paragraph_text) > 100 else ''),
                    'classes': paragraph.get('class', [])
                }
                
                # Process text nodes in this paragraph
                process_text_nodes(paragraph, sentence_id, file_name)
                sentence_counter += 1
            
            # Add CSS link to head
            if soup.head:
                # Remove existing CSS links first
                for link in soup.head.find_all('link', rel='stylesheet'):
                    link.decompose()
                
                # Add meta charset if missing
                if not soup.head.find('meta', charset=True):
                    meta = soup.new_tag('meta', charset='utf-8')
                    soup.head.insert(0, meta)
                
                # Add title if missing
                if not soup.head.find('title'):
                    title = soup.new_tag('title')
                    title.string = f"El Marciano - {file_name.replace('.xhtml', '').replace('.html', '')}"
                    soup.head.append(title)
                
                # Add CSS links
                css_links = [
                    '../styles/style.css',
                    '../styles/interactive.css', 
                    '../styles/chapter-navigation.css'
                ]
                
                for css_href in css_links:
                    css_link = soup.new_tag('link', rel='stylesheet', type='text/css', href=css_href)
                    soup.head.append(css_link)
            else:
                # Create head if it doesn't exist
                head = soup.new_tag('head')
                
                # Add meta charset
                meta = soup.new_tag('meta', charset='utf-8')
                head.append(meta)
                
                # Add title
                title = soup.new_tag('title')
                title.string = f"El Marciano - {file_name.replace('.xhtml', '').replace('.html', '')}"
                head.append(title)
                
                # Add CSS links
                css_links = [
                    '../styles/style.css',
                    '../styles/interactive.css', 
                    '../styles/chapter-navigation.css'
                ]
                
                for css_href in css_links:
                    css_link = soup.new_tag('link', rel='stylesheet', type='text/css', href=css_href)
                    head.append(css_link)
                
                if soup.html:
                    soup.html.insert(0, head)
            
            # Add JavaScript for interactivity and navigation
            if soup.body:
                # Add word interaction script
                word_script = soup.new_tag('script', src='../js/word-interaction.js')
                soup.body.append(word_script)
                
                # Add chapter navigation script
                nav_script = soup.new_tag('script', src='../js/chapter-navigation.js')
                soup.body.append(nav_script)
            
            # Update content with modified HTML and pretty print
            content = soup.prettify()
            
            if not file_name.endswith('.html') and not file_name.endswith('.xhtml'):
                print(f"Adding .html extension to: {file_name}")
                file_name += '.html'
            
            output_path = os.path.join('documents', file_name)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Exported document: {output_path} (with CSS link added)")
        
        elif item.get_type() == ebooklib.ITEM_IMAGE:
            image_count += 1
            file_name = item.get_name()
            if '/' in file_name:
                file_name = file_name.split('/')[-1]
            
            output_path = os.path.join('images', file_name)
            with open(output_path, 'wb') as f:
                f.write(item.get_content())
            print(f"Exported image: {output_path}")
        
        elif item.get_type() == ebooklib.ITEM_STYLE:
            style_count += 1
            content = item.get_content().decode('utf-8')
            print(f"CSS Preview (first 200 chars): {content[:200]}")
            
            file_name = item.get_name()
            if '/' in file_name:
                file_name = file_name.split('/')[-1]
            
            if not file_name.endswith('.css'):
                print(f"Adding .css extension to: {file_name}")
                file_name += '.css'
            
            output_path = os.path.join('styles', file_name)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Exported stylesheet: {output_path}")
        
        print("-" * 50)
    
    print(f"\n=== SUMMARY ===")
    print(f"Total documents exported: {document_count}")
    print(f"Total images exported: {image_count}")
    print(f"Total stylesheets exported: {style_count}")
    print(f"Total unique words indexed: {len(word_index)}")
    print(f"Total unique lemmas indexed: {len(lemma_index)}")
    print(f"Total sentences processed: {len(sentences)}")
    
    # Export word index and sentence data as JSON
    print(f"\n=== EXPORTING ENHANCED WORD DATA ===")
    
    # Export word index
    with open('data/word_index.json', 'w', encoding='utf-8') as f:
        json.dump(word_index, f, ensure_ascii=False, indent=2)
    print(f"Word index exported to data/word_index.json")
    
    # Export lemma index
    with open('data/lemma_index.json', 'w', encoding='utf-8') as f:
        json.dump(lemma_index, f, ensure_ascii=False, indent=2)
    print(f"Lemma index exported to data/lemma_index.json")
    
    # Export word-to-lemma mapping
    with open('data/word_to_lemma.json', 'w', encoding='utf-8') as f:
        json.dump(word_to_lemma, f, ensure_ascii=False, indent=2)
    print(f"Word-to-lemma mapping exported to data/word_to_lemma.json")
    
    # Export sentences
    with open('data/sentences.json', 'w', encoding='utf-8') as f:
        json.dump(sentences, f, ensure_ascii=False, indent=2)
    print(f"Sentence data exported to data/sentences.json")
    
    # Export word frequency stats
    word_freq = {word: len(occurrences) for word, occurrences in word_index.items()}
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    
    with open('data/word_frequency.json', 'w', encoding='utf-8') as f:
        json.dump(sorted_words, f, ensure_ascii=False, indent=2)
    print(f"Word frequency data exported to data/word_frequency.json")
    
    # Export lemma frequency stats
    lemma_freq = {lemma: len(occurrences) for lemma, occurrences in lemma_index.items()}
    sorted_lemmas = sorted(lemma_freq.items(), key=lambda x: x[1], reverse=True)
    
    with open('data/lemma_frequency.json', 'w', encoding='utf-8') as f:
        json.dump(sorted_lemmas, f, ensure_ascii=False, indent=2)
    print(f"Lemma frequency data exported to data/lemma_frequency.json")
    
    # Export word families (lemma -> all word forms)
    word_families = {}
    for lemma, occurrences in lemma_index.items():
        word_forms = list(set([occ['word'] for occ in occurrences]))
        word_families[lemma] = {
            'forms': word_forms,
            'total_occurrences': len(occurrences),
            'unique_forms': len(word_forms)
        }
    
    with open('data/word_families.json', 'w', encoding='utf-8') as f:
        json.dump(word_families, f, ensure_ascii=False, indent=2)
    print(f"Word families data exported to data/word_families.json")
    
    print(f"\nTop 10 most frequent words:")
    for word, freq in sorted_words[:10]:
        lemma = word_to_lemma.get(word, word)
        print(f"  {word} (lemma: {lemma}): {freq} occurrences")
    
    print(f"\nTop 10 most frequent lemmas:")
    for lemma, freq in sorted_lemmas[:10]:
        family = word_families.get(lemma, {})
        forms_count = family.get('unique_forms', 0)
        print(f"  {lemma}: {freq} occurrences ({forms_count} different forms)")
    
    print(f"\nExample word families:")
    example_families = [(lemma, data) for lemma, data in word_families.items() if data['unique_forms'] > 1][:5]
    for lemma, data in example_families:
        print(f"  {lemma}: {', '.join(data['forms'])}")
    
    # Export table of contents
    with open('data/table_of_contents.json', 'w', encoding='utf-8') as f:
        json.dump(toc_data, f, ensure_ascii=False, indent=2)
    print(f"Table of contents exported to data/table_of_contents.json")
    
    # Generate book structure and TOC page
    print(f"\n=== GENERATING BOOK STRUCTURE ===")
    book_id = generate_book_id(book)
    print(f"Generated book ID: {book_id}")
    book_dir = generate_book_structure(book, toc_data, book_id, document_count)
    print(f"Book structure created successfully in: {book_dir}")


if __name__ == "__main__":
    main()
