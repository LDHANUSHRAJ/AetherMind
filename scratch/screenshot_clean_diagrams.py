import os
import time
from playwright.sync_api import sync_playwright

def capture_clean_diagrams():
    html_path = "file:///" + os.path.abspath("professional_diagrams.html").replace("\\", "/")
    output_dir = os.path.abspath("../../brain/28b2779c-8b74-4aa5-b584-16255cfb1292")
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Opening {html_path}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1300, "height": 1800})
        page.goto(html_path)
        
        # Wait a moment for page layout
        time.sleep(1)
        
        # Screenshot system architecture
        arch_box = page.query_selector("#system-architecture")
        if arch_box:
            path = os.path.join(output_dir, "aethermind_system_architecture.png")
            arch_box.screenshot(path=path)
            print(f"Saved: {path}")
            
        # Screenshot database schema
        db_box = page.query_selector("#database-schema")
        if db_box:
            path = os.path.join(output_dir, "aethermind_database_schema.png")
            db_box.screenshot(path=path)
            print(f"Saved: {path}")
            
        browser.close()

if __name__ == "__main__":
    capture_clean_diagrams()
