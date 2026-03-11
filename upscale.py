import re
import os

files_to_modify = [
    r"c:\Users\USUÁRIO\Desktop\NEXUS\nexushmsj\src\modules\eletivas\components\GestaoAihs.jsx",
    r"c:\Users\USUÁRIO\Desktop\NEXUS\nexushmsj\src\modules\Eletivas\components\CadastroSolicitacoes.jsx",
    r"c:\Users\USUÁRIO\Desktop\NEXUS\nexushmsj\src\modules\TelemonitoramentoAVC\components\DashboardAVC.jsx",
    r"c:\Users\USUÁRIO\Desktop\NEXUS\nexushmsj\src\modules\TelemonitoramentoAVC\components\FormAcolhimento.jsx",
    r"c:\Users\USUÁRIO\Desktop\NEXUS\nexushmsj\src\modules\TelemonitoramentoAVC\components\FormCadastro.jsx"
]

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Inputs/Selects/Textareas should be text-base at min
    # We find tags <input, <select, <textarea and inside their className replace text-xs or text-sm with text-base
    def replace_input_text(match):
        tag_content = match.group(0)
        # Inside this tag string, we replace text-sm and text-xs with text-base
        tag_content = re.sub(r'\btext-sm\b', 'text-base', tag_content)
        tag_content = re.sub(r'\btext-xs\b', 'text-base', tag_content)
        return tag_content
        
    content = re.sub(r'<(?:input|select|textarea)[^>]+className="[^"]+"[^>]*>', replace_input_text, content)

    # 2. Labels generally should go from text-xs to text-sm, text-sm to text-base
    def replace_label_text(match):
        tag_content = match.group(0)
        tag_content = re.sub(r'\btext-sm\b', 'text-base', tag_content)
        tag_content = re.sub(r'\btext-xs\b', 'text-sm', tag_content)
        return tag_content
        
    content = re.sub(r'<label[^>]+className="[^"]+"[^>]*>', replace_label_text, content)

    # 3. Tables (th, td) text-xs -> text-sm, text-sm -> text-base
    # Except if they contain 'rounded-full' or 'px-1' or 'px-2' which are badges
    def replace_td_th_text(match):
        tag_content = match.group(0)
        if 'rounded' in tag_content and ('bg-' in tag_content or 'border' in tag_content):
            return tag_content # likely a badge inside a td/th though rarely applied directly to td, but just in case
        tag_content = re.sub(r'\btext-sm\b', 'text-base', tag_content)
        tag_content = re.sub(r'\btext-xs\b', 'text-sm', tag_content)
        return tag_content

    content = re.sub(r'<(?:td|th|thead)[^>]*className="[^"]+"[^>]*>', replace_td_th_text, content)

    # 4. Paragraphs and Spans and Divs (Normal text reading) -> text-sm to text-base, text-xs to text-sm
    # Let's target specific text phrases that aren't badges
    # A badge usually has 'rounded' and 'px-'.
    def replace_general_text(match):
        tag_content = match.group(0)
        # Check if it's a badge
        if re.search(r'\brounded-(?:full|md|lg|xl)\b', tag_content) and re.search(r'\bbg-[a-z]+-\d+\b', tag_content) and re.search(r'\b(text-xs|text-\[10px\])\b', tag_content):
            # It's a badge, skip replacing text-xs or text-sm
            return tag_content
            
        # Exception for badges like 'animate-pulse' or pílulas
        if 'pílula' in tag_content.lower() or 'badge' in tag_content.lower():
            return tag_content

        tag_content = re.sub(r'\btext-sm\b', 'text-base', tag_content)
        tag_content = re.sub(r'\btext-xs\b', 'text-sm', tag_content)
        return tag_content
        
    content = re.sub(r'<(?:p|span|div|h[1-6]|button|a)[^>]+className="[^"]+"[^>]*>', replace_general_text, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Processed: {filepath}")

for path in files_to_modify:
    process_file(path)

print("Upscale typography complete.")
