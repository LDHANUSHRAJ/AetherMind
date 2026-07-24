import os
import time
from playwright.sync_api import sync_playwright

def capture_complex_diagram():
    html_path = "file:///" + os.path.abspath("professional_diagrams.html").replace("\\", "/")
    output_dir = os.path.abspath("../../brain/28b2779c-8b74-4aa5-b584-16255cfb1292")
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Opening {html_path}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Make the viewport wide enough to fit the large multi-column grid
        page = browser.new_page(viewport={"width": 1450, "height": 1000})
        page.goto(html_path)
        
        # Wait a moment for page layout
        time.sleep(1)
        
        # Screenshot system architecture
        arch_box = page.query_selector("#complex-system-architecture")
        if arch_box:
            path = os.path.join(output_dir, "aethermind_complex_architecture.png")
            arch_box.screenshot(path=path)
            print(f"Saved: {path}")
            
        browser.close()

if __name__ == "__main__":
    capture_complex_diagram()
