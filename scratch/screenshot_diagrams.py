import os
import sys
import time

def run_playwright():
    print("Trying Playwright...")
    from playwright.sync_api import sync_playwright

    html_path = "file:///" + os.path.abspath("ppt_diagrams.html").replace("\\", "/")
    print(f"Opening: {html_path}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 2000})
        page.goto(html_path)
        
        # Wait for charts/animations
        time.sleep(3)
        
        # Find all diagram sections
        sections = page.query_selector_all(".diagram-section")
        print(f"Found {len(sections)} sections")
        
        output_dir = os.path.abspath("../../brain/28b2779c-8b74-4aa5-b584-16255cfb1292")
        os.makedirs(output_dir, exist_ok=True)
        
        for i, section in enumerate(sections, 1):
            h2 = section.query_selector("h2")
            title = f"diagram_{i}"
            if h2:
                text = h2.inner_text().strip().lower().replace(" ", "_").replace("/", "_").replace("\\", "_")
                # Remove section number prefix
                if "slide" in text:
                    text = "_".join(text.split("_")[2:])
                title = f"diagram_{i}_{text}"
            
            box = section.query_selector(".diagram-box")
            if box:
                screenshot_path = os.path.join(output_dir, f"{title}.png")
                box.screenshot(path=screenshot_path)
                print(f"Saved: {screenshot_path}")
            
        browser.close()

def run_selenium():
    print("Trying Selenium...")
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.edge.options import Options as EdgeOptions
    
    html_path = "file:///" + os.path.abspath("ppt_diagrams.html").replace("\\", "/")
    print(f"Opening: {html_path}")
    
    options = EdgeOptions()
    options.add_argument("--headless")
    options.add_argument("--window-size=1400,3000")
    
    driver = webdriver.Edge(options=options)
    try:
        driver.get(html_path)
        time.sleep(3)
        
        sections = driver.find_elements(By.CLASS_NAME, "diagram-section")
        print(f"Found {len(sections)} sections")
        
        output_dir = os.path.abspath("../../brain/28b2779c-8b74-4aa5-b584-16255cfb1292")
        os.makedirs(output_dir, exist_ok=True)
        
        for i, section in enumerate(sections, 1):
            h2 = section.find_element(By.TAG_NAME, "h2")
            title = f"diagram_{i}"
            if h2:
                text = h2.text.strip().lower().replace(" ", "_").replace("/", "_").replace("\\", "_")
                if "slide" in text:
                    text = "_".join(text.split("_")[2:])
                title = f"diagram_{i}_{text}"
                
            box = section.find_element(By.CLASS_NAME, "diagram-box")
            if box:
                screenshot_path = os.path.join(output_dir, f"{title}.png")
                box.screenshot(screenshot_path)
                print(f"Saved: {screenshot_path}")
    finally:
        driver.quit()

if __name__ == "__main__":
    try:
        run_playwright()
    except Exception as e:
        print(f"Playwright failed: {e}")
        try:
            run_selenium()
        except Exception as se:
            print(f"Selenium failed: {se}")
            sys.exit(1)
